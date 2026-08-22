import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// better-sqlite3 already applies a 5000ms busy timeout by default, but relying on
// an undocumented library default for something this load-bearing is how it
// silently changes under you on an upgrade — set it explicitly.
//
// Read this before tuning the number. better-sqlite3 is *synchronous*, so the
// busy handler sleeps on the Node event loop thread: while this connection waits
// for a write lock held by some *other* process, the entire API is frozen — every
// route, including /api/health. Measured under load: an external process holding a
// write transaction stalled every in-flight request for the full timeout, then the
// request failed with a raw `SqliteError: database is locked`.
//
// Within this process there is no contention to absorb (better-sqlite3 serializes
// every statement on one connection), so this timeout only ever matters against an
// external writer — a one-off maintenance script run against the live DB, or two
// API instances briefly overlapping across a restart. 5s is long enough to ride out
// a normal short script and short enough that a genuinely stuck writer surfaces as
// an error instead of an unbounded hang; index.ts's error handler turns that error
// into a retryable 503 rather than a 500.
db.pragma("busy_timeout = 5000");

// Cap how large the WAL file is left sitting at on disk.
//
// A WAL never shrinks on its own. Checkpointing copies its pages into the main
// database and then *reuses* the same file space — it does not give the space
// back — so the file permanently keeps the high-water mark of the single
// largest write burst. Production reached a **126MB WAL against a 2.4MB
// database** and stayed there. Verified locally: without this pragma a WAL that
// grows to 78MB is still 78MB after any amount of subsequent normal traffic;
// with it, the next ordinary checkpoint pulls it straight back down to the
// limit.
//
// Worth correcting a plausible-sounding misdiagnosis, since it cost time once:
// this is *not* caused by the long-lived read-only `db-viewer.mjs` connection
// holding file descriptors open. Reproduced with exactly that setup — a passive
// checkpoint still reported `busy: 0` and checkpointed every frame, and a
// TRUNCATE still shrank the file to zero, all with the reader connected. Open
// descriptors don't block a checkpoint; an idle connection holds no read mark.
// What that reader *does* prevent is the last-connection-close cleanup that
// deletes the WAL outright, which is why the file also survives an API restart.
//
// 16MB is ~6x the current database and well above the ~4MB steady state normal
// request traffic produces, so this only ever truncates after an abnormal burst
// rather than fighting the WAL during routine operation. It also bounds how much
// has to be replayed on crash recovery.
db.pragma("journal_size_limit = 16777216");

