import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { useUser } from "../context/UserContext";
import { useToast } from "../components/ui/Toast";
import { usePolling } from "../lib/usePolling";
import { AcceptRequestModal } from "../components/billing/AcceptRequestModal";

interface ServerRequest {
  id: number;
  name: string;
  planId: string;
  planName: string;
  ramMb: number | null;
  diskMb: number | null;
  cpuPercent: number | null;
  serverTypeName: string;
  version: string;
  status: "pending" | "approved" | "denied";
  denialReason: string | null;
  createdAt: string;
  username: string;
  email: string;
}

const statusTone: Record<ServerRequest["status"], "good" | "warn" | "bad"> = {
  approved: "good",
  pending: "warn",
  denied: "bad",
};

export function CreationRequestsPage() {
  const { user: currentUser } = useUser();
  const { push } = useToast();
  const [requests, setRequests] = useState<ServerRequest[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [accepting, setAccepting] = useState<ServerRequest | null>(null);

  async function loadRequests() {
    const res = await fetch("/api/requests", { credentials: "include" });
    if (res.ok) setRequests(await res.json());
  }

  useEffect(() => {
    loadRequests().catch(() => {});
  }, []);
  usePolling(() => {
    loadRequests().catch(() => {});
  }, 15000);

  if (!currentUser) return null;
  if (!currentUser.isAdmin) return <Navigate to="/dashboard" replace />;

  async function handleDeny(id: number) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/requests/${id}/deny`, { method: "POST", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to deny this request.");
      }
      push("Request denied.", "success");
      await loadRequests();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to deny this request.", "warn");
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  return (
    <DashboardShell title="Creation Requests">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pending requests</CardTitle>
              <CardDescription>Every server deploy needs approval right now — review and act on each one.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pending.length === 0 && (
              <p className="px-1 py-4 text-center text-[13px] text-text-lo">Nothing waiting on you.</p>
            )}
            {pending.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
                <div>
                  <p className="text-[13.5px] font-semibold text-text-hi">{r.name}</p>
                  <p className="mt-0.5 text-xs text-text-lo">
                    {r.username} ({r.email}) &middot; {r.serverTypeName} &middot; {r.planName} &middot; {r.version}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => handleDeny(r.id)}>
                    <X size={14} /> Deny
                  </Button>
                  <Button size="sm" disabled={busyId === r.id} onClick={() => setAccepting(r)}>
                    <Check size={14} /> Accept & configure
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {resolved.length > 0 && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Resolved</CardTitle>
                <CardDescription>Previously approved or denied requests.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {resolved.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
                  <div>
                    <p className="text-[13.5px] font-semibold text-text-hi">{r.name}</p>
                    <p className="mt-0.5 text-xs text-text-lo">
                      {r.username} &middot; {r.serverTypeName}
                      {r.status === "approved" ? ` · ${r.planName}` : ""}
                      {r.status === "denied" && r.denialReason ? ` · ${r.denialReason}` : ""}
                    </p>
                  </div>
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <AcceptRequestModal request={accepting} onClose={() => setAccepting(null)} onAccepted={loadRequests} />
    </DashboardShell>
  );
}
