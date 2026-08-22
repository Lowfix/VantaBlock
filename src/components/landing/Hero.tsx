import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cpu, Zap, Activity, Server, MemoryStick } from "lucide-react";
import { buttonVariants } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { usePolling } from "../../lib/usePolling";

interface PublicStats {
  totalServers: number;
  availableRamGb: number;
  totalRamGb: number;
}

export function Hero() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  function loadStats() {
    fetch("/api/public/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats)
      .catch(() => {});
  }

  useEffect(loadStats, []);
  usePolling(loadStats, 10000);

  return (
    <section className="relative overflow-hidden border-b border-line-soft">
      <div className="pointer-events-none absolute inset-0 bg-grid fade-mask-b opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent-600/10 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-2 lg:items-center lg:pb-32 lg:pt-28">
        <div className="animate-fade-in-up">
          <Badge tone="accent" dot>
            Now provisioning on Ryzen 9 9955HX
          </Badge>

          <h1 className="mt-6 text-balance text-[2.75rem] font-bold leading-[1.05] tracking-tight text-text-hi sm:text-6xl">
            Minecraft hosting that doesn't{" "}
            <span className="text-accent-400">flinch</span> under load.
          </h1>

          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-text-md">
            Dedicated Ryzen 9 9955HX cores, DDR5 memory, and NVMe storage
            on every plan. Spin up a server in under a minute and keep a flat 20 TPS
            even with modpacks and packed raids.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/register"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              Deploy your server
              <ArrowRight size={16} />
            </Link>
            <a
              href="#pricing"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              View pricing
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-[13px] text-text-lo">
            <span className="flex items-center gap-2">
              <Cpu size={14} className="text-accent-400" /> Ryzen 9 9955HX
            </span>
            <span className="flex items-center gap-2">
              <Zap size={14} className="text-accent-400" /> 96GB DDR5
            </span>
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-accent-400" /> 60s deploy time
            </span>
          </div>
        </div>

        <div
          className="relative animate-fade-in-up"
          style={{ animationDelay: "120ms" }}
        >
          <div className="rounded-2xl border border-line bg-panel/80 shadow-glow-md backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-good animate-pulse-ring" />
                <span className="text-[13px] font-medium text-text-hi">
                  Vantablock network
                </span>
              </div>
              <Badge tone="good" dot>
                Live
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-px bg-line-soft">
              <div className="bg-panel px-5 py-4">
                <p className="flex items-center gap-1.5 text-xs text-text-lo">
                  <Server size={12} /> Total hosted servers
                </p>
                <p className="mt-1.5 text-lg font-semibold text-text-hi">
                  {stats ? stats.totalServers : "—"}
                </p>
              </div>
              <div className="bg-panel px-5 py-4">
                <p className="flex items-center gap-1.5 text-xs text-text-lo">
                  <MemoryStick size={12} /> RAM available
                </p>
                <p className="mt-1.5 text-lg font-semibold text-text-hi">
                  {stats ? `${stats.availableRamGb} / ${stats.totalRamGb} GB` : "—"}
                </p>
              </div>
            </div>

            <div className="px-5 py-4 text-[12.5px] leading-relaxed text-text-lo">
              Real capacity, pulled live from our hosting network — not a mockup. This
              is what's actually free right now for a new server.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
