import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { plans } from "../../mock-data/plans";
import { buttonVariants } from "../ui/Button";
import { cn } from "../../lib/cn";

export function Pricing() {
  const [billing, setBilling] = useState<"monthly" | "quarterly">("monthly");

  return (
    <section id="pricing" className="border-b border-line-soft py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Pricing</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
              Plans sized by RAM, priced for real communities.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-text-md">
              Every tier runs on the same Ryzen 9 9955HX hardware and DDR5 memory speed. You're only
              choosing capacity.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-panel-2 p-1">
            <button
              onClick={() => setBilling("monthly")}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                billing === "monthly" ? "bg-panel-3 text-text-hi" : "text-text-lo hover:text-text-md"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("quarterly")}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                billing === "quarterly" ? "bg-panel-3 text-text-hi" : "text-text-lo hover:text-text-md"
              )}
            >
              Quarterly <span className="text-good">-10%</span>
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => {
            const price = billing === "quarterly" ? plan.price * 0.9 : plan.price;
            return (
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

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-text-hi">${price.toFixed(2)}</span>
                  <span className="text-[13px] text-text-lo">/mo</span>
                </div>

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
                  Get {plan.name}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
