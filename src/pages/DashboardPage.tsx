import { useEffect, useState } from "react";
import { Server, Activity, Cpu, Plus } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { ServerCard } from "../components/dashboard/ServerCard";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import type { GameServer } from "../mock-data/servers";
import { useUser } from "../context/UserContext";
import { useToast } from "../components/ui/Toast";
import { useMyServers, mergeMyServers } from "../lib/useMyServers";
import { DeployServerModal } from "../components/billing/DeployServerModal";
import { demoFetch } from "../demo/api";

const PTERO_PREFIX = "ptero-";

export function DashboardPage() {
  const [servers, setServers] = useState<GameServer[]>([]);
  const [deploying, setDeploying] = useState(false);
  const { user: currentUser } = useUser();
  const { push } = useToast();
  const { servers: myServers } = useMyServers();

  useEffect(() => {
    setServers((list) => mergeMyServers(list, myServers));
  }, [myServers]);

  if (!currentUser) return null;

  function handleAction(id: string, action: "start" | "stop" | "restart" | "kill") {
    const server = servers.find((s) => s.id === id);
    if (!server || !id.startsWith(PTERO_PREFIX)) return;

    const identifier = id.slice(PTERO_PREFIX.length);
    push(`Sending ${action} to ${server.name}...`, "info");
    demoFetch(`/api/servers/${identifier}/power`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        push(`${action[0].toUpperCase()}${action.slice(1)} sent to ${server.name}.`, "success");
      })
      .catch(() => push(`Failed to send ${action} to ${server.name}.`, "warn"));
  }

  function handleDeployed(name: string, status: "deploying" | "pending") {
    push(
      status === "pending"
        ? `Request to create "${name}" was sent for approval.`
        : `Deploying "${name}"... this can take a minute or two.`,
      "info"
    );
  }

  const activeServers = servers.filter((s) => s.status === "online").length;
  const totalRamUsed = servers.reduce((sum, s) => sum + s.ramUsed, 0);
  const totalRamAllocated = servers.reduce((sum, s) => sum + s.ramAllocated, 0);
  const avgCpu = servers.length ? Math.round(servers.reduce((sum, s) => sum + s.cpuUsed, 0) / servers.length) : 0;

  const stats = [
    { label: "Total servers", value: servers.length, icon: Server },
    { label: "Active now", value: `${activeServers} / ${servers.length}`, icon: Activity },
    { label: "Memory in use", value: `${totalRamUsed.toFixed(1)} / ${totalRamAllocated} GB`, icon: Cpu },
    { label: "Avg. CPU load", value: `${avgCpu}%`, icon: Cpu },
  ];

  return (
    <DashboardShell title="Overview">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-text-hi">
            Welcome back, {currentUser.firstName}
          </h2>
          <p className="mt-1 text-[13.5px] text-text-lo">Here's what's happening across your servers.</p>
        </div>
        <Button size="md" onClick={() => setDeploying(true)}>
          <Plus size={15} /> Deploy new server
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-lo">{stat.label}</p>
              <stat.icon size={15} className="text-accent-400" />
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-text-hi">{stat.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-text-hi">Your servers</h3>
          </div>
          {servers.length === 0 ? (
            <Card className="mt-4 flex flex-col items-center justify-center gap-3 p-10 text-center">
              <Server size={22} className="text-text-lo" />
              <div>
                <p className="text-[13.5px] font-medium text-text-hi">No servers yet</p>
                <p className="mt-1 text-xs text-text-lo">Deploy your first server to see it here.</p>
              </div>
            </Card>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {servers.map((server) => (
                <ServerCard key={server.id} server={server} onAction={handleAction} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-[15px] font-semibold text-text-hi">Resource usage</h3>
          <Card className="mt-4 p-5">
            <p className="text-xs text-text-lo">Across all servers this month</p>
            <div className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-text-lo">Bandwidth used</span>
                <span className="font-medium text-text-hi">412 GB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-lo">Storage used</span>
                <span className="font-medium text-text-hi">
                  {servers.reduce((s, srv) => s + srv.diskUsed, 0)} GB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-lo">Backups stored</span>
                <span className="font-medium text-text-hi">18</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DeployServerModal open={deploying} onClose={() => setDeploying(false)} onDeployed={handleDeployed} />
    </DashboardShell>
  );
}
