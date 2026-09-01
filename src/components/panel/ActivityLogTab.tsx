import { useCallback, useEffect, useState } from "react";
import type { ComponentType } from "react";
import { History, Power, FolderOpen, Archive, Settings, Users2, Terminal, Network, Database, Clock, Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";
import { demoFetch } from "../../demo/api";

interface ActivityEntry {
  id: string;
  event: string;
  is_api: boolean;
  ip: string | null;
  description: string | null;
  timestamp: string;
}

function categoryOf(event: string): string {
  const parts = event.split(":");
  const rest = parts[1] ?? parts[0];
  return rest.split(".")[0] ?? "other";
}

const categoryIcon: Record<string, ComponentType<{ size?: number }>> = {
  power: Power,
  file: FolderOpen,
  backup: Archive,
  settings: Settings,
  user: Users2,
  subuser: Users2,
  schedule: Clock,
  allocation: Network,
  database: Database,
  console: Terminal,
};

const filters: { id: string; label: string; icon: ComponentType<{ size?: number }> }[] = [
  { id: "all", label: "All", icon: History },
  { id: "power", label: "Power", icon: Power },
  { id: "file", label: "Files", icon: FolderOpen },
  { id: "backup", label: "Backups", icon: Archive },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "subuser", label: "Users", icon: Users2 },
  { id: "schedule", label: "Schedules", icon: Clock },
];

function describeEvent(event: string): string {
  const parts = event.split(":");
  const rest = (parts[1] ?? parts[0]).split(".");
  const [category, action] = rest;
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return action ? `${label}: ${action.replace(/-/g, " ")}` : label;
}

export function ActivityLogTab({ identifier }: { identifier: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await demoFetch(`/api/servers/${identifier}/activity`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { activity: ActivityEntry[] };
      setEntries(data.activity);
    } catch {
      // fail quietly — an empty activity log isn't alarming
    } finally {
      setLoading(false);
    }
  }, [identifier]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === "all" ? entries : entries.filter((e) => categoryOf(e.event) === filter);

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-3">
        {filters.map((f) => {
          const Icon = f.icon;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "border-accent-500/40 bg-accent-500/10 text-accent-300"
                  : "border-line bg-panel-2 text-text-md hover:border-line-soft hover:text-text-hi"
              )}
            >
              <Icon size={13} />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="divide-y divide-line-soft">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-text-lo">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-lo">No activity in this category.</p>
        )}
        {!loading &&
          filtered.map((entry) => {
            const Icon = categoryIcon[categoryOf(entry.event)] ?? History;
            return (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel-3 text-text-lo">
                  <Icon size={14} />
                </span>
                <p className="min-w-0 flex-1 truncate text-[13.5px] text-text-md">
                  <span className="font-medium text-text-hi">{describeEvent(entry.event)}</span>
                  {entry.is_api && <span className="ml-2 text-xs text-text-lo">via API</span>}
                </p>
                <span className="shrink-0 text-xs text-text-lo">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
