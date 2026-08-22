import { Router } from "express";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db.js";
import type { UserRow } from "../db.js";
import { requireAuth } from "../auth.js";
import { isOwnerUser } from "../adminGate.js";
import { deleteUserEverywhere } from "../accountDeletion.js";
import { logActivity } from "../activityLog.js";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

function userId(req: Request): number {
  return (req as Request & { userId: number }).userId;
}

// These are the "keys to the kingdom" actions (grant admin, suspend, reset a
// password, delete an account) — kept owner-only rather than delegable to
// accounts promoted to admin, since letting an admin manage other admins (or
// itself) is a different, riskier trust boundary than what "admin" means today
// (deploy without approval, Bank access, approving requests).
function requireOwner(req: Request, res: Response): boolean {
  if (!isOwnerUser(userId(req))) {
    res.status(403).json({ error: "Only the owner account can do this." });
    return false;
  }
  return true;
}

function computeRole(row: Pick<UserRow, "email" | "is_admin">): "owner" | "admin" | "member" {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && row.email.toLowerCase() === adminEmail.toLowerCase()) return "owner";
  return row.is_admin === 1 ? "admin" : "member";
}

accountsRouter.get("/", (req, res) => {
  if (!requireOwner(req, res)) return;

  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.balance, u.auth_provider, u.is_admin, u.suspended, u.created_at,
              (SELECT COUNT(*) FROM servers s WHERE s.user_id = u.id) as server_count
       FROM users u
       ORDER BY u.created_at DESC`
    )
    .all() as (Pick<UserRow, "id" | "username" | "email" | "balance" | "auth_provider" | "is_admin" | "suspended" | "created_at"> & {
    server_count: number;
  })[];

  res.json(
    rows.map((r) => ({
      id: r.id,
      username: r.username,
      email: r.email,
      balance: r.balance,
      authProvider: r.auth_provider,
      role: computeRole(r),
      suspended: Boolean(r.suspended),
      serverCount: r.server_count,
      createdAt: r.created_at,
    }))
  );
});

accountsRouter.get("/:id/detail", (req, res) => {
  if (!requireOwner(req, res)) return;
  const targetId = Number(req.params.id);

  const servers = db
    .prepare("SELECT pterodactyl_identifier as identifier, name, plan_id as planId, status FROM servers WHERE user_id = ?")
    .all(targetId);
  const invoices = db
    .prepare("SELECT id, description, amount, status, created_at as createdAt FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 25")
    .all(targetId);

  res.json({ servers, invoices });
});

accountsRouter.post("/:id/admin", (req, res) => {
  if (!requireOwner(req, res)) return;
  const targetId = Number(req.params.id);
  const { isAdmin } = req.body ?? {};
  if (typeof isAdmin !== "boolean") {
    res.status(400).json({ error: "isAdmin must be true or false." });
    return;
  }
  if (isOwnerUser(targetId)) {
    res.status(400).json({ error: "The owner account's admin status can't be changed." });
    return;
  }
  const target = db.prepare("SELECT id, username FROM users WHERE id = ?").get(targetId) as
    | Pick<UserRow, "id" | "username">
    | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(isAdmin ? 1 : 0, targetId);
  logActivity(
    isAdmin ? "admin_granted" : "admin_revoked",
    "admin",
    isAdmin ? `${target.username} was granted admin access` : `${target.username}'s admin access was revoked`
  );
  res.status(204).end();
});

accountsRouter.post("/:id/suspend", (req, res) => {
  if (!requireOwner(req, res)) return;
  const targetId = Number(req.params.id);
  const { suspended } = req.body ?? {};
  if (typeof suspended !== "boolean") {
    res.status(400).json({ error: "suspended must be true or false." });
    return;
  }
  if (isOwnerUser(targetId)) {
    res.status(400).json({ error: "The owner account can't be suspended." });
    return;
  }
  const target = db.prepare("SELECT id, username FROM users WHERE id = ?").get(targetId) as
    | Pick<UserRow, "id" | "username">
    | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  db.prepare("UPDATE users SET suspended = ? WHERE id = ?").run(suspended ? 1 : 0, targetId);
  logActivity(
    suspended ? "account_suspended" : "account_unsuspended",
    "admin",
    suspended ? `${target.username}'s account was suspended` : `${target.username}'s account was unsuspended`
  );
  res.status(204).end();
});

accountsRouter.post("/:id/reset-password", (req, res) => {
  if (!requireOwner(req, res)) return;
  const targetId = Number(req.params.id);
  const { newPassword } = req.body ?? {};
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }
  const target = db.prepare("SELECT id, username FROM users WHERE id = ?").get(targetId) as
    | Pick<UserRow, "id" | "username">
    | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ?, auth_provider = 'password' WHERE id = ?").run(hash, targetId);
  logActivity("password_reset", "admin", `${target.username}'s password was reset by the owner`);
  res.status(204).end();
});

accountsRouter.delete("/:id", async (req, res) => {
  if (!requireOwner(req, res)) return;
  const targetId = Number(req.params.id);
  if (isOwnerUser(targetId)) {
    res.status(400).json({ error: "The owner account can't be deleted." });
    return;
  }

  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as UserRow | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  await deleteUserEverywhere(target, true);
  res.status(204).end();
});
