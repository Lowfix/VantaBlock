export const BILLING_PERIOD_DAYS = 30;
export const GRACE_PERIOD_DAYS = 3;

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
