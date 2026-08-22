import crypto from "node:crypto";

// Encrypts `users.pterodactyl_client_key` at rest. Same fail-closed reasoning
// as SESSION_SECRET in auth.ts — no hardcoded fallback, refuse to start
// rather than silently handling secrets with a key every reader of this file
// also knows.
if (!process.env.CLIENT_KEY_ENCRYPTION_KEY) {
  throw new Error(
    "CLIENT_KEY_ENCRYPTION_KEY must be set (see .env) — refusing to start with no key for encrypting pterodactyl_client_key."
  );
}
const KEY = Buffer.from(process.env.CLIENT_KEY_ENCRYPTION_KEY, "base64");
if (KEY.length !== 32) {
  throw new Error("CLIENT_KEY_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256-GCM.");
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the AES-GCM standard/recommended size
const ENC_PREFIX = "enc:v1:";

/**
 * Encrypts a Pterodactyl client API key for storage. Always produces a fresh
 * random IV, so encrypting the same plaintext twice gives different output —
 * expected and fine, only one encrypted value is ever stored at a time.
 */
export function encryptClientKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv + authTag + ciphertext, base64-packed together — one column, one string.
  return ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypts a stored client key. Existing rows written before this feature
 * shipped are plain, unprefixed strings — those pass through unchanged
 * rather than failing, so migrating old rows to ciphertext can happen later,
 * separately, instead of needing a flag-day cutover. `null`/empty pass
 * through too, matching every call site's existing `user.pterodactyl_client_key`
 * nullability.
 */
export function decryptClientKey<T extends string | null | undefined>(stored: T): T {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
  const packed = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = packed.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8") as T;
}
