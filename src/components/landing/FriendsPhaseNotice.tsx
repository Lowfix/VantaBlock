import { useEffect, useRef, useState } from "react";
import {
  Users,
  Check,
  Sprout,
  Leaf,
  Shrub,
  TreeDeciduous,
  Trees,
  TreePine,
} from "lucide-react";
import { plans, type Plan } from "../../mock-data/plans";
import { cn } from "../../lib/cn";

// Stands in for <Pricing /> while Vantablock is running as an invite-only,
// no-cost setup for friends — swap this back for <Pricing /> in
// LandingPage.tsx once real public pricing comes back. Keeps the same
// #pricing anchor so the navbar link still lands somewhere sensible.
//
// Prices ARE shown here (see the copy below) — the invite-only/friends-free
// framing is about the *service* costing nothing right now, not about the
// numbers being placeholders. Presented as a "fanned deck of cards": one
// plan is featured (popped forward, upright, full spec list), the rest fan
// out at an angle behind it. Clicking any card brings it to the front;
// hovering a side card straightens/lifts it; the whole thing animates into
// its fanned position when scrolled into view.

const TIER_ICONS: Record<string, typeof Sprout> = {
  sprout: Sprout,
  sapling: Leaf,
  thicket: Shrub,
  grove: TreeDeciduous,
  woodland: Trees,
  redwood: TreePine,
};

