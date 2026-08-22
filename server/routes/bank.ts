import { Router } from "express";
import type { Request } from "express";
import { db } from "../db.js";
import type { UserRow } from "../db.js";
import { requireAuth } from "../auth.js";
import { isAdminUser } from "../adminGate.js";
import { runBillingCycle } from "../billingCron.js";

export const bankRouter = Router();
bankRouter.use(requireAuth);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireAdmin(req: Request, res: import("express").Response): boolean {
  const userId = (req as Request & { userId: number }).userId;
  if (!isAdminUser(userId)) {
    res.status(403).json({ error: "Only the admin account can do this." });
    return false;
  }
  return true;
}

bankRouter.get("/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = db
    .prepare("SELECT id, username, email, balance FROM users ORDER BY created_at DESC")
    .all() as Pick<UserRow, "id" | "username" | "email" | "balance">[];
  res.json(users);
});

bankRouter.post("/add-funds", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { userId: targetUserId, amount } = req.body ?? {};
  if (typeof targetUserId !== "number") {
    res.status(400).json({ error: "Choose an account to credit." });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter a valid amount greater than $0." });
    return;
  }

  const target = db.prepare("SELECT id, username, email, balance FROM users WHERE id = ?").get(targetUserId) as
    | Pick<UserRow, "id" | "username" | "email" | "balance">
    | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(amount, targetUserId);
  db.prepare("INSERT INTO invoices (user_id, description, amount, status) VALUES (?, ?, ?, 'paid')").run(
    targetUserId,
    "Bonus credit from Vantablock",
    -amount
  );

  res.json({ id: target.id, username: target.username, email: target.email, balance: target.balance + amount });
});

bankRouter.post("/deduct-funds", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { userId: targetUserId, amount } = req.body ?? {};
  if (typeof targetUserId !== "number") {
    res.status(400).json({ error: "Choose an account to debit." });
    return;
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter a valid amount greater than $0." });
    return;
  }

  const target = db.prepare("SELECT id, username, email, balance FROM users WHERE id = ?").get(targetUserId) as
    | Pick<UserRow, "id" | "username" | "email" | "balance">
    | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(amount, targetUserId);
  db.prepare("INSERT INTO invoices (user_id, description, amount, status) VALUES (?, ?, ?, 'paid')").run(
    targetUserId,
    "Balance deduction by admin",
    amount
  );

  res.json({ id: target.id, username: target.username, email: target.email, balance: target.balance - amount });
});

bankRouter.post("/set-balance", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { userId: targetUserId, balance } = req.body ?? {};
  if (typeof targetUserId !== "number") {
    res.status(400).json({ error: "Choose an account to update." });
    return;
  }
  if (typeof balance !== "number" || !Number.isFinite(balance)) {
    res.status(400).json({ error: "Enter a valid balance." });
    return;
  }

  const target = db.prepare("SELECT id, username, email, balance FROM users WHERE id = ?").get(targetUserId) as
    | Pick<UserRow, "id" | "username" | "email" | "balance">
    | undefined;
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  const delta = balance - target.balance;
  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(balance, targetUserId);
  if (delta !== 0) {
    db.prepare("INSERT INTO invoices (user_id, description, amount, status) VALUES (?, ?, ?, 'paid')").run(
      targetUserId,
      "Balance manually corrected by admin",
      -delta
    );
  }

  res.json({ id: target.id, username: target.username, email: target.email, balance });
});

bankRouter.patch("/user/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const targetUserId = Number(req.params.id);
  const { username, email } = req.body ?? {};
  if (!username || typeof username !== "string" || !username.trim()) {
    res.status(400).json({ error: "A username is required." });
    return;
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(targetUserId);
  if (!target) {
    res.status(404).json({ error: "That account no longer exists." });
    return;
  }

  const usernameTaken = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username.trim(), targetUserId);
  if (usernameTaken) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }
  const emailTaken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email.trim(), targetUserId);
  if (emailTaken) {
    res.status(409).json({ error: "That email is already in use." });
    return;
  }

  db.prepare("UPDATE users SET username = ?, email = ? WHERE id = ?").run(username.trim(), email.trim(), targetUserId);

  const updated = db.prepare("SELECT id, username, email, balance FROM users WHERE id = ?").get(targetUserId) as Pick<
    UserRow,
    "id" | "username" | "email" | "balance"
  >;
  res.json(updated);
});

// Lets the admin force a billing pass immediately (support/testing) instead of
// waiting for the next hourly tick.
bankRouter.post("/run-billing", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await runBillingCycle();
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Billing cycle failed." });
  }
});
