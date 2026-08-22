import { Cpu, Zap, Activity } from "lucide-react";
import { buttonVariants } from "../ui/Button";
import { Badge } from "../ui/Badge";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line-soft">
      <div className="pointer-events-none absolute inset-0 bg-grid fade-mask-b opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent-600/10 blur-[120px]" />

      <div className="relative mx-auto max-w-3xl px-6 pb-24 pt-20 text-center lg:pb-32 lg:pt-28">
        <div className="animate-fade-in-up">
          <Badge tone="accent" dot>
            Now provisioning on Ryzen 9 9955HX
          </Badge>

          <h1 className="mx-auto mt-6 text-balance text-[2.75rem] font-bold leading-[1.05] tracking-tight text-text-hi sm:text-6xl">
            Minecraft hosting that doesn't{" "}
            <span className="text-accent-400">flinch</span> under load.
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-[16px] leading-relaxed text-text-md">
            Dedicated Ryzen 9 9955HX cores, DDR5 memory, and NVMe storage
            on every plan. Spin up a server in under a minute and keep a flat 20 TPS
            even with modpacks and packed raids.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#pricing"
              className={buttonVariants({ variant: "primary", size: "lg" })}
            >
              View pricing
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] text-text-lo">
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
      </div>
    </section>
  );
}
