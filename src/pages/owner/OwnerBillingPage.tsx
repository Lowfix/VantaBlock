import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Search, Gift, Loader2, AlertTriangle } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input, Label } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import { useUser } from "../../context/UserContext";
import { useToast } from "../../components/ui/Toast";
import { cn } from "../../lib/cn";
import { usePolling } from "../../lib/usePolling";

type Tab = "bonus" | "invoices" | "overview";

const tabs: { id: Tab; label: string }[] = [
  { id: "bonus", label: "Account Bonus" },
  { id: "invoices", label: "Invoices" },
  { id: "overview", label: "Billing Overview" },
];

export function OwnerBillingPage() {
  const { user: currentUser } = useUser();
  const [tab, setTab] = useState<Tab>("bonus");

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  return (
    <DashboardShell title="Billing">
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

      {tab === "bonus" && <AccountBonusTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "overview" && <BillingOverviewTab />}
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// Account Bonus
// ---------------------------------------------------------------------------

interface BankUser {
  id: number;
  username: string;
  email: string;
  balance: number;
}

function AccountBonusTab() {
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
    (u) => !query.trim() || u.username.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Credit an account</CardTitle>
          <CardDescription>
            Add a bonus credit to any Vantablock account's balance. This is a ledger adjustment only — no real money
            moves. Real funds only move when a user tops up their own balance with a card.
          </CardDescription>
        </div>
        <Gift size={18} className="text-accent-400" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-lo" />
          <Input placeholder="Search by username or email..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
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
                    <Button variant="secondary" size="sm" onClick={() => setEditing(u)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <BonusManageModal user={editing} onClose={() => setEditing(null)} onUpdated={applyUpdate} />
    </Card>
  );
}

function BonusManageModal({ user, onClose, onUpdated }: { user: BankUser | null; onClose: () => void; onUpdated: (u: BankUser) => void }) {
  const { push } = useToast();
  const [deductAmount, setDeductAmount] = useState("");
  const [deducting, setDeducting] = useState(false);
  const [newBalance, setNewBalance] = useState("");
  const [settingBalance, setSettingBalance] = useState(false);

  useEffect(() => {
    setDeductAmount("");
    setNewBalance("");
  }, [user]);

  if (!user) return null;

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
    <Modal open={!!user} onClose={onClose} title={user.username} description="Deduct funds or set an exact balance.">
      <div className="space-y-5">
        <div className="border-b border-line-soft pb-4">
          <p className="text-xs text-text-lo">Current balance</p>
          <p className="text-lg font-semibold text-text-hi">${user.balance.toFixed(2)}</p>
        </div>
        <div>
          <Label htmlFor="deduct-amount">Deduct funds</Label>
          <div className="flex items-center gap-2">
            <Input id="deduct-amount" type="number" min="0" step="0.01" placeholder="0.00" value={deductAmount} onChange={(e) => setDeductAmount(e.target.value)} />
            <Button variant="danger" size="sm" onClick={handleDeduct} disabled={deducting}>
              {deducting ? "Deducting..." : "Deduct"}
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="set-balance">Set exact balance</Label>
          <div className="flex items-center gap-2">
            <Input id="set-balance" type="number" step="0.01" placeholder="0.00" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
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

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

interface LedgerEntry {
  id: number;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  username: string;
  email: string;
  category: "topup" | "newServer" | "renewal" | "planChange";
}

const invoiceFilters: { id: LedgerEntry["category"] | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "topup", label: "Top-ups" },
  { id: "newServer", label: "New servers" },
  { id: "renewal", label: "Renewals" },
  { id: "planChange", label: "Plan changes" },
];

function InvoicesTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LedgerEntry["category"] | "all">("all");

  function loadLedger() {
    fetch("/api/owner/ledger", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .finally(() => setLoading(false));
  }

  useEffect(loadLedger, []);
  usePolling(loadLedger, 15000);

  const filtered = filter === "all" ? entries : entries.filter((e) => e.category === filter);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Invoices</CardTitle>
          <CardDescription>Top-ups, new server purchases, renewals, and plan changes across every customer.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {invoiceFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id ? "border-accent-500/60 bg-accent-500/10 text-accent-300" : "border-line bg-panel-2 text-text-lo hover:text-text-md"
              )}
            >
              {f.label}
            </button>
          ))}
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
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-text-lo">
                      No invoices in this category.
                    </td>
                  </tr>
                )}
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-line-soft last:border-b-0">
                    <td className="px-4 py-3 text-text-md">{e.description}</td>
                    <td className="px-4 py-3">
                      <p className="text-text-hi">{e.username}</p>
                      <p className="text-xs text-text-lo">{e.email}</p>
                    </td>
                    <td className={cn("px-4 py-3 font-medium", e.amount < 0 ? "text-good" : "text-text-hi")}>
                      {e.amount < 0 ? "+" : ""}${Math.abs(e.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-text-md">
                      {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Billing Overview
// ---------------------------------------------------------------------------

interface BillingOverviewUser {
  id: number;
  username: string;
  email: string;
  balance: number;
  monthlyTotal: number;
  serverCount: number;
  nextBillAt: string | null;
  pastDue: boolean;
}

function BillingOverviewTab() {
  const [data, setData] = useState<{ users: BillingOverviewUser[]; platformTotal: number } | null>(null);
  const [loading, setLoading] = useState(true);

  function loadBillingSummary() {
    fetch("/api/owner/billing-summary", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(loadBillingSummary, []);
  usePolling(loadBillingSummary, 15000);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={20} className="animate-spin text-accent-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="text-xs text-text-lo">Total monthly billing across all customers</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-text-hi">${data.platformTotal.toFixed(2)}/mo</p>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Per-account billing</CardTitle>
            <CardDescription>What each account is currently being billed, their balance, and next charge.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line-soft text-xs text-text-lo">
                  <th className="px-5 py-2.5 font-medium">Account</th>
                  <th className="px-5 py-2.5 font-medium">Monthly total</th>
                  <th className="px-5 py-2.5 font-medium">Balance</th>
                  <th className="px-5 py-2.5 font-medium">Next bill</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-text-lo">
                      No billable accounts yet.
                    </td>
                  </tr>
                )}
                {data.users.map((u) => (
                  <tr key={u.id} className="border-b border-line-soft last:border-b-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-text-hi">{u.username}</p>
                      <p className="text-xs text-text-lo">{u.email}</p>
                    </td>
                    <td className="px-5 py-3 font-medium text-text-hi">${u.monthlyTotal.toFixed(2)}/mo</td>
                    <td className="px-5 py-3 text-text-md">${u.balance.toFixed(2)}</td>
                    <td className="px-5 py-3 text-text-md">
                      {u.nextBillAt
                        ? new Date(u.nextBillAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {u.pastDue ? (
                        <Badge tone="bad">
                          <AlertTriangle size={11} /> Past due
                        </Badge>
                      ) : (
                        <Badge tone="good">Current</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
