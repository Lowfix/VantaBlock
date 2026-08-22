import { db } from "./db.js";
import * as pterodactyl from "./pterodactyl.js";
import * as cloudflare from "./cloudflare.js";
import * as relay from "./relay.js";
import type { PlanLimits } from "./plans.js";
import type { ServerTypeConfig } from "./serverTypes.js";
import { BILLING_PERIOD_DAYS, daysFromNow } from "./billingConstants.js";
import { decryptClientKey } from "./secretCrypto.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/**
 * Picks a free subdomain slug for this server *and writes it to the row in the
 * same step*, so the unique index — not a stale SELECT from several awaits ago —
 * decides who gets a contested name. Two servers deployed simultaneously with
 * the same name previously both resolved to the same slug (nothing had claimed
 * it yet), so whichever wrote DNS last silently repointed the other's record at
 * its own port. Throws if every candidate is taken.
 */
function claimSubdomain(name: string, identifier: string): string {
  const base = slugify(name).length >= 3 ? slugify(name) : `mc-${identifier}`;
  for (let suffix = 1; suffix <= 50; suffix++) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`.slice(0, 32);
    try {
      const info = db
        .prepare("UPDATE servers SET subdomain = ?, subdomain_relayed = 0 WHERE pterodactyl_identifier = ?")
        .run(candidate, identifier);
      if (info.changes === 0) throw new Error(`No local row for ${identifier} to attach a subdomain to.`);
      return candidate;
    } catch (err) {
      // SQLITE_CONSTRAINT_UNIQUE — somebody else holds this slug; try the next.
      const message = err instanceof Error ? err.message : String(err);
      if (!/UNIQUE constraint failed/i.test(message)) throw err;
    }
  }
  throw new Error(`Could not find a free subdomain for "${name}".`);
}

type ProvisionInput = {
  userId: number;
  ownerId: number;
  clientKey: string;
  name: string;
  plan: PlanLimits;
  serverType: ServerTypeConfig;
  version: string;
  generateSubdomain: boolean;
};

/**
 * Picking a free allocation and claiming it are two separate API calls, and
 * nothing in between stops a second deploy from reading the same "free" port.
 * Measured live: four simultaneous deploys all picked allocation id 10, one
 * create won and the other three came back as a bare Pterodactyl 500 ("An
 * unexpected error was encountered while processing this request") — three
 * failed deploys with eight ports still free. Serializing just the pick→create
 * window (fast: one create call, well under a second) removes the collision
 * entirely; everything slow about a deploy — the actual install — still runs
 * concurrently in the background.
 */
let deployQueue: Promise<unknown> = Promise.resolve();

function withAllocationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = deployQueue.then(fn, fn);
  // Never let one deploy's failure reject the next one's turn in the queue.
  deployQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** An error worth trying the next free port for, rather than giving up on. */
function isAllocationConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /allocation/i.test(message) ||
    // Panel's generic 500 — what a create/create collision inside Panel itself
    // looks like from out here.
    /unexpected error was encountered/i.test(message)
  );
}

async function createOnAFreePort(input: ProvisionInput): Promise<{ id: number; identifier: string }> {
  const candidates = await pterodactyl.listFreeAllocationIds(4);
  if (candidates.length === 0) {
    throw new Error("No ports are available to allocate right now — try again later.");
  }

  let lastError: unknown;
  for (const allocationId of candidates) {
    try {
      return await pterodactyl.createServerForOwner({
        name: input.name,
        ownerId: input.ownerId,
        allocationId,
        memory: input.plan.ramMb,
        disk: input.plan.diskMb,
        cpu: input.plan.cpuPercent,
        eggId: input.serverType.eggId,
        dockerImage: input.serverType.dockerImage,
        startup: input.serverType.startup,
        environment: input.serverType.environment(input.version),
      });
    } catch (err) {
      // Anything that isn't about the port (a bad egg id, an unknown user) will
      // fail identically on every other port — surface it immediately instead of
      // burning three more API calls to say the same thing.
      if (!isAllocationConflict(err)) throw err;
      lastError = err;
      console.warn(`[provisioning] allocation ${allocationId} was not usable, trying the next free port:`, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to claim a port for the new server.");
}

/**
 * Creates a real Pterodactyl server for the given (already-mirrored) owner and
 * returns as soon as the Application API accepts the request. The install
 * itself (downloading the server jar, accepting the EULA, and starting it)
 * keeps running in the background — the caller can poll the regular
 * server-list/detail endpoints to see it come online.
 */
export async function provisionServer(input: ProvisionInput): Promise<{ identifier: string }> {
  const created = await withAllocationLock(() => createOnAFreePort(input));

  try {
    db.prepare(
      `INSERT INTO servers (user_id, pterodactyl_identifier, pterodactyl_id, plan_id, server_type, name, status, next_bill_at)
       VALUES (?, ?, ?, ?, ?, ?, 'installing', ?)`
    ).run(
      input.userId,
      created.identifier,
      created.id,
      input.plan.id,
      input.serverType.id,
      input.name,
      daysFromNow(BILLING_PERIOD_DAYS)
    );
  } catch (err) {
    // The real server exists but this app has no record of it — nothing would
    // ever show it to its owner again, and `reconcileServers()` only cleans up
    // the opposite drift (local row, no real server), so it would sit on the
    // node holding RAM, disk and a port forever. Undo the half-done deploy.
    console.warn(`[provisioning] local row for ${created.identifier} failed to save — deleting the orphaned server:`, err);
    await pterodactyl.deleteApplicationServer(created.id).catch((deleteErr) => {
      console.error(
        `[provisioning] ORPHAN: Pterodactyl server ${created.id} (${created.identifier}) has no local row and could not be deleted:`,
        deleteErr
      );
    });
    throw err;
  }

  finishProvisioning(created.id, created.identifier, input.clientKey, input.name, input.generateSubdomain).catch((err) => {
    console.warn(`[provisioning] ${created.identifier} failed to finish provisioning:`, err);
    db.prepare("UPDATE servers SET status = 'failed' WHERE pterodactyl_identifier = ?").run(created.identifier);
  });

  return { identifier: created.identifier };
}

/**
 * A deploy's install watcher only lives in memory, so an API restart (or crash)
 * mid-install leaves that server stuck on `status = 'installing'` forever —
 * `reconcileServers()` won't touch it, because the real server does exist. Pick
 * those back up at boot. The original "also generate a subdomain" choice isn't
 * recorded anywhere, so a resumed install skips that step; the owner can still
 * set one from the Subdomain tab.
 */
export function resumeInterruptedProvisioning(): void {
  const rows = db
    .prepare(
      `SELECT s.pterodactyl_identifier AS identifier, s.pterodactyl_id AS serverId, s.name AS name,
              u.pterodactyl_client_key AS clientKey
         FROM servers s
         JOIN users u ON u.id = s.user_id
        WHERE s.status = 'installing'`
    )
    .all() as { identifier: string; serverId: number | null; name: string; clientKey: string | null }[];

  for (const row of rows) {
    if (!row.serverId || !row.clientKey) {
      console.warn(`[provisioning] ${row.identifier} is stuck installing but can't be resumed (no server id / client key).`);
      continue;
    }
    console.log(`[provisioning] resuming interrupted install for ${row.identifier}`);
    finishProvisioning(row.serverId, row.identifier, decryptClientKey(row.clientKey), row.name, false).catch((err) => {
      console.warn(`[provisioning] ${row.identifier} failed to finish provisioning after resume:`, err);
      db.prepare("UPDATE servers SET status = 'failed' WHERE pterodactyl_identifier = ?").run(row.identifier);
    });
  }
}

