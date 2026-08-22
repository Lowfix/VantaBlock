import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Search, ArrowUpDown, KeyRound, Trash2, Loader2, Plus, Copy, Check } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input, Label } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Toggle } from "../components/ui/Toggle";
import { useUser } from "../context/UserContext";
import { useToast } from "../components/ui/Toast";
import { usePolling } from "../lib/usePolling";
import { cn } from "../lib/cn";

type Tab = "accounts" | "invites";

const tabs: { id: Tab; label: string }[] = [
  { id: "accounts", label: "All Accounts" },
  { id: "invites", label: "Invite Codes" },
];

interface Account {
  id: number;
  username: string;
  email: string;
  authProvider: string;
  role: "owner" | "admin" | "member";
  suspended: boolean;
  serverCount: number;
  createdAt: string;
}

type SortKey = "username" | "serverCount" | "createdAt";

const roleTone = { owner: "accent", admin: "good", member: "neutral" } as const;

export function AccountsPage() {
  const { user: currentUser } = useUser();
  const [tab, setTab] = useState<Tab>("accounts");

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardShell title="Accounts">
      <div className="mb-6 flex items-center gap-1 rounded-lg border border-line bg-panel-2 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-panel-3 text-text-hi" : "text-text-lo hover:text-text-md"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "accounts" && <AllAccountsTab />}
      {tab === "invites" && <InviteCodesTab />}
    </DashboardShell>
  );
}

