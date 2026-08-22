import { useCallback, useEffect, useRef, useState } from "react";
import { Download, RotateCcw, Trash2, Plus, HardDrive, Lock, Unlock, Loader2 } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { useToast } from "../ui/Toast";

interface Backup {
  uuid: string;
  name: string;
  bytes: number;
  created_at: string;
  completed_at: string | null;
  is_successful: boolean;
  is_locked: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 GB";
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function BackupsTab({ identifier }: { identifier: string }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupName, setBackupName] = useState("");
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const [deleting, setDeleting] = useState<Backup | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/servers/${identifier}/backups`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { backups: Backup[] };
      setBackups(data.backups);
      return data.backups;
    } catch {
      push("Could not load backups.", "warn");
      return [];
    }
  }, [identifier, push]);

  useEffect(() => {
    load().finally(() => setLoading(false));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  function pollUntilComplete(name: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const list = await load();
      const pending = list.find((b) => !b.completed_at);
      if (!pending) {
        if (pollRef.current) clearInterval(pollRef.current);
        push(`"${name}" backup complete.`, "success");
      }
    }, 3000);
  }

  async function handleCreate() {
    const name = backupName.trim() || "Manual backup";
    try {
      const res = await fetch(`/api/servers/${identifier}/backups`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      setCreating(false);
      setBackupName("");
      push("Backup started. This may take a few minutes.", "info");
      load();
      pollUntilComplete(name);
    } catch {
      push("Failed to start backup.", "warn");
    }
  }

  async function handleRestore() {
    if (!restoring) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/backups/${restoring.uuid}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Restoring from "${restoring.name}"... server will restart automatically.`, "info");
      setRestoring(null);
    } catch {
      push("Failed to start restore.", "warn");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/backups/${deleting.uuid}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Deleted backup "${deleting.name}"`, "warn");
      setDeleting(null);
      load();
    } catch {
      push("Failed to delete backup.", "warn");
    }
  }

  async function handleDownload(backup: Backup) {
    try {
      const res = await fetch(`/api/servers/${identifier}/backups/${backup.uuid}/download`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank");
    } catch {
      push("Failed to get download link.", "warn");
    }
  }

  async function handleToggleLock(backup: Backup) {
    try {
      const res = await fetch(`/api/servers/${identifier}/backups/${backup.uuid}/lock`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      push("Failed to update lock.", "warn");
    }
  }

  const totalBytes = backups.reduce((sum, b) => sum + b.bytes, 0);

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-text-md">
          <HardDrive size={14} className="text-accent-400" />
          {backups.length} backups stored · {formatBytes(totalBytes)} total
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> Create backup
        </Button>
      </div>

      <div className="divide-y divide-line-soft">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-text-lo">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        )}
        {!loading && backups.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-lo">No backups yet.</p>
        )}
        {!loading &&
          backups.map((backup) => {
            const inProgress = !backup.completed_at;
            return (
              <div key={backup.uuid} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-medium text-text-hi">{backup.name}</span>
                    {backup.is_locked && <Badge tone="neutral">locked</Badge>}
                    {inProgress && (
                      <Badge tone="warn" dot>
                        In progress
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-text-lo">
                    {new Date(backup.created_at).toLocaleString()} · {formatBytes(backup.bytes)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={inProgress} onClick={() => handleDownload(backup)}>
                    <Download size={13} /> Download
                  </Button>
                  <Button variant="secondary" size="sm" disabled={inProgress} onClick={() => setRestoring(backup)}>
                    <RotateCcw size={13} /> Restore
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleLock(backup)} title={backup.is_locked ? "Unlock" : "Lock"}>
                    {backup.is_locked ? <Unlock size={13} /> : <Lock size={13} />}
                  </Button>
                  <Button variant="danger" size="sm" disabled={inProgress || backup.is_locked} onClick={() => setDeleting(backup)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            );
          })}
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Create backup" description="Snapshot your server's current world and configuration.">
        <Input placeholder="Backup name (optional)" value={backupName} onChange={(e) => setBackupName(e.target.value)} autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Start backup</Button>
        </div>
      </Modal>

      <Modal
        open={!!restoring}
        onClose={() => setRestoring(null)}
        title="Restore backup"
        description={`Restoring "${restoring?.name}" will overwrite your current world and files. The server will restart.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRestoring(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRestore}>
            Restore backup
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete backup"
        description={`Permanently delete "${deleting?.name}"? This cannot be undone.`}
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
