import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import multer from "multer";
import { db } from "../db.js";
import type { UserRow, ServerRow, ServerPluginRow } from "../db.js";
import { requireAuth } from "../auth.js";
import * as pterodactyl from "../pterodactyl.js";
import * as cloudflare from "../cloudflare.js";
import * as relay from "../relay.js";
import { getMinecraftPlayerStatus } from "../minecraftStatus.js";
import { findPlan, customPlanLimits, freePlan } from "../plans.js";
import { SERVER_TYPES, findServerType } from "../serverTypes.js";
import { deployAndCharge } from "../deployCharge.js";
import { isAdminUser } from "../adminGate.js";
import { logActivity } from "../activityLog.js";
import { isFeatureEnabled } from "../featureFlags.js";
import * as plugins from "../plugins.js";
import { decryptClientKey } from "../secretCrypto.js";

export const serversRouter = Router();
serversRouter.use(requireAuth);

const stateMap: Record<string, "online" | "offline" | "starting" | "stopping"> = {
  running: "online",
  starting: "starting",
  stopping: "stopping",
  offline: "offline",
};

function pterodactylErrorStatus(message: string): number {
  if (message.includes("has not yet completed its installation")) return 503;
  // Panel's own client API rate-limits repeated calls (e.g. minting a fresh
  // websocket token) with Laravel's default throttle response, verbatim
  // "Too Many Attempts." — confirmed via a real concurrent-load test against
  // GET .../console (2026-08-21 DEVLOG entry). Surfacing this as a generic
  // 502 makes a transient, self-clearing throttle look identical to "the
  // whole Pterodactyl integration is broken," which isn't true and isn't
  // actionable for a client deciding whether to retry.
  if (message.includes("Too Many Attempts")) return 429;
  // `getFileContents`/`getFileContentsBinary` throw "Could not read X (404)."
  // for a file that genuinely doesn't exist (e.g. a fresh server that's never
  // had a player whitelisted/opped/banned yet, so whitelist.json/ops.json/
  // banned-players.json aren't there) — a normal, expected case for callers
  // like PlayersTab.tsx to distinguish from a real upstream failure, not
  // something that should collapse into the same generic 502 as everything
  // else. Passing the real status through only for 404 specifically, not
  // remapping every Pterodactyl status code, since that's the one case with
  // a known, safe, "this just means empty" client-side interpretation.
  if (/\(404\)\.?$/.test(message)) return 404;
  // Panel accepted the connection and then never answered within the budget
  // pterodactyl.ts sets (see PANEL_TIMEOUT_MESSAGE). 504 rather than 502 so
  // "the panel is slow/wedged" is distinguishable from "the panel answered and
  // refused" in logs and in anything alerting on 5xx — before this had a
  // timeout at all, the same request would have sat open for 305s.
  if (message === pterodactyl.PANEL_TIMEOUT_MESSAGE) return 504;
  return 502;
}

function getClientKey(req: Request): string | null {
  const userId = (req as Request & { userId: number }).userId;
  const user = db.prepare("SELECT pterodactyl_client_key FROM users WHERE id = ?").get(userId) as
    | Pick<UserRow, "pterodactyl_client_key">
    | undefined;
  return decryptClientKey(user?.pterodactyl_client_key ?? null);
}


interface AuthedRequest extends Request {
  clientKey: string;
  userId: number;
  params: Record<string, string>;
}

function requireClientKey(req: Request, res: Response, next: NextFunction) {
  const clientKey = getClientKey(req);
  if (!clientKey) {
    res.status(404).json({ error: "No Pterodactyl account is linked to this user yet." });
    return;
  }
  (req as AuthedRequest).clientKey = clientKey;
  next();
}

