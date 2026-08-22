import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { isOwnerUser } from "../adminGate.js";
import { findPlan } from "../plans.js";
import { findServerType } from "../serverTypes.js";
import { listAllRealServerIdentifiers, getNodeStatuses, getRelayNodeMap, PANEL_PUBLIC_URL } from "../pterodactyl.js";
import { getActivity } from "../activityLog.js";
import * as cloudflare from "../cloudflare.js";
import * as relay from "../relay.js";
import { FEATURES, getAllFlags, setFeatureEnabled, type FeatureKey } from "../featureFlags.js";
import { generateInviteCode, listInviteCodes, deleteInviteCode } from "../inviteCodes.js";

export const ownerConsoleRouter = Router();
ownerConsoleRouter.use(requireAuth);

function requireOwner(req: Request, res: Response): boolean {
  const userId = (req as Request & { userId: number }).userId;
  if (!isOwnerUser(userId)) {
    res.status(403).json({ error: "Only the owner account can view this." });
    return false;
  }
  return true;
}

/**
 * Deletes any local `servers` row that no longer has a matching real server on
 * Pterodactyl — self-healing the exact drift that made deleted servers keep
 * showing up in the owner console. Best-effort: if Pterodactyl is unreachable,
 * this just skips reconciling rather than blocking the page.
 */
export async function reconcileServers(): Promise<void> {
  try {
    const real = await listAllRealServerIdentifiers();
    const local = db.prepare("SELECT id, pterodactyl_identifier, subdomain FROM servers").all() as {
      id: number;
      pterodactyl_identifier: string;
      subdomain: string | null;
    }[];
    const stale = local.filter((s) => !real.has(s.pterodactyl_identifier));
    for (const s of stale) {
      // The server is already gone on Pterodactyl's side — clean up whatever
      // subdomain it had too, or the DNS record and relay rule outlive it.
      if (s.subdomain) {
        await cloudflare.deleteMinecraftSubdomain(s.subdomain).catch(() => {});
        await relay.removeRelayRoute(s.subdomain).catch(() => {});
      }
      db.prepare("DELETE FROM server_plugins WHERE server_identifier = ?").run(s.pterodactyl_identifier);
      db.prepare("DELETE FROM servers WHERE id = ?").run(s.id);
    }
  } catch {
    // Pterodactyl unreachable — leave the local table as-is for this request.
  }
}

ownerConsoleRouter.get("/servers", async (req, res) => {
  if (!requireOwner(req, res)) return;
  await reconcileServers();

  const rows = db
    .prepare(
      `SELECT s.id, s.pterodactyl_identifier as identifier, s.name, s.plan_id as planId, s.server_type as serverTypeId,
              s.status, s.billing_status as billingStatus, s.subdomain, s.created_at as createdAt,
              u.id as ownerId, u.username as ownerUsername, u.email as ownerEmail
       FROM servers s
       JOIN users u ON u.id = s.user_id
       ORDER BY s.created_at DESC`
    )
    .all() as {
    id: number;
    identifier: string;
    name: string;
    planId: string;
    serverTypeId: string;
    status: string;
    billingStatus: string;
    subdomain: string | null;
    createdAt: string;
    ownerId: number;
    ownerUsername: string;
    ownerEmail: string;
  }[];

  res.json(
    rows.map((r) => {
      const plan = r.planId ? findPlan(r.planId) : undefined;
      const serverType = findServerType(r.serverTypeId);
      return {
        id: r.id,
        identifier: r.identifier,
        panelUrl: `${PANEL_PUBLIC_URL}/server/${r.identifier}`,
        name: r.name,
        planId: r.planId,
        planName: plan?.name ?? (r.planId ? r.planId : "Custom"),
        planPrice: plan?.price ?? 0,
        serverTypeName: serverType?.name ?? r.serverTypeId,
        status: r.status,
        billingStatus: r.billingStatus,
        subdomain: r.subdomain,
        createdAt: r.createdAt,
        owner: { id: r.ownerId, username: r.ownerUsername, email: r.ownerEmail },
      };
    })
  );
});

type LedgerCategory = "topup" | "newServer" | "renewal" | "planChange" | "adminAdjustment";

const ADMIN_ADJUSTMENT_DESCRIPTIONS = new Set([
  "Bonus credit from Vantablock",
  "Balance deduction by admin",
  "Balance manually corrected by admin",
]);

function categorize(description: string): LedgerCategory {
  if (description === "Balance top-up (card)") return "topup";
  if (description.startsWith("Monthly renewal")) return "renewal";
  if (description.startsWith("Plan change:")) return "planChange";
  if (ADMIN_ADJUSTMENT_DESCRIPTIONS.has(description)) return "adminAdjustment";
  return "newServer";
}

