import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { db } from "./db.js";
import type { UserRow } from "./db.js";
import { isAdminUser, isOwnerUser } from "./adminGate.js";

// No hardcoded fallback here on purpose — a fallback that ships in the source
// is a fallback every reader of this file also knows, which would let anyone
// forge a valid session for any user. Fail fast at startup instead.
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be set (see .env) — refusing to start with no session signing key.");
}
const JWT_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = "vb_session";

export function signSession(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function setSessionCookie(res: Response, userId: number) {
  res.cookie(COOKIE_NAME, signSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

export function getSessionUserId(req: Request): number | null {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    return payload.userId;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  const row = db.prepare("SELECT suspended FROM users WHERE id = ?").get(userId) as Pick<UserRow, "suspended"> | undefined;
  if (!row) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  if (row.suspended) {
    clearSessionCookie(res);
    res.status(403).json({ error: "This account has been suspended." });
    return;
  }
  (req as Request & { userId: number }).userId = userId;
  next();
}

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim().charAt(0).toUpperCase();
  const b = lastName.trim().charAt(0).toUpperCase();
  return `${a}${b}` || "VB";
}

function memberSince(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function toPublicUser(row: UserRow) {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    username: row.username,
    email: row.email,
    avatarInitials: initials(row.first_name, row.last_name),
    avatarUrl: row.avatar_url ?? undefined,
    hasPassword: Boolean(row.password_hash),
    isAdmin: isAdminUser(row.id),
    isOwner: isOwnerUser(row.id),
    memberSince: memberSince(row.created_at),
    balance: row.balance,
    nextInvoiceDate: row.next_invoice_date,
    nextInvoiceAmount: row.next_invoice_amount,
    twoFactorEnabled: Boolean(row.two_factor_enabled),
    notificationPrefs: {
      serverAlerts: Boolean(row.notif_server_alerts),
      billingReminders: Boolean(row.notif_billing_reminders),
      productUpdates: Boolean(row.notif_product_updates),
      marketingEmails: Boolean(row.notif_marketing_emails),
    },
  };
}
