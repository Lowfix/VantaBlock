import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Search, Gift, Pencil } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Input, Label } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useUser } from "../context/UserContext";
import { useToast } from "../components/ui/Toast";
import { usePolling } from "../lib/usePolling";

interface BankUser {
  id: number;
  username: string;
  email: string;
  balance: number;
}

export function BankPage() {
  const { user: currentUser } = useUser();
  const { push } = useToast();
  const [users, setUsers] = useState<BankUser[]>([]);
  const [query, setQuery] = useState("");
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<BankUser | null>(null);

  async function loadUsers() {
    const res = await fetch("/api/bank/users", { credentials: "include" });
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    loadUsers().catch(() => {});
  }, []);
  usePolling(() => {
    loadUsers().catch(() => {});
  }, 15000);

  if (!currentUser) return null;
  if (!currentUser.isAdmin) return <Navigate to="/dashboard" replace />;

  function applyUpdate(updated: BankUser) {
    setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    setEditing((e) => (e && e.id === updated.id ? updated : e));
  }

  async function handleAddFunds(targetUserId: number) {
    const raw = amounts[targetUserId];
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value <= 0) {
      push("Enter an amount greater than $0.", "warn");
      return;
    }
    setSubmittingId(targetUserId);
    try {
      const res = await fetch("/api/bank/add-funds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, amount: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to add funds.");
      applyUpdate(body);
      setAmounts((a) => ({ ...a, [targetUserId]: "" }));
      push(`Added $${value.toFixed(2)} to ${body.username}'s balance.`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to add funds.", "warn");
    } finally {
      setSubmittingId(null);
    }
  }

  const filtered = users.filter(
    (u) =>
      !query.trim() ||
      u.username.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <DashboardShell title="Bank">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Credit an account</CardTitle>
            <CardDescription>
              Add a bonus credit to any Vantablock account's balance. This is a ledger adjustment only — no real
              money moves. Real funds only move when a user tops up their own balance with a card.
            </CardDescription>
          </div>
          <Gift size={18} className="text-accent-400" />
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

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line-soft bg-panel-2 text-xs text-text-lo">
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Balance</th>
                  <th className="px-4 py-2.5 font-medium">Add funds</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-text-lo">
                      No accounts found.
                    </td>
                  </tr>
                )}
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-line-soft last:border-b-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-hi">{u.username}</p>
                      <p className="text-xs text-text-lo">{u.email}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-text-hi">${u.balance.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="h-8 w-28 text-[13px]"
                          value={amounts[u.id] ?? ""}
                          onChange={(e) => setAmounts((a) => ({ ...a, [u.id]: e.target.value }))}
                        />
                        <Button size="sm" disabled={submittingId === u.id} onClick={() => handleAddFunds(u.id)}>
                          {submittingId === u.id ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setEditing(u)}
                        className="rounded-md p-1.5 text-text-lo transition-colors hover:bg-panel-3 hover:text-text-hi"
                        aria-label={`Edit ${u.username}`}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <EditUserModal user={editing} onClose={() => setEditing(null)} onUpdated={applyUpdate} />
    </DashboardShell>
  );
}

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: BankUser | null;
  onClose: () => void;
  onUpdated: (u: BankUser) => void;
}) {
  const { push } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deductAmount, setDeductAmount] = useState("");
  const [deducting, setDeducting] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [settingBalance, setSettingBalance] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setEmail(user.email);
      setDeductAmount("");
      setNewBalance("");
    }
  }, [user]);

  if (!user) return null;

  async function handleSaveProfile() {
    if (!username.trim() || !email.trim()) {
      push("Username and email are required.", "warn");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch(`/api/bank/user/${user!.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), email: email.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to update profile.");
      onUpdated(body);
      push("Profile updated.", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to update profile.", "warn");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleDeduct() {
    const value = Number(deductAmount);
    if (!deductAmount || !Number.isFinite(value) || value <= 0) {
      push("Enter an amount greater than $0.", "warn");
      return;
    }
    setDeducting(true);
    try {
      const res = await fetch("/api/bank/deduct-funds", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, amount: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to deduct funds.");
      onUpdated(body);
      setDeductAmount("");
      push(`Deducted $${value.toFixed(2)} from ${body.username}'s balance.`, "warn");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to deduct funds.", "warn");
    } finally {
      setDeducting(false);
    }
  }

  async function handleSetBalance() {
    const value = Number(newBalance);
    if (newBalance === "" || !Number.isFinite(value)) {
      push("Enter a valid balance.", "warn");
      return;
    }
    setSettingBalance(true);
    try {
      const res = await fetch("/api/bank/set-balance", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user!.id, balance: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to set balance.");
      onUpdated(body);
      setNewBalance("");
      push(`Set ${body.username}'s balance to $${value.toFixed(2)}.`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to set balance.", "warn");
    } finally {
      setSettingBalance(false);
    }
  }

  return (
    <Modal open={!!user} onClose={onClose} title={`Edit ${user.username}`} description="Admin-only account adjustments.">
      <div className="space-y-5">
        <div className="space-y-3">
          <div>
            <Label htmlFor="edit-username">Username</Label>
            <Input id="edit-username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button variant="secondary" size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? "Saving..." : "Save profile"}
          </Button>
        </div>

        <div className="border-t border-line-soft pt-4">
          <p className="text-xs text-text-lo">Current balance</p>
          <p className="text-lg font-semibold text-text-hi">${user.balance.toFixed(2)}</p>
        </div>

        <div>
          <Label htmlFor="deduct-amount">Deduct funds</Label>
          <div className="flex items-center gap-2">
            <Input
              id="deduct-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={deductAmount}
              onChange={(e) => setDeductAmount(e.target.value)}
            />
            <Button variant="danger" size="sm" onClick={handleDeduct} disabled={deducting}>
              {deducting ? "Deducting..." : "Deduct"}
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="set-balance">Set exact balance</Label>
          <div className="flex items-center gap-2">
            <Input
              id="set-balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
            />
            <Button variant="secondary" size="sm" onClick={handleSetBalance} disabled={settingBalance}>
              {settingBalance ? "Setting..." : "Set"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
