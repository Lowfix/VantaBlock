// Mirrors src/mock-data/plans.ts. Kept as a separate copy rather than a shared
// import since the server and client live in different TS project configs —
// the numbers here (RAM/disk in MB, cpu as a percentage of one core) are what
// actually get sent to Pterodactyl when provisioning or resizing a server.
export interface PlanLimits {
  id: string;
  name: string;
  price: number;
  ramMb: number;
  diskMb: number;
  cpuPercent: number;
}

export const PLANS: PlanLimits[] = [
  { id: "sprout", name: "Sprout", price: 2.99, ramMb: 2048, diskMb: 20480, cpuPercent: 200 },
  { id: "sapling", name: "Sapling", price: 5.99, ramMb: 4096, diskMb: 40960, cpuPercent: 200 },
  { id: "thicket", name: "Thicket", price: 8.99, ramMb: 6144, diskMb: 61440, cpuPercent: 200 },
  { id: "grove", name: "Grove", price: 11.99, ramMb: 8192, diskMb: 81920, cpuPercent: 300 },
  { id: "woodland", name: "Woodland", price: 14.99, ramMb: 10240, diskMb: 102400, cpuPercent: 300 },
  { id: "redwood", name: "Redwood", price: 17.99, ramMb: 12288, diskMb: 122880, cpuPercent: 300 },
];

export function findPlan(planId: string): PlanLimits | undefined {
  return PLANS.find((p) => p.id === planId);
}

/**
 * A free, owner-configured allocation instead of a fixed priced tier — used
 * for any customer deploy that bypasses the request queue entirely without
 * picking a plan. `id: ""` is the sentinel stored in `servers`/`server_requests`
 * for "not a real plan".
 */
export function customPlanLimits(ramMb: number, diskMb: number, cpuPercent: number): PlanLimits {
  return { id: "", name: "Custom", price: 0, ramMb, diskMb, cpuPercent };
}

/**
 * A real named plan tier, but with its price zeroed out — used when accepting
 * a server request, since this phase runs free for friends but the plan's
 * id/name/resources should still show up as e.g. "Sapling" rather than
 * "Custom" everywhere the server's plan gets displayed.
 */
export function freePlan(plan: PlanLimits): PlanLimits {
  return { ...plan, price: 0 };
}
