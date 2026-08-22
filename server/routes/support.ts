import { Router } from "express";
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { db } from "../db.js";
import type { SupportTicketRow, SupportTicketMessageRow } from "../db.js";
import { requireAuth } from "../auth.js";
import { isOwnerUser } from "../adminGate.js";

export const supportRouter = Router();
supportRouter.use(requireAuth);

// Prevents a single account from flooding the support queue — generous
// enough for a real customer with a genuinely bad day, tight enough to blunt
// automated spam. Keyed by userId, not IP, since this is already
// authenticated.
const ticketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as Request & { userId: number }).userId),
  message: { error: "You're sending messages too quickly. Try again in a few minutes." },
});

function userId(req: Request): number {
  return (req as Request & { userId: number }).userId;
}

const insertTicket = db.prepare(
  `INSERT INTO support_tickets (user_id, server_identifier, server_name, subject) VALUES (?, ?, ?, ?)`
);
const insertTicketMessage = db.prepare(
  "INSERT INTO support_ticket_messages (ticket_id, author_id, is_owner, body) VALUES (?, ?, 0, ?)"
);

const insertReply = db.prepare(
  "INSERT INTO support_ticket_messages (ticket_id, author_id, is_owner, body) VALUES (?, ?, ?, ?)"
);
const touchTicket = db.prepare(
  "UPDATE support_tickets SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
);
const reopenTicket = db.prepare(
  "UPDATE support_tickets SET status = 'open', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
);

const addReply = db.transaction((ticketId: number, uid: number, isOwnerReply: boolean, body: string) => {
  insertReply.run(ticketId, uid, isOwnerReply ? 1 : 0, body);
  // A customer following up on a closed ticket reopens it automatically; the
  // owner replying doesn't change status — they close it explicitly when done.
  if (isOwnerReply) touchTicket.run(ticketId);
  else reopenTicket.run(ticketId);
});

const createTicket = db.transaction(
  (uid: number, serverIdentifier: string | null, serverName: string | null, subject: string, message: string): number => {
    const info = insertTicket.run(uid, serverIdentifier, serverName, subject);
    const ticketId = info.lastInsertRowid as number;
    insertTicketMessage.run(ticketId, uid, message);
    return ticketId;
  }
);

function requireOwner(req: Request, res: Response): boolean {
  if (!isOwnerUser(userId(req))) {
    res.status(403).json({ error: "Only the owner account can view this." });
    return false;
  }
  return true;
}

function toPublicTicket(row: SupportTicketRow & { username?: string | null; email?: string | null }) {
  return {
    id: row.id,
    serverIdentifier: row.server_identifier,
    serverName: row.server_name,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    username: row.username,
    email: row.email,
  };
}

function toPublicMessage(row: SupportTicketMessageRow & { username?: string | null }) {
  return {
    id: row.id,
    isOwner: row.is_owner === 1,
    body: row.body,
    createdAt: row.created_at,
    username: row.username,
  };
}

// Customer: their own tickets.
supportRouter.get("/tickets/mine", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId(req)) as SupportTicketRow[];
  res.json(rows.map((r) => toPublicTicket(r)));
});

// Owner: every ticket, across every customer.
supportRouter.get("/tickets", (req, res) => {
  if (!requireOwner(req, res)) return;
  // LEFT JOIN, not JOIN — a ticket must still show up here even if the
  // customer who filed it has since deleted their account (self-service
  // deletion doesn't cascade-delete tickets, on purpose, so support history
  // isn't silently lost). `toPublicTicket` already treats username/email as
  // optional for exactly this case.
  const rows = db
    .prepare(
      `SELECT support_tickets.*, users.username as username, users.email as email
       FROM support_tickets
       LEFT JOIN users ON users.id = support_tickets.user_id
       ORDER BY
         CASE support_tickets.status WHEN 'open' THEN 0 ELSE 1 END,
         support_tickets.updated_at DESC`
    )
    .all() as (SupportTicketRow & { username: string | null; email: string | null })[];
  res.json(rows.map((r) => toPublicTicket(r)));
});

