import { cn } from "../../lib/cn";

/**
 * Decorative isometric voxel cubes drifting in the empty side gutters of the
 * landing page. Same projection, proportions and palette as VoxelIsland so the
 * two read as one motif.
 *
 * Expects a parent with an explicit pixel `height` matching the page's real
 * content height (LandingPage.tsx's parallax layer) — it lays itself out
 * over the full height of that parent via `inset-0` and never captures
 * pointer events. A percentage stretch against an ancestor that only has
 * `min-height` (not `height`) isn't a definite height for percentage
 * resolution and silently collapses to 0, which is what actually made these
 * disappear the first time this was wired up that way.
 */

const TILE_W = 64;
const TILE_H = 36;
const BLOCK_H = 38;

interface Point {
  x: number;
  y: number;
}

function project(gx: number, gy: number, gz: number): Point {
  return {
    x: (gx - gy) * (TILE_W / 2),
    y: (gx + gy) * (TILE_H / 2) - gz * BLOCK_H,
  };
}

function pts(points: Point[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

interface Palette {
  top: string;
  left: string;
  right: string;
}

const STONE: Palette = { top: "#2b2b34", left: "#1d1d24", right: "#151519" };
const STONE_LIGHT: Palette = { top: "#3a3a46", left: "#282830", right: "#1c1c22" };
const CRYSTAL: Palette = { top: "#b39cff", left: "#8257ff", right: "#5a34c9" };
const CRYSTAL_BRIGHT: Palette = { top: "#d0c3ff", left: "#9a7bff", right: "#6c3ff0" };

/** A single cube, drawn at the projection origin. */
function Cube({ palette }: { palette: Palette }) {
  const c = project(0, 0, 0);

  const topFace = [
    { x: c.x, y: c.y - TILE_H / 2 },
    { x: c.x + TILE_W / 2, y: c.y },
    { x: c.x, y: c.y + TILE_H / 2 },
    { x: c.x - TILE_W / 2, y: c.y },
  ];
  const leftFace = [
    { x: c.x - TILE_W / 2, y: c.y },
    { x: c.x, y: c.y + TILE_H / 2 },
    { x: c.x, y: c.y + TILE_H / 2 + BLOCK_H },
    { x: c.x - TILE_W / 2, y: c.y + BLOCK_H },
  ];
  const rightFace = [
    { x: c.x, y: c.y + TILE_H / 2 },
    { x: c.x + TILE_W / 2, y: c.y },
    { x: c.x + TILE_W / 2, y: c.y + BLOCK_H },
    { x: c.x, y: c.y + TILE_H / 2 + BLOCK_H },
  ];

  return (
    <svg viewBox="-33 -19 66 76" className="block h-auto w-full" aria-hidden>
      <polygon points={pts(rightFace)} fill={palette.right} />
      <polygon points={pts(leftFace)} fill={palette.left} />
      <polygon points={pts(topFace)} fill={palette.top} />
    </svg>
  );
}

interface VoxelSpec {
  side: "left" | "right";
  /** Vertical position down the page. */
  top: number;
  /** Gap in px between the cube and the edge of the 80rem content column. */
  gap: number;
  /** Rendered width in px. `gap + size` must stay under the gutter at the tier's breakpoint. */
  size: number;
  palette: Palette;
  opacity: number;
  delay: number;
  duration: number;
  glow?: boolean;
  /**
   * Which breakpoint this cube needs before there's enough gutter to show it
   * without overlapping the content column. `inner` is the baseline tier —
   * shown as soon as the whole component is visible at all.
   */
  tier: "inner" | "mid" | "outer";
}

// Each tier's breakpoint sets the available gutter: `(breakpoint - 1280) / 2`.
// Every cube's `gap + size` stays a few px under that so nothing clips the
// content column edge. Three tiers (instead of a tight single ring) so the
// scatter actually fills the margin as it widens, rather than bunching in a
// thin strip right against the content on anything short of ultrawide.
//
// Tailwind v4 scans source files for literal class strings — it can't see a
// template-interpolated `min-[${n}px]:block`, so this has to be a lookup of
// whole literal strings, not a breakpoint number plugged into one at runtime.
const TIER_VISIBILITY_CLASS: Record<VoxelSpec["tier"], string | undefined> = {
  inner: undefined,
  mid: "hidden min-[1560px]:block",
  outer: "hidden min-[1780px]:block",
};

const VOXELS: VoxelSpec[] = [
  // Inner ring — gutter is 60px at 1400px. Gaps spread 6-40 instead of a tight
  // 5-16 so cubes aren't all hugging the exact edge in a line.
  { side: "left", top: 6, gap: 6, size: 40, palette: CRYSTAL, opacity: 0.4, delay: 0, duration: 5.2, tier: "inner" },
  { side: "right", top: 13, gap: 20, size: 34, palette: STONE_LIGHT, opacity: 0.32, delay: 0.8, duration: 6.1, tier: "inner" },
  { side: "left", top: 22, gap: 10, size: 28, palette: CRYSTAL_BRIGHT, opacity: 0.45, delay: 1.6, duration: 4.4, glow: true, tier: "inner" },
  { side: "right", top: 30, gap: 28, size: 26, palette: CRYSTAL, opacity: 0.3, delay: 0.4, duration: 5.8, tier: "inner" },
  { side: "left", top: 40, gap: 8, size: 36, palette: STONE, opacity: 0.38, delay: 2.1, duration: 6.6, tier: "inner" },
  { side: "right", top: 48, gap: 34, size: 22, palette: CRYSTAL_BRIGHT, opacity: 0.42, delay: 1.1, duration: 4.9, glow: true, tier: "inner" },
  { side: "left", top: 58, gap: 14, size: 40, palette: STONE_LIGHT, opacity: 0.3, delay: 0.6, duration: 5.4, tier: "inner" },
  { side: "right", top: 66, gap: 6, size: 34, palette: CRYSTAL, opacity: 0.36, delay: 2.4, duration: 6.3, tier: "inner" },
  { side: "left", top: 76, gap: 24, size: 30, palette: CRYSTAL_BRIGHT, opacity: 0.4, delay: 1.9, duration: 4.6, glow: true, tier: "inner" },
  { side: "right", top: 84, gap: 12, size: 38, palette: STONE, opacity: 0.34, delay: 0.2, duration: 5.9, tier: "inner" },
  { side: "left", top: 92, gap: 30, size: 24, palette: CRYSTAL, opacity: 0.28, delay: 3.0, duration: 6.8, tier: "inner" },

  // Mid ring — gutter is 140px at 1560px. Fills the gap between the inner
  // cluster and the outer ring instead of leaving that band empty.
  { side: "left", top: 16, gap: 60, size: 48, palette: STONE, opacity: 0.24, delay: 1.2, duration: 6.0, tier: "mid" },
  { side: "right", top: 36, gap: 80, size: 40, palette: CRYSTAL_BRIGHT, opacity: 0.28, delay: 2.3, duration: 5.3, glow: true, tier: "mid" },
  { side: "left", top: 54, gap: 70, size: 44, palette: STONE_LIGHT, opacity: 0.22, delay: 0.3, duration: 6.7, tier: "mid" },
  { side: "right", top: 72, gap: 90, size: 36, palette: CRYSTAL, opacity: 0.26, delay: 1.7, duration: 5.6, tier: "mid" },
  { side: "left", top: 88, gap: 65, size: 42, palette: CRYSTAL_BRIGHT, opacity: 0.3, delay: 2.9, duration: 4.8, glow: true, tier: "mid" },

  // Outer ring — gutter is 250px at 1780px. Pushed further out than before so
  // ultrawide gets real spread instead of a second tight cluster.
  { side: "left", top: 18, gap: 110, size: 54, palette: CRYSTAL, opacity: 0.2, delay: 1.3, duration: 7.2, tier: "outer" },
  { side: "right", top: 40, gap: 150, size: 44, palette: STONE_LIGHT, opacity: 0.18, delay: 2.6, duration: 6.4, tier: "outer" },
  { side: "left", top: 66, gap: 130, size: 48, palette: CRYSTAL_BRIGHT, opacity: 0.24, delay: 0.9, duration: 5.6, glow: true, tier: "outer" },
  { side: "right", top: 86, gap: 165, size: 56, palette: CRYSTAL, opacity: 0.18, delay: 2.0, duration: 7.0, tier: "outer" },
];

/**
 * `.animate-float` is declared unlayered in index.css, so it outranks Tailwind's
 * layered `motion-reduce:animate-none`. Scope the reduced-motion override here
 * rather than editing that file.
 */
const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .vb-floating-voxel { animation: none !important; }
}`;

export function FloatingVoxels({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 hidden overflow-hidden min-[1400px]:block",
        className
      )}
      aria-hidden
    >
      <style>{REDUCED_MOTION_CSS}</style>

      {VOXELS.map((v, i) => {
        // Anchored to the edge of the 80rem (max-w-7xl) content column rather
        // than the viewport, so the scatter frames the content at any width.
        const anchor = `calc(50% + 40rem + ${v.gap}px)`;

        return (
          <div
            key={i}
            className={cn("vb-floating-voxel absolute animate-float", TIER_VISIBILITY_CLASS[v.tier])}
            style={{
              top: `${v.top}%`,
              left: v.side === "right" ? anchor : undefined,
              right: v.side === "left" ? anchor : undefined,
              width: `${v.size}px`,
              opacity: v.opacity,
              animationDelay: `${v.delay}s`,
              animationDuration: `${v.duration}s`,
              filter: v.glow ? "drop-shadow(0 0 8px rgba(130, 87, 255, 0.45))" : undefined,
            }}
          >
            <Cube palette={v.palette} />
          </div>
        );
      })}
    </div>
  );
}
