import { db } from "./db.js";
import { provisionServer } from "./provisioning.js";
import type { PlanLimits } from "./plans.js";
import type { ServerTypeConfig } from "./serverTypes.js";

const debitBalance = db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?");
const insertInvoice = db.prepare("INSERT INTO invoices (user_id, description, amount, status) VALUES (?, ?, ?, 'paid')");

const chargeForDeploy = db.transaction((userId: number, description: string, price: number) => {
  debitBalance.run(price, userId);
  insertInvoice.run(userId, description, price);
});

/**
 * Provisions a real server and charges its plan price against the owner's
 * balance in one step — used both for an admin's own immediate deploys and
 * for approving someone else's creation request.
 */
export async function deployAndCharge(input: {
  userId: number;
  ownerId: number;
  clientKey: string;
  name: string;
  plan: PlanLimits;
  serverType: ServerTypeConfig;
  version: string;
  generateSubdomain: boolean;
}): Promise<{ identifier: string }> {
  const created = await provisionServer(input);

  // Debit and ledger row go in together or not at all. As two loose statements a
  // failure (or a lock error) between them left a balance debited with no invoice
  // explaining it — the kind of drift nothing later reconciles, since the invoice
  // list *is* the record of what was charged.
  //
  // `.immediate` rather than the default deferred BEGIN: a deferred transaction
  // takes a read lock first and only tries to upgrade to a write lock at the
  // first write, and SQLite fails that upgrade with an immediate SQLITE_BUSY that
  // the busy handler is not allowed to retry. BEGIN IMMEDIATE takes the write
  // lock up front, where busy_timeout does apply.
  chargeForDeploy.immediate(input.userId, `${input.serverType.name} — ${input.plan.name} plan (${input.name})`, input.plan.price);

  return created;
}
