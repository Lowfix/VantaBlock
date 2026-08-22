import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Construction, SlidersHorizontal, Loader2 } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Toggle } from "../../components/ui/Toggle";
import { useUser } from "../../context/UserContext";
import { useToast } from "../../components/ui/Toast";
import { usePolling } from "../../lib/usePolling";

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export function OwnerSettingsPage() {
  const { user: currentUser } = useUser();
  const { push } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  function loadFlags() {
    fetch("/api/owner/features", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setFlags)
      .finally(() => setLoading(false));
  }

  useEffect(loadFlags, []);
  usePolling(loadFlags, 15000);

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  async function handleToggle(flag: FeatureFlag) {
    const nextValue = !flag.enabled;
    setTogglingKey(flag.key);
    setFlags((list) => list.map((f) => (f.key === flag.key ? { ...f, enabled: nextValue } : f)));
    try {
      const res = await fetch(`/api/owner/features/${flag.key}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextValue }),
      });
      if (!res.ok) throw new Error();
      push(`${flag.label} is now ${nextValue ? "on" : "off"}.`, nextValue ? "success" : "warn");
    } catch {
      setFlags((list) => list.map((f) => (f.key === flag.key ? { ...f, enabled: !nextValue } : f)));
      push(`Failed to update ${flag.label}.`, "warn");
    } finally {
      setTogglingKey(null);
    }
  }

  return (
    <DashboardShell title="Settings">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Feature toggles</CardTitle>
              <CardDescription>Turn platform features on or off without a deploy — changes apply immediately.</CardDescription>
            </div>
            <SlidersHorizontal size={16} className="text-accent-400" />
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-accent-400" />
              </div>
            ) : (
              flags.map((flag) => (
                <div
                  key={flag.key}
                  className="flex items-center justify-between gap-4 border-b border-line-soft py-3.5 last:border-b-0"
                >
                  <div>
                    <p className="text-[13.5px] font-medium text-text-hi">{flag.label}</p>
                    <p className="mt-0.5 max-w-lg text-xs text-text-lo">{flag.description}</p>
                  </div>
                  <Toggle
                    checked={flag.enabled}
                    onChange={() => handleToggle(flag)}
                    disabled={togglingKey === flag.key}
                    label={flag.label}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Construction size={26} className="text-text-lo" />
            <p className="text-[13.5px] font-medium text-text-hi">Plan pricing & server types not editable yet</p>
            <p className="max-w-sm text-[13px] text-text-lo">
              Still hardcoded in the codebase — making them live-editable is a real schema change worth its own
              conversation before building.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
