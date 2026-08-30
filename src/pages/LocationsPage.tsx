import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cpu, MapPin, Radio, ShieldCheck } from "lucide-react";
import { AmbientPage } from "../components/layout/AmbientPage";
import { PublicNavbar } from "../components/layout/PublicNavbar";
import { Footer } from "../components/layout/Footer";
import { USMap } from "../components/locations/USMap";
import { buttonVariants } from "../components/ui/Button";
import { cn } from "../lib/cn";

// Typical round-trip estimates from the California region to the largest
// North American metros. Marketing ballparks for a page describing one planned
// region — NOT measurements from live infrastructure (there isn't any yet, see
// .claude/PROJECT.md). The copy below keeps the "approximate" framing; keep it
// that way if these numbers are ever tweaked.
const LATENCY: { city: string; ms: number }[] = [
  { city: "Los Angeles", ms: 6 },
  { city: "San Francisco", ms: 12 },
  { city: "Las Vegas", ms: 14 },
  { city: "Phoenix", ms: 18 },
  { city: "Seattle", ms: 28 },
  { city: "Denver", ms: 34 },
  { city: "Dallas", ms: 42 },
  { city: "Chicago", ms: 56 },
  { city: "Atlanta", ms: 62 },
  { city: "New York", ms: 72 },
  { city: "Toronto", ms: 74 },
  { city: "Miami", ms: 78 },
];

function latencyTone(ms: number): { label: string; className: string } {
  if (ms < 20) return { label: "Excellent", className: "text-good" };
  if (ms < 45) return { label: "Great", className: "text-accent-300" };
  return { label: "Good", className: "text-text-md" };
}

const REGION_FACTS = [
  {
    icon: MapPin,
    title: "California, US West",
    body:
      "Pacific time. The closest region for West Coast, Mountain, and Southwest players — and still comfortably playable from anywhere in North America.",
  },
  {
    icon: Cpu,
    title: "Same hardware, no budget tier",
    body:
      "AMD Ryzen 9 9955HX, 96GB DDR5, and NVMe storage per node. The spec sheet on the features page is the spec sheet here — there's no cut-down \"value region\".",
  },
  {
    icon: ShieldCheck,
    title: "Filtered before it reaches you",
    body:
      "Automated DDoS defenses tuned for Minecraft traffic — per-IP rate limiting, kernel SYN tuning, and automated IP banning — sit in front of every server in the region.",
  },
];

export function LocationsPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Server Locations — Vantablock";
    return () => {
      document.title = previous;
    };
  }, []);

  const maxMs = Math.max(...LATENCY.map((l) => l.ms));

  return (
    <AmbientPage>
      <PublicNavbar />
      <main>
        <section className="relative overflow-hidden border-b border-line-soft">
          <div className="pointer-events-none absolute inset-0 bg-grid fade-mask-b opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent-600/10 blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-20 lg:pt-24">
            <div className="max-w-2xl animate-fade-in-up">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Server locations</p>
              <h1 className="mt-3 text-balance text-[2.5rem] font-bold leading-[1.05] tracking-tight text-text-hi sm:text-5xl">
                Hosted in <span className="text-accent-400">California</span>.
              </h1>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-text-md">
                Every Vantablock server runs from our US West region. That means single-digit ping for the West
                Coast, and latency that's still comfortably playable from anywhere in North America.
              </p>
            </div>

            <div className="relative mt-12 overflow-hidden rounded-2xl border border-line bg-panel/70 p-4 shadow-glow-sm sm:p-8">
              <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
              <USMap className="relative mx-auto max-w-4xl" />
              <div className="relative mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-line-soft pt-6 text-[13px] text-text-lo">
                <span className="flex items-center gap-2">
                  <MapPin size={14} className="text-accent-400" /> California · US West
                </span>
                <span className="flex items-center gap-2">
                  <Cpu size={14} className="text-accent-400" /> Ryzen 9 9955HX nodes
                </span>
                <span className="flex items-center gap-2">
                  <Radio size={14} className="text-accent-400" /> One region today, more as we grow
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="relative border-b border-line-soft py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">The region</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                What you get in California.
              </h2>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line-soft md:grid-cols-3">
              {REGION_FACTS.map((fact) => (
                <div key={fact.title} className="group bg-panel/60 p-7 transition-colors duration-300 hover:bg-panel-2/70">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-panel-2 text-accent-400 transition-colors duration-300 group-hover:border-accent-500/40 group-hover:text-accent-300">
                    <fact.icon size={19} strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold text-text-hi">{fact.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-text-lo">{fact.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-b border-line-soft py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Latency</p>
                <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                  Typical ping to California.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-text-md">
                  Approximate round-trip times over normal routes from the biggest North American metros. Your
                  exact number depends on your ISP and how it peers — but this is the ballpark to expect.
                </p>
                <p className="mt-4 text-[13.5px] leading-relaxed text-text-lo">
                  Under ~50ms feels instant in Minecraft. Anything under ~100ms is very playable — block placement,
                  combat, and redstone all stay responsive.
                </p>
              </div>

              <ul className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-panel/60">
                {LATENCY.map((row) => {
                  const tone = latencyTone(row.ms);
                  return (
                    <li
                      key={row.city}
                      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:grid-cols-[150px_1fr_72px_84px]"
                    >
                      <span className="text-[14px] font-medium text-text-hi">{row.city}</span>
                      {/* Mobile: city + ms share the first row, bar drops to a
                          full-width second row (order-last). Desktop: DOM order. */}
                      <div className="order-last col-span-2 h-1.5 overflow-hidden rounded-full bg-panel-3 sm:order-none sm:col-span-1">
                        <div
                          className="h-full rounded-full bg-accent-500"
                          style={{ width: `${Math.max(8, (row.ms / maxMs) * 100)}%` }}
                        />
                      </div>
                      <span className="text-right font-mono text-[13px] text-text-md sm:text-left">~{row.ms}ms</span>
                      <span className={cn("hidden text-right text-[12px] font-medium sm:block", tone.className)}>
                        {tone.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="relative py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-panel/70 px-8 py-16 text-center sm:px-16">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600/10 blur-[100px]" />
              <div className="relative">
                <h2 className="text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                  More regions as we grow.
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] text-text-md">
                  California is where we're starting, not where we're stopping. Where the next region lands is up
                  to where the players are.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link to="/#pricing" className={buttonVariants({ variant: "primary", size: "lg" })}>
                    View plans
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/#features" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                    See the hardware
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </AmbientPage>
  );
}
