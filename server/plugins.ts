// Orchestration layer for the Plugins tab's Modrinth browser — the only
// module `server/routes/servers.ts` talks to for this feature. Owns the
// `server_plugins` table, and reconciles it against a live `/plugins` directory
// listing so jars uploaded outside this tool still show up (as "unmanaged").
// See BACKEND.md's "Plugins" section for the full design and the non-negotiable
// rule that download URLs are always resolved server-side, never client-supplied.
//
// Hangar support was removed entirely (not just hidden) on 2026-08-21 — see
// that DEVLOG entry if it ever needs to come back. This module used to
// dispatch between two source modules; `hangar.ts` and every `"hangar"`
// branch are gone, confirmed no production `server_plugins` row referenced
// it before deleting.

import { db } from "./db.js";
import type { ServerPluginRow } from "./db.js";
import * as pterodactyl from "./pterodactyl.js";
import * as modrinth from "./modrinth.js";

export type PluginSource = "modrinth";

export function isPluginSource(value: unknown): value is PluginSource {
  return value === "modrinth";
}

export interface PluginSearchResultDTO {
  source: PluginSource;
  projectId: string;
  name: string;
  author: string;
  description: string;
  iconUrl: string | null;
  downloads: number;
}

export async function searchCatalog(source: PluginSource, query: string): Promise<PluginSearchResultDTO[]> {
  const results = await modrinth.searchModrinthProjects(query);
  return results.map((r) => ({ source, ...r }));
}

export interface PluginVersionDTO {
  versionId: string;
  versionName: string;
  gameVersions: string[];
  fileName: string;
  publishedAt: string;
}

// `_source` stays in the signature (unused now that Modrinth is the only
// source) to keep the route call-site shape stable — see BACKEND.md's
// Plugins section for why the URL still carries a `:source` segment.
export async function listVersions(_source: PluginSource, projectId: string): Promise<PluginVersionDTO[]> {
  return modrinth.getModrinthVersions(projectId);
}

export interface InstalledPluginDTO {
  id: number;
  source: PluginSource;
  projectId: string;
  projectName: string;
  projectAuthor: string;
  versionId: string;
  versionName: string;
  fileName: string;
  enabled: boolean;
  updateAvailable: boolean;
  installedAt: string;
  updatedAt: string;
}

function toInstalledPluginDTO(row: ServerPluginRow, updateAvailable = false): InstalledPluginDTO {
  return {
    id: row.id,
    source: row.source,
    projectId: row.project_id,
    projectName: row.project_name,
    projectAuthor: row.project_author,
    versionId: row.version_id,
    versionName: row.version_name,
    fileName: row.file_name,
    enabled: row.enabled === 1,
    updateAvailable,
    installedAt: row.installed_at,
    updatedAt: row.updated_at,
  };
}

const DISABLED_SUFFIX = ".disabled";

function baseFileName(diskName: string): string {
  return diskName.endsWith(DISABLED_SUFFIX) ? diskName.slice(0, -DISABLED_SUFFIX.length) : diskName;
}

export interface UnmanagedPlugin {
  fileName: string;
  enabled: boolean;
}

export interface InstalledPluginsResult {
  installed: InstalledPluginDTO[];
  unmanaged: UnmanagedPlugin[];
}

/**
 * `server_plugins` is the source of truth for metadata (which Modrinth
 * project+version a jar came from), but the actual `/plugins` directory is the
 * source of truth for what's really on disk — a customer can always upload or
 * delete a jar directly through the Files tab outside this feature. Reconciling
 * against a live listing on every read (rather than trusting the DB blindly)
 * is what surfaces those as a distinct "unmanaged" entry instead of just being
 * silently invisible or silently wrong.
 */
