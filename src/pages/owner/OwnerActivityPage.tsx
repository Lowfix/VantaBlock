import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useUser } from "../../context/UserContext";
import { usePolling } from "../../lib/usePolling";
import { activityCategoryIcon, activityCategoryLabel, type ActivityCategory, type ActivityEvent } from "../../lib/activity";
import { cn } from "../../lib/cn";

const activityFilters: { id: ActivityCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "signup", label: activityCategoryLabel.signup },
  { id: "request", label: activityCategoryLabel.request },
  { id: "server", label: activityCategoryLabel.server },
  { id: "admin", label: activityCategoryLabel.admin },
];

const PAGE_SIZE = 30;

export function OwnerActivityPage() {
  const { user: currentUser } = useUser();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityCategory | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  function loadActivity() {
    fetch("/api/owner/activity", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  useEffect(loadActivity, []);
  usePolling(loadActivity, 15000);

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  const filtered = filter === "all" ? events : events.filter((e) => e.category === filter);
  const visible = filtered.slice(0, visibleCount);

  function handleFilterChange(next: ActivityCategory | "all") {
    setFilter(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <DashboardShell title="Activity">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Full activity history</CardTitle>
            <CardDescription>Every account, request, server, and admin event across Vantablock.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {activityFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => handleFilterChange(f.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  filter === f.id
                    ? "border-accent-500/60 bg-accent-500/10 text-accent-300"
                    : "border-line bg-panel-2 text-text-lo hover:text-text-md"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-accent-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {visible.length === 0 && <p className="py-10 text-center text-[13px] text-text-lo">Nothing here yet.</p>}
              {visible.map((event, i) => {
                const Icon = activityCategoryIcon[event.category];
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-line-soft bg-panel-2/60 px-3.5 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-300">
                      <Icon size={13} />
                    </span>
                    <span className="flex-1 text-[13px] text-text-md">{event.description}</span>
                    <span className="shrink-0 text-xs text-text-lo">
                      {new Date(event.timestamp).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}

              {visibleCount < filtered.length && (
                <div className="flex justify-center pt-2">
                  <Button variant="secondary" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
                    Load more
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
