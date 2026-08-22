import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, RefreshCw, Search, Loader2 } from "lucide-react";
import type { GameServer } from "../../mock-data/servers";
import { Toggle } from "../ui/Toggle";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { useToast } from "../ui/Toast";

type PluginSource = "modrinth";

interface InstalledPlugin {
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
}

interface UnmanagedPlugin {
  fileName: string;
  enabled: boolean;
}

interface SearchResult {
  source: PluginSource;
  projectId: string;
  name: string;
  author: string;
  description: string;
  downloads: number;
}

interface PluginVersion {
  versionId: string;
  versionName: string;
  gameVersions: string[];
}

const SOURCE_LABEL: Record<PluginSource, string> = { modrinth: "Modrinth" };

// Modrinth is the only plugin source — Hangar was removed entirely (not just
// hidden) per the 2026-08-21 DEVLOG entry. `PluginSource` stays a named type
// rather than inlining the literal everywhere, in case a source is ever added
// back or a new one introduced.
const SEARCH_SOURCE: PluginSource = "modrinth";

export function PluginsTab({ identifier, server }: { identifier: string; server: GameServer }) {
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [unmanaged, setUnmanaged] = useState<UnmanagedPlugin[]>([]);
  const [busyId, setBusyId] = useState<number | string | null>(null);

  const [installOpen, setInstallOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState<SearchResult | null>(null);
  const [versions, setVersions] = useState<PluginVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);

  const [uninstalling, setUninstalling] = useState<InstalledPlugin | null>(null);
  const [deletingUnmanaged, setDeletingUnmanaged] = useState<UnmanagedPlugin | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/plugins`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        supported: boolean;
        featureEnabled: boolean;
        installed: InstalledPlugin[];
        unmanaged: UnmanagedPlugin[];
      };
      setSupported(data.supported);
      setFeatureEnabled(data.featureEnabled);
      setInstalled(data.installed);
      setUnmanaged(data.unmanaged);
    } catch {
      push("Could not load plugins.", "warn");
    } finally {
      setLoading(false);
    }
  }, [identifier, push]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!installOpen || picking) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/servers/${identifier}/plugins/search?source=${SEARCH_SOURCE}&q=${encodeURIComponent(query.trim())}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setResults(res.ok ? data.results : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [identifier, installOpen, picking, query]);

  async function openVersionPicker(result: SearchResult) {
    setPicking(result);
    setLoadingVersions(true);
    setVersions([]);
    try {
      const res = await fetch(
        `/api/servers/${identifier}/plugins/${result.source}/${encodeURIComponent(result.projectId)}/versions`,
        { credentials: "include" }
      );
      const data = await res.json();
      setVersions(res.ok ? data.versions : []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }

  function closeInstallModal() {
    setInstallOpen(false);
    setQuery("");
    setResults([]);
    setPicking(null);
    setVersions([]);
  }

  async function handleInstall(version: PluginVersion) {
    if (!picking) return;
    setInstallingVersionId(version.versionId);
    try {
      const res = await fetch(`/api/servers/${identifier}/plugins/install`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: picking.source,
          projectId: picking.projectId,
          projectName: picking.name,
          projectAuthor: picking.author,
          versionId: version.versionId,
          versionName: version.versionName,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to install plugin.");
      push(`Installed "${picking.name}". Restart the server to apply.`, "success");
      closeInstallModal();
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to install plugin.", "warn");
    } finally {
      setInstallingVersionId(null);
    }
  }

  async function handleUninstall() {
    if (!uninstalling) return;
    setBusyId(uninstalling.id);
    try {
      const res = await fetch(`/api/servers/${identifier}/plugins/${uninstalling.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to uninstall plugin.");
      }
      push(`Uninstalled "${uninstalling.projectName}". Restart the server to apply.`, "warn");
      setUninstalling(null);
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to uninstall plugin.", "warn");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteUnmanaged() {
    if (!deletingUnmanaged) return;
    setBusyId(deletingUnmanaged.fileName);
    try {
      const res = await fetch(`/api/servers/${identifier}/plugins/unmanaged`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: deletingUnmanaged.fileName, enabled: deletingUnmanaged.enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete file.");
      }
      push(`Deleted "${deletingUnmanaged.fileName}". Restart the server to apply.`, "warn");
      setDeletingUnmanaged(null);
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to delete file.", "warn");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdate(plugin: InstalledPlugin) {
    setBusyId(plugin.id);
    try {
      const versionsRes = await fetch(
        `/api/servers/${identifier}/plugins/${plugin.source}/${encodeURIComponent(plugin.projectId)}/versions`,
        { credentials: "include" }
      );
      const versionsData = await versionsRes.json();
      const latest = versionsRes.ok ? (versionsData.versions as PluginVersion[])[0] : null;
      if (!latest) throw new Error("Could not find a newer version.");

      const res = await fetch(`/api/servers/${identifier}/plugins/${plugin.id}/update`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: latest.versionId, versionName: latest.versionName }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to update plugin.");
      push(`Updated "${plugin.projectName}" to v${latest.versionName}. Restart the server to apply.`, "success");
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update plugin.", "warn");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggle(plugin: InstalledPlugin) {
    setBusyId(plugin.id);
    try {
      const res = await fetch(`/api/servers/${identifier}/plugins/${plugin.id}/toggle`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to update plugin.");
      push(`${body.plugin.enabled ? "Enabled" : "Disabled"} "${plugin.projectName}". Restart the server to apply.`, "success");
      load();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update plugin.", "warn");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-panel/60 py-16 text-[13px] text-text-lo">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-line bg-panel/60 py-16 text-center text-[13px] text-text-lo">
        Plugins are only available for Paper servers — this server is running {server.software}.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-text-md">
          {installed.length} plugins installed · {installed.filter((p) => p.enabled).length} enabled
          {unmanaged.length > 0 && <span className="text-text-lo"> · {unmanaged.length} unmanaged</span>}
        </div>
        <Button size="sm" onClick={() => setInstallOpen(true)} disabled={!featureEnabled}>
          <Plus size={14} /> Install plugin
        </Button>
      </div>

      {!featureEnabled && (
        <p className="border-b border-line-soft bg-warn/10 px-4 py-2 text-xs text-warn">
          Installing/updating/uninstalling plugins is turned off right now — check back later.
        </p>
      )}

      <div className="divide-y divide-line-soft">
        {installed.map((plugin) => (
          <div key={plugin.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Toggle
                checked={plugin.enabled}
                onChange={() => handleToggle(plugin)}
                disabled={!featureEnabled || busyId === plugin.id}
                label={`Toggle ${plugin.projectName}`}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-text-hi">{plugin.projectName}</span>
                  <Badge tone="neutral">{SOURCE_LABEL[plugin.source]}</Badge>
                  <Badge tone="neutral">v{plugin.versionName}</Badge>
                  {plugin.updateAvailable && (
                    <Badge tone="accent" dot>
                      Update available
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-lo">by {plugin.projectAuthor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plugin.updateAvailable && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUpdate(plugin)}
                  disabled={!featureEnabled || busyId === plugin.id}
                >
                  <RefreshCw size={13} /> Update
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setUninstalling(plugin)}
                disabled={!featureEnabled || busyId === plugin.id}
                aria-label={`Uninstall ${plugin.projectName}`}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        ))}

        {unmanaged.map((plugin) => (
          <div key={plugin.fileName} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-text-hi">{plugin.fileName}</span>
                  <Badge tone="neutral">Unmanaged</Badge>
                  <Badge tone={plugin.enabled ? "good" : "neutral"}>{plugin.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-text-lo">Uploaded outside the plugin browser — filename only, no version info.</p>
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setDeletingUnmanaged(plugin)}
              disabled={!featureEnabled || busyId === plugin.fileName}
              aria-label={`Delete ${plugin.fileName}`}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ))}

        {installed.length === 0 && unmanaged.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-text-lo">No plugins installed yet.</p>
        )}
      </div>

      <Modal open={installOpen} onClose={closeInstallModal} title="Install plugin" description="Search Modrinth and install with one click.">
        {!picking ? (
          <>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-lo" />
              <Input placeholder="Search plugins..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" autoFocus />
            </div>
            <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
              {searching && <p className="px-1 py-6 text-center text-[13px] text-text-lo">Searching...</p>}
              {!searching && query.trim() && results.length === 0 && (
                <p className="px-1 py-6 text-center text-[13px] text-text-lo">No plugins match your search.</p>
              )}
              {!query.trim() && <p className="px-1 py-6 text-center text-[13px] text-text-lo">Type to search {SOURCE_LABEL[SEARCH_SOURCE]}.</p>}
              {!searching &&
                results.map((r) => (
                  <div key={r.projectId} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2/60 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-text-hi">{r.name}</span>
                        <span className="shrink-0 text-xs text-text-lo">by {r.author}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-text-lo">{r.description}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => openVersionPicker(r)}>
                      Select
                    </Button>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setPicking(null);
                setVersions([]);
              }}
              className="mb-3 text-[13px] text-accent-400 hover:underline"
            >
              ← Back to search
            </button>
            <p className="mb-3 text-[13px] text-text-md">
              Choose a version of <span className="font-medium text-text-hi">{picking.name}</span> to install:
            </p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {loadingVersions && <p className="px-1 py-6 text-center text-[13px] text-text-lo">Loading versions...</p>}
              {!loadingVersions && versions.length === 0 && (
                <p className="px-1 py-6 text-center text-[13px] text-text-lo">No compatible versions found.</p>
              )}
              {!loadingVersions &&
                versions.map((v) => (
                  <div key={v.versionId} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-panel-2/60 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <span className="text-[13px] font-medium text-text-hi">v{v.versionName}</span>
                      {v.gameVersions.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-text-lo">MC {v.gameVersions.slice(-4).join(", ")}</p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => handleInstall(v)} disabled={installingVersionId !== null}>
                      {installingVersionId === v.versionId ? "Installing..." : "Install"}
                    </Button>
                  </div>
                ))}
            </div>
          </>
        )}
      </Modal>

      <Modal
        open={!!uninstalling}
        onClose={() => setUninstalling(null)}
        title="Uninstall plugin"
        description={`Uninstall "${uninstalling?.projectName}"? Any data it stores may be lost. Restart the server to apply.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setUninstalling(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleUninstall}>
            Uninstall
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!deletingUnmanaged}
        onClose={() => setDeletingUnmanaged(null)}
        title="Delete file"
        description={`Delete "${deletingUnmanaged?.fileName}"? It wasn't installed through this tool, so there's no version to reinstall from here.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeletingUnmanaged(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteUnmanaged}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
