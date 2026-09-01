import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Cpu,
  DatabaseBackup,
  Globe,
  MapPin,
  Play,
  Plus,
  RotateCcw,
  Server,
  Sparkles,
  Square,
  SquareTerminal,
} from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { Badge } from "../components/ui/Badge";
import { buttonVariants } from "../components/ui/Button";
import { cn } from "../lib/cn";

// Static PREVIEW of the server panel's overview page — what a logged-in user
// with running servers will see once accounts exist. Modeled on the real
// pre-teardown DashboardPage (git show 584357a^:src/pages/DashboardPage.tsx —
// same stat tiles / server cards / resource sidebar structure), rebuilt in
// the marketing site's design language. NOT wired to anything: no auth, no
// fetch, no state beyond a "that's part of the preview" toast when an action
// button is clicked. Every number below is hand-written demo data — keep it
// plausible against mock-data/plans.ts (Grove = 8GB/45 players, Sapling =
// 4GB/20 players) if it's ever edited.

interface DemoServer {
  name: string;
  plan: string;
  software: string;
  subdomain: string;
  online: boolean;
  players: { now: number; max: number };
  tps: string;
  ram: { used: number; total: number };
  cpu: number;
}

const DEMO_SERVERS: DemoServer[] = [
  {
    name: "Emberfall SMP",
    plan: "Grove",
    software: "Paper 1.21.4",
    subdomain: "emberfall.vantablock.net",
    online: true,
    players: { now: 14, max: 45 },
    tps: "20.0",
    ram: { used: 6.4, total: 8 },
    cpu: 41,
  },
  {
    name: "Skyblock Weekends",
    plan: "Sapling",
    software: "Fabric 1.21.4",
    subdomain: "skyblock.vantablock.net",
    online: false,
    players: { now: 0, max: 20 },
    tps: "—",
    ram: { used: 0, total: 4 },
    cpu: 0,
  },
];

const CONSOLE_LINES = [
  "[04:00:12] [Server thread/INFO]: Automatic backup complete (1.2 GB in 41s)",
  "[09:14:03] [Server thread/INFO]: Kestrel_ joined the game",
  "[09:14:09] [Server thread/INFO]: <Kestrel_> chunks loading instantly again",
  "[09:31:26] [Server thread/INFO]: Villager trades refreshed in r.0.-1.mca",
  "[10:02:41] [Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0",
];

