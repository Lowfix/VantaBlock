import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34 5.5 29.3 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5 44.5 35.3 44.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34 5.5 29.3 3.5 24 3.5c-7.5 0-14 4.2-17.7 10.4z"
      />
      <path
        fill="#4CAF50"
        d="M24 44.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.6 2.2-7.2 2.2-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.9 40.2 16.4 44.5 24 44.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.9 36 44.5 30.6 44.5 24c0-1.2-.1-2.4-.3-3.5z"
      />
    </svg>
  );
}

interface GoogleButtonProps {
  label: string;
  loading?: boolean;
  onClick: () => void;
  className?: string;
}

export function GoogleButton({ label, loading, onClick, className }: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-panel-2 text-sm font-medium text-text-hi",
        "transition-all duration-200 hover:bg-panel-3 hover:border-line-soft disabled:opacity-60 disabled:pointer-events-none",
        className
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
      {loading ? "Connecting..." : label}
    </button>
  );
}