export async function listInstalledPlugins(apiKey: string, identifier: string): Promise<InstalledPluginsResult> {
  const rows = db
    .prepare("SELECT * FROM server_plugins WHERE server_identifier = ? ORDER BY project_name")
    .all(identifier) as ServerPluginRow[];
  const managedFileNames = new Set(rows.map((r) => r.file_name));

  let files: pterodactyl.FileObject[] = [];
  try {
    files = await pterodactyl.listFiles(apiKey, identifier, "/plugins");
  } catch {
    // No /plugins directory yet (fresh server, nothing installed) — not an error.
    files = [];
  }

  const unmanaged: UnmanagedPlugin[] = files
    .filter((f) => f.is_file && baseFileName(f.name).endsWith(".jar"))
    .filter((f) => !managedFileNames.has(baseFileName(f.name)))
    .map((f) => ({ fileName: baseFileName(f.name), enabled: !f.name.endsWith(DISABLED_SUFFIX) }));

  // "Update available" needs each row's current latest version from its own
  // source — a real network call per row, so failures are swallowed per-row
  // (a source being briefly unreachable shouldn't break the whole list).
  const installed = await Promise.all(
    rows.map(async (row) => {
      const latest = await getLatestVersionId(row.source, row.project_id);
      return toInstalledPluginDTO(row, latest !== null && latest !== row.version_id);
    })
  );

  return { installed, unmanaged };
}

async function getLatestVersionId(source: PluginSource, projectId: string): Promise<string | null> {
  try {
    const versions = await listVersions(source, projectId);
    return versions[0]?.versionId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mutations — install/uninstall/update/toggle. Every download URL is resolved
// here, server-side, from a trusted source module using only
// (source, projectId, versionId) — never a client-supplied URL (see
// BACKEND.md's Plugins section for why this is non-negotiable). `projectName`/
// `projectAuthor`/`versionName` are display-only metadata (never used for any
// file/network operation) — safe to accept from the client the same way the
// search UI already displayed them, sparing a redundant lookup call.
// ---------------------------------------------------------------------------

const MAX_JAR_SIZE = 100 * 1024 * 1024;

async function downloadJar(url: string, fileName: string): Promise<Buffer> {
  if (!fileName.toLowerCase().endsWith(".jar")) {
    throw new Error(`"${fileName}" isn't a .jar file.`);
  }
  // Measured: WorldEdit (7.7MB) downloads and re-uploads to Wings in ~2s total,
  // so 120s covers a jar at the 100MB cap even on a slow CDN edge. The point of
  // the bound is that this runs inline on a browser request against a host we
  // don't control — without a signal, a CDN that stalls mid-body holds the
  // request (and the partially-buffered jar) for undici's 300s default.
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) }).catch((err: unknown) => {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(`Downloading ${fileName} timed out.`);
    }
    throw err;
  });
  if (!res.ok) throw new Error(`Could not download ${fileName} (${res.status}).`);
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_JAR_SIZE) {
    throw new Error(`${fileName} is too large to install.`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_JAR_SIZE) {
    throw new Error(`${fileName} is too large to install.`);
  }
  return buffer;
}

async function resolveDownload(versionId: string): Promise<{ downloadUrl: string; fileName: string }> {
  return modrinth.resolveModrinthDownload(versionId);
}

async function ensurePluginsFolder(apiKey: string, identifier: string): Promise<void> {
  try {
    await pterodactyl.createFolder(apiKey, identifier, "/", "plugins");
  } catch {
    // Already exists (true for any server that's booted at least once) — a
    // real failure here will just surface more clearly on the upload itself.
  }
}

