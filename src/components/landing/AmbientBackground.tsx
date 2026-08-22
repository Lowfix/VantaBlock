// Purely decorative full-page backdrop for the landing page — fills the
// otherwise-empty side margins with the same violet-glow-plus-grid language
// Hero.tsx and CTASection.tsx already use at section scale (bg-grid,
// fade-mask-b, blurred accent-600 orbs), just extended down the whole page
// and biased toward the left/right edges instead of centered. Reuses only
// existing theme tokens/utilities from src/index.css — nothing new added
// there. `aria-hidden` + `pointer-events-none` + absolute positioning: takes
// no part in layout, scrolling, focus order, or hit-testing, and adds
// nothing a screen reader would announce.
//
// Intended usage: mount inside a parent with an explicit pixel `height`
// matching the page's real content height (LandingPage.tsx's parallax
// layer) — a `height: 100%`/`inset-0` percentage stretch against an
// ancestor that only has `min-height` (not `height`) is not a definite
// height for percentage-resolution purposes, and silently collapses to 0.

interface Star {
  x: number;
  y: number;
  size: number;
  tier: "dim" | "mid" | "bright";
  delay: number;
  duration: number;
}

// Deterministic pseudo-random spread (mulberry32) instead of Math.random() —
// keeps the scatter identical across renders/HMR instead of reshuffling.
function mulberry32(seed: number) {
  return function rand() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIERS: Star["tier"][] = ["dim", "dim", "mid", "mid", "bright"];

const STARS: Star[] = (() => {
  const rand = mulberry32(1337);
  return Array.from({ length: 26 }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    size: 1 + rand() * 1.5,
    tier: TIERS[Math.floor(rand() * TIERS.length)],
    delay: rand() * 5,
    duration: 3 + rand() * 3.5,
  }));
})();

// `.animate-float` is declared unlayered in index.css, so Tailwind's layered
// `motion-reduce:animate-none` loses to it (same trap FloatingVoxels hit) —
// scope the override here instead of editing that file. The twinkle keyframes
// only set their 50% stop; the resting opacity comes from each tier's own
// class rule, so a paused/reduced-motion star still shows at a sensible
// static brightness rather than snapping to fully opaque.
const SCOPED_CSS = `
@keyframes vb-twinkle-dim { 50% { opacity: 0.32; } }
@keyframes vb-twinkle-mid { 50% { opacity: 0.5; } }
@keyframes vb-twinkle-bright { 50% { opacity: 0.7; } }
.vb-star { animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
.vb-star-dim { opacity: 0.16; animation-name: vb-twinkle-dim; }
.vb-star-mid { opacity: 0.2; animation-name: vb-twinkle-mid; }
.vb-star-bright { opacity: 0.24; animation-name: vb-twinkle-bright; }
@media (prefers-reduced-motion: reduce) {
  .vb-star, .vb-ambient-glow { animation: none !important; }
}`;

export function AmbientBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <style>{SCOPED_CSS}</style>

      {/* Extended grid texture, faded top and bottom so it reads as ambient
          texture rather than a hard-edged tile — same pattern as Hero's own
          bg-grid, just spanning the full page and much lower opacity since
          it's now behind every section, not just one. */}
      <div
        className="absolute inset-0 bg-grid opacity-25"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      />

      {/* Faint grain, same fade mask as the grid — an existing theme utility
          (src/index.css's .bg-noise) that nothing on the site used yet. */}
      <div
        className="absolute inset-0 bg-noise opacity-40"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}
      />

      {/* Edge-biased glow orbs, alternating left/right down the page, sized
          and blurred enough to bleed visibly into the side margins at a
          normal ~1440px desktop width, not just on ultrawide. */}
      <div className="absolute left-[-6%] top-[6%] h-[380px] w-[380px] rounded-full bg-accent-600/10 blur-[120px]" />
      <div
        className="vb-ambient-glow absolute right-[-8%] top-[26%] h-[420px] w-[420px] rounded-full bg-accent-500/8 blur-[130px] animate-float"
        style={{ animationDuration: "7s" }}
      />
      <div className="absolute left-[-10%] top-[48%] h-[460px] w-[460px] rounded-full bg-accent-600/8 blur-[140px]" />
      <div
        className="vb-ambient-glow absolute right-[-6%] top-[68%] h-[360px] w-[360px] rounded-full bg-accent-400/8 blur-[110px] animate-float"
        style={{ animationDuration: "8s", animationDelay: "1.5s" }}
      />
      <div className="absolute left-[-8%] top-[88%] h-[400px] w-[400px] rounded-full bg-accent-600/10 blur-[120px]" />

      {/* Faint starfield — small twinkling dots spread across the full width,
          not just the edges, so a normal (non-ultrawide) viewport still gets
          some depth, not only the margin glows/voxels. */}
      {STARS.map((s, i) => (
        <div
          key={i}
          className={`vb-star vb-star-${s.tier} absolute rounded-full bg-text-hi`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
