import Stripe from "stripe";
import { db } from "./db.js";

const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.3;

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe isn't configured yet.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

/**
 * The customer pays this much so that, after Stripe's own cut, Vantablock nets
 * exactly the amount they asked to add — the processing fee is surfaced to the
 * customer as a surcharge rather than absorbed silently.
 */
export function grossUpForStripeFee(netAmount: number): number {
  const gross = (netAmount + STRIPE_FIXED) / (1 - STRIPE_PERCENT);
  return Math.round(gross * 100) / 100;
}

export function stripeFeePortion(netAmount: number): number {
  return Math.round((grossUpForStripeFee(netAmount) - netAmount) * 100) / 100;
}

/**
 * Backs the embedded Payment Element on the Billing page — the card form itself
 * renders inline on our own page (never a Stripe-hosted redirect), but Stripe.js
 * still owns tokenizing and submitting the card data directly to Stripe.
 */
export async function createTopUpPaymentIntent(input: {
  userId: number;
  netAmount: number;
}): Promise<{ clientSecret: string }> {
  const stripe = getStripe();
  const grossAmount = grossUpForStripeFee(input.netAmount);

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(grossAmount * 100),
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { userId: String(input.userId), netAmount: input.netAmount.toFixed(2) },
    description: `Add $${input.netAmount.toFixed(2)} to Vantablock balance (includes $${stripeFeePortion(input.netAmount).toFixed(2)} processing fee)`,
  });

  if (!intent.client_secret) {
    throw new Error("Stripe didn't return a client secret.");
  }
  return { clientSecret: intent.client_secret };
}

/**
 * Verifies the webhook actually came from Stripe, then credits the balance —
 * guarded against double-crediting if Stripe retries delivery of the same event.
 */
export async function handleStripeWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Stripe webhook secret isn't configured yet.");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  if (event.type !== "payment_intent.succeeded") return;

  const intent = event.data.object as Stripe.PaymentIntent;
  const userId = Number(intent.metadata?.userId);
  const netAmount = Number(intent.metadata?.netAmount);
  if (!userId || !Number.isFinite(netAmount)) return;

  const alreadyProcessed = db.prepare("SELECT id FROM invoices WHERE stripe_session_id = ?").get(intent.id);
  if (alreadyProcessed) return;

  db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(netAmount, userId);
  db.prepare(
    "INSERT INTO invoices (user_id, description, amount, status, stripe_session_id) VALUES (?, ?, ?, 'paid', ?)"
  ).run(userId, "Balance top-up (card)", -netAmount, intent.id);
}
