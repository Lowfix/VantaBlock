import { useEffect, useState } from "react";

export interface LiveServerStats {
  identifier: string;
  status: "online" | "offline" | "starting" | "stopping";
  cpuUsed: number;
  ramUsed: number;
  diskUsed: number;
  uptimeMs: number;
  ip: string | null;
  port: number;
  playersOnline: number;
  playersMax: number;
  playerNames: string[];
  billingStatus: "active" | "past_due" | "suspended";
  nextBillAt: string | null;
  gracePeriodEndsAt: string | null;
}

export function useLiveServerStats(identifier: string | null, intervalMs = 2000) {
  const [stats, setStats] = useState<LiveServerStats | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (!identifier) return;
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/servers/${identifier}`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as LiveServerStats;
        if (!stopped) {
          setStats(data);
          setUnreachable(false);
        }
      } catch {
        if (!stopped) setUnreachable(true);
      }
    }

    poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [identifier, intervalMs]);

  return { stats, unreachable };
}
