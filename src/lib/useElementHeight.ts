import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Tracks an element's rendered height in px, via ResizeObserver. Used to give
 * a same-height decorative overlay an explicit pixel height to clip against,
 * instead of a CSS percentage/`inset-0` stretch — see useParallax.ts's
 * comment on why that indirection caused real layout bugs here.
 */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number | null {
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    setHeight(el.getBoundingClientRect().height);

    const observer = new ResizeObserver((entries) => setHeight(entries[0].contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return height;
}
