import { cn } from "../../lib/cn";
import {
  US_MAP_WIDTH,
  US_MAP_HEIGHT,
  US_OUTLINE_PATH,
  US_STATE_BORDERS_PATH,
  CALIFORNIA_PATH,
  CALIFORNIA_CENTER,
  US_DOTS,
  CALIFORNIA_DOTS,
} from "./usMapData";

// Dot-matrix map of the contiguous US with California lit up as the (currently
// only) region. All geometry is precomputed in usMapData.ts — this component
// just turns each "x,y x,y ..." dot list into ONE <path> of tiny circles (a
// single DOM node per field instead of ~2k <circle> elements) and draws the
// region marker on top. Nothing is fetched at runtime.
function dotsToPath(encoded: string, r: number): string {
  const d = 2 * r;
  let out = "";
  for (const pair of encoded.split(" ")) {
    const comma = pair.indexOf(",");
    const x = Number(pair.slice(0, comma)) - r;
    const y = pair.slice(comma + 1);
    // Two half-circle arcs from (x - r, y) make one full circle.
    out += `M${x},${y}a${r},${r} 0 1,0 ${d},0a${r},${r} 0 1,0 -${d},0`;
  }
  return out;
}

const US_DOTS_PATH = dotsToPath(US_DOTS, 1.7);
const CA_DOTS_PATH = dotsToPath(CALIFORNIA_DOTS, 2.1);
const [CX, CY] = CALIFORNIA_CENTER;

// Pulse-ring keyframes are scoped here (unlayered) rather than added to
// index.css — same pattern as AmbientBackground/FloatingVoxels. The existing
// `.animate-pulse-ring` in index.css is a box-shadow animation in the `good`
// green, which neither works on SVG circles nor matches the accent color.
const SCOPED_CSS = `
@keyframes vb-map-pulse { from { transform: scale(0.5); opacity: 0.7; } to { transform: scale(3); opacity: 0; } }
.vb-map-pulse { transform-box: fill-box; transform-origin: center; animation: vb-map-pulse 2.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite; }
@media (prefers-reduced-motion: reduce) {
  .vb-map-pulse { animation: none !important; transform: scale(1.8); opacity: 0.25; }
}`;

interface USMapProps {
  className?: string;
  /** Show the floating "California · US West" pill above the marker. */
  label?: boolean;
}

export function USMap({ className, label = true }: USMapProps) {
  return (
    <div className={cn("relative w-full", className)}>
      <style>{SCOPED_CSS}</style>
      <svg
        viewBox={`0 0 ${US_MAP_WIDTH} ${US_MAP_HEIGHT}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Map of the contiguous United States with California highlighted as Vantablock's US West region"
      >
        <defs>
          <filter id="vb-map-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="vb-map-halo">
            <stop offset="0%" style={{ stopColor: "var(--color-accent-500)", stopOpacity: 0.35 }} />
            <stop offset="100%" style={{ stopColor: "var(--color-accent-500)", stopOpacity: 0 }} />
          </radialGradient>
        </defs>

        {/* Faint state borders + coastline under the dots, so the shape
            still reads at small sizes where the dot grid alone gets sparse. */}
        <path d={US_STATE_BORDERS_PATH} className="fill-none stroke-text-lo/10" strokeWidth={0.8} />
        <path d={US_OUTLINE_PATH} className="fill-none stroke-text-lo/25" strokeWidth={1} strokeLinejoin="round" />
        <path d={US_DOTS_PATH} className="fill-text-lo/35" />

        {/* The region: soft halo, state fill/outline, brighter dots, marker. */}
        <circle cx={CX} cy={CY} r={120} fill="url(#vb-map-halo)" />
        <path d={CALIFORNIA_PATH} className="fill-accent-500/15 stroke-accent-400/70" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={CA_DOTS_PATH} className="fill-accent-300" filter="url(#vb-map-glow)" />
        <g transform={`translate(${CX} ${CY})`}>
          <circle r={12} className="vb-map-pulse fill-accent-400" />
          <circle r={12} className="vb-map-pulse fill-accent-400" style={{ animationDelay: "1.3s" }} />
          <circle r={9} className="fill-accent-500" filter="url(#vb-map-glow)" />
          <circle r={4} fill="#fff" />
        </g>
      </svg>

      {label && (
        // HTML rather than <text> inside the SVG so the label keeps a real
        // font size at any rendered width instead of scaling with the viewBox.
        // Sits to the RIGHT of the marker: California hugs the left edge of
        // the viewBox, so a centered-above pill would clip off the map.
        <div
          className="pointer-events-none absolute"
          style={{ left: `${(CX / US_MAP_WIDTH) * 100}%`, top: `${(CY / US_MAP_HEIGHT) * 100}%` }}
        >
          <div
            className="whitespace-nowrap rounded-full border border-accent-500/40 bg-ink/90 px-3 py-1.5 text-[12px] font-medium text-text-hi shadow-glow-sm backdrop-blur"
            style={{ transform: "translate(30px, -50%)" }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-400 align-middle" />
            California <span className="text-text-lo">· US West</span>
          </div>
        </div>
      )}
    </div>
  );
}