// Reclaim the WAL at startup so a restart is a reliable way to reset it. Normally
// SQLite deletes the WAL when the *last* connection closes, but `db-viewer.mjs`
// holds a permanent read-only connection, so that cleanup never runs on this box.
// Nothing else is writing at module load, so this is cheap; wrapped because a
// checkpoint that can't get the lock is a non-event, not a reason to fail boot.
try {
  db.pragma("wal_checkpoint(TRUNCATE)");
} catch (err) {
  console.warn("[db] startup WAL checkpoint skipped:", err instanceof Error ? err.message : err);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    avatar_url TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'password',
    balance REAL NOT NULL DEFAULT 0,
    next_invoice_date TEXT NOT NULL DEFAULT 'No invoices yet',
    next_invoice_amount REAL NOT NULL DEFAULT 0,
    two_factor_enabled INTEGER NOT NULL DEFAULT 0,
    notif_server_alerts INTEGER NOT NULL DEFAULT 1,
    notif_billing_reminders INTEGER NOT NULL DEFAULT 1,
    notif_product_updates INTEGER NOT NULL DEFAULT 0,
    notif_marketing_emails INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    pterodactyl_identifier TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

const serverColumns = db.prepare("PRAGMA table_info(servers)").all() as { name: string }[];
const hasServerColumn = (name: string) => serverColumns.some((c) => c.name === name);
if (!hasServerColumn("server_type")) {
  db.exec("ALTER TABLE servers ADD COLUMN server_type TEXT NOT NULL DEFAULT 'paper'");
}
if (!hasServerColumn("pterodactyl_id")) {
  db.exec("ALTER TABLE servers ADD COLUMN pterodactyl_id INTEGER");
}
if (!hasServerColumn("billing_status")) {
  db.exec("ALTER TABLE servers ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'active'");
}
if (!hasServerColumn("next_bill_at")) {
  db.exec("ALTER TABLE servers ADD COLUMN next_bill_at TEXT");
  // Existing servers predate this column — give them a fresh full cycle starting now
  // instead of billing them immediately on the next cron tick.
  db.exec(
    `UPDATE servers SET next_bill_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 days') WHERE next_bill_at IS NULL`
  );
}
if (!hasServerColumn("grace_period_ends_at")) {
  db.exec("ALTER TABLE servers ADD COLUMN grace_period_ends_at TEXT");
}
if (!hasServerColumn("subdomain")) {
  db.exec("ALTER TABLE servers ADD COLUMN subdomain TEXT");
}
if (!hasServerColumn("subdomain_relayed")) {
  db.exec("ALTER TABLE servers ADD COLUMN subdomain_relayed INTEGER NOT NULL DEFAULT 0");
}
if (!hasServerColumn("ram_mb")) {
  db.exec("ALTER TABLE servers ADD COLUMN ram_mb INTEGER");
}
if (!hasServerColumn("disk_mb")) {
  db.exec("ALTER TABLE servers ADD COLUMN disk_mb INTEGER");
}
if (!hasServerColumn("cpu_percent")) {
  db.exec("ALTER TABLE servers ADD COLUMN cpu_percent INTEGER");
}
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_servers_subdomain ON servers(subdomain) WHERE subdomain IS NOT NULL");

export interface ServerRow {
  id: number;
  user_id: number;
  pterodactyl_identifier: string;
  pterodactyl_id: number | null;
  plan_id: string;
  server_type: string;
  name: string;
  status: string;
  billing_status: "active" | "past_due" | "suspended";
  next_bill_at: string | null;
  grace_period_ends_at: string | null;
  subdomain: string | null;
  // Whether the *current* subdomain (if any) was set up via the relay VM —
  // recorded at save time rather than inferred later, since a node can become
  // relay-capable after a subdomain was already saved the direct-IP way.
  subdomain_relayed: 0 | 1;
  // Non-null for a custom-configured server (plan_id is '' in that case) —
  // set directly by the owner instead of coming from a fixed plan tier.
  ram_mb: number | null;
  disk_mb: number | null;
  cpu_percent: number | null;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

const invoiceColumns = db.prepare("PRAGMA table_info(invoices)").all() as { name: string }[];
if (!invoiceColumns.some((c) => c.name === "stripe_session_id")) {
  // SQLite can't add a UNIQUE column via ALTER TABLE — the uniqueness (which is
  // what stops a retried Stripe webhook from double-crediting) comes from the
  // partial index below instead.
  db.exec("ALTER TABLE invoices ADD COLUMN stripe_session_id TEXT");
}
db.exec(
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_session_id ON invoices(stripe_session_id) WHERE stripe_session_id IS NOT NULL"
);

export interface InvoiceRow {
  id: number;
  user_id: number;
  description: string;
  amount: number;
  status: string;
  stripe_session_id: string | null;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS server_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    server_type_id TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    identifier TEXT,
    denial_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    resolved_at TEXT
  );
`);

const requestColumns = db.prepare("PRAGMA table_info(server_requests)").all() as { name: string }[];
if (!requestColumns.some((c) => c.name === "generate_subdomain")) {
  db.exec("ALTER TABLE server_requests ADD COLUMN generate_subdomain INTEGER NOT NULL DEFAULT 1");
}
if (!requestColumns.some((c) => c.name === "ram_mb")) {
  db.exec("ALTER TABLE server_requests ADD COLUMN ram_mb INTEGER");
}
if (!requestColumns.some((c) => c.name === "disk_mb")) {
  db.exec("ALTER TABLE server_requests ADD COLUMN disk_mb INTEGER");
}
if (!requestColumns.some((c) => c.name === "cpu_percent")) {
  db.exec("ALTER TABLE server_requests ADD COLUMN cpu_percent INTEGER");
}

export interface ServerRequestRow {
  id: number;
  user_id: number;
  name: string;
  plan_id: string;
  server_type_id: string;
  version: string;
  status: "pending" | "approved" | "denied";
  identifier: string | null;
  denial_reason: string | null;
  generate_subdomain: 0 | 1;
  // Filled in by the owner at approval time (not by the requester) — null
  // while the request is still pending.
  ram_mb: number | null;
  disk_mb: number | null;
  cpu_percent: number | null;
  created_at: string;
  resolved_at: string | null;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

export interface ActivityLogRow {
  id: number;
  type: string;
  category: string;
  description: string;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    server_identifier TEXT,
    server_name TEXT,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

export interface SupportTicketRow {
  id: number;
  user_id: number;
  server_identifier: string | null;
  server_name: string | null;
  subject: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

export interface SupportTicketMessageRow {
  id: number;
  ticket_id: number;
  author_id: number;
  is_owner: 0 | 1;
  body: string;
  created_at: string;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS feature_flags (
    key TEXT PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS invite_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    used_by_user_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    used_at TEXT
  );
`);

export interface InviteCodeRow {
  id: number;
  code: string;
  used_by_user_id: number | null;
  created_at: string;
  used_at: string | null;
}

export interface FeatureFlagRow {
  key: string;
  enabled: 0 | 1;
}

const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
const hasColumn = (name: string) => userColumns.some((c) => c.name === name);
if (!hasColumn("pterodactyl_user_id")) {
  db.exec("ALTER TABLE users ADD COLUMN pterodactyl_user_id INTEGER");
}
if (!hasColumn("pterodactyl_client_key")) {
  db.exec("ALTER TABLE users ADD COLUMN pterodactyl_client_key TEXT");
}
if (!hasColumn("is_admin")) {
  db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
}
if (!hasColumn("suspended")) {
  db.exec("ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0");
}

export interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  password_hash: string | null;
  avatar_url: string | null;
  auth_provider: string;
  balance: number;
  next_invoice_date: string;
  next_invoice_amount: number;
  two_factor_enabled: number;
  notif_server_alerts: number;
  notif_billing_reminders: number;
  notif_product_updates: number;
  notif_marketing_emails: number;
  created_at: string;
  pterodactyl_user_id: number | null;
  // Plaintext Pterodactyl client API key for this user's mirrored account. Local-dev-only
  // simplification — a production build should encrypt this at rest.
  pterodactyl_client_key: string | null;
  is_admin: 0 | 1;
  suspended: 0 | 1;
}

