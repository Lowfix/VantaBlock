import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../auth.js";
import { createTopUpPaymentIntent } from "../stripeBilling.js";
import { isFeatureEnabled } from "../featureFlags.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.post("/intent", async (req, res) => {
  if (!isFeatureEnabled("stripe_topups")) {
    res.status(403).json({ error: "Adding funds is turned off right now — check back later." });
    return;
  }

  const userId = (req as Request & { userId: number }).userId;
  const { amount } = req.body ?? {};
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "Enter a valid amount greater than $0." });
    return;
  }

  try {
    const { clientSecret } = await createTopUpPaymentIntent({ userId, netAmount: amount });
    res.json({ clientSecret });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Failed to start payment." });
  }
});
