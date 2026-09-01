// Mirrors server/stripeBilling.ts's math exactly, so the UI can preview the total
// live as the customer types without a round-trip to the server.
const STRIPE_PERCENT = 0.029;
const STRIPE_FIXED = 0.3;

export function grossUpForStripeFee(netAmount: number): number {
  const gross = (netAmount + STRIPE_FIXED) / (1 - STRIPE_PERCENT);
  return Math.round(gross * 100) / 100;
}

export function stripeFeePortion(netAmount: number): number {
  return Math.round((grossUpForStripeFee(netAmount) - netAmount) * 100) / 100;
}
