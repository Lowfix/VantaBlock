import { useEffect, useState } from "react";
import type { GameServer } from "../mock-data/servers";
import { plans } from "../mock-data/plans";

export interface MyPterodactylServer {
  identifier: string;
  name: string;
  ramAllocated: number;
  diskAllocated: number;
  planId: string | null;
  serverType: string;
  status: "online" | "offline" | "starting" | "stopping";
  cpuUsed: number;
  ramUsed: number;
  diskUsed: number;
  billingStatus: "active" | "past_due" | "suspended";
  nextBillAt: string | null;
  gracePeriodEndsAt: string | null;
}

export function pterodactylServerId(identifier: string): string {
  return `ptero-${identifier}`;
}

export function planName(planId: string | null): string {
  if (!planId) return "Custom";
  return plans.find((p) => p.id === planId)?.name ?? "Custom";
}

const SOFTWARE_LABELS: Record<string, GameServer["software"]> = {
  vanilla: "Vanilla",
  paper: "Paper",
  fabric: "Fabric",
  forge: "Forge",
  neoforge: "NeoForge",
};

export function softwareLabel(serverType: string): GameServer["software"] {
  return SOFTWARE_LABELS[serverType] ?? "Paper";
}

export function toGameServerPlaceholder(server: MyPterodactylServer): GameServer {
  return {
    id: pterodactylServerId(server.identifier),
    name: server.name,
    status: server.status,
    ip: "—",
    version: "—",
    software: softwareLabel(server.serverType),
    ramAllocated: server.ramAllocated,
    ramUsed: server.ramUsed,
    cpuUsed: server.cpuUsed,
    diskUsed: server.diskUsed,
    diskAllocated: server.diskAllocated,
    playersOnline: 0,
    playersMax: 0,
    plan: planName(server.planId),
    uptime: "—",
    location: "Local",
    motd: "",
    port: 0,
    billingStatus: server.billingStatus,
    nextBillAt: server.nextBillAt,
    gracePeriodEndsAt: server.gracePeriodEndsAt,
  };
}

export function applyLiveFields(existing: GameServer, live: MyPterodactylServer): GameServer {
  return {
    ...existing,
    name: live.name,
    status: live.status,
    ramAllocated: live.ramAllocated,
    diskAllocated: live.diskAllocated,
    ramUsed: live.ramUsed,
    cpuUsed: live.cpuUsed,
    diskUsed: live.diskUsed,
    plan: planName(live.planId),
    software: softwareLabel(live.serverType),
    billingStatus: live.billingStatus,
    nextBillAt: live.nextBillAt,
    gracePeriodEndsAt: live.gracePeriodEndsAt,
  };
}

/** Merges a fresh list of real servers into an existing GameServer[] state array —
 * updates ones already present (so live stats keep flowing) and appends new ones. */
export function mergeMyServers(list: GameServer[], myServers: MyPterodactylServer[]): GameServer[] {
  const byId = new Map(list.map((s) => [s.id, s]));
  for (const live of myServers) {
    const id = pterodactylServerId(live.identifier);
    const existing = byId.get(id);
    byId.set(id, existing ? applyLiveFields(existing, live) : toGameServerPlaceholder(live));
  }
  return [...byId.values()];
}

export function useMyServers(intervalMs = 3000) {
  const [servers, setServers] = useState<MyPterodactylServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/servers", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as MyPterodactylServer[];
        if (!cancelled) setServers(data);
      } catch {
        // keep the last known list on a transient failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { servers, loading };
}
