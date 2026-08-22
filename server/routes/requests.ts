import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "../db.js";
import type { UserRow, ServerRequestRow } from "../db.js";
import { requireAuth } from "../auth.js";
import { isAdminUser } from "../adminGate.js";
import { deployAndCharge } from "../deployCharge.js";
import { findPlan, freePlan } from "../plans.js";
import { findServerType } from "../serverTypes.js";
import { decryptClientKey } from "../secretCrypto.js";

export const requestsRouter = Router();
requestsRouter.use(requireAuth);

function userId(req: Request): number {
  return (req as Request & { userId: number }).userId;
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdminUser(userId(req))) {
    res.status(403).json({ error: "Only the admin account can do this." });
    return false;
  }
  return true;
}

function toPublicRequest(row: ServerRequestRow & { username?: string; email?: string }) {
  const plan = row.plan_id ? findPlan(row.plan_id) : undefined;
  const serverType = findServerType(row.server_type_id);
  return {
    id: row.id,
    name: row.name,
    planId: row.plan_id,
    planName: plan?.name ?? (row.plan_id ? row.plan_id : "Custom"),
    planPrice: plan?.price ?? 0,
    ramMb: row.ram_mb,
    diskMb: row.disk_mb,
    cpuPercent: row.cpu_percent,
    serverTypeId: row.server_type_id,
    serverTypeName: serverType?.name ?? row.server_type_id,
    version: row.version,
    status: row.status,
    identifier: row.identifier,
    denialReason: row.denial_reason,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    username: row.username,
    email: row.email,
  };
}

requestsRouter.get("/mine", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM server_requests WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId(req)) as ServerRequestRow[];
  res.json(rows.map((r) => toPublicRequest(r)));
});

requestsRouter.get("/", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const rows = db
    .prepare(
      `SELECT server_requests.*, users.username as username, users.email as email
       FROM server_requests
       JOIN users ON users.id = server_requests.user_id
       ORDER BY
         CASE server_requests.status WHEN 'pending' THEN 0 ELSE 1 END,
         server_requests.created_at DESC`
    )
    .all() as (ServerRequestRow & { username: string; email: string })[];
  res.json(rows.map((r) => toPublicRequest(r)));
});

requestsRouter.post("/:id/approve", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const request = db.prepare("SELECT * FROM server_requests WHERE id = ?").get(req.params.id) as
    | ServerRequestRow
    | undefined;
  if (!request) {
    res.status(404).json({ error: "That request no longer exists." });
    return;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "This request has already been resolved." });
    return;
  }

  const { planId } = req.body ?? {};
  const chosenPlan = typeof planId === "string" ? findPlan(planId) : undefined;
  if (!chosenPlan) {
    res.status(400).json({ error: "Choose a valid plan." });
    return;
  }

  const owner = db
    .prepare("SELECT pterodactyl_user_id, pterodactyl_client_key FROM users WHERE id = ?")
    .get(request.user_id) as Pick<UserRow, "pterodactyl_user_id" | "pterodactyl_client_key"> | undefined;
  const serverType = findServerType(request.server_type_id);

  if (!owner?.pterodactyl_user_id || !owner.pterodactyl_client_key || !serverType) {
    res.status(400).json({ error: "This request can no longer be fulfilled — the account or server type changed." });
    return;
  }
  const ownerClientKey = decryptClientKey(owner.pterodactyl_client_key);

  // Same named plan the customer would see elsewhere (so it still shows as
  // e.g. "Sapling" rather than "Custom"), just free — this phase has no
  // billing, and the owner may have picked a different (often lower) plan
  // than what was originally requested.
  const plan = freePlan(chosenPlan);

  // Claim this request before deploying, atomically.
  //
  // The `status !== 'pending'` check above is necessary but nowhere near
  // sufficient: `deployAndCharge` below is awaited for several seconds while it
  // talks to Pterodactyl, and the row still says 'pending' that entire time.
  // Two approvals overlapping in that window both read 'pending' and both
  // deploy. This is not theoretical — it reproduces with five concurrent
  // approvals of one request (an admin double-clicking Approve, or the Requests
  // page open in two tabs): every one returned 200 and provisioned a *real*
  // server, leaving four orphans burning node RAM and disk, plus a duplicate
  // invoice and balance debit each, while the request row kept only the last
  // identifier.
  //
  // Claiming via `resolved_at` rather than a new 'approving' status keeps this
  // purely server-side — nothing in `src/` reads `resolvedAt`, and the request
  // correctly still reads as pending to the customer while the deploy runs.
  // `changes === 1` can only be true for one caller, however many race in.
  const claimed = db
    .prepare(
      `UPDATE server_requests
       SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'pending' AND resolved_at IS NULL`
    )
    .run(request.id);
  if (claimed.changes !== 1) {
    res.status(409).json({ error: "This request is already being handled." });
    return;
  }

  try {
    const created = await deployAndCharge({
      userId: request.user_id,
      ownerId: owner.pterodactyl_user_id,
      clientKey: ownerClientKey,
      name: request.name,
      plan,
      serverType,
      version: request.version,
      generateSubdomain: request.generate_subdomain === 1,
    });
    db.prepare(
      `UPDATE server_requests SET status = 'approved', identifier = ?, plan_id = ?, ram_mb = ?, disk_mb = ?, cpu_percent = ?,
       resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    ).run(created.identifier, plan.id, plan.ramMb, plan.diskMb, plan.cpuPercent, request.id);
    res.json({ identifier: created.identifier });
  } catch (err) {
    // Release the claim so the owner can actually retry — a failed deploy must
    // not leave the request permanently stuck as "already being handled".
    db.prepare("UPDATE server_requests SET resolved_at = NULL WHERE id = ? AND status = 'pending'").run(request.id);
    const message = err instanceof Error ? err.message : "Failed to deploy this server.";
    res.status(502).json({ error: message });
  }
});

requestsRouter.post("/:id/deny", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const request = db.prepare("SELECT * FROM server_requests WHERE id = ?").get(req.params.id) as
    | ServerRequestRow
    | undefined;
  if (!request) {
    res.status(404).json({ error: "That request no longer exists." });
    return;
  }
  if (request.status !== "pending") {
    res.status(409).json({ error: "This request has already been resolved." });
    return;
  }

  const { reason } = req.body ?? {};
  // `AND resolved_at IS NULL` respects the claim taken by /approve above: a deny
  // that lands while a deploy is already in flight must lose, not silently
  // overwrite a request whose server is midway through being created.
  const denied = db
    .prepare(
      `UPDATE server_requests
       SET status = 'denied', denial_reason = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND status = 'pending' AND resolved_at IS NULL`
    )
    .run(typeof reason === "string" && reason.trim() ? reason.trim() : null, request.id);
  if (denied.changes !== 1) {
    res.status(409).json({ error: "This request is already being handled." });
    return;
  }
  res.status(204).end();
});
