import { db } from "./db.js";
import type { ServerRow, UserRow } from "./db.js";
import * as pterodactyl from "./pterodactyl.js";
import { findPlan } from "./plans.js";
import { BILLING_PERIOD_DAYS, GRACE_PERIOD_DAYS, daysFromNow } from "./billingConstants.js";

function chargeAndAdvance(server: ServerRow, price: number) {
  db.prepare("UPDATE users SET balance = balance - ? WHERE id = ?").run(price, server.user_id);
  db.prepare("INSERT INTO invoices (user_id, description, amount, status) VALUES (?, ?, ?, 'paid')").run(
    server.user_id,
    `Monthly renewal — ${server.name}`,
    price
  );
  db.prepare(
    "UPDATE servers SET billing_status = 'active', next_bill_at = ?, grace_period_ends_at = NULL WHERE id = ?"
  ).run(daysFromNow(BILLING_PERIOD_DAYS), server.id);
}

async function processServer(server: ServerRow, now: number): Promise<void> {
  const plan = findPlan(server.plan_id);
  if (!plan) return;
  const owner = db.prepare("SELECT balance FROM users WHERE id = ?").get(server.user_id) as
    | Pick<UserRow, "balance">
    | undefined;
  if (!owner) return;

  if (server.billing_status === "active") {
    if (!server.next_bill_at || new Date(server.next_bill_at).getTime() > now) return;
    if (owner.balance >= plan.price) {
      chargeAndAdvance(server, plan.price);
    } else {
      db.prepare("UPDATE servers SET billing_status = 'past_due', grace_period_ends_at = ? WHERE id = ?").run(
        daysFromNow(GRACE_PERIOD_DAYS),
        server.id
      );
    }
    return;
  }

  if (server.billing_status === "past_due") {
    if (owner.balance >= plan.price) {
      chargeAndAdvance(server, plan.price);
      return;
    }
    if (server.grace_period_ends_at && new Date(server.grace_period_ends_at).getTime() <= now) {
      if (server.pterodactyl_id) {
        await pterodactyl.suspendServer(server.pterodactyl_id);
      }
      db.prepare("UPDATE servers SET billing_status = 'suspended' WHERE id = ?").run(server.id);
    }
    return;
  }

  if (server.billing_status === "suspended") {
    if (owner.balance >= plan.price) {
      chargeAndAdvance(server, plan.price);
      if (server.pterodactyl_id) {
        await pterodactyl.unsuspendServer(server.pterodactyl_id);
      }
    }
  }
}

/**
 * Runs one pass of monthly billing across every tracked server: charges what's due,
 * starts a 3-day grace period for anything that can't pay, and suspends (via
 * Pterodactyl itself, which stops and locks the server) anything still unpaid once
 * the grace period ends. Balance sufficiency is re-checked every pass, so topping up
 * later automatically charges and unsuspends on the next tick — no manual retry needed.
 */
export async function runBillingCycle(): Promise<void> {
  const now = Date.now();
  const servers = db.prepare("SELECT * FROM servers WHERE status != 'failed'").all() as ServerRow[];
  for (const server of servers) {
    try {
      await processServer(server, now);
    } catch (err) {
      console.warn(`[billing] failed to process server ${server.pterodactyl_identifier}:`, err);
    }
  }
}
