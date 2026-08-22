import { Link } from "react-router-dom";
import { Users, ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "../ui/Button";
import { plans } from "../../mock-data/plans";
import { cn } from "../../lib/cn";

// Stands in for <Pricing /> while Vantablock is running as an invite-only,
// no-cost setup for friends — swap this back for <Pricing /> in
// LandingPage.tsx once real public pricing comes back. Keeps the same
// #pricing anchor so the navbar link still lands somewhere sensible. Still
// shows the plan tiers/specs (people should be able to see what's on offer)
// but deliberately omits prices while everything is free/invite-only.
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
          Vantablock is currently running free of charge for a small group of friends while we build things out.
          There's no public pricing yet — accounts need an invite code to sign up. If you've got one, you're in.
        </p>
        <div className="mt-8">
          <Link to="/register" className={buttonVariants({ variant: "primary", size: "lg" })}>
            I have an invite code
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-7xl px-6">
        <p className="text-center text-[13px] font-semibold uppercase tracking-wider text-accent-400">
          Plans on offer
        </p>
        <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-text-md">
          Here's every tier we'll support once pricing goes live. For now, an invite gets you in free
          of charge.
        </p>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-2xl border p-7 transition-colors duration-300",
                plan.featured
                  ? "border-accent-500/50 bg-panel-2 shadow-glow-md"
                  : "border-line bg-panel/60 hover:border-line-soft hover:bg-panel-2/60"
              )}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              )}

              <h3 className="text-[15px] font-semibold text-text-hi">{plan.name}</h3>
              <p className="text-[13px] text-text-lo">{plan.ram}GB DDR5 RAM</p>

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

              <Link
                to="/register"
                className={buttonVariants({
                  variant: plan.featured ? "primary" : "secondary",
                  className: "mt-7 w-full",
                })}
              >
                Request {plan.name}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
