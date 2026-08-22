// Typed wrapper over Modrinth's public API (api.modrinth.com/v2). Unauthenticated
// for reads, but Modrinth's own guidance asks for a descriptive User-Agent — set
// one. Confirmed real rate limit: 300 req/min via the `X-Ratelimit-Limit` header.
// Every shape here was verified against a real live response before being written
// (see the 2026-08-20 "Phase 0" DEVLOG entry and BACKEND.md's Plugins section) —
// don't hand-edit these interfaces from memory/docs alone.

const MODRINTH_API_BASE = "https://api.modrinth.com/v2";
const USER_AGENT = "VantaBlock/1.0 (+https://vantablock.duxy.online)";

// Modrinth is a third party on the public internet, reached inline while a
// browser request waits (plugin search, and the version re-resolve inside an
// install). Node's fetch has no default request timeout, so without this a
// Modrinth outage that hangs rather than refuses would hold those requests open
// for undici's 300s header timeout — measured for real against Panel on
// 2026-08-21 and the same mechanism applies here.
const MODRINTH_TIMEOUT_MS = 15_000;

async function modrinthFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${MODRINTH_API_BASE}${path}`, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(MODRINTH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error("Modrinth did not respond in time.");
    }
    throw err;
  }
  if (!res.ok) throw new Error(`Modrinth responded with ${res.status}.`);
  return res.json() as Promise<T>;
}

export interface ModrinthSearchResult {
  projectId: string;
  name: string;
  author: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
}

interface ModrinthSearchHit {
  project_id: string;
  title: string;
  author: string;
  description: string;
  icon_url: string | null;
  downloads: number;
}

interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
}

// A hit's own top-level `project_type` can say "mod" even when it matched this
// facet — the facet matches an internal `all_project_types` list, not that
// field (confirmed live, see BACKEND.md). Matching the facet at all is what
// means "this is a plugin" here, so no further client-side filtering is done.
const PLUGIN_FACETS = encodeURIComponent(JSON.stringify([["project_type:plugin"]]));

export async function searchModrinthProjects(query: string): Promise<ModrinthSearchResult[]> {
  const res = await modrinthFetch<ModrinthSearchResponse>(
    `/search?query=${encodeURIComponent(query)}&facets=${PLUGIN_FACETS}&limit=20`
  );
  return res.hits.map((h) => ({
    projectId: h.project_id,
    name: h.title,
    author: h.author,
    description: h.description,
    iconUrl: h.icon_url,
    downloads: h.downloads,
  }));
}

export interface ModrinthVersion {
  versionId: string;
  versionName: string;
  gameVersions: string[];
  fileName: string;
  publishedAt: string;
}

interface ModrinthFile {
  filename: string;
  url: string;
  primary: boolean;
}

interface ModrinthVersionRaw {
  id: string;
  version_number: string;
  date_published: string;
  game_versions: string[];
  files: ModrinthFile[];
}

function primaryFile(raw: ModrinthVersionRaw): ModrinthFile | undefined {
  // A version can ship extra non-primary files (e.g. a sources jar) — always
  // prefer the one actually marked primary, falling back to the first file
  // only if none is marked (hasn't been observed live, but the field is
  // optional per Modrinth's own docs).
  return raw.files.find((f) => f.primary) ?? raw.files[0];
}

function toModrinthVersion(raw: ModrinthVersionRaw): ModrinthVersion | null {
  const file = primaryFile(raw);
  if (!file) return null;
  return {
    versionId: raw.id,
    versionName: raw.version_number,
    gameVersions: raw.game_versions,
    fileName: file.filename,
    publishedAt: raw.date_published,
  };
}

/** Newest first, matching Modrinth's own default ordering. */
export async function getModrinthVersions(projectId: string): Promise<ModrinthVersion[]> {
  const raw = await modrinthFetch<ModrinthVersionRaw[]>(
    `/project/${encodeURIComponent(projectId)}/version?loaders=%5B%22paper%22%5D`
  );
  return raw.map(toModrinthVersion).filter((v): v is ModrinthVersion => v !== null);
}

/** Re-fetches a single version to get a fresh download URL right before installing/updating. */
export async function resolveModrinthDownload(versionId: string): Promise<{ downloadUrl: string; fileName: string }> {
  const raw = await modrinthFetch<ModrinthVersionRaw>(`/version/${encodeURIComponent(versionId)}`);
  const file = primaryFile(raw);
  if (!file) throw new Error("This version has no downloadable file.");
  return { downloadUrl: file.url, fileName: file.filename };
}