function getTicketForViewer(req: Request, res: Response): SupportTicketRow | undefined {
  const ticket = db.prepare("SELECT * FROM support_tickets WHERE id = ?").get(req.params.id) as
    | SupportTicketRow
    | undefined;
  if (!ticket) {
    res.status(404).json({ error: "That ticket no longer exists." });
    return undefined;
  }
  if (ticket.user_id !== userId(req) && !isOwnerUser(userId(req))) {
    res.status(403).json({ error: "You don't have access to this ticket." });
    return undefined;
  }
  return ticket;
}

// Detail + full message thread — either the ticket's own author, or the owner.
supportRouter.get("/tickets/:id", (req, res) => {
  const ticket = getTicketForViewer(req, res);
  if (!ticket) return;

  const owner = db.prepare("SELECT username, email FROM users WHERE id = ?").get(ticket.user_id) as
    | { username: string; email: string }
    | undefined;
  // LEFT JOIN for the same reason as the ticket-list query above — a message
  // shouldn't vanish from the thread just because its author (owner or
  // customer) later deleted their account.
  const messages = db
    .prepare(
      `SELECT support_ticket_messages.*, users.username as username
       FROM support_ticket_messages
       LEFT JOIN users ON users.id = support_ticket_messages.author_id
       WHERE ticket_id = ?
       ORDER BY created_at ASC`
    )
    .all(ticket.id) as (SupportTicketMessageRow & { username: string | null })[];

  res.json({
    ticket: toPublicTicket({ ...ticket, username: owner?.username, email: owner?.email }),
    messages: messages.map((m) => toPublicMessage(m)),
  });
});

// Create a new ticket — always for yourself, optionally attached to one of your servers.
supportRouter.post("/tickets", ticketLimiter, (req, res) => {
  const { subject, message, serverIdentifier, serverName } = req.body ?? {};
  if (!subject || typeof subject !== "string" || !subject.trim()) {
    res.status(400).json({ error: "A subject is required." });
    return;
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "A message is required." });
    return;
  }

  const uid = userId(req);
  // One transaction: a ticket whose opening message failed to insert is a ticket
  // the owner sees in the queue with an empty thread and no way to know what was
  // being reported. See deployCharge.ts for why `.immediate` and not the default
  // deferred BEGIN.
  const ticketId = createTicket.immediate(
    uid,
    typeof serverIdentifier === "string" && serverIdentifier ? serverIdentifier : null,
    typeof serverName === "string" && serverName ? serverName : null,
    subject.trim(),
    message.trim()
  );
  res.status(201).json({ id: ticketId });
});

// Reply — the ticket's own author, or the owner replying to anyone's ticket.
supportRouter.post("/tickets/:id/reply", ticketLimiter, (req, res) => {
  const ticket = getTicketForViewer(req, res);
  if (!ticket) return;

  const { message } = req.body ?? {};
  if (!message || typeof message !== "string" || !message.trim()) {
    res.status(400).json({ error: "A message is required." });
    return;
  }

  const uid = userId(req);
  const isOwnerReply = isOwnerUser(uid);
  // Also transactional: a customer's reply that lands without its accompanying
  // reopen leaves the follow-up sitting inside a closed ticket, which is exactly
  // the thread the owner is not looking at.
  addReply.immediate(ticket.id, uid, isOwnerReply, message.trim());

  res.status(204).end();
});

supportRouter.post("/tickets/:id/close", (req, res) => {
  if (!requireOwner(req, res)) return;
  const ticket = db.prepare("SELECT id FROM support_tickets WHERE id = ?").get(req.params.id) as
    | Pick<SupportTicketRow, "id">
    | undefined;
  if (!ticket) {
    res.status(404).json({ error: "That ticket no longer exists." });
    return;
  }
  db.prepare(
    "UPDATE support_tickets SET status = 'closed', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ).run(ticket.id);
  res.status(204).end();
});

supportRouter.post("/tickets/:id/reopen", (req, res) => {
  if (!requireOwner(req, res)) return;
  const ticket = db.prepare("SELECT id FROM support_tickets WHERE id = ?").get(req.params.id) as
    | Pick<SupportTicketRow, "id">
    | undefined;
  if (!ticket) {
    res.status(404).json({ error: "That ticket no longer exists." });
    return;
  }
  db.prepare(
    "UPDATE support_tickets SET status = 'open', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"
  ).run(ticket.id);
  res.status(204).end();
});
