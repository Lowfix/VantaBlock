import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonVariantProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium " +
  "transition-all duration-200 ease-out disabled:opacity-40 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-void select-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-500 text-white shadow-[0_0_0_1px_rgba(130,87,255,0.4),0_1px_0_0_rgba(255,255,255,0.08)_inset] " +
    "hover:bg-accent-400 hover:shadow-glow-md active:bg-accent-600",
  secondary:
    "bg-panel-2 text-text-hi border border-line hover:bg-panel-3 hover:border-line active:bg-panel",
  outline:
    "bg-transparent text-text-hi border border-line hover:border-accent-500/50 hover:bg-accent-500/5",
  ghost: "bg-transparent text-text-md hover:bg-panel-2 hover:text-text-hi",
  danger:
    "bg-bad/10 text-bad border border-bad/25 hover:bg-bad/15 hover:border-bad/40",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-[15px]",
  icon: "h-9 w-9 shrink-0",
};

export function buttonVariants({ variant = "primary", size = "md", className }: ButtonVariantProps = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return <button ref={ref} className={buttonVariants({ variant, size, className })} {...props} />;
  }
);
Button.displayName = "Button";
