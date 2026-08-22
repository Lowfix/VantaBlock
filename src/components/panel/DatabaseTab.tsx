import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, KeyRound, Eye, EyeOff, RefreshCw, Database as DatabaseIcon, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Label } from "../ui/Input";
import { useToast } from "../ui/Toast";

interface ManagedDatabase {
  id: string;
  name: string;
  username: string;
  host: string;
  port: number;
  connectionsFrom: string;
  maxConnections: number;
  password: string | null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function DatabaseTab({ identifier }: { identifier: string }) {
  const [databases, setDatabases] = useState<ManagedDatabase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [dbName, setDbName] = useState("");
  const [viewing, setViewing] = useState<ManagedDatabase | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState<ManagedDatabase | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${identifier}/databases`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { databases: ManagedDatabase[] };
      setDatabases(data.databases);
    } catch {
      push("Could not load databases.", "warn");
    }
  }, [identifier, push]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleCreate() {
    const slug = slugify(dbName);
    if (!slug) return;
    setCreateSubmitting(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/databases`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: slug }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to create database.");
      const database: ManagedDatabase = body.database;
      setDatabases((list) => [database, ...list]);
      push(`Database "${database.name}" created.`, "success");
      setCreating(false);
      setDbName("");
      setShowPassword(true);
      setViewing(database);
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to create database.", "warn");
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleRotatePassword() {
    if (!viewing) return;
    setRotating(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/databases/${viewing.id}/rotate-password`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to rotate password.");
      const updated: ManagedDatabase = body.database;
      setDatabases((list) => list.map((d) => (d.id === updated.id ? updated : d)));
      setViewing(updated);
      setShowPassword(true);
      push("Password rotated.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to rotate password.", "warn");
    } finally {
      setRotating(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/databases/${deleting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setDatabases((list) => list.filter((d) => d.id !== deleting.id));
      push(`Deleted database "${deleting.name}"`, "warn");
    } catch {
      push(`Failed to delete "${deleting.name}".`, "warn");
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-line bg-panel/60 py-16">
        <Loader2 size={20} className="animate-spin text-accent-400" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-text-md">
          <DatabaseIcon size={14} className="text-accent-400" />
          {databases.length} database{databases.length === 1 ? "" : "s"} provisioned
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreating(true);
            setDbName("");
          }}
        >
          <Plus size={14} /> Create database
        </Button>
      </div>

      {databases.length === 0 && (
        <p className="px-4 py-8 text-center text-[13px] text-text-lo">No databases yet — create one for a plugin or web integration.</p>
      )}

      <div className="divide-y divide-line-soft">
        {databases.map((db) => (
          <div key={db.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-[13.5px] font-medium text-text-hi">{db.name}</p>
              <p className="mt-1 font-mono text-xs text-text-lo">
                {db.host}:{db.port} · {db.username}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowPassword(false);
                  setViewing(db);
                }}
              >
                <KeyRound size={13} /> View credentials
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleting(db)} aria-label={`Delete database ${db.name}`}>
                <Trash2 size={13} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create database"
        description="Provision a new MySQL database for a plugin or web integration. Connection details are generated automatically."
      >
        <Label htmlFor="db-name">Database name</Label>
        <Input id="db-name" placeholder="e.g. dynmap_web" value={dbName} onChange={(e) => setDbName(e.target.value)} autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreating(false)} disabled={createSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createSubmitting || !slugify(dbName)}>
            {createSubmitting ? "Creating..." : "Create database"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        description="Use these credentials to connect a plugin or external tool to this database."
      >
        {viewing && (
          <div className="space-y-3 font-mono text-[13px]">
            <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
              <span className="text-text-lo">Host</span>
              <span className="text-text-hi">{viewing.host}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
              <span className="text-text-lo">Port</span>
              <span className="text-text-hi">{viewing.port}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
              <span className="text-text-lo">Username</span>
              <span className="text-text-hi">{viewing.username}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3.5 py-2.5">
              <span className="text-text-lo">Password</span>
              <span className="flex items-center gap-2">
                <span className="text-text-hi">
                  {viewing.password ? (showPassword ? viewing.password : "•".repeat(16)) : "—"}
                </span>
                {viewing.password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-text-lo hover:text-text-hi"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </span>
            </div>
          </div>
        )}
        <div className="mt-5 flex justify-between gap-2">
          <Button variant="secondary" onClick={handleRotatePassword} disabled={rotating}>
            <RefreshCw size={13} className={rotating ? "animate-spin" : ""} /> Rotate password
          </Button>
          <Button variant="secondary" onClick={() => setViewing(null)}>
            Close
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete database"
        description={`Permanently delete "${deleting?.name}"? Any plugin relying on it will stop working.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
