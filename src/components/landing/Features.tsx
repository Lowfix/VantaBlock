import { Cpu, MemoryStick, ShieldCheck, Rocket, Gauge, LifeBuoy } from "lucide-react";

const features = [
  {
    icon: Cpu,
    title: "AMD Ryzen 9 9955HX",
    perNode: true,
    description:
      "16 Zen 5 cores (32 threads) boosting up to 5.4GHz power every server — more single-thread headroom than Minecraft's world generation and redstone logic can even saturate.",
  },
  {
    icon: MemoryStick,
    title: "96GB DDR5 memory",
    perNode: true,
    description:
      "Fast dual-channel DDR5 means chunk loading and RAM-hungry modpacks never bottleneck, even under sustained load.",
  },
  {
    icon: ShieldCheck,
    title: "Automated DDoS defenses",
    description:
      "Connection-rate limiting and real-time IP banning are tuned specifically for how Minecraft traffic behaves — floods and abusive connections get shut down automatically, before they can bog down your server.",
  },
  {
    icon: Rocket,
    title: "Instant setup",
    description:
      "Servers provision in under a minute. Pick a version, choose Paper, Forge, Fabric, or Vanilla, and you're on the world selection screen.",
  },
  {
    icon: Gauge,
    title: "NVMe SSD storage",
    perNode: true,
    description:
      "World saves, backups, and plugin installs run on pure NVMe storage — no spinning disks, no I/O bottlenecks during autosave.",
  },
  {
    icon: LifeBuoy,
    title: "Real support, fast",
    description:
      "A support queue staffed by people who actually run Minecraft servers, with a median first response time under 15 minutes.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-b border-line-soft py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Infrastructure</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
            Hardware chosen for one job: keeping your TPS at 20.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-text-md">
            No shared vCPU throttling, no oversold RAM. Every plan gets a slice of hardware built specifically for
            Minecraft's single-threaded main loop — specs below are per node, and we run more than one.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line-soft sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="group bg-panel/60 p-7 transition-colors duration-300 hover:bg-panel-2/70">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-panel-2 text-accent-400 transition-colors duration-300 group-hover:border-accent-500/40 group-hover:text-accent-300">
                <feature.icon size={19} strokeWidth={1.75} />
              </div>
              <div className="mt-5 flex items-center gap-2">
                <h3 className="text-[15px] font-semibold text-text-hi">{feature.title}</h3>
                {feature.perNode && (
                  <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-lo">
                    Per node
                  </span>
                )}
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-text-lo">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