// Tracks plugins installed onto a real server through the Plugins tab's Modrinth
// browser (server/plugins.ts) — not a cache of what's physically on disk, since that's
// reconciled live against a `/plugins` directory listing instead (see BACKEND.md's
// Plugins section). This is what makes "update available" checking possible without
// re-parsing every installed jar's plugin.yml on every page load.
db.exec(`
  CREATE TABLE IF NOT EXISTS server_plugins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_identifier TEXT NOT NULL,
    source TEXT NOT NULL,
    project_id TEXT NOT NULL,
    project_name TEXT NOT NULL,
    project_author TEXT NOT NULL,
    version_id TEXT NOT NULL,
    version_name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    installed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_server_plugins_identity ON server_plugins(server_identifier, file_name);
`);

export interface ServerPluginRow {
  id: number;
  server_identifier: string;
  source: "modrinth";
  project_id: string;
  project_name: string;
  project_author: string;
  version_id: string;
  version_name: string;
  file_name: string;
  enabled: 0 | 1;
  installed_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Indexes for the hot query shapes.
//
// Every one of these backs a query that runs on a page load and was previously a
// full table scan. That matters more here than in a server with an async driver:
// better-sqlite3 is synchronous, so a scan doesn't just make *its* request slow,
// it blocks the whole single-threaded API for the duration. `IF NOT EXISTS` keeps
// this idempotent like the rest of this file (see BACKEND.md — db.ts *is* the
// migration system).
// ---------------------------------------------------------------------------
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_activity_log_category_created ON activity_log(category, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);
  CREATE INDEX IF NOT EXISTS idx_servers_created_at ON servers(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_server_requests_user_id ON server_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_server_requests_status ON server_requests(status);
  CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
`);
