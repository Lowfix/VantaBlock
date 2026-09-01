import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Cpu,
  Gauge,
  Globe,
  Leaf,
  Minus,
  Puzzle,
  Rocket,
  ShieldCheck,
  Shrub,
  Sprout,
  SquareTerminal,
  TreeDeciduous,
  TreePine,
  Trees,
  Users,
} from "lucide-react";
import { AmbientPage } from "../components/layout/AmbientPage";
import { PublicNavbar } from "../components/layout/PublicNavbar";
import { Footer } from "../components/layout/Footer";
import { buttonVariants } from "../components/ui/Button";
import { plans, type Plan } from "../mock-data/plans";
import { cn } from "../lib/cn";

// The FULL plan lineup, in detail. The landing page deliberately shows only
// the first three tiers (a clean fan — see FriendsPhaseNotice's
// DISPLAYED_PLANS) and stays that way; THIS page maps over the whole
// `plans` array, so adding a tier to mock-data/plans.ts puts it here
// automatically without touching the landing page. That's the contract —
// keep it.

// Same tier icons as the landing fan (kept local on purpose — the two
// components shouldn't be coupled over an icon map).
const TIER_ICONS: Record<string, typeof Sprout> = {
  sprout: Sprout,
  sapling: Leaf,
  thicket: Shrub,
  grove: TreeDeciduous,
  woodland: Trees,
  redwood: TreePine,
};

// One-line "who is this for" per tier. A new tier without an entry just
// shows no blurb — don't let this map block adding plans.
const PLAN_BLURBS: Record<string, string> = {
  sprout: "Vanilla with a few friends.",
  sapling: "Small SMPs and light plugin setups.",
  thicket: "Bigger SMPs with a full plugin suite.",
  grove: "Modpacks and mid-size communities.",
  woodland: "Heavy modpacks and busy communities.",
  redwood: "Large modded communities and events.",
};

// Feature strings in plans.ts that differentiate tiers (everything else is
// covered by the "every plan includes" section).
const hasFeature = (plan: Plan, needle: string) => plan.features.some((f) => f.toLowerCase().includes(needle));

const EVERY_PLAN = [
  { icon: Cpu, label: "AMD Ryzen 9 9955HX cores" },
  { icon: Gauge, label: "DDR5 memory + NVMe storage" },
  { icon: ShieldCheck, label: "DDoS filtering built for Minecraft" },
  { icon: Rocket, label: "Deploys in under a minute" },
  { icon: Globe, label: "Free yourname.vantablock.net subdomain" },
  { icon: Puzzle, label: "Paper, Fabric, Forge, or Vanilla + 1-click modpacks" },
  { icon: SquareTerminal, label: "The full control panel" },
  { icon: Users, label: "California (US West) region" },
];

const GUIDE = [
  {
    title: "Playing vanilla with friends?",
    body: "Sprout or Sapling. Vanilla is light — RAM mostly sets how many chunks and players stay smooth at once.",
    tiers: "Sprout · Sapling",
  },
  {
    title: "Running plugins or a bigger SMP?",
    body: "Thicket or Grove. Plugin suites and larger player counts want the extra memory and the third vCore.",
    tiers: "Thicket · Grove",
  },
  {
    title: "Modpacks or a big community?",
    body: "Grove and up. Modpacks are RAM-hungry — most want 8GB+ to keep chunk generation and tick times happy.",
    tiers: "Grove · Woodland · Redwood",
  },
];

function BoolCell({ yes }: { yes: boolean }) {
  return yes ? (
    <Check size={15} className="mx-auto text-accent-400" aria-label="Included" />
  ) : (
    <Minus size={14} className="mx-auto text-text-lo/50" aria-label="Not included" />
  );
}

