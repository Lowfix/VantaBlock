import { db } from "./db.js";
import type { UserRow } from "./db.js";

// The "owner" is the one account matching ADMIN_EMAIL — permanent, can't be demoted
// or suspended through the app. Any other account can be promoted to "admin" via
// the Account Management tab, which grants the same powers (deploy without
// approval, Bank access, approving requests) but stays revocable by the owner.
export function isOwnerUser(userId: number): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as Pick<UserRow, "email"> | undefined;
  return user?.email?.toLowerCase() === adminEmail.toLowerCase();
}

export function isAdminUser(userId: number): boolean {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  const user = db.prepare("SELECT email, is_admin FROM users WHERE id = ?").get(userId) as
    | Pick<UserRow, "email" | "is_admin">
    | undefined;
  if (!user) return false;
  return user.email.toLowerCase() === adminEmail.toLowerCase() || user.is_admin === 1;
}
