import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export interface DropdownOption {
  value: string;
  label: string;
  meta?: string;
  description?: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
}

export function Dropdown({ value, onChange, options, placeholder, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const buttons = optionRefs.current.filter((b): b is HTMLButtonElement => b !== null);
        if (buttons.length === 0) return;
        const currentIndex = buttons.findIndex((b) => b === document.activeElement);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + buttons.length) % buttons.length;
        buttons[nextIndex]?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    // Land keyboard focus on the currently-selected option (or the first)
    // as soon as the list opens, so arrow keys work immediately.
    const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
    optionRefs.current[selectedIndex]?.focus();
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-3.5 text-left text-sm",
          "outline-none transition-colors duration-150 focus:border-accent-500/60 focus:ring-4 focus:ring-accent-500/10",
          open && "border-accent-500/60 ring-4 ring-accent-500/10"
        )}
      >
        <span className={cn("truncate", selected ? "text-text-hi" : "text-text-lo")}>
          {selected?.label ?? placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {selected?.meta && <span className="text-[13px] font-semibold text-text-hi">{selected.meta}</span>}
          <ChevronDown size={15} className={cn("text-text-lo transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && (
        <div
          className="absolute z-40 mt-1.5 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-panel-2 py-1 shadow-glow-md animate-fade-in-up"
          style={{ animationDuration: "0.15s" }}
        >
          {options.map((opt, i) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors",
                  active ? "bg-accent-500/10" : "hover:bg-panel-3"
                )}
              >
                <span className="min-w-0">
                  <span className={cn("block truncate text-[13px] font-medium", active ? "text-accent-300" : "text-text-hi")}>
                    {opt.label}
                  </span>
                  {opt.description && <span className="block truncate text-xs text-text-lo">{opt.description}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {opt.meta && <span className="text-[13px] font-semibold text-text-hi">{opt.meta}</span>}
                  {active && <Check size={14} className="text-accent-400" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
