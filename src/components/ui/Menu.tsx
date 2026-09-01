import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface MenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

export function Menu({ trigger, children, align = "right", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [];
        if (items.length === 0) return;
        const list = Array.from(items);
        const currentIndex = list.findIndex((b) => b === document.activeElement);
        const delta = e.key === "ArrowDown" ? 1 : -1;
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + list.length) % list.length;
        list[nextIndex]?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    // Land keyboard focus on the first item as soon as the menu opens, so
    // arrow keys/Tab work immediately instead of leaving focus on the trigger.
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div ref={triggerRef} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </div>
      {open && (
        <div
          ref={menuRef}
          className={cn(
            "absolute z-40 mt-2 min-w-[180px] overflow-hidden rounded-lg border border-line bg-panel-2 py-1 shadow-glow-md animate-fade-in-up",
            align === "right" ? "right-0" : "left-0",
            className
          )}
          style={{ animationDuration: "0.15s" }}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  icon?: ReactNode;
}

export function MenuItem({ children, onClick, danger, icon }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] transition-colors",
        danger ? "text-bad hover:bg-bad/10" : "text-text-md hover:bg-panel-3 hover:text-text-hi"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line-soft" />;
}
