import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { Link } from "react-router-dom";
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
import { buttonVariants } from "../ui/Button";
import { cn } from "../../lib/cn";

// Stands in for <Pricing /> while Vantablock is running as an invite-only,
// no-cost setup for friends — swap this back for <Pricing /> in
// LandingPage.tsx once real public pricing comes back. Keeps the same
// #pricing anchor so the navbar link still lands somewhere sensible.
//
// Prices ARE shown here (see the copy below) — the invite-only/friends-free
// framing is about the *service* costing nothing right now, not about the
// numbers being placeholders. Presented as a "fanned deck of cards": all six
// cards sit at a FIXED position (tier order, gentle static rotation/vertical
// offset per slot — never recomputed relative to which card is "active") and
// render at the same size at all times. Clicking a card only changes that
// card's own scale/glow/z-index and reveals its full feature checklist — it
// never moves a card to a different slot, so the layout can't go lopsided
// depending on which tier is active. (An earlier version re-centered the
// whole deck around the clicked card, which shrank the other five to
// near-illegible size and produced an asymmetric split with 6 — an even
// count — around whichever card was featured. See DEVLOG.md.) Hovering a
// card nudges it forward slightly; the whole thing animates into its resting
// fan position when scrolled into view.

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

// Fixed pixel width for every card in the fan — the layered look below
// depends on all cards sharing one width so the overlap math stays correct.
const CARD_WIDTH = 280;
// Horizontal distance between adjacent card centers. Deliberately less than
// CARD_WIDTH so neighbors overlap (about a third of each card's width tucks
// behind its neighbor) — a real "fanned deck," not cards with gaps between
// them rotated in place.
const CARD_X_STEP = 190;

/**
 * Each card's rotation/position is a fixed function of its own slot (index)
 * in tier order — NOT of which card is currently active. This is what keeps
 * the deck from ever going lopsided: the geometry never changes when a card
 * is clicked, only that one card's scale/glow/z-index does.
 */
function fanSlot(index: number, total: number): { rotate: number; x: number; y: number } {
  const center = (total - 1) / 2;
  const offset = index - center;
  return {
    rotate: offset * 9, // pronounced, alternating either side of center
    x: offset * CARD_X_STEP, // overlapping horizontal spread
    y: Math.abs(offset) * 34, // shallow arc: outer slots sit lower, like a hand of cards
  };
}

interface CardStyle {
  transform: string;
  zIndex: number;
  opacity: number;
}

function getCardStyle(
  slot: { rotate: number; x: number; y: number },
  isActive: boolean,
  isHovered: boolean,
  inView: boolean
): CardStyle {
  const scale = isActive ? 1.08 : isHovered ? 1.04 : 1;
  // Popping "forward" is a small negative Y nudge plus scale/z-index/glow —
  // never a change to which slot the card occupies.
  const y = slot.y - (isActive ? 16 : isHovered ? 6 : 0);
  const rotate = isActive ? 0 : slot.rotate;

  let entranceY = y;
  let entranceScale = scale;
  let opacity = 1;

  if (!inView) {
    // Pre-entrance: every card starts slightly lower, flattened, and
    // scaled down, then transitions into its resting slot together.
    entranceY = y + 40;
    entranceScale = Math.min(scale, 0.85);
    opacity = 0;
  }

  return {
    // `left: 50%` + `translateX(-50% + slot.x)` centers the whole fan in its
    // container while placing each card at its own horizontal offset —
    // that's what lets cards overlap instead of sitting in separate columns.
    transform: `translateX(calc(-50% + ${slot.x}px)) translateY(${entranceY}px) rotate(${rotate}deg) scale(${entranceScale})`,
    zIndex: isActive ? 30 : isHovered ? 20 : 10,
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

// Every card — active or not — always shows icon, name, RAM, price, and the
// vCores/storage/players spec block at a consistent, legible size. Only the
// full feature checklist is gated behind `expanded` (true for the active
// card, and always true in the mobile stacked list).
function PlanCardBody({ plan, icon: Icon, expanded }: { plan: Plan; icon: typeof Sprout; expanded: boolean }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-300">
          <Icon size={19} strokeWidth={1.75} />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-text-hi">{plan.name}</h3>
          <p className="text-[12px] text-text-lo">{plan.ram}GB DDR5 RAM</p>
        </div>
      </div>

      <p className="mt-4 flex items-baseline gap-1">
        <span className="text-2xl font-bold tracking-tight text-text-hi">${plan.price.toFixed(2)}</span>
        <span className="text-[12px] text-text-lo">/mo</span>
      </p>

      <div className="mt-4 space-y-1 border-t border-line-soft pt-4 text-[12px] text-text-lo">
        <p>{plan.vCores}</p>
        <p>{plan.storage}</p>
        <p>{plan.players}</p>
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-400 ease-out",
          expanded ? "mt-4 max-h-[420px] opacity-100" : "mt-0 max-h-0 opacity-0"
        )}
      >
        <ul className="space-y-2 border-t border-line-soft pt-4 text-[12px] text-text-md">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check size={14} className="mt-0.5 shrink-0 text-accent-400" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Sits right below the spec block when collapsed (the checklist
          above has zero height/margin) and below the full checklist once
          expanded, by virtue of JSX order alone — no separate collapsed vs.
          expanded placement needed. Stops propagation so clicking it doesn't
          also fire the card's own "feature this card" click handler on the
          way to navigating away. */}
      <Link
        to={`/get-started?plan=${plan.id}`}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        className={buttonVariants({ variant: expanded ? "primary" : "outline", size: "sm", className: "mt-4 w-full" })}
      >
        Deploy {plan.name}
      </Link>
    </>
  );
}

