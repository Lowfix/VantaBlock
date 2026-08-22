import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { ChevronRight, Trash2, UploadCloud, Maximize2, Minimize2, Play, Square, RotateCw, Power, Users2, Globe2, Hash, Cpu, MemoryStick, HardDrive, Radio } from "lucide-react";
import type { GameServer } from "../../mock-data/servers";
import { initialConsoleLines, consoleLineGenerators, mockPlayerNames } from "../../mock-data/console";
import { AreaChart, MultiLineChart } from "../ui/UsageChart";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/cn";
import { formatConsoleLine, type ConsoleToken } from "../../lib/consoleFormatting";

function tokenStyle(token: ConsoleToken): CSSProperties | undefined {
  if (!token.color && !token.bold && !token.italic && !token.underline) return undefined;
  return {
    color: token.color,
    fontWeight: token.bold ? 600 : undefined,
    fontStyle: token.italic ? "italic" : undefined,
    textDecoration: token.underline ? "underline" : undefined,
  };
}

function timestamp() {
  const d = new Date();
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function clockLabel(offsetMs = 0) {
  const d = new Date(Date.now() + offsetMs);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function randomLine(): string {
  const template = consoleLineGenerators[Math.floor(Math.random() * consoleLineGenerators.length)];
  const player = mockPlayerNames[Math.floor(Math.random() * mockPlayerNames.length)];
  return template.replace("{time}", timestamp()).replace("{player}", player);
}

const commandResponses: Record<string, (arg: string) => string> = {
  say: (arg) => `[Server] ${arg}`,
  list: () => "There are 11 of a max of 45 players online: Kestrel_, wildberry_pie, GraniteFox",
  whitelist: () => "Whitelist is now reloaded",
  gamemode: (arg) => `Set own game mode to ${arg || "SURVIVAL"} Mode`,
  weather: (arg) => `Set the weather to ${arg || "clear"}`,
  time: (arg) => `Set the time to ${arg || "1000"}`,
  save: () => "Saved the game",
  help: () => "Use /help [page] to see all commands. This is a mock console — most commands are simulated.",
};

const HISTORY_LENGTH = 12;

function seedSeries(base: number, spread: number) {
  return Array.from({ length: HISTORY_LENGTH }, () => Math.max(0, base + (Math.random() - 0.5) * spread));
}

interface LiveConsoleProps {
  lines: string[];
  connected: boolean;
  sendCommand: (command: string) => void;
  stats: {
    cpuAbsolute: number;
    memoryBytes: number;
    diskBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
  } | null;
}

interface ConsoleTabProps {
  server: GameServer;
  identifier: string | null;
  onPower: (action: "start" | "stop" | "restart" | "kill") => void;
  busy: boolean;
  live?: LiveConsoleProps;
}

export function ConsoleTab({ server, identifier, onPower, busy, live }: ConsoleTabProps) {
  const [lines, setLines] = useState<string[]>(live ? [] : initialConsoleLines);
  const [connectionAddress, setConnectionAddress] = useState<string | null>(null);

  const loadSubdomain = useCallback(async () => {
    if (!identifier) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/subdomain`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { subdomain: string | null; rootDomain: string };
      setConnectionAddress(data.subdomain ? `${data.subdomain}.${data.rootDomain}` : null);
    } catch {
      // No subdomain set yet, or couldn't reach it — fall back to the raw IP:port below.
    }
  }, [identifier]);

  useEffect(() => {
    loadSubdomain();
  }, [loadSubdomain]);
  const [clearedIndex, setClearedIndex] = useState(0);
  const [command, setCommand] = useState("");
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isOnline = server.status === "online";
  const { push } = useToast();
  const displayLines = live ? live.lines.slice(clearedIndex) : lines;

  // The console websocket pushes fresh stats about once a second — much faster than
  // the REST poll backing `server` — so prefer it for the top cards when connected.
  const liveCpuUsed = live?.stats ? Math.round(live.stats.cpuAbsolute) : server.cpuUsed;
  const liveRamUsed = live?.stats ? live.stats.memoryBytes / 1024 / 1024 / 1024 : server.ramUsed;
  const liveDiskUsed = live?.stats ? live.stats.diskBytes / 1024 / 1024 / 1024 : server.diskUsed;

  const [memSeries, setMemSeries] = useState(() => seedSeries(server.ramUsed, server.ramAllocated * 0.15));
  const [cpuSeries, setCpuSeries] = useState(() => seedSeries(server.cpuUsed, 25));
  const [rxSeries, setRxSeries] = useState(() => seedSeries(0.4, 0.3));
  const [txSeries, setTxSeries] = useState(() => seedSeries(0.3, 0.25));
  const [timeLabels, setTimeLabels] = useState(() =>
    Array.from({ length: HISTORY_LENGTH }, (_, i) => clockLabel((i - (HISTORY_LENGTH - 1)) * 2000))
  );
  const prevNetworkRef = useRef<{ rx: number; tx: number; t: number } | null>(null);

  // Only auto-scroll to the newest line when the user was already reading the
  // bottom of the log — otherwise a new line arriving mid-scrollback yanks
  // them back down before they can read anything.
  const atBottomRef = useRef(true);
  const AT_BOTTOM_THRESHOLD_PX = 48;

  function handleConsoleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= AT_BOTTOM_THRESHOLD_PX;
  }

  useEffect(() => {
    if (!atBottomRef.current) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [displayLines]);

  useEffect(() => {
    if (!isOnline || live) return;
    const interval = setInterval(() => {
      setLines((prev) => [...prev.slice(-200), randomLine()]);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [isOnline, live, server.id]);

  useEffect(() => {
    if (!isOnline || live) return;
    const interval = setInterval(() => {
      setMemSeries((prev) => [...prev.slice(1), Math.max(0.2, Math.min(server.ramAllocated, prev[prev.length - 1] + (Math.random() - 0.5) * server.ramAllocated * 0.08))]);
      setCpuSeries((prev) => [...prev.slice(1), Math.max(2, Math.min(100, prev[prev.length - 1] + (Math.random() - 0.5) * 18))]);
      setRxSeries((prev) => [...prev.slice(1), Math.max(0, prev[prev.length - 1] + (Math.random() - 0.5) * 0.3)]);
      setTxSeries((prev) => [...prev.slice(1), Math.max(0, prev[prev.length - 1] + (Math.random() - 0.5) * 0.25)]);
      setTimeLabels((prev) => [...prev.slice(1), clockLabel()]);
    }, 2000);
    return () => clearInterval(interval);
  }, [isOnline, live, server.ramAllocated]);

  useEffect(() => {
    if (!live?.stats) return;
    const s = live.stats;
    const now = Date.now();
    let rxRate = 0;
    let txRate = 0;
    const prev = prevNetworkRef.current;
    if (prev) {
      const dtSeconds = (now - prev.t) / 1000;
      if (dtSeconds > 0) {
        rxRate = Math.max(0, (s.networkRxBytes - prev.rx) / dtSeconds / 1024 / 1024);
        txRate = Math.max(0, (s.networkTxBytes - prev.tx) / dtSeconds / 1024 / 1024);
      }
    }
    prevNetworkRef.current = { rx: s.networkRxBytes, tx: s.networkTxBytes, t: now };

    setMemSeries((prev) => [...prev.slice(1), s.memoryBytes / 1024 / 1024 / 1024]);
    setCpuSeries((prev) => [...prev.slice(1), s.cpuAbsolute]);
    setRxSeries((prev) => [...prev.slice(1), rxRate]);
    setTxSeries((prev) => [...prev.slice(1), txRate]);
    setTimeLabels((prev) => [...prev.slice(1), clockLabel()]);
  }, [live?.stats]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) return;
    atBottomRef.current = true;

    if (live) {
      live.sendCommand(trimmed);
      setCommand("");
      return;
    }

    const [cmd, ...rest] = trimmed.replace(/^\//, "").split(" ");
    const arg = rest.join(" ");
    const responder = commandResponses[cmd.toLowerCase()];
    const response = responder ? responder(arg) : `Unknown command "${cmd}". Type "help" for a list of commands.`;

    setLines((prev) => [
      ...prev,
      `[${timestamp()} INFO]: Console issued server command: /${trimmed}`,
      `[${timestamp()} INFO]: ${response}`,
    ]);
    setCommand("");
  }

  function handleUploadLogs() {
    push("Logs uploaded — share link copied to clipboard (mock).", "success");
  }

  const serverIdShort = server.id.replace("srv-", "").slice(0, 8).padEnd(8, "0").toUpperCase();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Radio} label="Status" tone={isOnline ? "good" : "neutral"}>
          <div className="flex items-center justify-between">
            <span className={cn("text-[13px] font-semibold uppercase tracking-wide", isOnline ? "text-good" : "text-text-lo")}>
              {server.status}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] text-text-md">
              <Users2 size={13} className="text-text-lo" />
              {server.playersOnline} / {server.playersMax}
            </span>
          </div>
        </StatCard>
        <StatCard icon={Globe2} label="Connection address" tone="accent">
          <span className="font-mono text-[13px] text-text-hi">
            {connectionAddress ?? (server.ip ? `${server.ip}:${server.port}` : "Not available yet")}
          </span>
        </StatCard>
        <StatCard icon={Hash} label="Server ID" tone="accent">
          <span className="font-mono text-[13px] text-text-hi">{serverIdShort}</span>
        </StatCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Cpu} label="CPU" tone="accent">
          <span className="text-[13px] text-text-hi">
            {isOnline ? liveCpuUsed : 0}% <span className="text-text-lo">/ 200%</span>
          </span>
        </StatCard>
        <StatCard icon={MemoryStick} label="RAM" tone="accent">
          <span className="text-[13px] text-text-hi">
            {liveRamUsed.toFixed(2)} GB <span className="text-text-lo">/ {server.ramAllocated} GB</span>
          </span>
        </StatCard>
        <StatCard icon={HardDrive} label="Storage" tone="accent">
          <span className="text-[13px] text-text-hi">
            {liveDiskUsed.toFixed(2)} GB <span className="text-text-lo">/ {server.diskAllocated} GB</span>
          </span>
        </StatCard>
      </div>

      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-line bg-ink transition-[height] duration-300",
          expanded ? "h-[760px]" : "h-[420px]"
        )}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
          <span className="text-xs font-medium text-text-lo">Console output</span>
          <span className="flex items-center gap-1.5 text-xs text-text-lo">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? (live.connected ? "bg-good" : "bg-warn") : isOnline ? "bg-good" : "bg-text-lo"}`} />
            {live ? (live.connected ? "Connected to Wings" : "Connecting...") : isOnline ? "Streaming live" : "Server offline"}
          </span>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleConsoleScroll}
          className="flex-1 space-y-1 overflow-y-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed"
        >
          {displayLines.map((line, i) => {
            const { prefix, body } = formatConsoleLine(line);
            return (
              <p key={i} className="break-words text-text-md">
                {prefix.length > 0 && (
                  <span className="text-text-lo">{prefix.map((t) => t.text).join("")}</span>
                )}
                {body.map((token, j) =>
                  token.href ? (
                    <a
                      key={j}
                      href={token.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-dotted underline-offset-2 hover:text-accent-300"
                      style={tokenStyle(token)}
                    >
                      {token.text}
                    </a>
                  ) : (
                    <span key={j} style={tokenStyle(token)}>
                      {token.text}
                    </span>
                  )
                )}
              </p>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-line-soft px-3 py-3">
          <ChevronRight size={15} className="shrink-0 text-accent-400" />
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={isOnline ? "Type a command..." : "Server must be online to run commands"}
            disabled={!isOnline}
            className="flex-1 bg-transparent font-mono text-[13px] text-text-hi placeholder:text-text-lo outline-none disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => {
              atBottomRef.current = true;
              if (live) setClearedIndex(live.lines.length);
              else setLines([]);
            }}
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs font-medium text-text-md transition-colors hover:bg-panel-3"
          >
            <Trash2 size={12} /> Clear
          </button>
          <button
            type="button"
            onClick={handleUploadLogs}
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2.5 py-1.5 text-xs font-medium text-text-md transition-colors hover:bg-panel-3"
          >
            <UploadCloud size={12} /> Upload logs
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-line bg-panel-2 p-1.5 text-text-md transition-colors hover:bg-panel-3"
            aria-label={expanded ? "Collapse console" : "Expand console"}
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </form>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-panel/60 px-4 py-3.5">
        <PowerButton icon={Play} label="Start" tone="good" onClick={() => onPower("start")} disabled={busy || isOnline} />
        <PowerButton icon={RotateCw} label="Restart" tone="accent" onClick={() => onPower("restart")} disabled={busy || !isOnline} />
        <PowerButton icon={Square} label="Stop" tone="bad" onClick={() => onPower("stop")} disabled={busy || !isOnline} />
        <PowerButton icon={Power} label="Kill" tone="bad" onClick={() => onPower("kill")} disabled={!isOnline} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Memory usage" icon={MemoryStick}>
          <AreaChart
            data={memSeries}
            max={server.ramAllocated}
            color="#8257ff"
            yLabels={[`${server.ramAllocated}GB`, `${(server.ramAllocated / 2).toFixed(1)}GB`, "0GB"]}
            xLabels={[timeLabels[0], timeLabels[Math.floor(timeLabels.length / 2)], timeLabels[timeLabels.length - 1]]}
          />
        </ChartCard>
        <ChartCard title="CPU usage" icon={Cpu}>
          <AreaChart
            data={cpuSeries}
            max={100}
            color="#9a7bff"
            yLabels={["100%", "50%", "0%"]}
            xLabels={[timeLabels[0], timeLabels[Math.floor(timeLabels.length / 2)], timeLabels[timeLabels.length - 1]]}
          />
        </ChartCard>
        <ChartCard title="Network usage" icon={Globe2} legend={[{ label: "Receive", color: "#8257ff" }, { label: "Transmit", color: "#f2555a" }]}>
          <MultiLineChart
            series={[
              { label: "Receive", color: "#8257ff", data: rxSeries },
              { label: "Transmit", color: "#f2555a", data: txSeries },
            ]}
            max={Math.max(1, ...rxSeries, ...txSeries)}
            yLabels={["max", "", "0"]}
            xLabels={[timeLabels[0], timeLabels[Math.floor(timeLabels.length / 2)], timeLabels[timeLabels.length - 1]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  tone,
  children,
}: {
  icon: typeof Cpu;
  label: string;
  tone: "accent" | "good" | "neutral";
  children: ReactNode;
}) {
  const toneClasses = {
    accent: "text-accent-300 bg-accent-500/10",
    good: "text-good bg-good/10",
    neutral: "text-text-lo bg-panel-3",
  };
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel/60">
      <div className={cn("flex items-center gap-2 px-4 py-2 text-[12.5px] font-medium", toneClasses[tone])}>
        <Icon size={14} />
        {label}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  legend,
  children,
}: {
  title: string;
  icon: typeof Cpu;
  legend?: { label: string; color: string }[];
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium text-text-hi">
          <Icon size={14} className="text-accent-400" />
          {title}
        </div>
        {legend && (
          <div className="flex items-center gap-3">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-text-lo">
                <span className="h-1.5 w-3 rounded-full" style={{ backgroundColor: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PowerButton({
  icon: Icon,
  label,
  tone,
  onClick,
  disabled,
}: {
  icon: typeof Play;
  label: string;
  tone: "good" | "bad" | "accent";
  onClick: () => void;
  disabled?: boolean;
}) {
  const toneClasses = {
    good: "hover:border-good/40 hover:text-good hover:bg-good/5",
    bad: "hover:border-bad/40 hover:text-bad hover:bg-bad/5",
    accent: "hover:border-accent-500/40 hover:text-accent-300 hover:bg-accent-500/5",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-5 py-2 text-[13px] font-medium text-text-md transition-colors disabled:opacity-30 disabled:pointer-events-none",
        toneClasses[tone]
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
