export type ServerStatus = "online" | "offline" | "starting" | "stopping" | "restarting";
export type BillingStatus = "active" | "past_due" | "suspended";

export interface GameServer {
  id: string;
  name: string;
  status: ServerStatus;
  ip: string | null;
  version: string;
  software: "Paper" | "Fabric" | "Forge" | "NeoForge" | "Vanilla" | "Purpur";
  ramAllocated: number;
  ramUsed: number;
  cpuUsed: number;
  diskUsed: number;
  diskAllocated: number;
  playersOnline: number;
  playersMax: number;
  plan: string;
  uptime: string;
  location: string;
  motd: string;
  port: number;
  billingStatus: BillingStatus;
  nextBillAt: string | null;
  gracePeriodEndsAt: string | null;
}

// Demo/placeholder servers were removed now that the panel is wired to real
// Pterodactyl data — the list is populated live from useMyServers instead.
export const servers: GameServer[] = [];
