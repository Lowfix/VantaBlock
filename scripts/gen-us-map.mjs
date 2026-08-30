// One-off generator for src/components/locations/usMapData.ts — the SVG paths
// and dot-grid coordinates behind the USMap component. Not part of the build;
// its output is committed. Only re-run if the projection, viewBox, dot spacing,
// or highlighted state needs to change.
//
// Run from the repo root (the three packages are NOT project dependencies —
// install them without saving, run, then they can be dropped again):
//
//   npm install --no-save us-atlas@3 topojson-client@3 d3-geo@3
//   node scripts/gen-us-map.mjs
//
// Source data: `us-atlas` (public domain, US Census cartographic boundaries
// via TopoJSON). Contiguous US only — AK/HI and the territories are dropped
// so the fit isn't shrunk by far-flung islands.

import fs from "node:fs";
import * as topojson from "topojson-client";
import { geoAlbers, geoPath, geoContains } from "d3-geo";

const us = JSON.parse(fs.readFileSync("node_modules/us-atlas/states-10m.json", "utf8"));
const SKIP = new Set(["02", "15", "72", "60", "66", "69", "78"]); // AK, HI, PR, AS, GU, MP, VI — contiguous US only
const states = topojson.feature(us, us.objects.states);
states.features = states.features.filter((f) => !SKIP.has(f.id));
const keptIds = new Set(states.features.map((f) => f.id));
const statesGeom = { ...us.objects.states, geometries: us.objects.states.geometries.filter((g) => !SKIP.has(g.id)) };

const W = 960, H = 600, PAD = 8;
const projection = geoAlbers().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], states);
const path = geoPath(projection);

const outer = topojson.mesh(us, statesGeom, (a, b) => a === b);
const inner = topojson.mesh(us, statesGeom, (a, b) => a !== b);
const nation = topojson.merge(us, statesGeom.geometries);
const ca = states.features.find((f) => f.id === "06");

const round = (s) => s.replace(/(\d+\.\d{1,})/g, (m) => (+m).toFixed(1));
const outerPath = round(path(outer));
const innerPath = round(path(inner));
const caPath = round(path(ca));
const caCentroid = path.centroid(ca).map((n) => +n.toFixed(1));

// Dot grid: sample every S px, keep points inside the merged nation polygon.
const S = 11;
const dots = [], caDots = [];
const nationFeature = { type: "Feature", geometry: nation };
for (let y = PAD + S / 2; y < H - PAD; y += S) {
  for (let x = PAD + S / 2; x < W - PAD; x += S) {
    const ll = projection.invert([x, y]);
    if (!ll) continue;
    if (!geoContains(nationFeature, ll)) continue;
    (geoContains(ca, ll) ? caDots : dots).push([Math.round(x), Math.round(y)]);
  }
}
console.error({ W, H, outer: outerPath.length, inner: innerPath.length, ca: caPath.length, dots: dots.length, caDots: caDots.length, caCentroid, kept: keptIds.size });

// Cities for the latency table — project a handful of metros so the page can
// optionally place markers later; also useful to sanity check the projection.
const cities = {
  "Los Angeles": [-118.24, 34.05], "San Francisco": [-122.42, 37.77], "Seattle": [-122.33, 47.61],
  "Las Vegas": [-115.14, 36.17], "Phoenix": [-112.07, 33.45], "Denver": [-104.99, 39.74],
  "Dallas": [-96.80, 32.78], "Chicago": [-87.63, 41.88], "Atlanta": [-84.39, 33.75],
  "New York": [-74.01, 40.71], "Miami": [-80.19, 25.76],
};
const cityPx = Object.fromEntries(Object.entries(cities).map(([k, v]) => [k, projection(v).map((n) => +n.toFixed(1))]));
console.error(cityPx);

const enc = (arr) => arr.map(([x, y]) => `${x},${y}`).join(" ");
const out = `// GENERATED — do not hand-edit. Built from the public-domain \`us-atlas\` package
// (states-10m.json, contiguous US only — AK/HI/PR excluded) projected with
// d3-geo's geoAlbers into a ${W}x${H} viewBox. Regenerate with the one-off
// script described in .claude/FRONTEND.md ("USMap") if the projection or dot
// spacing ever needs to change. Nothing here is fetched at runtime.

export const US_MAP_WIDTH = ${W};
export const US_MAP_HEIGHT = ${H};

/** Outer coastline/border of the contiguous US. */
export const US_OUTLINE_PATH = ${JSON.stringify(outerPath)};

/** Interior state borders (shared edges only). */
export const US_STATE_BORDERS_PATH = ${JSON.stringify(innerPath)};

/** California's outline, for the region highlight. */
export const CALIFORNIA_PATH = ${JSON.stringify(caPath)};

/** Area centroid of California in viewBox px — where the region marker sits. */
export const CALIFORNIA_CENTER: readonly [number, number] = [${caCentroid[0]}, ${caCentroid[1]}];

/** Grid spacing (px) the dot fields below were sampled at. */
export const US_DOT_SPACING = ${S};

/** "x,y x,y ..." — every grid point inside the US but outside California. */
export const US_DOTS = ${JSON.stringify(enc(dots))};

/** "x,y x,y ..." — every grid point inside California. */
export const CALIFORNIA_DOTS = ${JSON.stringify(enc(caDots))};
`;
fs.writeFileSync("src/components/locations/usMapData.ts", out);
console.error("wrote src/components/locations/usMapData.ts", out.length, "bytes");