function PlanFan({ plans: allPlans }: { plans: Plan[] }) {
  // The real `featured` flag (Grove) doesn't exist in this trimmed 3-tier
  // view — default to the middle card instead, matching the reference
  // design's centered/popped card rather than falling back to index 0.
  const featuredIndex = allPlans.findIndex((p) => p.featured);
  const defaultIndex = featuredIndex >= 0 ? featuredIndex : Math.floor((allPlans.length - 1) / 2);
  const [active, setActive] = useState(defaultIndex);
  const [hovered, setHovered] = useState<number | null>(null);
  const { ref, inView } = usePlanFanInView<HTMLDivElement>();

  return (
    <div ref={ref} className="relative mx-auto h-[560px]" style={{ width: CARD_WIDTH + (allPlans.length - 1) * CARD_X_STEP + 60 }}>
      <style>{REDUCED_MOTION_CSS}</style>

      {allPlans.map((plan, i) => {
        const isActive = i === active;
        const isHovered = hovered === i;
        // "Most popular" is a fixed label on a specific plan, not tied to
        // which card is currently featured/active — Sapling always wears
        // it here, independent of `plan.featured` (that flag belongs to
        // Grove, which isn't part of this trimmed 3-tier display at all).
        const isMostPopular = plan.id === "sapling";
        const Icon = TIER_ICONS[plan.id] ?? Sprout;
        const slot = fanSlot(i, allPlans.length);
        const style = getCardStyle(slot, isActive, isHovered, inView);

        // A plain <button> can't validly contain the interactive <Link>
        // that PlanCardBody now renders (a Deploy button) — nested
        // interactive content is invalid HTML and unreliable to click
        // across browsers. Same "select this card" behavior via
        // role="button" + tabIndex + explicit Enter/Space handling instead.
        return (
          <div
            key={plan.id}
            role="button"
            tabIndex={0}
            onClick={() => setActive(i)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setActive(i);
              }
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            aria-pressed={isActive}
            aria-label={isActive ? `${plan.name} plan, currently featured` : `Show ${plan.name} plan details`}
            className={cn(
              "vb-plan-card absolute left-1/2 top-0 flex cursor-pointer flex-col rounded-2xl border p-5 text-left transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60",
              isActive
                ? "border-accent-500/50 bg-panel-2 shadow-glow-md"
                : "border-line bg-panel/90 backdrop-blur-sm hover:border-accent-500/40 hover:bg-panel-2/90 hover:shadow-glow-sm"
            )}
            style={{ ...style, width: CARD_WIDTH }}
          >
            {isMostPopular && (
              <span className="absolute -top-3 left-5 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </span>
            )}
            <PlanCardBody plan={plan} icon={Icon} expanded={isActive} />
          </div>
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
        // Same fixed-to-Sapling rule as the desktop fan — see PlanFan above.
        const isMostPopular = plan.id === "sapling";
        return (
          <div
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-2xl border p-7",
              isMostPopular ? "border-accent-500/50 bg-panel-2 shadow-glow-md" : "border-line bg-panel/60"
            )}
          >
            {isMostPopular && (
              <span className="absolute -top-3 left-7 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                Most popular
              </span>
            )}
            <PlanCardBody plan={plan} icon={Icon} expanded />
          </div>
        );
      })}
    </div>
  );
}

// Only the first three tiers show here — Grove/Woodland/Redwood exist in the
// data (and still power BankPage/DeployServerModal elsewhere) but are
// deliberately left out of this display for a cleaner three-card fan,
// matching the reference design. Revisit if the plan lineup itself changes.
const DISPLAYED_PLANS = plans.slice(0, 3);

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

      <div className="mx-auto mt-16 max-w-3xl px-6">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-accent-400">
          Plans on offer
        </p>
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-text-md">
          Priced the way they'll stay once pricing goes live for everyone. Have an invite?
          You're running on one of these for $0 right now.
        </p>

        <div className="mt-14 hidden sm:block">
          <PlanFan plans={DISPLAYED_PLANS} />
          <p className="mt-6 text-center text-[13px] text-text-lo">Click a card to feature it.</p>
        </div>

        <div className="mt-10">
          <MobilePlanList plans={DISPLAYED_PLANS} />
        </div>
      </div>
    </section>
  );
}
