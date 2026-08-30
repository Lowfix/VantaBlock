import { useRef } from "react";
import type { ReactNode } from "react";
import { AmbientBackground } from "../landing/AmbientBackground";
import { FloatingVoxels } from "../illustrations/FloatingVoxels";
import { useParallax } from "../../lib/useParallax";
import { useElementHeight } from "../../lib/useElementHeight";

export function AmbientPage({ children }: { children: ReactNode }) {
  // Shared page shell: the full-page decorative background layer (ambient
  // glow/grid/starfield + drifting voxel cubes) behind whatever page content
  // is passed in. Extracted from LandingPage.tsx so a second page (Locations)
  // gets the identical treatment without copying the structure below — and
  // the structure matters, because three real bugs came out of getting it
  // right, all fixed by exactly this arrangement:
  //
  // 1. A CSS transform still counts toward the *page's own* scrollable area
  //    even though it doesn't move the element's layout box — so as the
  //    layer fell increasingly behind while scrolling, the page kept
  //    getting taller to accommodate it, letting you scroll well past the
  //    real content. Fix: the OUTER clipping box below is `position: fixed`
  //    — always exactly viewport-sized, by definition, regardless of what's
  //    transformed inside it. `position: fixed` boxes never contribute to
  //    an ancestor's scrollable area, so this can't recur no matter what
  //    the inner layer does.
  // 2. The cubes/orbs are positioned with `top: X%`, meant to resolve
  //    against the page's real height. An earlier version stretched the
  //    inner layer via `height: 100%`/`inset-0` against this component's
  //    outer div — which only sets `min-height` (`min-h-screen`), not
  //    `height`. A percentage height against an ancestor that has no
  //    definite `height` isn't valid per spec and silently collapses to 0,
  //    which is what actually made the whole layer disappear. Fix: measure
  //    the page's real height and set it as an explicit pixel value on the
  //    INNER (transformed) layer instead of relying on a percentage stretch.
  // 3. `-z-10` looked like the obvious way to keep this behind everything,
  //    but this div's own `bg-void` background doesn't establish its own
  //    stacking context (no z-index set), so per the CSS stacking-order
  //    spec its background actually paints *above* negative z-index
  //    descendants, not below — a well-known negative-z-index pitfall, and
  //    what was actually hiding the whole layer. Fix: no z-index at all —
  //    since this is the very first thing in the DOM, and nothing else here
  //    has an explicit stack order except the navbar's `z-40` (which is
  //    supposed to stay on top regardless), DOM order alone already paints
  //    it behind everything real.
  //
  // One consequence worth knowing when writing page content: a fixed box
  // paints above *non-positioned* in-flow content regardless of DOM order,
  // so any section/panel that should sit crisply on top of the decoration
  // (rather than having the starfield show through it) needs `relative` —
  // see the note on Footer.tsx.
  const pageRef = useRef<HTMLDivElement>(null);
  const pageHeight = useElementHeight(pageRef);
  const parallaxRef = useParallax<HTMLDivElement>(0.55);

  return (
    <div ref={pageRef} className="relative min-h-screen bg-void">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          ref={parallaxRef}
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{ height: pageHeight ? `${pageHeight}px` : "100vh" }}
        >
          <AmbientBackground />
          <FloatingVoxels />
        </div>
      </div>
      {children}
    </div>
  );
}
