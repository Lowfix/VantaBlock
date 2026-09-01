import { cn } from "../../lib/cn";

interface ProgressBarProps {
  value: number;
  max?: number;
  tone?: "accent" | "good" | "warn" | "bad";
  className?: string;
  showLabel?: boolean;
}

const toneClasses = {
  accent: "bg-accent-500",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
};

export function ProgressBar({ value, max = 100, tone = "accent", className, showLabel }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const autoTone: typeof tone = pct > 90 ? "bad" : pct > 70 ? "warn" : tone;
  return (
    <div className={cn("w-full", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
        <div
          className={cn("h-full rounded-full transition-all duration-500 ease-out", toneClasses[autoTone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <div className="mt-1 text-xs text-text-lo">{Math.round(pct)}%</div>}
    </div>
  );
}
