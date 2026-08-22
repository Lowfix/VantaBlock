import crypto from "node:crypto";
import { db } from "./db.js";
import type { InviteCodeRow } from "./db.js";

// Avoids visually-ambiguous characters (0/O, 1/I/L) since these get typed by
// hand off a screen or a message from a friend.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 10): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

export function generateInviteCode(): InviteCodeRow {
  // Collisions are astronomically unlikely at this alphabet/length, but a
  // fresh code is cheap enough to just retry on the rare UNIQUE conflict.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const code = randomCode();
      const info = db.prepare("INSERT INTO invite_codes (code) VALUES (?)").run(code);
      return db.prepare("SELECT * FROM invite_codes WHERE id = ?").get(info.lastInsertRowid) as InviteCodeRow;
    } catch {
      // UNIQUE constraint hit — try again with a new random code.
    }
  }
  throw new Error("Failed to generate a unique invite code.");
}

export function listInviteCodes(): (InviteCodeRow & { usedByUsername: string | null; usedByEmail: string | null })[] {
  return db
    .prepare(
      `SELECT ic.*, u.username as usedByUsername, u.email as usedByEmail
       FROM invite_codes ic
       LEFT JOIN users u ON u.id = ic.used_by_user_id
       ORDER BY ic.created_at DESC`
    )
    .all() as (InviteCodeRow & { usedByUsername: string | null; usedByEmail: string | null })[];
}

/**
 * Atomically claims a code for a user — only succeeds if the code exists and
 * hasn't already been used, so two near-simultaneous registrations can't both
 * consume the same single-use code.
 */
export function consumeInviteCode(code: string, userId: number): boolean {
  const normalized = code.trim().toUpperCase();
  const result = db
    .prepare(
      `UPDATE invite_codes
       SET used_by_user_id = ?, used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE code = ? AND used_by_user_id IS NULL`
    )
    .run(userId, normalized);
  return result.changes === 1;
}

export function deleteInviteCode(id: number): void {
  db.prepare("DELETE FROM invite_codes WHERE id = ? AND used_by_user_id IS NULL").run(id);
}