function AllAccountsTab() {
  const { push } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [managing, setManaging] = useState<Account | null>(null);

  async function loadAccounts() {
    const res = await fetch("/api/accounts", { credentials: "include" });
    if (res.ok) setAccounts(await res.json());
  }

  useEffect(() => {
    loadAccounts()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  usePolling(() => {
    loadAccounts().catch(() => {});
  }, 15000);

  function applyUpdate(updated: Partial<Account> & { id: number }) {
    setAccounts((list) => list.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
    setManaging((m) => (m && m.id === updated.id ? { ...m, ...updated } : m));
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = accounts.filter(
      (a) => !q || a.username.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "username") cmp = a.username.localeCompare(b.username);
      else if (sortKey === "serverCount") cmp = a.serverCount - b.serverCount;
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [accounts, query, sortKey, sortDir]);

  function SortHeader({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) {
    return (
      <button
        onClick={() => toggleSort(sortKeyName)}
        className="flex items-center gap-1 font-medium text-text-lo transition-colors hover:text-text-hi"
      >
        {label}
        <ArrowUpDown size={11} className={sortKey === sortKeyName ? "text-accent-400" : "text-text-lo"} />
      </button>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>All accounts</CardTitle>
            <CardDescription>Manage every Vantablock account — admin access, suspensions, and support actions.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-lo" />
            <Input
              placeholder="Search by username or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-accent-400" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line-soft bg-panel-2 text-xs text-text-lo">
                    <th className="px-4 py-2.5">
                      <SortHeader label="Account" sortKeyName="username" />
                    </th>
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2.5">
                      <SortHeader label="Servers" sortKeyName="serverCount" />
                    </th>
                    <th className="px-4 py-2.5 font-medium">Auth</th>
                    <th className="px-4 py-2.5">
                      <SortHeader label="Joined" sortKeyName="createdAt" />
                    </th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-text-lo">
                        No accounts found.
                      </td>
                    </tr>
                  )}
                  {filtered.map((a) => (
                    <tr key={a.id} className="border-b border-line-soft last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-hi">{a.username}</p>
                        <p className="text-xs text-text-lo">{a.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={roleTone[a.role]}>{a.role}</Badge>
                          {a.suspended && <Badge tone="bad">suspended</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-md">{a.serverCount}</td>
                      <td className="px-4 py-3 text-text-md capitalize">{a.authProvider}</td>
                      <td className="px-4 py-3 text-text-md">
                        {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="secondary" size="sm" onClick={() => setManaging(a)}>
                          Manage
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ManageAccountModal account={managing} onClose={() => setManaging(null)} onUpdated={applyUpdate} push={push} />
    </>
  );
}

interface ServerSummary {
  identifier: string;
  name: string;
  status: string;
}

function ManageAccountModal({
  account,
  onClose,
  onUpdated,
  push,
}: {
  account: Account | null;
  onClose: () => void;
  onUpdated: (u: Partial<Account> & { id: number }) => void;
  push: (msg: string, tone?: "success" | "warn" | "info") => void;
}) {
  const [detail, setDetail] = useState<{ servers: ServerSummary[] } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [togglingAdmin, setTogglingAdmin] = useState(false);
  const [togglingSuspend, setTogglingSuspend] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!account) {
      setDetail(null);
      setNewPassword("");
      setConfirmingDelete(false);
      return;
    }
    fetch(`/api/accounts/${account.id}/detail`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setDetail(d))
      .catch(() => {});
  }, [account]);

  if (!account) return null;
  const isOwnerRow = account.role === "owner";

  async function handleToggleAdmin() {
    setTogglingAdmin(true);
    try {
      const nextValue = account!.role !== "admin";
      const res = await fetch(`/api/accounts/${account!.id}/admin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: nextValue }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to update admin status.");
      onUpdated({ id: account!.id, role: nextValue ? "admin" : "member" });
      push(nextValue ? `${account!.username} is now an admin.` : `${account!.username} is no longer an admin.`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update admin status.", "warn");
    } finally {
      setTogglingAdmin(false);
    }
  }

  async function handleToggleSuspend() {
    setTogglingSuspend(true);
    try {
      const nextValue = !account!.suspended;
      const res = await fetch(`/api/accounts/${account!.id}/suspend`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: nextValue }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to update suspension.");
      onUpdated({ id: account!.id, suspended: nextValue });
      push(nextValue ? `${account!.username} has been suspended.` : `${account!.username} has been unsuspended.`, nextValue ? "warn" : "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update suspension.", "warn");
    } finally {
      setTogglingSuspend(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) {
      push("New password must be at least 8 characters.", "warn");
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch(`/api/accounts/${account!.id}/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to reset password.");
      setNewPassword("");
      push(`Password reset for ${account!.username}.`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to reset password.", "warn");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/accounts/${account!.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to delete account.");
      }
      push(`${account!.username}'s account has been deleted.`, "warn");
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to delete account.", "warn");
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <Modal open={!!account} onClose={onClose} title={account.username} description={account.email} className="!max-w-lg">
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-text-hi">Admin access</p>
            <p className="text-xs text-text-lo">Deploy without approval, Bank access, approve requests.</p>
          </div>
          {isOwnerRow ? (
            <Badge tone="accent">Owner</Badge>
          ) : (
            <Toggle checked={account.role === "admin"} onChange={handleToggleAdmin} disabled={togglingAdmin} label="Admin access" />
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-text-hi">Suspended</p>
            <p className="text-xs text-text-lo">Blocks login immediately — doesn't delete anything.</p>
          </div>
          {isOwnerRow ? (
            <Badge tone="neutral">Can't suspend owner</Badge>
          ) : (
            <Toggle checked={account.suspended} onChange={handleToggleSuspend} disabled={togglingSuspend} label="Suspended" />
          )}
        </div>

        <div>
          <Label htmlFor="reset-password">Reset password</Label>
          <div className="flex items-center gap-2">
            <Input
              id="reset-password"
              type="text"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={handleResetPassword} disabled={resettingPassword}>
              <KeyRound size={13} /> {resettingPassword ? "Setting..." : "Set"}
            </Button>
          </div>
        </div>

        {detail && (
          <div className="border-t border-line-soft pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Servers ({detail.servers.length})</p>
            {detail.servers.length === 0 ? (
              <p className="text-[13px] text-text-lo">No servers.</p>
            ) : (
              <div className="space-y-1.5">
                {detail.servers.map((s) => (
                  <div key={s.identifier} className="flex items-center justify-between rounded-md border border-line bg-panel-2 px-3 py-1.5 text-[13px]">
                    <span className="text-text-hi">{s.name}</span>
                    <span className="text-xs text-text-lo">{s.status}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {!isOwnerRow && (
          <div className="border-t border-line-soft pt-4">
            {!confirmingDelete ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
                <Trash2 size={13} /> Delete account
              </Button>
            ) : (
              <div className="rounded-lg border border-bad/25 bg-bad/5 p-3">
                <p className="mb-2 text-[13px] text-text-hi">
                  Permanently delete {account.username}? This removes their servers, Pterodactyl account, and invoices. Can't be undone.
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Yes, delete permanently"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Invite Codes
// ---------------------------------------------------------------------------

interface InviteCode {
  id: number;
  code: string;
  usedByUserId: number | null;
  usedByUsername: string | null;
  usedByEmail: string | null;
  createdAt: string;
  usedAt: string | null;
}

function InviteCodesTab() {
  const { push } = useToast();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function loadCodes() {
    return fetch("/api/owner/invites", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setCodes);
  }

  useEffect(() => {
    loadCodes()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  usePolling(() => {
    loadCodes().catch(() => {});
  }, 15000);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/owner/invites", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to generate an invite code.");
      const created = await res.json();
      setCodes((list) => [created, ...list]);
      push(`New invite code: ${created.code}`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to generate an invite code.", "warn");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy(code: InviteCode) {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopiedId(code.id);
      setTimeout(() => setCopiedId((id) => (id === code.id ? null : id)), 1500);
    } catch {
      push("Couldn't copy — select and copy the code manually.", "warn");
    }
  }

  async function handleDelete(code: InviteCode) {
    try {
      const res = await fetch(`/api/owner/invites/${code.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove that code.");
      setCodes((list) => list.filter((c) => c.id !== code.id));
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to remove that code.", "warn");
    }
  }

  const unused = codes.filter((c) => !c.usedByUserId);
  const used = codes.filter((c) => c.usedByUserId);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Invite codes</CardTitle>
          <CardDescription>
            Registration requires one of these single-use codes. Generate one and send it to whoever you're adding.
          </CardDescription>
        </div>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          <Plus size={14} /> {generating ? "Generating..." : "Generate code"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin text-accent-400" />
          </div>
        ) : codes.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-text-lo">
            No invite codes yet — generate one to let a friend register.
          </p>
        ) : (
          <div className="space-y-5">
            {unused.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Unused ({unused.length})</p>
                <div className="space-y-1.5">
                  {unused.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-3.5 py-2.5"
                    >
                      <span className="font-mono text-sm tracking-wider text-text-hi">{c.code}</span>
                      <div className="flex items-center gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => handleCopy(c)}>
                          {copiedId === c.id ? <Check size={13} /> : <Copy size={13} />}
                          {copiedId === c.id ? "Copied" : "Copy"}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleDelete(c)}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {used.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-lo">Used ({used.length})</p>
                <div className="space-y-1.5">
                  {used.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border border-line-soft bg-panel-2/50 px-3.5 py-2.5"
                    >
                      <div>
                        <span className="font-mono text-sm tracking-wider text-text-lo line-through">{c.code}</span>
                        <p className="mt-0.5 text-xs text-text-lo">
                          Used by {c.usedByUsername} ({c.usedByEmail})
                          {c.usedAt &&
                            ` on ${new Date(c.usedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                        </p>
                      </div>
                      <Badge tone="neutral">used</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
