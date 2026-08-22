// One-off migration: encrypts every `users.pterodactyl_client_key` row still
// stored in plaintext, using the exact same AES-256-GCM scheme as
// server/secretCrypto.ts (kept duplicated here on purpose — this script has
// to run standalone with plain `node`, not through tsx/tsc, so it can't
// import the compiled server module directly).
//
//   node scripts/migrate-encrypt-client-keys.mjs <data.db path> [--dry-run]
//
// Requires CLIENT_KEY_ENCRYPTION_KEY in the environment (source .env first).
//
// Safety model:
//   - Takes its own pre-migration snapshot (via scripts/db-snapshot.mjs, same
//     VACUUM INTO + verify approach the nightly backup uses) before writing
//     anything, independent of the nightly backup job.
//   - Every row is encrypted, then immediately decrypted back and compared to
//     the original plaintext BEFORE the UPDATE runs. A row only ever gets
//     overwritten once its own round-trip is proven correct.
//   - Idempotent: only touches rows that don't already start with the
//     "enc:v1:" prefix, so re-running after a partial/interrupted run is
//     always safe and picks up exactly where it left off.
//   - `--dry-run` reports what would happen without writing anything.
//   - Exits non-zero if anything failed to migrate, so it's never silently
//     "mostly done."

import Database from "better-sqlite3";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dbPath = args.find((a) => !a.startsWith("--"));

if (!dbPath) {
  console.error("usage: node migrate-encrypt-client-keys.mjs <data.db path> [--dry-run]");
  process.exit(2);
}
if (!process.env.CLIENT_KEY_ENCRYPTION_KEY) {
  console.error("CLIENT_KEY_ENCRYPTION_KEY must be set in the environment (source .env first).");
  process.exit(2);
}

const KEY = Buffer.from(process.env.CLIENT_KEY_ENCRYPTION_KEY, "base64");
if (KEY.length !== 32) {
  console.error("CLIENT_KEY_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes.");
  process.exit(2);
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENC_PREFIX = "enc:v1:";

function encryptClientKey(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

function decryptClientKey(stored) {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
  const packed = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = packed.subarray(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

const db = new Database(dbPath, { fileMustExist: true });

const candidates = db
  .prepare("SELECT id, pterodactyl_client_key FROM users WHERE pterodactyl_client_key IS NOT NULL AND pterodactyl_client_key NOT LIKE 'enc:v1:%'")
  .all();

console.log(`[migrate] ${candidates.length} plaintext row(s) found${dryRun ? " (dry run — nothing will be written)" : ""}`);

if (candidates.length === 0) {
  console.log("[migrate] nothing to do.");
  process.exit(0);
}

if (dryRun) {
  console.log(`[migrate] would migrate user ids: ${candidates.map((r) => r.id).join(", ")}`);
  process.exit(0);
}

// --- pre-migration snapshot, independent of the nightly backup ---------------
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const snapshotPath = `${dbPath}.pre-clientkey-migration-${stamp}`;
console.log(`[migrate] taking pre-migration snapshot: ${snapshotPath}`);
try {
  execFileSync("node", [path.join(__dirname, "db-snapshot.mjs"), dbPath, snapshotPath], { stdio: "inherit" });
} catch {
  console.error("[migrate] pre-migration snapshot failed verification — refusing to touch live data.");
  process.exit(1);
}

// --- migrate, one verified row at a time --------------------------------------
const update = db.prepare("UPDATE users SET pterodactyl_client_key = ? WHERE id = ?");

let migrated = 0;
const failures = [];

for (const row of candidates) {
  try {
    const encrypted = encryptClientKey(row.pterodactyl_client_key);
    const roundTrip = decryptClientKey(encrypted);
    if (roundTrip !== row.pterodactyl_client_key) {
      throw new Error("round-trip mismatch after encrypt — refusing to write");
    }
    update.run(encrypted, row.id);
    migrated++;
    console.log(`[migrate] user ${row.id}: ok`);
  } catch (err) {
    failures.push({ id: row.id, error: err instanceof Error ? err.message : String(err) });
    console.error(`[migrate] user ${row.id}: FAILED — ${err instanceof Error ? err.message : err}`);
  }
}

const remainingPlaintext = db
  .prepare("SELECT COUNT(*) AS c FROM users WHERE pterodactyl_client_key IS NOT NULL AND pterodactyl_client_key NOT LIKE 'enc:v1:%'")
  .get().c;

db.close();

console.log(`[migrate] done: ${migrated} migrated, ${failures.length} failed, ${remainingPlaintext} plaintext row(s) remain`);
if (failures.length > 0) {
  console.error(`[migrate] failed ids: ${failures.map((f) => f.id).join(", ")} — re-run this script to retry them (idempotent).`);
  process.exit(1);
}
