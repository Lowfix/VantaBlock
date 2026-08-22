import { ArrowRight } from "lucide-react";
import { buttonVariants } from "../ui/Button";
import { VoxelIsland } from "../illustrations/VoxelIsland";

export function CTASection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-panel/70 px-8 py-16 text-center sm:px-16">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600/10 blur-[100px]" />
          <VoxelIsland className="pointer-events-none absolute -right-16 -top-20 hidden w-[280px] opacity-40 sm:block lg:-right-8 lg:w-[340px]" />
          <div className="relative">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
              Your world is one deploy away.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-text-md">
              Take a look at what's on offer, and get in touch once pricing goes live.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#pricing" className={buttonVariants({ variant: "primary", size: "lg" })}>
                View plans
                <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