function handle(fn: (req: AuthedRequest, res: Response) => Promise<void>) {
  return async (req: Request, res: Response) => {
    try {
      await fn(req as AuthedRequest, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reach Pterodactyl.";
      res.status(pterodactylErrorStatus(message)).json({ error: message });
    }
  };
}

// Coalesces concurrent identical work by key — a second caller asking for
// the same key while the first is still in flight awaits that SAME promise
// instead of starting a redundant one. Confirmed necessary by a real load
// test (2026-08-21 DEVLOG entry): many concurrent GET / requests for the
// same user (several open tabs each polling every 3s can easily overlap)
// each independently hit Panel's API, and a synchronized burst of ~200 drove
// Panel's own capacity to become the real bottleneck (36.5% failure rate).
// This only coalesces requests already concurrently in flight — it never
// serves stale data, since the in-flight entry is cleared the moment that
// fetch settles, so the next poll a few seconds later always starts fresh.
const inFlight = new Map<string, Promise<unknown>>();

function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

serversRouter.get("/", async (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const clientKey = getClientKey(req);
  if (!clientKey) {
    res.json([]);
    return;
  }

  try {
    const withStats = await coalesce(`servers:${userId}`, async () => {
      const servers = await pterodactyl.listClientServers(clientKey);
      const localRows = db.prepare("SELECT * FROM servers WHERE user_id = ?").all(userId) as ServerRow[];
      const localByIdentifier = new Map(localRows.map((r) => [r.pterodactyl_identifier, r]));

      return Promise.all(
        servers.map(async (s) => {
          const local = localByIdentifier.get(s.identifier);
          const base = {
            identifier: s.identifier,
            name: s.name,
            ramAllocated: Math.round(s.limits.memory / 1024),
            diskAllocated: Math.round(s.limits.disk / 1024),
            planId: local?.plan_id ?? null,
            serverType: local?.server_type ?? "paper",
            billingStatus: local?.billing_status ?? "active",
            nextBillAt: local?.next_bill_at ?? null,
            gracePeriodEndsAt: local?.grace_period_ends_at ?? null,
          };

          if (local?.status === "installing") {
            return { ...base, status: "starting" as const, cpuUsed: 0, ramUsed: 0, diskUsed: 0 };
          }
          if (local?.status === "failed") {
            return { ...base, status: "offline" as const, cpuUsed: 0, ramUsed: 0, diskUsed: 0 };
          }
          try {
            const resources = await pterodactyl.getServerResources(clientKey, s.identifier);
            const { current_state, resources: usage } = resources.attributes;
            return {
              ...base,
              status: stateMap[current_state] ?? "offline",
              cpuUsed: Math.round(usage.cpu_absolute),
              ramUsed: Number((usage.memory_bytes / 1024 / 1024 / 1024).toFixed(2)),
              diskUsed: Number((usage.disk_bytes / 1024 / 1024 / 1024).toFixed(2)),
            };
          } catch {
            // Not installed yet on Pterodactyl's side, or transiently unreachable.
            return { ...base, status: "starting" as const, cpuUsed: 0, ramUsed: 0, diskUsed: 0 };
          }
        })
      );
    });

    res.json(withStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach Pterodactyl.";
    res.status(pterodactylErrorStatus(message)).json({ error: message });
  }
});

serversRouter.get("/types", (_req, res) => {
  res.json({
    types: SERVER_TYPES.map((t) => ({ id: t.id, name: t.name, description: t.description })),
  });
});

serversRouter.post("/", async (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const user = db
    .prepare("SELECT pterodactyl_user_id, pterodactyl_client_key FROM users WHERE id = ?")
    .get(userId) as Pick<UserRow, "pterodactyl_user_id" | "pterodactyl_client_key"> | undefined;

  if (!user?.pterodactyl_user_id || !user.pterodactyl_client_key) {
    res.status(400).json({ error: "Your account isn't linked to Pterodactyl yet. Try logging out and back in." });
    return;
  }
  const clientKey = decryptClientKey(user.pterodactyl_client_key);

  const { name, planId, ramMb, diskMb, cpuPercent, serverTypeId, version, generateSubdomain } = req.body ?? {};
  const shouldGenerateSubdomain = generateSubdomain !== false;
  const serverType = typeof serverTypeId === "string" ? findServerType(serverTypeId) : undefined;
  const resolvedVersion = typeof version === "string" && version.trim() ? version.trim() : "latest";
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "A server name is required." });
    return;
  }
  if (!serverType) {
    res.status(400).json({ error: "Choose a valid server type." });
    return;
  }

  // The admin always deploys immediately. Everyone else needs approval — see
  // server/routes/requests.ts — unless the owner has turned that requirement
  // off entirely, in which case customers deploy instantly too.
  const requiresApproval = !isAdminUser(userId) && isFeatureEnabled("require_server_approval");
  if (requiresApproval) {
    if (!isFeatureEnabled("server_requests")) {
      res.status(403).json({ error: "New server requests are paused right now — check back later." });
      return;
    }
    const requestedPlan = typeof planId === "string" ? findPlan(planId) : undefined;
    if (!requestedPlan) {
      res.status(400).json({ error: "Choose a valid plan." });
      return;
    }
    // The owner can still downgrade this at accept time — this is just what
    // the customer asked for.
    const info = db
      .prepare(
        `INSERT INTO server_requests (user_id, name, plan_id, server_type_id, version, generate_subdomain)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(userId, name.trim(), requestedPlan.id, serverType.id, resolvedVersion, shouldGenerateSubdomain ? 1 : 0);
    res.status(202).json({ requestId: info.lastInsertRowid, status: "pending" });
    return;
  }

  // Instant deploy — the admin's own server, with RAM/disk/CPU picked directly
  // in the UI, or a customer deploy with approval turned off entirely (in
  // which case they still picked a plan in the UI, same as a request would
  // have used). Either way this is free — plan price is zeroed at deploy time.
  const plan = isAdminUser(userId)
    ? customPlanLimits(Number(ramMb) || 0, Number(diskMb) || 0, Number(cpuPercent) || 0)
    : (() => {
        const p = typeof planId === "string" ? findPlan(planId) : undefined;
        return p ? freePlan(p) : undefined;
      })();
  if (!plan) {
    res.status(400).json({ error: isAdminUser(userId) ? "Enter valid RAM/disk/CPU values." : "Choose a valid plan." });
    return;
  }
  if (isAdminUser(userId) && (plan.ramMb < 512 || plan.diskMb < 1024 || plan.cpuPercent < 25)) {
    res.status(400).json({ error: "Enter a valid RAM (512+ MB), disk (1024+ MB), and CPU (25%+) allocation." });
    return;
  }

  try {
    const created = await deployAndCharge({
      userId,
      ownerId: user.pterodactyl_user_id,
      clientKey,
      name: name.trim(),
      plan,
      serverType,
      version: resolvedVersion,
      generateSubdomain: shouldGenerateSubdomain,
    });
    res.status(202).json({ identifier: created.identifier, status: "deploying" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to deploy server.";
    res.status(pterodactylErrorStatus(message)).json({ error: message });
  }
});

serversRouter.use("/:identifier", requireClientKey);

// ---------------------------------------------------------------------------
// Overview / power / console
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier",
  handle(async (req, res) => {
    const [details, resources, allocations] = await Promise.all([
      pterodactyl.getServerDetails(req.clientKey, req.params.identifier),
      pterodactyl.getServerResources(req.clientKey, req.params.identifier),
      pterodactyl.listAllocations(req.clientKey, req.params.identifier).catch(() => []),
    ]);
    const { current_state, resources: usage } = resources.attributes;

    const primary = allocations.find((a) => a.is_default) ?? allocations[0];
    const port = primary?.port ?? pterodactyl.LIVE_SERVER_PORT;

    // The live Minecraft ping has to hit the Wings node actually running the
    // container — the Panel's own address (the old, wrong default here) has
    // nothing listening on that port, which silently zeroed out player counts.
    const nodeAddress = await pterodactyl.getNodeAddress(details.internalId).catch(() => null);
    const players = nodeAddress ? await getMinecraftPlayerStatus(nodeAddress, port).catch(() => null) : null;

    const local = db
      .prepare("SELECT billing_status, next_bill_at, grace_period_ends_at FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "billing_status" | "next_bill_at" | "grace_period_ends_at"> | undefined;

    // Player-facing direct-connect address: the relay's public IP whenever this
    // server's node is relay-capable — checked live against the node itself,
    // never against whether a subdomain happens to exist yet, so there's no
    // window (e.g. while a server is still installing) where this falls back
    // to the home IP just because a subdomain hasn't been created yet. If the
    // relay lookup itself fails, fail closed (hide the address) rather than
    // risk exposing the home IP — the direct-IP fallback only applies once
    // we've positively confirmed this node has no relay entry at all.
    let ip: string | null = null;
    try {
      const relayBackendIp = await pterodactyl.getNodeRelayAddress(details.internalId);
      ip = relayBackendIp ? relay.getRelayPublicIp() : cloudflare.PUBLIC_IP || null;
    } catch {
      ip = null;
    }

    res.json({
      identifier: req.params.identifier,
      status: stateMap[current_state] ?? "offline",
      cpuUsed: Math.round(usage.cpu_absolute),
      ramUsed: Number((usage.memory_bytes / 1024 / 1024 / 1024).toFixed(2)),
      diskUsed: Number((usage.disk_bytes / 1024 / 1024 / 1024).toFixed(2)),
      uptimeMs: usage.uptime,
      ip,
      port,
      playersOnline: players?.online ?? 0,
      playersMax: players?.max ?? 0,
      playerNames: players?.names ?? [],
      billingStatus: local?.billing_status ?? "active",
      nextBillAt: local?.next_bill_at ?? null,
      gracePeriodEndsAt: local?.grace_period_ends_at ?? null,
    });
  })
);

serversRouter.delete(
  "/:identifier",
  handle(async (req, res) => {
    const localRow = db
      .prepare("SELECT * FROM servers WHERE pterodactyl_identifier = ? AND user_id = ?")
      .get(req.params.identifier, req.userId) as ServerRow | undefined;
    if (!localRow) {
      res.status(404).json({ error: "Server not found." });
      return;
    }

    const details = await pterodactyl.getServerDetails(req.clientKey, req.params.identifier);
    await pterodactyl.deleteApplicationServer(details.internalId);

    if (localRow.subdomain) {
      await cloudflare.deleteMinecraftSubdomain(localRow.subdomain).catch(() => {});
      await relay.removeRelayRoute(localRow.subdomain).catch(() => {});
    }

    db.prepare("DELETE FROM server_plugins WHERE server_identifier = ?").run(req.params.identifier);
    db.prepare("DELETE FROM servers WHERE id = ?").run(localRow.id);

    const owner = db.prepare("SELECT username FROM users WHERE id = ?").get(req.userId) as
      | Pick<UserRow, "username">
      | undefined;
    logActivity("server_deleted", "server", `${owner?.username ?? "A user"} deleted "${localRow.name}"`);

    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/power",
  handle(async (req, res) => {
    const { action } = req.body ?? {};
    if (action !== "start" && action !== "stop" && action !== "restart" && action !== "kill") {
      res.status(400).json({ error: "Invalid power action." });
      return;
    }
    await pterodactyl.sendPowerAction(req.clientKey, req.params.identifier, action);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/command",
  handle(async (req, res) => {
    const { command } = req.body ?? {};
    if (!command || typeof command !== "string") {
      res.status(400).json({ error: "A command is required." });
      return;
    }
    await pterodactyl.sendCommand(req.clientKey, req.params.identifier, command);
    res.status(204).end();
  })
);

serversRouter.get(
  "/:identifier/console/history",
  async (req, res) => {
    const clientKey = getClientKey(req);
    if (!clientKey) {
      res.status(404).json({ error: "No Pterodactyl account is linked to this user yet." });
      return;
    }
    try {
      const lines = await pterodactyl.getConsoleHistory(clientKey, req.params.identifier);
      res.json({ lines });
    } catch {
      // No log file yet (server never started) or unreadable — not fatal, the live
      // console will still work fine starting from an empty buffer.
      res.json({ lines: [] });
    }
  }
);

serversRouter.get(
  "/:identifier/console",
  handle(async (req, res) => {
    const creds = await pterodactyl.getWebsocketCredentials(req.clientKey, req.params.identifier);
    res.json(creds.data);
  })
);

serversRouter.patch(
  "/:identifier/plan",
  handle(async (req, res) => {
    if (!isAdminUser(req.userId)) {
      res.status(403).json({ error: "Changing plans is invite-only right now. Reach out if you'd like access." });
      return;
    }

    const { planId } = req.body ?? {};
    const plan = typeof planId === "string" ? findPlan(planId) : undefined;
    if (!plan) {
      res.status(400).json({ error: "Choose a valid plan." });
      return;
    }

    const existingRow = db
      .prepare("SELECT plan_id FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "plan_id"> | undefined;
    const oldPlan = existingRow ? findPlan(existingRow.plan_id) : undefined;
    const priceDiff = plan.price - (oldPlan?.price ?? 0);

    if (priceDiff > 0) {
      const userRow = db.prepare("SELECT balance FROM users WHERE id = ?").get(req.userId) as
        | Pick<UserRow, "balance">
        | undefined;
      if (!userRow || userRow.balance < priceDiff) {
        res.status(402).json({
          error: `Insufficient balance — this upgrade costs $${priceDiff.toFixed(2)} more. Add funds in Bank first.`,
        });
        return;
      }
    }

    const details = await pterodactyl.getServerDetails(req.clientKey, req.params.identifier);
    const allocations = await pterodactyl.listAllocations(req.clientKey, req.params.identifier);
    const primary = allocations.find((a) => a.is_default) ?? allocations[0];
    if (!primary) {
      res.status(502).json({ error: "No allocation found for this server." });
      return;
    }

    await pterodactyl.updateServerBuild(details.internalId, primary.id, {
      memory: plan.ramMb,
      disk: plan.diskMb,
      cpu: plan.cpuPercent,
    });

    db.prepare(
      `INSERT INTO servers (user_id, pterodactyl_identifier, plan_id, name, status)
       VALUES (?, ?, ?, ?, 'ready')
       ON CONFLICT(pterodactyl_identifier) DO UPDATE SET plan_id = excluded.plan_id`
    ).run(req.userId, req.params.identifier, plan.id, details.name);

    if (priceDiff !== 0) {
      db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(priceDiff, req.userId);
      db.prepare("INSERT INTO invoices (user_id, description, amount, status) VALUES (?, ?, ?, 'paid')").run(
        req.userId,
        `Plan change: ${oldPlan?.name ?? "Custom"} → ${plan.name} (${details.name})`,
        priceDiff
      );
    }

    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/files",
  handle(async (req, res) => {
    const directory = typeof req.query.directory === "string" ? req.query.directory : "/";
    const files = await pterodactyl.listFiles(req.clientKey, req.params.identifier, directory);
    res.json({ files });
  })
);

serversRouter.get(
  "/:identifier/files/contents",
  handle(async (req, res) => {
    const file = typeof req.query.file === "string" ? req.query.file : "";
    if (!file) {
      res.status(400).json({ error: "A file path is required." });
      return;
    }
    const content = await pterodactyl.getFileContents(req.clientKey, req.params.identifier, file);
    res.json({ content });
  })
);

serversRouter.put(
  "/:identifier/files/contents",
  handle(async (req, res) => {
    const { file, content } = req.body ?? {};
    if (!file || typeof file !== "string" || typeof content !== "string") {
      res.status(400).json({ error: "A file path and content are required." });
      return;
    }
    await pterodactyl.writeFile(req.clientKey, req.params.identifier, file, content);
    res.status(204).end();
  })
);

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

serversRouter.post(
  "/:identifier/files/upload",
  (req, res, next) => {
    fileUpload.single("file")(req, res, (err: unknown) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
            ? "File is too large to upload."
            : "Failed to process upload.";
        res.status(400).json({ error: message });
        return;
      }
      next();
    });
  },
  handle(async (req, res) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "A file is required." });
      return;
    }
    const directory = typeof req.body?.directory === "string" ? req.body.directory : "/";
    await pterodactyl.uploadFile(req.clientKey, req.params.identifier, directory, file.originalname, file.buffer);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/files/folder",
  handle(async (req, res) => {
    const { root, name } = req.body ?? {};
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "A folder name is required." });
      return;
    }
    await pterodactyl.createFolder(req.clientKey, req.params.identifier, root ?? "/", name);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/files/delete",
  handle(async (req, res) => {
    const { root, files } = req.body ?? {};
    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: "At least one file is required." });
      return;
    }
    await pterodactyl.deleteFiles(req.clientKey, req.params.identifier, root ?? "/", files);
    res.status(204).end();
  })
);

serversRouter.put(
  "/:identifier/files/rename",
  handle(async (req, res) => {
    const { root, from, to } = req.body ?? {};
    if (!from || !to) {
      res.status(400).json({ error: "Both from and to names are required." });
      return;
    }
    await pterodactyl.renameFile(req.clientKey, req.params.identifier, root ?? "/", from, to);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/files/compress",
  handle(async (req, res) => {
    const { root, files } = req.body ?? {};
    if (!Array.isArray(files) || files.length === 0) {
      res.status(400).json({ error: "At least one file is required." });
      return;
    }
    const archive = await pterodactyl.compressFiles(req.clientKey, req.params.identifier, root ?? "/", files);
    res.json({ archive });
  })
);

serversRouter.post(
  "/:identifier/files/decompress",
  handle(async (req, res) => {
    const { root, file } = req.body ?? {};
    if (!file) {
      res.status(400).json({ error: "A file is required." });
      return;
    }
    await pterodactyl.decompressFile(req.clientKey, req.params.identifier, root ?? "/", file);
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/schedules",
  handle(async (req, res) => {
    const schedules = await pterodactyl.listSchedules(req.clientKey, req.params.identifier);
    res.json({ schedules });
  })
);

serversRouter.post(
  "/:identifier/schedules",
  handle(async (req, res) => {
    const { name, minute, hour, day_of_month, day_of_week, is_active } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "A schedule name is required." });
      return;
    }
    const schedule = await pterodactyl.createSchedule(req.clientKey, req.params.identifier, {
      name,
      minute: minute ?? "*",
      hour: hour ?? "*",
      day_of_month: day_of_month ?? "*",
      day_of_week: day_of_week ?? "*",
      is_active: is_active ?? true,
    });
    res.status(201).json({ schedule });
  })
);

serversRouter.patch(
  "/:identifier/schedules/:scheduleId",
  handle(async (req, res) => {
    const schedule = await pterodactyl.updateSchedule(
      req.clientKey,
      req.params.identifier,
      Number(req.params.scheduleId),
      req.body ?? {}
    );
    res.json({ schedule });
  })
);

serversRouter.delete(
  "/:identifier/schedules/:scheduleId",
  handle(async (req, res) => {
    await pterodactyl.deleteSchedule(req.clientKey, req.params.identifier, Number(req.params.scheduleId));
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/schedules/:scheduleId/execute",
  handle(async (req, res) => {
    await pterodactyl.executeSchedule(req.clientKey, req.params.identifier, Number(req.params.scheduleId));
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/schedules/:scheduleId/tasks",
  handle(async (req, res) => {
    const { action, payload, time_offset, continue_on_failure } = req.body ?? {};
    if (!action) {
      res.status(400).json({ error: "A task action is required." });
      return;
    }
    await pterodactyl.createTask(req.clientKey, req.params.identifier, Number(req.params.scheduleId), {
      action,
      payload: payload ?? "",
      time_offset: time_offset ?? 0,
      continue_on_failure,
    });
    res.status(204).end();
  })
);

serversRouter.delete(
  "/:identifier/schedules/:scheduleId/tasks/:taskId",
  handle(async (req, res) => {
    await pterodactyl.deleteTask(
      req.clientKey,
      req.params.identifier,
      Number(req.params.scheduleId),
      Number(req.params.taskId)
    );
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/startup",
  handle(async (req, res) => {
    const startup = await pterodactyl.getStartup(req.clientKey, req.params.identifier);
    res.json(startup);
  })
);

serversRouter.put(
  "/:identifier/startup/variable",
  handle(async (req, res) => {
    const { key, value } = req.body ?? {};
    if (!key) {
      res.status(400).json({ error: "A variable key is required." });
      return;
    }
    await pterodactyl.updateStartupVariable(req.clientKey, req.params.identifier, key, value ?? "");
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

serversRouter.post(
  "/:identifier/settings/rename",
  handle(async (req, res) => {
    const { name, description } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: "A server name is required." });
      return;
    }
    await pterodactyl.renameServer(req.clientKey, req.params.identifier, name, description ?? "");
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/settings/reinstall",
  handle(async (req, res) => {
    await pterodactyl.reinstallServer(req.clientKey, req.params.identifier);
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Subusers ("Users" tab)
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/users",
  handle(async (req, res) => {
    const users = await pterodactyl.listSubusers(req.clientKey, req.params.identifier);
    res.json({ users });
  })
);

serversRouter.post(
  "/:identifier/users",
  handle(async (req, res) => {
    const { email, role } = req.body ?? {};
    if (!email || !(role in pterodactyl.ROLE_PERMISSIONS)) {
      res.status(400).json({ error: "A valid email and role are required." });
      return;
    }
    const permissions = [...pterodactyl.ROLE_PERMISSIONS[role as pterodactyl.SubuserRole]];
    const user = await pterodactyl.createSubuser(req.clientKey, req.params.identifier, email, permissions);
    res.status(201).json({ user });
  })
);

serversRouter.delete(
  "/:identifier/users/:subuserUuid",
  handle(async (req, res) => {
    await pterodactyl.deleteSubuser(req.clientKey, req.params.identifier, req.params.subuserUuid);
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/backups",
  handle(async (req, res) => {
    const backups = await pterodactyl.listBackups(req.clientKey, req.params.identifier);
    res.json({ backups });
  })
);

serversRouter.post(
  "/:identifier/backups",
  handle(async (req, res) => {
    const { name } = req.body ?? {};
    const backup = await pterodactyl.createBackup(req.clientKey, req.params.identifier, name || "Manual backup");
    res.status(201).json({ backup });
  })
);

serversRouter.delete(
  "/:identifier/backups/:backupUuid",
  handle(async (req, res) => {
    await pterodactyl.deleteBackup(req.clientKey, req.params.identifier, req.params.backupUuid);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/backups/:backupUuid/restore",
  handle(async (req, res) => {
    await pterodactyl.restoreBackup(req.clientKey, req.params.identifier, req.params.backupUuid);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/backups/:backupUuid/lock",
  handle(async (req, res) => {
    const backup = await pterodactyl.toggleBackupLock(req.clientKey, req.params.identifier, req.params.backupUuid);
    res.json({ backup });
  })
);

serversRouter.get(
  "/:identifier/backups/:backupUuid/download",
  handle(async (req, res) => {
    const url = await pterodactyl.getBackupDownloadUrl(req.clientKey, req.params.identifier, req.params.backupUuid);
    res.json({ url });
  })
);

// ---------------------------------------------------------------------------
// Network (Ports & Proxies)
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/network/allocations",
  handle(async (req, res) => {
    const allocations = await pterodactyl.listAllocations(req.clientKey, req.params.identifier);
    res.json({ allocations });
  })
);

serversRouter.post(
  "/:identifier/network/allocations",
  handle(async (req, res) => {
    const allocation = await pterodactyl.createAllocation(req.clientKey, req.params.identifier);
    res.status(201).json({ allocation });
  })
);

serversRouter.patch(
  "/:identifier/network/allocations/:allocationId",
  handle(async (req, res) => {
    const { notes } = req.body ?? {};
    await pterodactyl.updateAllocationNotes(req.clientKey, req.params.identifier, Number(req.params.allocationId), notes ?? "");
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/network/allocations/:allocationId/primary",
  handle(async (req, res) => {
    await pterodactyl.setPrimaryAllocation(req.clientKey, req.params.identifier, Number(req.params.allocationId));
    res.status(204).end();
  })
);

serversRouter.delete(
  "/:identifier/network/allocations/:allocationId",
  handle(async (req, res) => {
    await pterodactyl.deleteAllocation(req.clientKey, req.params.identifier, Number(req.params.allocationId));
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Databases
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/databases",
  handle(async (req, res) => {
    const databases = await pterodactyl.listDatabases(req.clientKey, req.params.identifier);
    res.json({ databases });
  })
);

serversRouter.post(
  "/:identifier/databases",
  handle(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "A database name is required." });
      return;
    }
    const database = await pterodactyl.createDatabase(req.clientKey, req.params.identifier, name.trim());
    res.status(201).json({ database });
  })
);

serversRouter.post(
  "/:identifier/databases/:databaseId/rotate-password",
  handle(async (req, res) => {
    const database = await pterodactyl.rotateDatabasePassword(req.clientKey, req.params.identifier, req.params.databaseId);
    res.json({ database });
  })
);

serversRouter.delete(
  "/:identifier/databases/:databaseId",
  handle(async (req, res) => {
    await pterodactyl.deleteDatabase(req.clientKey, req.params.identifier, req.params.databaseId);
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Plugins (Modrinth browser) — Phase 1: read-only browsing + listing.
// Only Paper servers support plugins (see server/serverTypes.ts). Mutating
// routes (install/update/uninstall/toggle) land in a later phase and will be
// gated behind the `plugin_browser` feature flag the same way
// `self_service_subdomains` is: checked inline per mutating route, with a
// `featureEnabled` boolean on the GET response so the UI can disable buttons
// without a second round trip. Browsing/listing itself is never flag-gated.
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/plugins",
  handle(async (req, res) => {
    const localRow = db
      .prepare("SELECT server_type FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "server_type"> | undefined;
    const supported = (localRow?.server_type ?? "paper") === "paper";

    if (!supported) {
      res.json({ supported: false, featureEnabled: isFeatureEnabled("plugin_browser"), installed: [], unmanaged: [] });
      return;
    }

    const { installed, unmanaged } = await plugins.listInstalledPlugins(req.clientKey, req.params.identifier);
    res.json({ supported: true, featureEnabled: isFeatureEnabled("plugin_browser"), installed, unmanaged });
  })
);

serversRouter.get(
  "/:identifier/plugins/search",
  handle(async (req, res) => {
    const source = req.query.source;
    const q = req.query.q;
    if (!plugins.isPluginSource(source)) {
      res.status(400).json({ error: "source must be \"modrinth\"." });
      return;
    }
    if (typeof q !== "string" || !q.trim()) {
      res.json({ results: [] });
      return;
    }
    const results = await plugins.searchCatalog(source, q.trim());
    res.json({ results });
  })
);

serversRouter.get(
  "/:identifier/plugins/:source/:projectId/versions",
  handle(async (req, res) => {
    if (!plugins.isPluginSource(req.params.source)) {
      res.status(400).json({ error: "source must be \"modrinth\"." });
      return;
    }
    const versions = await plugins.listVersions(req.params.source, req.params.projectId);
    res.json({ versions });
  })
);

function requirePluginBrowserEnabled(res: Response): boolean {
  if (!isFeatureEnabled("plugin_browser")) {
    res.status(403).json({ error: "Installing/updating/uninstalling plugins is turned off right now — check back later." });
    return false;
  }
  return true;
}

function getPluginRow(identifier: string, rowId: number): ServerPluginRow | undefined {
  return db.prepare("SELECT * FROM server_plugins WHERE id = ? AND server_identifier = ?").get(rowId, identifier) as
    | ServerPluginRow
    | undefined;
}

serversRouter.post(
  "/:identifier/plugins/install",
  handle(async (req, res) => {
    if (!requirePluginBrowserEnabled(res)) return;
    const localRow = db
      .prepare("SELECT server_type FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "server_type"> | undefined;
    if ((localRow?.server_type ?? "paper") !== "paper") {
      res.status(400).json({ error: "Plugins are only supported on Paper servers." });
      return;
    }
    const { source, projectId, projectName, projectAuthor, versionId, versionName } = req.body ?? {};
    if (!plugins.isPluginSource(source) || typeof projectId !== "string" || !projectId.trim() || typeof versionId !== "string" || !versionId.trim()) {
      res.status(400).json({ error: "source, projectId, and versionId are required." });
      return;
    }
    const plugin = await plugins.installPlugin(
      req.clientKey,
      req.params.identifier,
      source,
      projectId.trim(),
      typeof projectName === "string" && projectName.trim() ? projectName.trim() : projectId.trim(),
      typeof projectAuthor === "string" && projectAuthor.trim() ? projectAuthor.trim() : "Unknown",
      versionId.trim(),
      typeof versionName === "string" && versionName.trim() ? versionName.trim() : versionId.trim()
    );
    res.status(201).json({ plugin });
  })
);

serversRouter.delete(
  "/:identifier/plugins/unmanaged",
  handle(async (req, res) => {
    if (!requirePluginBrowserEnabled(res)) return;
    const { fileName, enabled } = req.body ?? {};
    if (typeof fileName !== "string" || !fileName.trim()) {
      res.status(400).json({ error: "fileName is required." });
      return;
    }
    await plugins.uninstallUnmanagedPlugin(req.clientKey, req.params.identifier, fileName.trim(), enabled !== false);
    res.status(204).end();
  })
);

serversRouter.delete(
  "/:identifier/plugins/:pluginRowId",
  handle(async (req, res) => {
    if (!requirePluginBrowserEnabled(res)) return;
    const row = getPluginRow(req.params.identifier, Number(req.params.pluginRowId));
    if (!row) {
      res.status(404).json({ error: "That plugin isn't installed." });
      return;
    }
    await plugins.uninstallPlugin(req.clientKey, req.params.identifier, row);
    res.status(204).end();
  })
);

serversRouter.post(
  "/:identifier/plugins/:pluginRowId/update",
  handle(async (req, res) => {
    if (!requirePluginBrowserEnabled(res)) return;
    const row = getPluginRow(req.params.identifier, Number(req.params.pluginRowId));
    if (!row) {
      res.status(404).json({ error: "That plugin isn't installed." });
      return;
    }
    const { versionId, versionName } = req.body ?? {};
    if (typeof versionId !== "string" || !versionId.trim()) {
      res.status(400).json({ error: "versionId is required." });
      return;
    }
    const plugin = await plugins.updatePlugin(
      req.clientKey,
      req.params.identifier,
      row,
      versionId.trim(),
      typeof versionName === "string" && versionName.trim() ? versionName.trim() : versionId.trim()
    );
    res.json({ plugin });
  })
);

serversRouter.post(
  "/:identifier/plugins/:pluginRowId/toggle",
  handle(async (req, res) => {
    if (!requirePluginBrowserEnabled(res)) return;
    const row = getPluginRow(req.params.identifier, Number(req.params.pluginRowId));
    if (!row) {
      res.status(404).json({ error: "That plugin isn't installed." });
      return;
    }
    const plugin = await plugins.togglePlugin(req.clientKey, req.params.identifier, row);
    res.json({ plugin });
  })
);

// ---------------------------------------------------------------------------
// Subdomain
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/subdomain",
  handle(async (req, res) => {
    const localRow = db
      .prepare("SELECT subdomain, subdomain_relayed FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "subdomain" | "subdomain_relayed"> | undefined;

    const details = await pterodactyl.getServerDetails(req.clientKey, req.params.identifier);
    const allocations = await pterodactyl.listAllocations(req.clientKey, req.params.identifier);
    const primary = allocations.find((a) => a.is_default) ?? allocations[0];
    const nodeAddress = await pterodactyl.getNodeAddress(details.internalId).catch(() => null);

    res.json({
      subdomain: localRow?.subdomain ?? null,
      rootDomain: cloudflare.ROOT_DOMAIN,
      configured: cloudflare.isConfigured(),
      relayed: Boolean(localRow?.subdomain && localRow.subdomain_relayed === 1),
      featureEnabled: isFeatureEnabled("self_service_subdomains"),
      forwarding: primary && nodeAddress ? { port: primary.port, targetIp: nodeAddress } : null,
    });
  })
);

serversRouter.put(
  "/:identifier/subdomain",
  handle(async (req, res) => {
    if (!isFeatureEnabled("self_service_subdomains")) {
      res.status(403).json({ error: "Subdomains are turned off right now — check back later." });
      return;
    }

    const { subdomain } = req.body ?? {};
    if (typeof subdomain !== "string" || !/^[a-z0-9-]{3,32}$/.test(subdomain)) {
      res.status(400).json({ error: "Use 3-32 lowercase letters, numbers, or hyphens only." });
      return;
    }

    const previous = db
      .prepare("SELECT subdomain, subdomain_relayed FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "subdomain" | "subdomain_relayed"> | undefined;

    // Claim the name in the DB *first*, and let the unique index be the arbiter.
    // A "SELECT … WHERE subdomain = ?" check here instead used to pass for both
    // of two simultaneous requests for the same name — several awaits later they
    // both wrote DNS, so the loser's Cloudflare upsert (keyed on the record name)
    // repointed the winner's A/SRV records at the loser's port before the loser's
    // own UPDATE hit the unique index and turned into a 409. Same defect the
    // deploy-time auto-subdomain had; see `claimSubdomain()` in provisioning.ts.
    try {
      db.prepare("UPDATE servers SET subdomain = ?, subdomain_relayed = 0 WHERE pterodactyl_identifier = ?").run(
        subdomain,
        req.params.identifier
      );
    } catch (err) {
      if (/UNIQUE constraint failed/i.test(err instanceof Error ? err.message : String(err))) {
        res.status(409).json({ error: "That subdomain is already taken." });
        return;
      }
      throw err;
    }

    // Nothing outside the DB has changed yet at this point, so any failure from
    // here on puts the row back exactly as it was rather than leaving it
    // advertising a name with no DNS behind it.
    const releaseClaim = () => {
      db.prepare("UPDATE servers SET subdomain = ?, subdomain_relayed = ? WHERE pterodactyl_identifier = ?").run(
        previous?.subdomain ?? null,
        previous?.subdomain_relayed ?? 0,
        req.params.identifier
      );
    };

    let relayBackendIp: string | null = null;
    try {
      const details = await pterodactyl.getServerDetails(req.clientKey, req.params.identifier);
      const allocations = await pterodactyl.listAllocations(req.clientKey, req.params.identifier);
      const primary = allocations.find((a) => a.is_default) ?? allocations[0];
      if (!primary) {
        releaseClaim();
        res.status(502).json({ error: "No allocation found for this server." });
        return;
      }

      // If this server's node has a relay tunnel, route it through the relay
      // (and point DNS at the relay's public IP) instead of the home IP — but
      // if the relay push itself fails, stop here rather than leave DNS pointed
      // at a relay with no matching route.
      relayBackendIp = relay.isRelayConfigured()
        ? await pterodactyl.getNodeRelayAddress(details.internalId).catch(() => null)
        : null;
      if (relayBackendIp) {
        try {
          await relay.upsertRelayRoute(subdomain, primary.port, relayBackendIp);
        } catch (err) {
          releaseClaim();
          const message = err instanceof Error ? err.message : "Failed to configure the relay.";
          res.status(502).json({ error: `Couldn't set up traffic routing: ${message}` });
          return;
        }
      }

      const dnsTargetIp = relayBackendIp ? relay.getRelayPublicIp() ?? undefined : undefined;
      await cloudflare.upsertMinecraftSubdomain(subdomain, primary.port, dnsTargetIp);
    } catch (err) {
      releaseClaim();
      if (relayBackendIp) await relay.removeRelayRoute(subdomain).catch(() => {});
      throw err;
    }

    // The old name's records go last, once the new ones are actually live —
    // deleting them first (the previous order) meant a later failure left the
    // server with no working address at all, while its row still advertised the
    // old one.
    if (previous?.subdomain && previous.subdomain !== subdomain) {
      await cloudflare.deleteMinecraftSubdomain(previous.subdomain).catch(() => {});
      await relay.removeRelayRoute(previous.subdomain).catch(() => {});
    }

    db.prepare("UPDATE servers SET subdomain_relayed = ? WHERE pterodactyl_identifier = ?").run(
      relayBackendIp ? 1 : 0,
      req.params.identifier
    );

    res.json({ subdomain, fullDomain: `${subdomain}.${cloudflare.ROOT_DOMAIN}` });
  })
);

serversRouter.delete(
  "/:identifier/subdomain",
  handle(async (req, res) => {
    if (!isFeatureEnabled("self_service_subdomains")) {
      res.status(403).json({ error: "Subdomains are turned off right now — check back later." });
      return;
    }

    const localRow = db
      .prepare("SELECT subdomain FROM servers WHERE pterodactyl_identifier = ?")
      .get(req.params.identifier) as Pick<ServerRow, "subdomain"> | undefined;
    if (localRow?.subdomain) {
      await cloudflare.deleteMinecraftSubdomain(localRow.subdomain);
      await relay.removeRelayRoute(localRow.subdomain).catch(() => {});
      db.prepare("UPDATE servers SET subdomain = NULL, subdomain_relayed = 0 WHERE pterodactyl_identifier = ?").run(req.params.identifier);
    }
    res.status(204).end();
  })
);

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

serversRouter.get(
  "/:identifier/activity",
  handle(async (req, res) => {
    const activity = await pterodactyl.getActivity(req.clientKey, req.params.identifier);
    res.json({ activity });
  })
);
