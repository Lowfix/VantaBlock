import { cn } from "../../lib/cn";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ value, min, max, step = 1, onChange, className }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn("h-1.5 w-full cursor-pointer appearance-none rounded-full bg-panel-3 accent-accent-500", className)}
      style={{
        background: `linear-gradient(to right, var(--color-accent-500) ${pct}%, var(--color-panel-3) ${pct}%)`,
      }}
    />
  );
}