ownerConsoleRouter.get("/ledger", (req, res) => {
  if (!requireOwner(req, res)) return;

  const rows = db
    .prepare(
      `SELECT i.id, i.description, i.amount, i.status, i.created_at as createdAt,
              u.username, u.email
       FROM invoices i
       JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC
       LIMIT 500`
    )
    .all() as { id: number; description: string; amount: number; status: string; createdAt: string; username: string; email: string }[];

  // Admin-driven balance adjustments (bonus/deduct/correct) belong exclusively to
  // the Account Bonus tab, not this ledger — otherwise the same action would show
  // up in two different places with two different framings.
  const filtered = rows
    .map((r) => ({ ...r, category: categorize(r.description) }))
    .filter((r) => r.category !== "adminAdjustment");

  res.json(filtered);
});

ownerConsoleRouter.get("/billing-summary", async (req, res) => {
  if (!requireOwner(req, res)) return;
  await reconcileServers();

  const users = db.prepare("SELECT id, username, email, balance FROM users ORDER BY username").all() as {
    id: number;
    username: string;
    email: string;
    balance: number;
  }[];

  const servers = db
    .prepare("SELECT user_id, plan_id, billing_status, next_bill_at FROM servers")
    .all() as { user_id: number; plan_id: string; billing_status: string; next_bill_at: string | null }[];

  const perUser = users.map((u) => {
    const owned = servers.filter((s) => s.user_id === u.id);
    const monthlyTotal = owned.reduce((sum, s) => sum + (findPlan(s.plan_id)?.price ?? 0), 0);
    const nextBillDates = owned.map((s) => s.next_bill_at).filter((d): d is string => Boolean(d));
    const nextBillAt = nextBillDates.length
      ? nextBillDates.reduce((earliest, d) => (new Date(d) < new Date(earliest) ? d : earliest))
      : null;
    const pastDue = owned.some((s) => s.billing_status === "past_due" || s.billing_status === "suspended");

    return {
      id: u.id,
      username: u.username,
      email: u.email,
      balance: u.balance,
      monthlyTotal,
      serverCount: owned.length,
      nextBillAt,
      pastDue,
    };
  });

  const platformTotal = perUser.reduce((sum, u) => sum + u.monthlyTotal, 0);

  res.json({
    users: perUser.filter((u) => u.serverCount > 0 || u.balance !== 0).sort((a, b) => b.monthlyTotal - a.monthlyTotal),
    platformTotal,
  });
});

ownerConsoleRouter.get("/activity", (req, res) => {
  if (!requireOwner(req, res)) return;
  // Unlike Overview's feed, this includes payment events — this is the
  // dedicated detailed history, capped generously rather than paginated
  // server-side since the underlying volume is small.
  res.json(getActivity(undefined, 1000));
});

ownerConsoleRouter.get("/features", (req, res) => {
  if (!requireOwner(req, res)) return;
  res.json(getAllFlags());
});

ownerConsoleRouter.get("/infrastructure", async (req, res) => {
  if (!requireOwner(req, res)) return;

  const relayNodeIps = getRelayNodeMap();
  const [nodes, relayStatus] = await Promise.all([
    getNodeStatuses().catch(() => []),
    relay.getRelayStatus(relayNodeIps),
  ]);
  const nodeName = (nodeId: number) => nodes.find((n) => n.id === nodeId)?.name ?? `Node ${nodeId}`;
  const nodeIdByTunnelIp = new Map(Object.entries(relayNodeIps).map(([id, ip]) => [ip, Number(id)]));

  res.json({
    configured: relay.isRelayConfigured(),
    publicIp: relay.getRelayPublicIp(),
    reachable: relayStatus.reachable,
    haproxyActive: relayStatus.haproxyActive,
    tunnels: relayStatus.nodes.map((n) => ({ ...n, nodeName: nodeName(n.nodeId) })),
    routes: relayStatus.routes.map((r) => ({
      ...r,
      nodeName: nodeIdByTunnelIp.has(r.backendIp) ? nodeName(nodeIdByTunnelIp.get(r.backendIp)!) : null,
    })),
  });
});

ownerConsoleRouter.post("/features/:key", (req, res) => {
  if (!requireOwner(req, res)) return;
  const key = req.params.key as FeatureKey;
  if (!FEATURES.some((f) => f.key === key)) {
    res.status(404).json({ error: "Unknown feature." });
    return;
  }
  const { enabled } = req.body ?? {};
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be true or false." });
    return;
  }
  setFeatureEnabled(key, enabled);
  res.status(204).end();
});

ownerConsoleRouter.get("/invites", (req, res) => {
  if (!requireOwner(req, res)) return;
  res.json(listInviteCodes());
});

ownerConsoleRouter.post("/invites", (req, res) => {
  if (!requireOwner(req, res)) return;
  res.status(201).json(generateInviteCode());
});

ownerConsoleRouter.delete("/invites/:id", (req, res) => {
  if (!requireOwner(req, res)) return;
  deleteInviteCode(Number(req.params.id));
  res.status(204).end();
});
