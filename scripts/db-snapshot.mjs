// Takes a consistent snapshot of the live SQLite database and proves it's usable
// before anyone relies on it. Called by scripts/backup-db.sh.
//
//   node scripts/db-snapshot.mjs <source.db> <dest.db>
//
// `VACUUM INTO` is safe against a live WAL-mode database being written to by the
// running API: it's a read transaction with respect to the source, so the API
// never blocks and the source file is never modified. Verified on production
// against the live DB with the API up. It also defragments, so the snapshot is
// usually far smaller than the live file.
//
// Exits non-zero on any problem, so the caller can refuse to ship a bad backup.

import Database from "better-sqlite3";
import { rmSync } from "node:fs";

const [source, dest] = process.argv.slice(2);

if (!source || !dest) {
  console.error("usage: node db-snapshot.mjs <source.db> <dest.db>");
  process.exit(2);
}

// A leftover from a previous failed run would make VACUUM INTO fail outright.
rmSync(dest, { force: true });

const live = new Database(source, { readonly: true, fileMustExist: true });

try {
  live.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
} catch (err) {
  console.error(`snapshot failed: ${err.message}`);
  process.exit(1);
}

// "A file appeared" is not the same as "a restorable backup exists" — check that
// the copy is structurally sound and holds every row the live database holds.
const copy = new Database(dest, { readonly: true, fileMustExist: true });

const integrity = copy.pragma("integrity_check", { simple: true });
if (integrity !== "ok") {
  console.error(`snapshot failed integrity_check: ${integrity}`);
  process.exit(1);
}

const tables = live
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((r) => r.name);

if (tables.length === 0) {
  console.error("snapshot failed: source database has no tables");
  process.exit(1);
}

let rows = 0;
const mismatches = [];

for (const table of tables) {
  const quoted = `"${table.replace(/"/g, '""')}"`;
  const before = live.prepare(`SELECT COUNT(*) AS c FROM ${quoted}`).get().c;
  const after = copy.prepare(`SELECT COUNT(*) AS c FROM ${quoted}`).get().c;
  if (before !== after) mismatches.push(`${table} (live ${before}, snapshot ${after})`);
  rows += after;
}

live.close();
copy.close();

// A row-count drift means the snapshot raced a write in a way VACUUM INTO should
// have made impossible — treat it as a failed backup rather than shipping it.
if (mismatches.length > 0) {
  console.error(`snapshot row counts differ from live: ${mismatches.join(", ")}`);
  process.exit(1);
}

console.log(`ok: ${tables.length} tables, ${rows} rows, integrity_check passed`);
