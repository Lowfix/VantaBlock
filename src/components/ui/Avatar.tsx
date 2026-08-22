import { cn } from "../../lib/cn";

interface AvatarProps {
  initials: string;
  src?: string;
  className?: string;
}

export function Avatar({ initials, src, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-line", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-accent-500/15 font-semibold text-accent-300",
        className
      )}
    >
      {initials}
    </span>
  );
}
