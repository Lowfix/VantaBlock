import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cpu, Zap, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";
import { VoxelIsland } from "../illustrations/VoxelIsland";

const highlights = [
  { icon: Cpu, text: "Dedicated Ryzen 9 9955HX cores" },
  { icon: Zap, text: "96GB DDR5 memory" },
  { icon: ShieldCheck, text: "Enterprise DDoS filtering" },
];

export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600/10 blur-[130px]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-panel/80 shadow-glow-md backdrop-blur-sm lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          <Link to="/" className="mb-8 inline-block w-fit">
            <Logo />
          </Link>

          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight text-text-hi">{title}</h1>
            <p className="mt-2 text-[14px] text-text-lo">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        <div className="relative hidden flex-col items-center justify-center border-l border-line-soft bg-ink/70 px-10 py-10 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
          <VoxelIsland className="relative" />

          <div className="relative mt-4 text-center">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Vantablock</p>
            <h2 className="mt-2 text-balance text-xl font-bold leading-snug tracking-tight text-text-hi">
              Built for communities that don't tolerate lag.
            </h2>
          </div>

          <div className="relative mt-7 w-full max-w-xs space-y-2.5">
            {highlights.map((h) => (
              <div key={h.text} className="flex items-center gap-3 rounded-xl border border-line bg-panel/60 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400">
                  <h.icon size={14} />
                </span>
                <span className="text-[13px] text-text-md">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
