import { Router } from "express";
import type { Request } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import type { UserRow, InvoiceRow } from "../db.js";
import { requireAuth, toPublicUser, clearSessionCookie } from "../auth.js";
import { deleteUserEverywhere } from "../accountDeletion.js";

export const accountRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same idea as auth.ts's authLimiter, for the two routes here that check a
// password — a compromised/shared session shouldn't get unlimited guesses at
// the account's real password. Keyed by userId (not IP) since these routes
// require auth already; the attacker's IP is irrelevant if they have a valid
// session cookie from anywhere.
const passwordCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as Request & { userId: number }).userId),
  message: { error: "Too many attempts. Try again in a few minutes." },
});

function findById(id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

accountRouter.patch("/profile", requireAuth, (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const { firstName, lastName, username, email } = req.body ?? {};

  if (!firstName || !lastName || !username || !email) {
    res.status(400).json({ error: "All profile fields are required." });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  const usernameTaken = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, userId);
  if (usernameTaken) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }
  const emailTaken = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, userId);
  if (emailTaken) {
    res.status(409).json({ error: "That email is already in use." });
    return;
  }

  db.prepare("UPDATE users SET first_name = ?, last_name = ?, username = ?, email = ? WHERE id = ?").run(
    firstName,
    lastName,
    username,
    email,
    userId
  );

  res.json(toPublicUser(findById(userId)!));
});

accountRouter.patch("/settings", requireAuth, (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const { twoFactorEnabled, notificationPrefs } = req.body ?? {};

  const user = findById(userId)!;
  const next2fa = typeof twoFactorEnabled === "boolean" ? twoFactorEnabled : Boolean(user.two_factor_enabled);
  const prefs = notificationPrefs ?? {};

  db.prepare(
    `UPDATE users SET
      two_factor_enabled = ?,
      notif_server_alerts = ?,
      notif_billing_reminders = ?,
      notif_product_updates = ?,
      notif_marketing_emails = ?
     WHERE id = ?`
  ).run(
    next2fa ? 1 : 0,
    (prefs.serverAlerts ?? Boolean(user.notif_server_alerts)) ? 1 : 0,
    (prefs.billingReminders ?? Boolean(user.notif_billing_reminders)) ? 1 : 0,
    (prefs.productUpdates ?? Boolean(user.notif_product_updates)) ? 1 : 0,
    (prefs.marketingEmails ?? Boolean(user.notif_marketing_emails)) ? 1 : 0,
    userId
  );

  res.json(toPublicUser(findById(userId)!));
});

accountRouter.post("/password", requireAuth, passwordCheckLimiter, (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const user = findById(userId)!;
  if (!user.password_hash) {
    res.status(400).json({ error: "This account signs in with Google and has no password to change." });
    return;
  }
  if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(newPassword, 10), userId);
  res.status(204).end();
});

accountRouter.get("/invoices", requireAuth, (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const rows = db
    .prepare("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as InvoiceRow[];
  res.json(
    rows.map((r) => ({
      id: `INV-${r.id}`,
      date: new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      description: r.description,
      amount: r.amount,
      status: r.status,
    }))
  );
});

accountRouter.delete("/", requireAuth, passwordCheckLimiter, async (req, res) => {
  const userId = (req as Request & { userId: number }).userId;
  const { password } = req.body ?? {};
  const user = findById(userId);
  if (!user) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  if (user.password_hash) {
    if (!password || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: "Password is incorrect." });
      return;
    }
  }

  await deleteUserEverywhere(user);

  clearSessionCookie(res);
  res.status(204).end();
});
