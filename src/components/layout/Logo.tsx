import { cn } from "../../lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#8257ff" />
        <path d="M7 8L12 17L17 8" stroke="#0a0a0d" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-text-hi">Vantablock</span>
    </div>
  );
}
