import { useEffect, useRef } from "react";

/**
 * Returns a ref to attach to a decorative layer that lives inside a
 * `position: fixed` clip boundary (see LandingPage.tsx) — with no transform
 * at all, an element in there doesn't move with scroll whatsoever, it's
 * glued to the viewport. This shifts it up as the page scrolls down, at
 * `speed` — the fraction of the real scroll rate it tracks at (e.g. 0.55 =
 * moves at 55% of how far the page actually scrolled), so it visibly lags
 * behind real content instead of either standing still or matching it 1:1.
 * Applies a CSS transform directly on scroll (rAF-throttled, no React
 * state) rather than changing the page's own scroll container, so it can't
 * affect anchor links or scroll-restoration behavior elsewhere on the page.
 *
 * No-ops under prefers-reduced-motion — the layer just stays put.
 */
export function useParallax<T extends HTMLElement>(speed: number) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    function apply() {
      if (el) el.style.transform = `translate3d(0, ${-window.scrollY * speed}px, 0)`;
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return ref;
}
