import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db.js";
import { requireAuth } from "../auth.js";
import { isOwnerUser } from "../adminGate.js";
import { getNodeStatuses, getServerResources } from "../pterodactyl.js";
import { reconcileServers } from "./ownerConsole.js";
import { getActivity } from "../activityLog.js";
import { decryptClientKey } from "../secretCrypto.js";

export const overviewRouter = Router();
overviewRouter.use(requireAuth);

function requireOwner(req: Request, res: Response): boolean {
  const userId = (req as Request & { userId: number }).userId;
  if (!isOwnerUser(userId)) {
    res.status(403).json({ error: "Only the owner account can view this." });
    return false;
  }
  return true;
}

overviewRouter.get("/", async (req, res) => {
  if (!requireOwner(req, res)) return;
  await reconcileServers();

  // --- Infra ---
  const servers = db.prepare("SELECT status FROM servers").all() as { status: string }[];
  const serverCounts = {
    total: servers.length,
    ready: servers.filter((s) => s.status === "ready").length,
    installing: servers.filter((s) => s.status === "installing").length,
    failed: servers.filter((s) => s.status === "failed").length,
  };

  const nodes = await getNodeStatuses().catch(() => []);

  // --- Live resource usage --- (real-time load, not the $ figures this
  // replaced — summed across every server whose owner still has a linked
  // Pterodactyl client key; a server that fails to answer just contributes 0
  // rather than breaking the whole aggregate)
  const liveServers = db
    .prepare(
      `SELECT s.pterodactyl_identifier as identifier, u.pterodactyl_client_key as clientKey
       FROM servers s
       JOIN users u ON u.id = s.user_id
       WHERE u.pterodactyl_client_key IS NOT NULL`
    )
    .all() as { identifier: string; clientKey: string }[];

  const usage = await Promise.all(
    liveServers.map(async (s) => {
      try {
        const res = await getServerResources(decryptClientKey(s.clientKey), s.identifier);
        return res.attributes.resources;
      } catch {
        return null;
      }
    })
  );
  const totalCpuPercent = Math.round(usage.reduce((sum, r) => sum + (r?.cpu_absolute ?? 0), 0));
  const totalMemoryGb = Number((usage.reduce((sum, r) => sum + (r?.memory_bytes ?? 0), 0) / 1024 / 1024 / 1024).toFixed(1));

  // --- Growth ---
  const totalAccounts = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  const newSignups7d = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days')").get() as {
      c: number;
    }
  ).c;
  const newSignups30d = (
    db.prepare("SELECT COUNT(*) as c FROM users WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')").get() as {
      c: number;
    }
  ).c;
  const pendingRequests = (
    db.prepare("SELECT COUNT(*) as c FROM server_requests WHERE status = 'pending'").get() as { c: number }
  ).c;
  const suspendedAccounts = (db.prepare("SELECT COUNT(*) as c FROM users WHERE suspended = 1").get() as { c: number }).c;

  // --- Activity feed --- (no payment/$ events here — those stay owner-only
  // on the detailed Activity page, not the shared Overview)
  const activity = getActivity(["signup", "request", "server", "admin"], 50);

  res.json({
    infra: {
      serverCounts,
      nodes,
    },
    resources: {
      totalCpuPercent,
      totalMemoryGb,
    },
    growth: {
      totalAccounts,
      newSignups7d,
      newSignups30d,
      pendingRequests,
      suspendedAccounts,
    },
    activity,
  });
});
