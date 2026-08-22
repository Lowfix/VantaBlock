import { db } from "./db.js";

export type ActivityCategory = "signup" | "request" | "server" | "admin" | "payment";

export interface ActivityEvent {
  type: string;
  category: ActivityCategory;
  description: string;
  timestamp: string;
}

/**
 * Records an event that has no other historical trace once it happens —
 * account admin actions and server deletions overwrite/remove the row they
 * describe, so unlike signups or deploys they can't be derived later from
 * current table state.
 */
export function logActivity(type: string, category: ActivityCategory, description: string): void {
  db.prepare("INSERT INTO activity_log (type, category, description) VALUES (?, ?, ?)").run(type, category, description);
}

/**
 * Builds the merged activity timeline. Signups, server deploys, request
 * lifecycle, and payments are read live off their source tables (they're
 * still there to query); admin actions and server deletions come from the
 * logged `activity_log` table since nothing else remembers them. `categories`
 * restricts which categories are included — omit for everything.
 */
export function getActivity(categories?: ActivityCategory[], limit = 1000): ActivityEvent[] {
  const want = (c: ActivityCategory) => !categories || categories.includes(c);
  const events: ActivityEvent[] = [];
  // Every source query below is capped at `limit` and ordered newest-first, so
  // the merged top-`limit` is exactly what an uncapped merge would have produced
  // — the (limit+1)th row of any single source can never outrank the limit-th
  // row of the merged set. Before this cap each call read *every* row of users,
  // servers, server_requests, invoices and activity_log into JS just to slice
  // the newest few off the top. That is not merely slow: better-sqlite3 is
  // synchronous, so the whole API froze for the duration. Measured with 500k
  // activity rows, one request to /api/owner/activity blocked every other
  // request — /api/health included — for ~1.5s, and it scales linearly from
  // there.

  if (want("signup")) {
    const rows = db.prepare("SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT ?").all(limit) as {
      username: string;
      created_at: string;
    }[];
    for (const r of rows) {
      events.push({ type: "signup", category: "signup", description: `${r.username} created an account`, timestamp: r.created_at });
    }
  }

  if (want("server")) {
    const rows = db
      .prepare(
        `SELECT s.name, s.created_at, u.username FROM servers s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT ?`
      )
      .all(limit) as { name: string; created_at: string; username: string }[];
    for (const r of rows) {
      events.push({ type: "server_created", category: "server", description: `${r.username} deployed "${r.name}"`, timestamp: r.created_at });
    }
  }

  if (want("request")) {
    const rows = db
      .prepare(
        `SELECT sr.name, sr.status, sr.created_at, sr.resolved_at, sr.denial_reason, u.username
         FROM server_requests sr JOIN users u ON u.id = sr.user_id
         ORDER BY MAX(sr.created_at, COALESCE(sr.resolved_at, sr.created_at)) DESC LIMIT ?`
      )
      .all(limit) as {
      name: string;
      status: string;
      created_at: string;
      resolved_at: string | null;
      denial_reason: string | null;
      username: string;
    }[];
    for (const r of rows) {
      events.push({
        type: "request_submitted",
        category: "request",
        description: `${r.username} requested "${r.name}"`,
        timestamp: r.created_at,
      });
      if (r.status === "approved" && r.resolved_at) {
        events.push({
          type: "request_approved",
          category: "request",
          description: `Request for "${r.name}" was approved`,
          timestamp: r.resolved_at,
        });
      } else if (r.status === "denied" && r.resolved_at) {
        events.push({
          type: "request_denied",
          category: "request",
          description: `Request for "${r.name}" was denied${r.denial_reason ? ` — ${r.denial_reason}` : ""}`,
          timestamp: r.resolved_at,
        });
      }
    }
  }

  if (want("payment")) {
    const rows = db
      .prepare(
        `SELECT i.amount, i.created_at, u.username FROM invoices i JOIN users u ON u.id = i.user_id
         WHERE i.description = 'Balance top-up (card)' ORDER BY i.created_at DESC LIMIT ?`
      )
      .all(limit) as { amount: number; created_at: string; username: string }[];
    for (const r of rows) {
      events.push({
        type: "payment",
        category: "payment",
        description: `${r.username} added $${Math.abs(r.amount).toFixed(2)} via Stripe`,
        timestamp: r.created_at,
      });
    }
  }

  const loggedCategories = (["admin", "server"] as ActivityCategory[]).filter(want);
  if (loggedCategories.length > 0) {
    const placeholders = loggedCategories.map(() => "?").join(",");
    const rows = db
      .prepare(
        `SELECT type, category, description, created_at FROM activity_log WHERE category IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`
      )
      .all(...loggedCategories, limit) as { type: string; category: ActivityCategory; description: string; created_at: string }[];
    for (const r of rows) {
      events.push({ type: r.type, category: r.category, description: r.description, timestamp: r.created_at });
    }
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}