export async function installPlugin(
  apiKey: string,
  identifier: string,
  source: PluginSource,
  projectId: string,
  projectName: string,
  projectAuthor: string,
  versionId: string,
  versionName: string
): Promise<InstalledPluginDTO> {
  const { downloadUrl, fileName } = await resolveDownload(versionId);
  const buffer = await downloadJar(downloadUrl, fileName);
  await ensurePluginsFolder(apiKey, identifier);
  await pterodactyl.uploadFile(apiKey, identifier, "/plugins", fileName, buffer);

  db.prepare(
    `INSERT INTO server_plugins (server_identifier, source, project_id, project_name, project_author, version_id, version_name, file_name)
     VALUES (@identifier, @source, @projectId, @projectName, @projectAuthor, @versionId, @versionName, @fileName)
     ON CONFLICT(server_identifier, file_name) DO UPDATE SET
       source = @source, project_id = @projectId, project_name = @projectName, project_author = @projectAuthor,
       version_id = @versionId, version_name = @versionName, enabled = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  ).run({ identifier, source, projectId, projectName, projectAuthor, versionId, versionName, fileName });

  const row = db.prepare("SELECT * FROM server_plugins WHERE server_identifier = ? AND file_name = ?").get(identifier, fileName) as ServerPluginRow;
  return toInstalledPluginDTO(row);
}

export async function uninstallPlugin(apiKey: string, identifier: string, row: ServerPluginRow): Promise<void> {
  const diskName = row.enabled === 1 ? row.file_name : row.file_name + DISABLED_SUFFIX;
  await pterodactyl.deleteFiles(apiKey, identifier, "/plugins", [diskName]);
  db.prepare("DELETE FROM server_plugins WHERE id = ?").run(row.id);
}

export async function uninstallUnmanagedPlugin(apiKey: string, identifier: string, fileName: string, enabled: boolean): Promise<void> {
  const diskName = enabled ? fileName : fileName + DISABLED_SUFFIX;
  await pterodactyl.deleteFiles(apiKey, identifier, "/plugins", [diskName]);
}

export async function togglePlugin(apiKey: string, identifier: string, row: ServerPluginRow): Promise<InstalledPluginDTO> {
  const from = row.enabled === 1 ? row.file_name : row.file_name + DISABLED_SUFFIX;
  const to = row.enabled === 1 ? row.file_name + DISABLED_SUFFIX : row.file_name;
  await pterodactyl.renameFile(apiKey, identifier, "/plugins", from, to);
  db.prepare("UPDATE server_plugins SET enabled = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(
    row.enabled === 1 ? 0 : 1,
    row.id
  );
  const updated = db.prepare("SELECT * FROM server_plugins WHERE id = ?").get(row.id) as ServerPluginRow;
  return toInstalledPluginDTO(updated);
}

/**
 * `source`/`projectId` always come from the trusted DB row, never from the
 * request — only `versionId`/`versionName` are client-supplied, closing off
 * an "update row 5 using a completely different project" avenue.
 */
export async function updatePlugin(
  apiKey: string,
  identifier: string,
  row: ServerPluginRow,
  versionId: string,
  versionName: string
): Promise<InstalledPluginDTO> {
  const { downloadUrl, fileName } = await resolveDownload(versionId);
  const buffer = await downloadJar(downloadUrl, fileName);
  await ensurePluginsFolder(apiKey, identifier);

  const oldDiskName = row.enabled === 1 ? row.file_name : row.file_name + DISABLED_SUFFIX;
  if (oldDiskName !== fileName) {
    await pterodactyl.deleteFiles(apiKey, identifier, "/plugins", [oldDiskName]).catch(() => {});
  }
  await pterodactyl.uploadFile(apiKey, identifier, "/plugins", fileName, buffer);
  if (row.enabled === 0) {
    // Preserve a disabled plugin's disabled state across an update instead of
    // silently re-enabling it.
    await pterodactyl.renameFile(apiKey, identifier, "/plugins", fileName, fileName + DISABLED_SUFFIX);
  }

  db.prepare(
    `UPDATE server_plugins SET version_id = ?, version_name = ?, file_name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
  ).run(versionId, versionName, fileName, row.id);

  const updated = db.prepare("SELECT * FROM server_plugins WHERE id = ?").get(row.id) as ServerPluginRow;
  return toInstalledPluginDTO(updated);
}
