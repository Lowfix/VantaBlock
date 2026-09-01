import { Link } from "react-router-dom";
import { Play, Square, RotateCw, Settings2, MoreVertical, MapPin } from "lucide-react";
import type { GameServer } from "../../mock-data/servers";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { ProgressBar } from "../ui/ProgressBar";
import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";

const statusTone = {
  online: "good",
  offline: "neutral",
  starting: "warn",
  stopping: "warn",
  restarting: "warn",
} as const;

const statusLabel = {
  online: "Online",
  offline: "Offline",
  starting: "Starting…",
  stopping: "Stopping…",
  restarting: "Restarting…",
} as const;

interface ServerCardProps {
  server: GameServer;
  onAction: (id: string, action: "start" | "stop" | "restart" | "kill") => void;
}

export function ServerCard({ server, onAction }: ServerCardProps) {
  const busy = server.status === "starting" || server.status === "stopping" || server.status === "restarting";

  return (
    <Card interactive className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={
                "h-2 w-2 shrink-0 rounded-full " +
                (server.status === "online" ? "bg-good animate-pulse-ring" : busy ? "bg-warn" : "bg-text-lo")
              }
            />
            <Link to={`/panel-preview/servers/${server.id}`} className="truncate text-[14.5px] font-semibold text-text-hi hover:text-accent-300">
              {server.name}
            </Link>
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-text-lo">
            <MapPin size={11} /> {server.location} · {server.software} {server.version}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={statusTone[server.status]} dot>
            {statusLabel[server.status]}
          </Badge>
          <Menu
            trigger={
              <button className="rounded-md p-1.5 text-text-lo transition-colors hover:bg-panel-3 hover:text-text-hi">
                <MoreVertical size={16} />
              </button>
            }
          >
            {server.status === "offline" ? (
              <MenuItem icon={<Play size={14} />} onClick={() => onAction(server.id, "start")}>
                Start
              </MenuItem>
            ) : (
              <MenuItem icon={<Square size={14} />} onClick={() => onAction(server.id, "stop")}>
                Stop
              </MenuItem>
            )}
            <MenuItem icon={<RotateCw size={14} />} onClick={() => onAction(server.id, "restart")}>
              Restart
            </MenuItem>
            <MenuSeparator />
            <Link to={`/panel-preview/servers/${server.id}`}>
              <MenuItem icon={<Settings2 size={14} />}>Manage</MenuItem>
            </Link>
          </Menu>
        </div>
      </div>

      <div className="mt-5 space-y-3.5">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-lo">Memory</span>
            <span className="text-text-md">
              {server.ramUsed.toFixed(1)} / {server.ramAllocated} GB
            </span>
          </div>
          <ProgressBar className="mt-1.5" value={server.ramUsed} max={server.ramAllocated} />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-lo">CPU</span>
            <span className="text-text-md">{server.cpuUsed}%</span>
          </div>
          <ProgressBar className="mt-1.5" value={server.cpuUsed} max={100} />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-line-soft pt-4">
        {server.status === "offline" ? (
          <button
            onClick={() => onAction(server.id, "start")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-2 py-2 text-[12.5px] font-medium text-text-md transition-colors hover:border-good/40 hover:text-good"
          >
            <Play size={13} /> Start
          </button>
        ) : (
          <button
            onClick={() => onAction(server.id, "stop")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-2 py-2 text-[12.5px] font-medium text-text-md transition-colors hover:border-bad/40 hover:text-bad disabled:opacity-40"
          >
            <Square size={13} /> Stop
          </button>
        )}
        <button
          onClick={() => onAction(server.id, "restart")}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-2 py-2 text-[12.5px] font-medium text-text-md transition-colors hover:border-accent-500/40 hover:text-accent-300 disabled:opacity-40"
        >
          <RotateCw size={13} /> Restart
        </button>
        <Link
          to={`/panel-preview/servers/${server.id}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent-500/10 py-2 text-[12.5px] font-medium text-accent-300 transition-colors hover:bg-accent-500/20"
        >
          <Settings2 size={13} /> Manage
        </Link>
      </div>
    </Card>
  );
}
