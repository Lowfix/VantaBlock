import { useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Search, ArrowUpDown, Loader2, Check, X, ExternalLink } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useUser } from "../../context/UserContext";
import { useToast } from "../../components/ui/Toast";
import { usePolling } from "../../lib/usePolling";
import { cn } from "../../lib/cn";
import { AcceptRequestModal } from "../../components/billing/AcceptRequestModal";

type Tab = "all" | "requests";

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All Servers" },
  { id: "requests", label: "Requests" },
];

export function OwnerServersPage() {
  const { user: currentUser } = useUser();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "requests" ? "requests" : "all";
  const [tab, setTab] = useState<Tab>(initialTab);

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardShell title="Servers">
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-line bg-panel-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-panel-3 text-text-hi" : "text-text-lo hover:text-text-md"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "all" && <AllServersTab />}
      {tab === "requests" && <RequestsTab />}
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// All Servers
// ---------------------------------------------------------------------------

interface OwnerServer {
  id: number;
  identifier: string;
  panelUrl: string;
  name: string;
  planName: string;
  planPrice: number;
  serverTypeName: string;
  status: string;
  subdomain: string | null;
  createdAt: string;
  owner: { id: number; username: string; email: string };
}

type SortKey = "name" | "planPrice" | "createdAt";

const statusTone: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  ready: "good",
  installing: "warn",
  failed: "bad",
};

function AllServersTab() {
  const [searchParams] = useSearchParams();
  const deepLinkIdentifier = searchParams.get("identifier");
  const [servers, setServers] = useState<OwnerServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(deepLinkIdentifier ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function loadServers() {
    fetch("/api/owner/servers", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setServers)
      .finally(() => setLoading(false));
  }

  useEffect(loadServers, []);
  usePolling(loadServers, 15000);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = servers.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.identifier.toLowerCase().includes(q) ||
        s.owner.username.toLowerCase().includes(q) ||
        s.owner.email.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "planPrice") cmp = a.planPrice - b.planPrice;
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [servers, query, sortKey, sortDir]);

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    return (
      <button onClick={() => toggleSort(sortKeyName)} className="flex items-center gap-1 font-medium text-text-lo transition-colors hover:text-text-hi">
        {label}
        <ArrowUpDown size={11} className={sortKey === sortKeyName ? "text-accent-400" : "text-text-lo"} />
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>All servers</CardTitle>
          <CardDescription>Every server deployed across every customer.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-lo" />
          <Input
            placeholder="Search by server name, username, or email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-accent-400" />
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line-soft bg-panel-2 text-xs text-text-lo">
                  <th className="px-4 py-2.5">
                    <SortHeader label="Server" sortKeyName="name" />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5">
                    <SortHeader label="Plan" sortKeyName="planPrice" />
                  </th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5">
                    <SortHeader label="Deployed" sortKeyName="createdAt" />
                  </th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-text-lo">
                      No servers found.
                    </td>
                  </tr>
                )}
                {filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      if (s.panelUrl) window.open(s.panelUrl, "_blank", "noopener,noreferrer");
                    }}
                    title="Open this server in Pterodactyl"
                    className={cn(
                      "cursor-pointer border-b border-line-soft transition-colors last:border-b-0 hover:bg-panel-3",
                      s.identifier === deepLinkIdentifier && "bg-accent-500/10"
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-hi">{s.name}</p>
                      {s.subdomain && <p className="font-mono text-xs text-text-lo">{s.subdomain}.duxy.online</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-text-md">{s.owner.username}</p>
                      <p className="text-xs text-text-lo">{s.owner.email}</p>
                    </td>
                    <td className="px-4 py-3 text-text-md">{s.serverTypeName}</td>
                    <td className="px-4 py-3">
                      <p className="text-text-hi">{s.planName}</p>
                      <p className="text-xs text-text-lo">${s.planPrice.toFixed(2)}/mo</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone[s.status] ?? "neutral"}>{s.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-md">
                      {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-text-lo">
                      <ExternalLink size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

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

const statusToneRequest: Record<ServerRequest["status"], "good" | "warn" | "bad"> = {
  approved: "good",
  pending: "warn",
  denied: "bad",
};

function RequestsTab() {
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Pending requests</CardTitle>
            <CardDescription>Every server deploy needs approval right now — review and act on each one.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {pending.length === 0 && <p className="px-1 py-4 text-center text-[13px] text-text-lo">Nothing waiting on you.</p>}
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
                <Badge tone={statusToneRequest[r.status]}>{r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AcceptRequestModal request={accepting} onClose={() => setAccepting(null)} onAccepted={loadRequests} />
    </div>
  );
}