function Bar({ value, warn }: { value: number; warn?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
      <div
        className={cn("h-full rounded-full", warn ? "bg-warn" : "bg-accent-500")}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function ServerCard({ server, onAction }: { server: DemoServer; onAction: (what: string) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-panel/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="truncate text-[15px] font-semibold text-text-hi">{server.name}</h3>
            {server.online ? (
              <Badge tone="good" dot>
                Online
              </Badge>
            ) : (
              <Badge tone="neutral" dot>
                Stopped
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-text-lo">
            {server.plan} plan · {server.software}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[12px] text-text-lo">
            <Globe size={11} className="shrink-0 text-accent-400" />
            <span className="min-w-0 truncate">{server.subdomain}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {server.online ? (
            <>
              <button
                type="button"
                onClick={() => onAction("Console")}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
                aria-label={`Open ${server.name} console`}
              >
                <SquareTerminal size={15} />
              </button>
              <button
                type="button"
                onClick={() => onAction("Restart")}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
                aria-label={`Restart ${server.name}`}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => onAction("Stop")}
                className={buttonVariants({ variant: "danger", size: "icon" })}
                aria-label={`Stop ${server.name}`}
              >
                <Square size={13} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onAction("Start")}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Play size={13} /> Start
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-line-soft pt-4 text-[12px]">
        <div>
          <p className="text-text-lo">Players</p>
          <p className="mt-0.5 font-mono text-[13px] text-text-hi">
            {server.players.now}/{server.players.max}
          </p>
        </div>
        <div>
          <p className="text-text-lo">TPS</p>
          <p className={cn("mt-0.5 font-mono text-[13px]", server.online ? "text-good" : "text-text-lo")}>
            {server.tps}
          </p>
        </div>
        <div>
          <p className="text-text-lo">CPU</p>
          <p className="mt-0.5 font-mono text-[13px] text-text-hi">{server.cpu}%</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-text-lo">Memory</span>
          <span className="font-mono text-text-md">
            {server.ram.used.toFixed(1)} / {server.ram.total} GB
          </span>
        </div>
        <div className="mt-1.5">
          <Bar value={(server.ram.used / server.ram.total) * 100} />
        </div>
      </div>
    </div>
  );
}

export function PanelPreviewPage() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.title;
    document.title = "Panel Preview — Vantablock";
    return () => {
      document.title = previous;
    };
  }, []);

  // Any panel action just explains itself; auto-dismiss after a moment.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const onAction = (what: string) => setToast(`"${what}" is part of the preview — nothing here is wired up yet.`);

  const stats = [
    { label: "Total servers", value: "2", icon: Server },
    { label: "Active now", value: "1 / 2", icon: Activity },
    { label: "Memory in use", value: "6.4 / 12 GB", icon: Cpu },
    { label: "Region", value: "US West", icon: MapPin },
  ];

  return (
    <div className="relative min-h-screen bg-void">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />

      {/* App-style top bar: logo, panel tag, fake user chip. */}
      <header className="relative border-b border-line-soft bg-ink/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Vantablock home">
              <Logo />
            </Link>
            <span className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-text-lo">
              Panel
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone="accent" dot>
              Preview
            </Badge>
            <div className="flex items-center gap-2.5 rounded-full border border-line bg-panel-2 py-1 pl-1 pr-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-500/20 text-[11px] font-semibold text-accent-300">
                K
              </span>
              <span className="hidden text-[13px] font-medium text-text-md sm:block">Kestrel_</span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-8">
        {/* The honesty banner — same voice as GetStartedPage's post-submit note. */}
        <div className="rounded-xl border border-accent-500/30 bg-accent-500/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 text-[13px] leading-relaxed text-text-md">
              <Sparkles size={14} className="shrink-0 text-accent-300" />
              <span>
                <span className="font-semibold text-accent-300">You're looking at a preview</span> — this is the
                panel you'll get once accounts are live. The servers and numbers below are examples, and none of
                the buttons do anything real.
              </span>
            </p>
            <Link to="/get-started" className="text-[13px] font-medium text-accent-400 hover:text-accent-300">
              Get an account →
            </Link>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-text-hi">Welcome back, Kestrel_</h1>
            <p className="mt-1 text-[13.5px] text-text-lo">Here's what's happening across your servers.</p>
          </div>
          <button type="button" onClick={() => onAction("Deploy new server")} className={buttonVariants({ size: "md" })}>
            <Plus size={15} /> Deploy new server
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-line bg-panel/70 p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-text-lo">{stat.label}</p>
                <stat.icon size={15} className="text-accent-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-text-hi">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <h2 className="text-[15px] font-semibold text-text-hi">Your servers</h2>
            {/* space-y, not grid: an auto grid track floors at the items'
                min-content width (the header row's name+subdomain+buttons),
                which overflowed 390px phones by a few px. Stacked blocks
                just take the container width. */}
            <div className="mt-4 space-y-4">
              {DEMO_SERVERS.map((server) => (
                <ServerCard key={server.name} server={server} onAction={onAction} />
              ))}
            </div>

            <h2 className="mt-8 flex items-center gap-2 text-[15px] font-semibold text-text-hi">
              <SquareTerminal size={15} className="text-accent-400" /> Console — Emberfall SMP
            </h2>
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink">
              <div className="max-w-full overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-text-md">
                {CONSOLE_LINES.map((line) => (
                  <p key={line} className="whitespace-nowrap">
                    {line}
                  </p>
                ))}
                <p className="mt-1 flex items-center gap-1 text-text-lo">
                  <span className="text-accent-400">$</span>
                  <span className="animate-caret inline-block h-3.5 w-[7px] bg-text-md" />
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-[15px] font-semibold text-text-hi">Resource usage</h2>
              <div className="mt-4 space-y-5 rounded-2xl border border-line bg-panel/70 p-5">
                <div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-lo">Memory (all servers)</span>
                    <span className="font-mono text-text-md">6.4 / 12 GB</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={53} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-lo">Avg. CPU load</span>
                    <span className="font-mono text-text-md">23%</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={23} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-text-lo">Storage</span>
                    <span className="font-mono text-text-md">38 / 120 GB</span>
                  </div>
                  <div className="mt-1.5">
                    <Bar value={32} />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-text-hi">Backups</h2>
              <div className="mt-4 rounded-2xl border border-line bg-panel/70 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-good/10 text-good">
                    <DatabaseBackup size={16} />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-text-hi">Daily backups on</p>
                    <p className="text-[12px] text-text-lo">Last run today, 4:00 AM · 1.2 GB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onAction("Back up now")}
                  className={buttonVariants({ variant: "outline", size: "sm", className: "mt-4 w-full" })}
                >
                  Back up now
                </button>
              </div>
            </div>

            <div>
              <h2 className="text-[15px] font-semibold text-text-hi">Region</h2>
              <div className="mt-4 rounded-2xl border border-line bg-panel/70 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400">
                    <MapPin size={16} />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-text-hi">California · US West</p>
                    <p className="text-[12px] text-text-lo">All your servers run here</p>
                  </div>
                </div>
                <Link
                  to="/locations"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "mt-4 w-full" })}
                >
                  About this region
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line-soft pt-6 text-center">
          <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-text-lo transition-colors hover:text-text-md">
            <ArrowLeft size={13} /> Back to vantablock.net
          </Link>
        </div>
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in-up rounded-full border border-accent-500/40 bg-ink/95 px-4 py-2 text-[13px] text-text-md shadow-glow-sm backdrop-blur"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
