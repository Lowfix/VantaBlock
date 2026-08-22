import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Wifi, WifiOff, Server, Construction } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useUser } from "../../context/UserContext";
import { usePolling } from "../../lib/usePolling";

interface RelayNodeTunnel {
  nodeId: number;
  nodeName: string;
  tunnelIp: string;
  connected: boolean;
  lastHandshakeSecondsAgo: number | null;
}

interface RelayRoute {
  subdomain: string;
  port: number;
  backendIp: string;
  nodeName: string | null;
}

interface InfrastructureData {
  configured: boolean;
  publicIp: string | null;
  reachable: boolean;
  haproxyActive: boolean;
  tunnels: RelayNodeTunnel[];
  routes: RelayRoute[];
}

function handshakeLabel(seconds: number | null): string {
  if (seconds === null) return "Never";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function OwnerInfrastructurePage() {
  const { user: currentUser } = useUser();
  const [data, setData] = useState<InfrastructureData | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/owner/infrastructure", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(load, []);
  usePolling(load, 15000);

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  if (loading || !data) {
    return (
      <DashboardShell title="Infrastructure">
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-accent-400" />
        </div>
      </DashboardShell>
    );
  }

  if (!data.configured) {
    return (
      <DashboardShell title="Infrastructure">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Construction size={28} className="text-text-lo" />
            <p className="text-[13.5px] font-medium text-text-hi">Relay isn't configured on this box</p>
            <p className="max-w-sm text-[13px] text-text-lo">
              Set RELAY_HOST and RELAY_SSH_KEY_PATH in the environment to enable relay management here.
            </p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Infrastructure">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Relay VM</CardTitle>
              <CardDescription>The public-facing box that hides the home IP for actual Minecraft traffic.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone={data.reachable ? "good" : "bad"} dot>
                {data.reachable ? <Wifi size={11} /> : <WifiOff size={11} />}
                {data.reachable ? "Reachable" : "Unreachable"}
              </Badge>
              <Badge tone={data.haproxyActive ? "good" : "bad"}>HAProxy {data.haproxyActive ? "active" : "inactive"}</Badge>
              {data.publicIp && <span className="font-mono text-xs text-text-lo">{data.publicIp}</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Node tunnels</CardTitle>
              <CardDescription>WireGuard connection health between the relay and each Wings node.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.tunnels.length === 0 && <p className="py-4 text-center text-[13px] text-text-lo">No nodes wired into the relay yet.</p>}
            {data.tunnels.map((t) => (
              <div key={t.nodeId} className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-4 py-3">
                <div>
                  <p className="text-[13.5px] font-medium text-text-hi">{t.nodeName}</p>
                  <p className="font-mono text-xs text-text-lo">{t.tunnelIp}</p>
                </div>
                <div className="text-right">
                  <Badge tone={t.connected ? "good" : "bad"} dot>
                    {t.connected ? <Wifi size={11} /> : <WifiOff size={11} />}
                    {t.connected ? "Connected" : "Disconnected"}
                  </Badge>
                  <p className="mt-1 text-xs text-text-lo">Last handshake: {handshakeLabel(t.lastHandshakeSecondsAgo)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Active relay routes</CardTitle>
              <CardDescription>Read live from the relay's own config — exactly what's forwarding right now.</CardDescription>
            </div>
            <Server size={16} className="text-accent-400" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line-soft text-xs text-text-lo">
                    <th className="px-5 py-2.5 font-medium">Subdomain</th>
                    <th className="px-5 py-2.5 font-medium">Port</th>
                    <th className="px-5 py-2.5 font-medium">Routed to</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-6 text-center text-text-lo">
                        No active routes.
                      </td>
                    </tr>
                  )}
                  {data.routes.map((r) => (
                    <tr key={r.subdomain} className="border-b border-line-soft last:border-b-0">
                      <td className="px-5 py-3 font-mono text-text-hi">{r.subdomain}</td>
                      <td className="px-5 py-3 text-text-md">{r.port}</td>
                      <td className="px-5 py-3 text-text-md">
                        {r.nodeName ?? <span className="font-mono text-xs text-text-lo">{r.backendIp}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