// `.animate-float`-style keyframe classes elsewhere in this codebase are
// declared unlayered in index.css, so Tailwind's layered `motion-reduce:*`
// variants lose to them (see AmbientBackground.tsx / FloatingVoxels.tsx).
// This component doesn't use a named keyframe animation for its fan
// position — it drives the fan/hover/entrance transform through inline
// styles plus a plain CSS transition — but the same "a JS check alone isn't
// enough" lesson applies to transitions too, so the override lives in a
// scoped <style> block here rather than relying only on the JS check in
// usePlanFanInView below.
const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .vb-plan-card { transition: none !important; }
}`;

/** Signed distance from `featured`, wrapped so the fan stays centered on it. */
function signedOffset(index: number, featured: number, count: number): number {
  let raw = index - featured;
  while (raw > count / 2) raw -= count;
  while (raw <= -count / 2) raw += count;
  return raw;
}

interface CardStyle {
  transform: string;
  zIndex: number;
  opacity: number;
}

function getCardStyle(offset: number, isFeatured: boolean, isHovered: boolean, inView: boolean): CardStyle {
  const abs = Math.abs(offset);

  let x = offset * 150;
  let y = isFeatured ? -20 : abs * 24;
  let rotate = offset * 9;
  let scale = isFeatured ? 1.04 : Math.max(0.76, 1 - abs * 0.1);
  let opacity = Math.max(0.55, 1 - abs * 0.14);

  if (isHovered && !isFeatured) {
    rotate *= 0.3;
    y -= 16;
    scale += 0.045;
    opacity = 1;
  }

  if (!inView) {
    // Pre-entrance: collapsed toward the center and flattened out, so the
    // transition below carries every card from here into its resting fan
    // position the instant the section scrolls into view.
    x *= 0.15;
    y += 56;
    rotate *= 0.15;
    scale = Math.min(scale, 0.8);
    opacity = 0;
  }

  return {
    transform: `translate3d(calc(-50% + ${x}px), ${y}px, 0) rotate(${rotate}deg) scale(${scale})`,
    zIndex: isFeatured ? 20 : 10 - abs,
    opacity,
  };
}

/** Fires once, the first time the fan scrolls into view. */
function usePlanFanInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

function PlanFullContent({ plan, icon: Icon }: { plan: Plan; icon: typeof Sprout }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-300">
          <Icon size={20} strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-text-hi">{plan.name}</h3>
          <p className="text-[13px] text-text-lo">{plan.ram}GB DDR5 RAM</p>
        </div>
      </div>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight text-text-hi">${plan.price.toFixed(2)}</span>
        <span className="text-[13px] text-text-lo">/mo</span>
      </p>

      <div className="mt-5 space-y-1.5 border-t border-line-soft pt-5 text-[13px] text-text-lo">
        <p>{plan.vCores}</p>
        <p>{plan.storage}</p>
        <p>{plan.players}</p>
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-text-md">
            <Check size={15} className="mt-0.5 shrink-0 text-accent-400" />
            {f}
          </li>
        ))}
      </ul>
    </>
  );
}

function PlanCompactContent({ plan, icon: Icon }: { plan: Plan; icon: typeof Sprout }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel-2 text-accent-400">
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <h3 className="mt-3 text-[14px] font-semibold text-text-hi">{plan.name}</h3>
      <p className="mt-1 text-[17px] font-bold text-text-hi">
        ${plan.price.toFixed(2)}
        <span className="text-[11px] font-normal text-text-lo"> /mo</span>
      </p>
    </div>
  );
}

function PlanFan({ plans: allPlans }: { plans: Plan[] }) {
  const defaultIndex = Math.max(
    0,
    allPlans.findIndex((p) => p.featured)
  );
  const [featured, setFeatured] = useState(defaultIndex);
  const [hovered, setHovered] = useState<number | null>(null);
  const { ref, inView } = usePlanFanInView<HTMLDivElement>();

  return (
    <div ref={ref} className="relative mx-auto h-[620px] w-full max-w-2xl">
      <style>{REDUCED_MOTION_CSS}</style>

      {allPlans.map((plan, i) => {
        const offset = signedOffset(i, featured, allPlans.length);
        const isFeatured = offset === 0;
        const isHovered = hovered === i;
        const Icon = TIER_ICONS[plan.id] ?? Sprout;
        const style = getCardStyle(offset, isFeatured, isHovered, inView);

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => setFeatured(i)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            aria-pressed={isFeatured}
            aria-label={isFeatured ? `${plan.name} plan, currently featured` : `Show ${plan.name} plan details`}
            className={cn(
              "vb-plan-card absolute left-1/2 top-0 flex flex-col rounded-2xl border text-left transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60",
              isFeatured
                ? "w-[290px] border-accent-500/50 bg-panel-2 p-7 shadow-glow-md"
                : "w-[250px] cursor-pointer border-line bg-panel/70 p-6 hover:border-accent-500/40 hover:bg-panel-2/70 hover:shadow-glow-sm"
            )}
            style={style}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </span>
            )}
            {isFeatured ? <PlanFullContent plan={plan} icon={Icon} /> : <PlanCompactContent plan={plan} icon={Icon} />}
          </button>
        );
      })}
    </div>
  );
}

function MobilePlanList({ plans: allPlans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-5 sm:hidden">
      {allPlans.map((plan) => {
        const Icon = TIER_ICONS[plan.id] ?? Sprout;
        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-2xl border p-7",
              plan.featured ? "border-accent-500/50 bg-panel-2 shadow-glow-md" : "border-line bg-panel/60"
            )}
          >
            {plan.featured && (
              <span className="absolute -top-3 left-7 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </span>
            )}
            <PlanFullContent plan={plan} icon={Icon} />
          </div>
        );
      })}
    </div>
  );
}

export function FriendsPhaseNotice() {
  return (
    <section id="pricing" className="border-b border-line-soft py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel-2 text-accent-400">
          <Users size={22} />
        </div>
        <h2 className="mt-6 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
          Invite-only, for now.
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-text-md">
          Vantablock is currently free for a small group of friends while we build things out. The pricing
          below is real — it's what every plan will cost once we open up more widely — but for now, an
          invite means running any tier here at no charge.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-7xl px-6">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-accent-400">
          Plans on offer
        </p>
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-text-md">
          Six tiers, priced the way they'll stay once pricing goes live for everyone. Have an invite?
          You're running on one of these for $0 right now.
        </p>

        <div className="mt-14 hidden sm:block">
          <PlanFan plans={plans} />
          <p className="mt-4 text-center text-[13px] text-text-lo">Click a card to bring it forward.</p>
        </div>

        <div className="mt-10">
          <MobilePlanList plans={plans} />
        </div>
      </div>
    </section>
  );
}
