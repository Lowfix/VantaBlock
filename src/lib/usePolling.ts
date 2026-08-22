import { useEffect, useRef } from "react";

/**
 * Re-runs `fn` on an interval so dashboard pages reflect changes made
 * elsewhere (another tab, a cron job, another admin) without a manual
 * page refresh. `fn` is read from a ref each tick so callers don't need
 * to memoize it.
 */
export function usePolling(fn: () => void, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const id = setInterval(() => fnRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
