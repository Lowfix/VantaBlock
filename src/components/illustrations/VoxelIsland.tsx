import { cn } from "../../lib/cn";

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

interface CubeSpec {
  x: number;
  y: number;
  z: number;
  top: string;
  left: string;
  right: string;
  glow?: boolean;
}

function Cube({ x, y, z, top, left, right, glow }: CubeSpec) {
  const c = project(x, y, z);
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
    <g filter={glow ? "url(#voxel-glow)" : undefined}>
      <polygon points={pts(rightFace)} fill={right} />
      <polygon points={pts(leftFace)} fill={left} />
      <polygon points={pts(topFace)} fill={top} stroke={glow ? top : "none"} strokeOpacity={glow ? 0.4 : 0} strokeWidth={glow ? 6 : 0} />
    </g>
  );
}

const STONE = { top: "#2b2b34", left: "#1d1d24", right: "#151519" };
const CRYSTAL = { top: "#b39cff", left: "#8257ff", right: "#5a34c9" };
const CRYSTAL_BRIGHT = { top: "#d0c3ff", left: "#9a7bff", right: "#6c3ff0" };

const islandCells: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [0, 2],
  [1, 2],
  [2, 2],
];

const oreCells = new Set(["0,0", "2,2"]);

const cubes: CubeSpec[] = [
  ...islandCells.map(([x, y]) => {
    const isOre = oreCells.has(`${x},${y}`);
    return {
      x,
      y,
      z: 0,
      top: isOre ? CRYSTAL.top : STONE.top,
      left: STONE.left,
      right: STONE.right,
    };
  }),
  { x: 1, y: 1, z: 1, ...STONE },
  { x: 1, y: 1, z: 2, ...CRYSTAL_BRIGHT, glow: true },
];

const floatingCubes: CubeSpec[] = [
  { x: -1.4, y: -0.6, z: 2.6, ...CRYSTAL },
  { x: 3.1, y: -0.2, z: 3.2, ...CRYSTAL_BRIGHT, glow: true },
  { x: -0.8, y: 2.8, z: 2.2, ...CRYSTAL },
];

const sortedCubes = [...cubes].sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));

export function VoxelIsland({ className }: { className?: string }) {
  return (
    <svg viewBox="-220 -220 440 400" className={cn("w-full max-w-md", className)} aria-hidden>
      <defs>
        <filter id="voxel-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <ellipse cx="0" cy="20" rx="150" ry="60" fill="#8257ff" opacity="0.08" />

      {sortedCubes.map((cube, i) => (
        <Cube key={`base-${i}`} {...cube} />
      ))}

      {floatingCubes.map((cube, i) => (
        <g key={`float-${i}`} className="animate-float" style={{ animationDelay: `${i * 0.6}s` }}>
          <Cube {...cube} />
        </g>
      ))}

      {[
        [-140, -120],
        [130, -90],
        [90, 40],
        [-110, 60],
        [10, -150],
      ].map(([sx, sy], i) => (
        <circle key={i} cx={sx} cy={sy} r={i % 2 === 0 ? 2.2 : 1.4} fill="#b39cff" opacity={0.5} />
      ))}
    </svg>
  );
}