async function finishProvisioning(
  serverId: number,
  identifier: string,
  clientKey: string,
  name: string,
  generateSubdomain: boolean
): Promise<void> {
  const deadline = Date.now() + 5 * 60 * 1000;
  let installed = false;
  while (Date.now() < deadline) {
    await sleep(5000);
    try {
      if (await pterodactyl.isServerInstalled(serverId)) {
        installed = true;
        break;
      }
    } catch (err) {
      // A throttled or briefly-unreachable Panel used to abort the whole watch
      // and mark a server 'failed' that was installing perfectly well — one bad
      // poll out of sixty shouldn't condemn a real server. Keep polling until
      // the deadline instead. A server that's genuinely gone is the exception:
      // no amount of waiting brings it back.
      const message = err instanceof Error ? err.message : String(err);
      if (/could not be found/i.test(message)) throw err;
      console.warn(`[provisioning] ${identifier} install poll failed (will retry):`, message);
    }
  }
  if (!installed) {
    throw new Error("Install did not complete within the expected time.");
  }

  // Every Mojang-derived server (Vanilla/Paper/Forge) refuses to boot until the
  // EULA is accepted — do that for the user now so it's one less step later,
  // but leave the server stopped: it shouldn't start consuming resources (or
  // show up as "online") until the user actually chooses to start it.
  // Best-effort: a real, fully-installed server shouldn't be reported as a
  // failed deploy just because one file write got throttled — Minecraft will
  // write its own eula.txt on first boot, and the Files tab can fix it too.
  let eulaWritten = false;
  for (let attempt = 0; attempt < 3 && !eulaWritten; attempt++) {
    try {
      await pterodactyl.writeFile(clientKey, identifier, "eula.txt", "eula=true\n");
      eulaWritten = true;
    } catch (err) {
      console.warn(`[provisioning] ${identifier} eula.txt write attempt ${attempt + 1} failed:`, err);
      await sleep(3000);
    }
  }
  if (!eulaWritten) {
    console.warn(`[provisioning] ${identifier} could not write eula.txt — the server will need it accepted before it boots.`);
  }

  if (generateSubdomain) {
    let claimed: string | null = null;
    try {
      const allocations = await pterodactyl.listAllocations(clientKey, identifier);
      const primary = allocations.find((a) => a.is_default) ?? allocations[0];
      if (primary) {
        // Claim the slug in the DB *before* touching DNS. Picking a name by
        // querying and then writing it several awaits later let two servers
        // deployed at the same moment under the same name both settle on the
        // same slug: the first one's DNS record would be silently repointed at
        // the second one's port, and only the losing UPDATE would fail (on the
        // unique index) — a cross-customer misroute reported as nothing worse
        // than a warning. Claiming first makes the unique index the arbiter
        // before any external state exists.
        const slug = claimSubdomain(name, identifier);
        claimed = slug;
        // Same relay-aware routing as a manual subdomain save: use the relay
        // (and point DNS at it) when this node has a tunnel, otherwise fall
        // back to the direct home-IP path.
        const relayBackendIp = relay.isRelayConfigured()
          ? await pterodactyl.getNodeRelayAddress(serverId).catch(() => null)
          : null;
        if (relayBackendIp) {
          await relay.upsertRelayRoute(slug, primary.port, relayBackendIp);
        }
        const dnsTargetIp = relayBackendIp ? relay.getRelayPublicIp() ?? undefined : undefined;
        await cloudflare.upsertMinecraftSubdomain(slug, primary.port, dnsTargetIp);
        db.prepare("UPDATE servers SET subdomain_relayed = ? WHERE pterodactyl_identifier = ?").run(
          relayBackendIp ? 1 : 0,
          identifier
        );
      }
    } catch (err) {
      // Non-fatal — the user can still set one manually from the Subdomain tab.
      // Release the claim so the name isn't held by a server that has no DNS
      // record behind it (and so a retry from the Subdomain tab can reuse it).
      if (claimed) {
        db.prepare(
          "UPDATE servers SET subdomain = NULL, subdomain_relayed = 0 WHERE pterodactyl_identifier = ? AND subdomain = ?"
        ).run(identifier, claimed);
      }
      console.warn(`[provisioning] ${identifier} failed to auto-create a subdomain:`, err);
    }
  }

  db.prepare("UPDATE servers SET status = 'ready' WHERE pterodactyl_identifier = ?").run(identifier);
}
