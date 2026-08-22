import crypto from "node:crypto";
import { db } from "./db.js";
import * as pterodactyl from "./pterodactyl.js";
import { encryptClientKey } from "./secretCrypto.js";

function randomPassword(): string {
  return crypto.randomBytes(24).toString("base64url");
}

async function uniquePterodactylUsername(base: string): Promise<string> {
  // Pterodactyl usernames must be globally unique; Vantablock usernames only need to be
  // unique within our own DB, so collisions against existing Pterodactyl accounts (e.g.
  // "admin") are handled by suffixing rather than by pre-checking.
  return base.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 32) || "vantablock_user";
}

/**
 * Best-effort: creates a matching Pterodactyl user for a newly registered Vantablock
 * account and mints a Client API key for it, so the user's own servers can later be
 * looked up (and controlled) through their own credentials rather than a shared admin
 * key. Failures are logged and swallowed — Pterodactyl being unreachable should never
 * block signup.
 */
export async function mirrorPterodactylAccount(userId: number, input: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  if (!pterodactyl.isApplicationApiConfigured()) return;

  try {
    const password = randomPassword();
    const username = await uniquePterodactylUsername(input.username);

    let pterodactylUserId: number;
    try {
      pterodactylUserId = await pterodactyl.createApplicationUser({
        email: input.email,
        username,
        firstName: input.firstName,
        lastName: input.lastName,
        password,
      });
    } catch (err) {
      // Most likely a duplicate email/username already in Pterodactyl — retry once
      // with a suffixed username before giving up.
      const suffixed = `${username}_${Math.floor(Math.random() * 10000)}`;
      pterodactylUserId = await pterodactyl.createApplicationUser({
        email: input.email,
        username: suffixed,
        firstName: input.firstName,
        lastName: input.lastName,
        password,
      });
    }

    const clientKey = await pterodactyl.mintClientApiKeyForUser(input.email, password, "Vantablock");

    db.prepare("UPDATE users SET pterodactyl_user_id = ?, pterodactyl_client_key = ? WHERE id = ?").run(
      pterodactylUserId,
      encryptClientKey(clientKey),
      userId
    );
  } catch (err) {
    console.warn(
      `[pterodactyl] Could not mirror an account for user ${userId}:`,
      err instanceof Error ? err.message : err
    );
  }
}
