import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Server, Loader2, Users, UserPlus, Inbox, ShieldOff, ArrowRight, History, Cpu, MemoryStick } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Badge } from "../components/ui/Badge";
import { usePolling } from "../lib/usePolling";
import { activityCategoryIcon, activityCategoryLabel, type ActivityCategory, type ActivityEvent } from "../lib/activity";
import { cn } from "../lib/cn";

interface OverviewData {
  infra: {
    serverCounts: { total: number; ready: number; installing: number; failed: number };
    nodes: {
      id: number;
      name: string;
      maintenanceMode: boolean;
      memoryUsedMb: number;
      memoryTotalMb: number;
      diskUsedMb: number;
      diskTotalMb: number;
    }[];
  };
  resources: {
    totalCpuPercent: number;
    totalMemoryGb: number;
  };
  growth: {
    totalAccounts: number;
    newSignups7d: number;
    newSignups30d: number;
    pendingRequests: number;
    suspendedAccounts: number;
  };
  activity: ActivityEvent[];
}

// Overview never receives payment events from the API — this feed excludes $
// activity entirely, so the filter pills only need the non-money categories.
const overviewFilters: { id: ActivityCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "signup", label: activityCategoryLabel.signup },
  { id: "request", label: activityCategoryLabel.request },
  { id: "server", label: activityCategoryLabel.server },
  { id: "admin", label: activityCategoryLabel.admin },
];

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "accent",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "accent" | "good" | "warn" | "bad";
}) {
  const toneClasses = {
    accent: "text-accent-300 bg-accent-500/10",
    good: "text-good bg-good/10",
    warn: "text-warn bg-warn/10",
    bad: "text-bad bg-bad/10",
  };
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-lo">{label}</p>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-text-hi">{value}</p>
    </Card>
  );
}

export function OwnerOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityFilter, setActivityFilter] = useState<ActivityCategory | "all">("all");

  function loadOverview() {
    fetch("/api/overview", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(loadOverview, []);
  usePolling(loadOverview, 15000);

  if (loading || !data) {
    return (
      <DashboardShell title="Company Overview">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-accent-400" />
        </div>
      </DashboardShell>
    );
  }

  const { infra, resources, growth, activity } = data;
  const filteredActivity =
    activityFilter === "all" ? activity : activity.filter((e) => e.category === activityFilter);

  return (
    <DashboardShell title="Company Overview">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-lo">Live load</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard icon={Cpu} label="Total CPU load" value={`${resources.totalCpuPercent}%`} />
            <StatCard icon={MemoryStick} label="Total memory usage" value={`${resources.totalMemoryGb.toFixed(1)} GB`} />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Servers</CardTitle>
                <CardDescription>Current status across every deployed server.</CardDescription>
              </div>
              <Server size={16} className="text-accent-400" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-text-hi">{infra.serverCounts.total}</p>
                  <p className="text-xs text-text-lo">Total</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-good">{infra.serverCounts.ready}</p>
                  <p className="text-xs text-text-lo">Ready</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-warn">{infra.serverCounts.installing}</p>
                  <p className="text-xs text-text-lo">Installing</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-bad">{infra.serverCounts.failed}</p>
                  <p className="text-xs text-text-lo">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Wings nodes</CardTitle>
                <CardDescription>Live connection status and capacity per node.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {infra.nodes.map((n) => (
                <div key={n.id} className="rounded-lg border border-line bg-panel-2 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13.5px] font-medium text-text-hi">{n.name}</span>
                    {n.maintenanceMode && <Badge tone="warn">Maintenance</Badge>}
                  </div>
                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-text-lo">
                        <span>Memory</span>
                        <span>
                          {(n.memoryUsedMb / 1024).toFixed(1)} / {(n.memoryTotalMb / 1024).toFixed(0)} GB
                        </span>
                      </div>
                      <ProgressBar value={n.memoryUsedMb} max={n.memoryTotalMb} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-text-lo">
                        <span>Disk</span>
                        <span>
                          {(n.diskUsedMb / 1024).toFixed(0)} / {(n.diskTotalMb / 1024).toFixed(0)} GB
                        </span>
                      </div>
                      <ProgressBar value={n.diskUsedMb} max={n.diskTotalMb} />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-lo">Growth</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Users} label="Total accounts" value={String(growth.totalAccounts)} />
            <StatCard icon={UserPlus} label="New signups (7d / 30d)" value={`${growth.newSignups7d} / ${growth.newSignups30d}`} tone="good" />
            <Link to="/owner/servers?tab=requests">
              <StatCard icon={Inbox} label="Pending requests" value={String(growth.pendingRequests)} tone={growth.pendingRequests > 0 ? "warn" : "good"} />
            </Link>
            <StatCard icon={ShieldOff} label="Suspended accounts" value={String(growth.suspendedAccounts)} tone={growth.suspendedAccounts > 0 ? "bad" : "good"} />
          </div>
        </section>

        <section>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Signups, requests, and server changes across the whole business.</CardDescription>
              </div>
              <Link to="/owner/activity" className="flex items-center gap-1.5 text-[13px] font-medium text-accent-400 hover:text-accent-300">
                <History size={14} /> Full history
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {overviewFilters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActivityFilter(f.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      activityFilter === f.id
                        ? "border-accent-500/60 bg-accent-500/10 text-accent-300"
                        : "border-line bg-panel-2 text-text-lo hover:text-text-md"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {filteredActivity.length === 0 && (
                  <p className="py-6 text-center text-[13px] text-text-lo">Nothing here yet.</p>
                )}
                {filteredActivity.slice(0, 15).map((event, i) => {
                  const Icon = activityCategoryIcon[event.category];
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-line-soft bg-panel-2/60 px-3.5 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-300">
                        <Icon size={13} />
                      </span>
                      <span className="flex-1 text-[13px] text-text-md">{event.description}</span>
                      <span className="shrink-0 text-xs text-text-lo">
                        {new Date(event.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="flex justify-end">
          <Link to="/owner/servers" className="flex items-center gap-1.5 text-[13px] font-medium text-accent-400 hover:text-accent-300">
            View all servers <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
