import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Network, Star, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { useToast } from "../ui/Toast";
import { demoFetch } from "../../demo/api";

interface Allocation {
  id: number;
  ip: string;
  ip_alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
}

export function PortsTab({ identifier }: { identifier: string }) {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Allocation | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await demoFetch(`/api/servers/${identifier}/network/allocations`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { allocations: Allocation[] };
      setAllocations(data.allocations);
    } catch {
      push("Could not load port allocations.", "warn");
    } finally {
      setLoading(false);
    }
  }, [identifier, push]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    try {
      const res = await demoFetch(`/api/servers/${identifier}/network/allocations`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error);
      }
      push("Port allocated.", "success");
      setCreating(false);
      load();
    } catch (err) {
      push(err instanceof Error && err.message ? err.message : "Failed to allocate a port.", "warn");
    }
  }

  async function handleSetPrimary(allocation: Allocation) {
    try {
      const res = await demoFetch(`/api/servers/${identifier}/network/allocations/${allocation.id}/primary`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Port ${allocation.port} is now primary.`, "success");
      load();
    } catch {
      push("Failed to update primary allocation.", "warn");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      const res = await demoFetch(`/api/servers/${identifier}/network/allocations/${deleting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Removed allocation ${deleting.ip}:${deleting.port}`, "warn");
      setDeleting(null);
      load();
    } catch {
      push("Failed to remove allocation.", "warn");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-text-md">
          <Network size={14} className="text-accent-400" />
          {allocations.length} port {allocations.length === 1 ? "allocation" : "allocations"}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus size={14} /> Add allocation
        </Button>
      </div>

      <div className="divide-y divide-line-soft">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-text-lo">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        )}
        {!loading && allocations.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-lo">No port allocations yet.</p>
        )}
        {!loading &&
          allocations.map((allocation) => (
            <div key={allocation.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[13.5px] font-medium text-text-hi">
                      {allocation.ip_alias ?? allocation.ip}:{allocation.port}
                    </span>
                    {allocation.is_default && <Badge tone="accent">Primary</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-text-lo">{allocation.notes || "No notes"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!allocation.is_default && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => handleSetPrimary(allocation)}>
                      <Star size={13} /> Make primary
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setDeleting(allocation)}
                      aria-label={`Remove allocation ${allocation.ip_alias ?? allocation.ip}:${allocation.port}`}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add allocation"
        description="Assigns the next free port on this server's node — for a proxy, voice chat plugin, or secondary service. Ports can't be hand-picked; Pterodactyl allocates from what's available."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Add allocation</Button>
        </div>
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remove allocation"
        description={`Remove the allocation on port ${deleting?.port}? Any service bound to it will stop being reachable.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}
