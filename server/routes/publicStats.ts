import { Router } from "express";
import { db } from "../db.js";
import { getNodeStatuses } from "../pterodactyl.js";

// Unauthenticated on purpose — this feeds the landing page, which logged-out
// visitors see. Nothing here reveals anything customer-specific, just
// aggregate platform capacity.
export const publicStatsRouter = Router();

interface PublicStats {
  totalServers: number;
  availableRamGb: number;
  totalRamGb: number;
}

// Every hit here was calling out to Pterodactyl's real (PHP-backed) node API
// with zero caching — found under load testing (2026-08-21) that this made an
// unauthenticated, landing-page-facing endpoint a direct amplifier against the
// Panel itself: enough traffic here could peg the same box's PHP-FPM workers
// that real customers' server consoles also depend on. Node capacity doesn't
// need to be second-fresh for a landing-page stat, so a short in-memory cache
// turns any volume of hits into at most one real Pterodactyl call per window.
const CACHE_TTL_MS = 20_000;
let cached: { data: PublicStats; expiresAt: number } | null = null;

async function computeStats(): Promise<PublicStats> {
  // Every server that's actually hosted (provisioned or being provisioned),
  // not just currently-online ones — a sleeping/idle server (once that lands)
  // still counts, since it's still a real hosted server, just not consuming
  // RAM at that moment. Only a failed deploy doesn't count.
  const totalServers = (
    db.prepare("SELECT COUNT(*) as c FROM servers WHERE status != 'failed'").get() as { c: number }
  ).c;

  const nodes = await getNodeStatuses().catch(() => []);
  const totalRamMb = nodes.reduce((sum, n) => sum + n.memoryTotalMb, 0);
  const availableRamMb = nodes.reduce((sum, n) => sum + Math.max(0, n.memoryTotalMb - n.memoryUsedMb), 0);

  return {
    totalServers,
    availableRamGb: Math.round(availableRamMb / 1024),
    totalRamGb: Math.round(totalRamMb / 1024),
  };
}

publicStatsRouter.get("/", async (_req, res) => {
  const now = Date.now();
  if (!cached || cached.expiresAt < now) {
    cached = { data: await computeStats(), expiresAt: now + CACHE_TTL_MS };
  }
  res.json(cached.data);
});
