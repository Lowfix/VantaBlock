import { useCallback, useEffect, useState } from "react";
import { UserPlus, UserMinus, UsersRound, Loader2 } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input, Label, Select } from "../ui/Input";
import { useToast } from "../ui/Toast";

type Role = "Administrator" | "Support" | "Viewer";
const roleOptions: Role[] = ["Administrator", "Support", "Viewer"];
const roleTone = { Administrator: "accent", Support: "warn", Viewer: "neutral" } as const;

interface Subuser {
  uuid: string;
  email: string;
  permissions: string[];
  created_at: string;
}

function roleForPermissions(permissions: string[]): Role {
  if (permissions.includes("settings.rename") || permissions.includes("user.create")) return "Administrator";
  if (permissions.includes("control.start")) return "Support";
  return "Viewer";
}

export function UsersTab({ identifier }: { identifier: string }) {
  const [users, setUsers] = useState<Subuser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Support");
  const [removing, setRemoving] = useState<Subuser | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/users`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { users: Subuser[] };
      setUsers(data.users);
    } catch {
      push("Could not load teammates.", "warn");
    } finally {
      setLoading(false);
    }
  }, [identifier, push]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleInvite() {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/users`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error);
      }
      push(`Invited ${trimmed} as ${role}.`, "success");
      setInviting(false);
      setEmail("");
      setRole("Support");
      load();
    } catch (err) {
      push(err instanceof Error && err.message ? err.message : "Failed to invite user.", "warn");
    }
  }

  async function handleRemove() {
    if (!removing) return;
    try {
      const res = await fetch(`/api/servers/${identifier}/users/${removing.uuid}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push(`Removed ${removing.email} from this server.`, "warn");
      setRemoving(null);
      load();
    } catch {
      push("Failed to remove user.", "warn");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-text-md">
          <UsersRound size={14} className="text-accent-400" />
          {users.length} teammates with panel access
        </div>
        <Button
          size="sm"
          onClick={() => {
            setInviting(true);
            setEmail("");
            setRole("Support");
          }}
        >
          <UserPlus size={14} /> Invite user
        </Button>
      </div>

      <div className="divide-y divide-line-soft">
        {loading && (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-[13px] text-text-lo">
            <Loader2 size={15} className="animate-spin" /> Loading...
          </div>
        )}
        {!loading && users.length === 0 && (
          <p className="px-4 py-8 text-center text-[13px] text-text-lo">No teammates have access yet.</p>
        )}
        {!loading &&
          users.map((user) => {
            const role = roleForPermissions(user.permissions);
            return (
              <div key={user.uuid} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-[12px] font-semibold text-accent-300">
                    {user.email.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium text-text-hi">{user.email}</p>
                    <p className="mt-0.5 text-xs text-text-lo">Added {new Date(user.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={roleTone[role]}>{role}</Badge>
                  <Button variant="danger" size="sm" onClick={() => setRemoving(user)}>
                    <UserMinus size={13} /> Remove
                  </Button>
                </div>
              </div>
            );
          })}
      </div>

      <Modal
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite user"
        description="Give a teammate access to help manage this server from the panel."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teammate@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setInviting(false)}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={!email.trim()}>
            Send invite
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Remove teammate access"
        description={`Revoke panel access for ${removing?.email}? They will no longer be able to manage this server.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemove}>
            Remove access
          </Button>
        </div>
      </Modal>
    </div>
  );
}
