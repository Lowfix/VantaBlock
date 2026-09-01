import { forwardRef } from "react";
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, LabelHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const fieldBase =
  "w-full rounded-lg border border-line bg-panel-2 px-3.5 text-sm text-text-hi placeholder:text-text-lo " +
  "outline-none transition-colors duration-150 focus:border-accent-500/60 focus:bg-panel " +
  "focus:ring-4 focus:ring-accent-500/10 disabled:opacity-40 disabled:pointer-events-none";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(fieldBase, "h-10", error && "border-bad/60 focus:border-bad/60 focus:ring-bad/10", className)}
    {...props}
  />
));
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, error, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(fieldBase, "py-2.5 min-h-24 resize-y", error && "border-bad/60", className)}
    {...props}
  />
));
Textarea.displayName = "Textarea";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, "h-10 appearance-none bg-panel-2", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[13px] font-medium text-text-md mb-1.5", className)} {...props} />;
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-bad">{children}</p>;
}