export function PlansPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Plans & Pricing — Vantablock";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <AmbientPage>
      <PublicNavbar />
      <main>
        <section className="relative overflow-hidden border-b border-line-soft">
          <div className="pointer-events-none absolute inset-0 bg-grid fade-mask-b opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent-600/10 blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-20 lg:pt-24">
            <div className="max-w-2xl animate-fade-in-up">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Plans</p>
              <h1 className="mt-3 text-balance text-[2.5rem] font-bold leading-[1.05] tracking-tight text-text-hi sm:text-5xl">
                Every plan, <span className="text-accent-400">in detail</span>.
              </h1>
              <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-text-md">
                The full lineup and what separates each tier. Prices are our planned public pricing —
                during the private beta every plan is <span className="font-semibold text-text-hi">$0 with an invite</span>.
              </p>
            </div>
          </div>
        </section>

        {/* All tiers — this grid is the page's reason to exist: it renders the
            entire plans array, so new tiers land here automatically. */}
        <section className="relative border-b border-line-soft py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const Icon = TIER_ICONS[plan.id] ?? Sprout;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl border p-6",
                      plan.featured
                        ? "border-accent-500/50 bg-panel-2 shadow-glow-md"
                        : "border-line bg-panel/60"
                    )}
                  >
                    {plan.featured && (
                      <span className="absolute -top-3 left-6 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        Recommended
                      </span>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-300">
                        <Icon size={19} strokeWidth={1.75} />
                      </div>
                      <div>
                        <h2 className="text-[16px] font-semibold text-text-hi">{plan.name}</h2>
                        {PLAN_BLURBS[plan.id] && <p className="text-[12.5px] text-text-lo">{PLAN_BLURBS[plan.id]}</p>}
                      </div>
                    </div>

                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-text-hi">${plan.price.toFixed(2)}</span>
                      <span className="text-[12px] text-text-lo">/mo planned</span>
                      <span className="ml-auto rounded-full border border-good/25 bg-good/10 px-2 py-0.5 text-[11px] font-medium text-good">
                        $0 in beta
                      </span>
                    </div>

                    <div className="mt-5 space-y-1.5 border-t border-line-soft pt-4 text-[13px] text-text-md">
                      <p className="flex justify-between"><span className="text-text-lo">Memory</span> <span className="font-medium text-text-hi">{plan.ram}GB DDR5</span></p>
                      <p className="flex justify-between"><span className="text-text-lo">CPU</span> <span className="font-medium text-text-hi">{plan.vCores}</span></p>
                      <p className="flex justify-between"><span className="text-text-lo">Storage</span> <span className="font-medium text-text-hi">{plan.storage}</span></p>
                      <p className="flex justify-between"><span className="text-text-lo">Players</span> <span className="font-medium text-text-hi">{plan.players.replace("Up to ", "")}</span></p>
                    </div>

                    <ul className="mt-4 flex-1 space-y-2 border-t border-line-soft pt-4 text-[12.5px] text-text-md">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check size={13} className="mt-0.5 shrink-0 text-accent-400" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={`/get-started?plan=${plan.id}`}
                      className={buttonVariants({ variant: plan.featured ? "primary" : "outline", size: "sm", className: "mt-5 w-full" })}
                    >
                      Choose {plan.name}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Side-by-side comparison */}
        <section className="relative border-b border-line-soft py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Compare</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                Side by side.
              </h2>
            </div>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-line bg-panel/60">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line-soft text-xs text-text-lo">
                    <th className="px-5 py-3.5 font-medium">Plan</th>
                    {plans.map((p) => (
                      <th key={p.id} className={cn("px-4 py-3.5 text-center font-semibold", p.featured ? "text-accent-300" : "text-text-hi")}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">Planned price</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center font-medium text-text-hi">${p.price.toFixed(2)}/mo</td>
                    ))}
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">Memory</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center text-text-md">{p.ram}GB</td>
                    ))}
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">vCores @ 5.4GHz</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center text-text-md">{parseInt(p.vCores, 10)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">NVMe storage</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center text-text-md">{parseInt(p.storage, 10)}GB</td>
                    ))}
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">Recommended players</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center text-text-md">{p.players.replace("Up to ", "").replace(" players", "")}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">DDoS protection</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center text-text-md">
                        {hasFeature(p, "advanced ddos") ? "Advanced" : "Standard"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-line-soft">
                    <td className="px-5 py-3 text-text-lo">Daily automated backups</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center"><BoolCell yes={hasFeature(p, "daily automated backups")} /></td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-5 py-3 text-text-lo">Priority support queue</td>
                    {plans.map((p) => (
                      <td key={p.id} className="px-4 py-3 text-center"><BoolCell yes={hasFeature(p, "priority support")} /></td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[12.5px] text-text-lo">
              Player counts are guidance, not hard caps — vanilla stretches further, heavy modpacks less.
            </p>
          </div>
        </section>

        {/* What every plan includes */}
        <section className="relative border-b border-line-soft py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Included everywhere</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                Every plan gets the same foundation.
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-text-md">
                Tiers change how much memory, CPU, and storage you get — never the quality of the
                hardware underneath.
              </p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line-soft sm:grid-cols-2 lg:grid-cols-4">
              {EVERY_PLAN.map((item) => (
                <div key={item.label} className="flex items-center gap-3 bg-panel/60 p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-panel-2 text-accent-400">
                    <item.icon size={16} strokeWidth={1.75} />
                  </span>
                  <span className="text-[13px] leading-snug text-text-md">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Which plan? */}
        <section className="relative border-b border-line-soft py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Not sure?</p>
              <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                Pick by how you play.
              </h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {GUIDE.map((g) => (
                <div key={g.title} className="rounded-2xl border border-line bg-panel/60 p-6">
                  <h3 className="text-[15px] font-semibold text-text-hi">{g.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-text-lo">{g.body}</p>
                  <p className="mt-4 text-[12.5px] font-medium text-accent-300">{g.tiers}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[13.5px] text-text-lo">
              Outgrow a tier? Plans can be changed from the panel at any time — your world comes with you.
            </p>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-panel/70 px-8 py-14 text-center sm:px-16">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600/10 blur-[100px]" />
              <div className="relative">
                <h2 className="text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
                  Free while we're in beta.
                </h2>
                <p className="mx-auto mt-4 max-w-md text-[15px] text-text-md">
                  Every tier here runs at no charge during the private beta — all you need is an invite code.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link to="/get-started" className={buttonVariants({ variant: "primary", size: "lg" })}>
                    Use an invite
                    <ArrowRight size={16} />
                  </Link>
                  <Link to="/panel-preview" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                    Peek at the panel
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
