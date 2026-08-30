import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { USMap } from "../locations/USMap";
import { buttonVariants } from "../ui/Button";

// Compact "where the servers are" section on the landing page — the same
// USMap the /locations page uses at full size, plus three headline ping
// figures (kept in sync by hand with LocationsPage.tsx's LATENCY table).
const PINGS = [
  { city: "Los Angeles", ms: 6 },
  { city: "Seattle", ms: 28 },
  { city: "New York", ms: 72 },
];

export function LocationsTeaser() {
  return (
    <section id="locations" className="relative border-b border-line-soft py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.25fr]">
          <div className="max-w-xl">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Server location</p>
            <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
              Hosted in California.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-text-md">
              Every server runs from our US West region — single-digit ping for the West Coast, and still
              comfortably playable from anywhere in North America.
            </p>

            <dl className="mt-8 grid grid-cols-3 gap-4">
              {PINGS.map((p) => (
                <div key={p.city} className="rounded-xl border border-line bg-panel/60 px-4 py-3">
                  <dd className="font-mono text-lg font-semibold text-text-hi">~{p.ms}ms</dd>
                  <dt className="mt-0.5 text-[12px] text-text-lo">{p.city}</dt>
                </div>
              ))}
            </dl>

            <Link to="/locations" className={buttonVariants({ variant: "outline", className: "mt-8" })}>
              See the region
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-line bg-panel/60 p-4 sm:p-6">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
            <USMap className="relative" />
          </div>
        </div>
      </div>
    </section>
  );
}
