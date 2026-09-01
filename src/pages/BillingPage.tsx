import { useEffect, useState } from "react";
import { Download, Plus, ShieldCheck } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import type { GameServer } from "../mock-data/servers";
import { plans } from "../mock-data/plans";
import type { Invoice, InvoiceStatus } from "../mock-data/invoices";
import { useUser } from "../context/UserContext";
import { ChangePlanModal } from "../components/billing/ChangePlanModal";
import { AddFundsModal } from "../components/billing/AddFundsModal";
import { DeployServerModal } from "../components/billing/DeployServerModal";
import { useToast } from "../components/ui/Toast";
import { useMyServers, mergeMyServers } from "../lib/useMyServers";
import { demoFetch } from "../demo/api";

const PTERO_PREFIX = "ptero-";

const invoiceTone: Record<InvoiceStatus, "good" | "warn" | "bad"> = {
  paid: "good",
  pending: "warn",
  failed: "bad",
};

const billingStatusLabel: Record<GameServer["billingStatus"], string> = {
  active: "Active",
  past_due: "Past due",
  suspended: "Suspended",
};

const billingStatusTone: Record<GameServer["billingStatus"], "good" | "warn" | "bad"> = {
  active: "good",
  past_due: "warn",
  suspended: "bad",
};

interface MyRequest {
  id: number;
  name: string;
  planName: string;
  planPrice: number;
  serverTypeName: string;
  version: string;
  status: "pending" | "approved" | "denied";
  denialReason: string | null;
  createdAt: string;
}

const requestTone: Record<MyRequest["status"], "good" | "warn" | "bad"> = {
  approved: "good",
  pending: "warn",
  denied: "bad",
};

export function BillingPage() {
  const { user: currentUser } = useUser();
  const [servers, setServers] = useState<GameServer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [changingServer, setChangingServer] = useState<GameServer | null>(null);
  const [addingFunds, setAddingFunds] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const { push } = useToast();
  const { servers: myServers } = useMyServers();

  useEffect(() => {
    setServers((list) => mergeMyServers(list, myServers));
  }, [myServers]);

  async function refreshInvoices() {
    const res = await demoFetch("/api/account/invoices", { credentials: "include" });
    if (res.ok) setInvoices(await res.json());
  }

  async function refreshRequests() {
    const res = await demoFetch("/api/requests/mine", { credentials: "include" });
    if (res.ok) setMyRequests(await res.json());
  }

  useEffect(() => {
    refreshInvoices().catch(() => {});
    refreshRequests().catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success") {
      push("Payment received — your balance has been updated.", "success");
    } else if (payment === "cancelled") {
      push("Payment cancelled — no charge was made.", "info");
    }
    if (payment) {
      params.delete("payment");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  if (!currentUser) return null;

  async function handlePlanChange(planId: string) {
    if (!changingServer || !changingServer.id.startsWith(PTERO_PREFIX)) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    const identifier = changingServer.id.slice(PTERO_PREFIX.length);
    try {
      const res = await demoFetch(`/api/servers/${identifier}/plan`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error);
      }
      push(`${changingServer.name} moved to the ${plan.name} plan.`, "success");
      refreshInvoices().catch(() => {});
    } catch (err) {
      push(err instanceof Error && err.message ? err.message : `Failed to change ${changingServer.name}'s plan.`, "warn");
    }
  }

  function handleDeployed(name: string, status: "deploying" | "pending") {
    if (status === "pending") {
      push(`Request to create "${name}" was sent for approval.`, "info");
      refreshRequests().catch(() => {});
    } else {
      push(`Deploying "${name}"... this can take a minute or two.`, "info");
      refreshInvoices().catch(() => {});
    }
  }

  const totalMonthly = servers.reduce((sum, s) => {
    const plan = plans.find((p) => p.name === s.plan);
    return sum + (plan?.price ?? 0);
  }, 0);

  return (
    <DashboardShell title="Billing & Plans">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Active plans</CardTitle>
                <CardDescription>Manage the hosting plan assigned to each server.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-text-hi">${totalMonthly.toFixed(2)}/mo</span>
                <Button size="sm" onClick={() => setDeploying(true)}>
                  <Plus size={14} /> Deploy server
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {servers.length === 0 && (
                <p className="px-1 py-4 text-center text-[13px] text-text-lo">No servers yet — deploy one to get started.</p>
              )}
              {servers.map((server) => {
                const plan = plans.find((p) => p.name === server.plan);
                return (
                  <div
                    key={server.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[13.5px] font-semibold text-text-hi">{server.name}</p>
                        {server.billingStatus !== "active" && (
                          <Badge tone={billingStatusTone[server.billingStatus]}>{billingStatusLabel[server.billingStatus]}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-text-lo">
                        {server.plan} plan · {server.ramAllocated}GB RAM · {plan ? `$${plan.price.toFixed(2)}/mo` : ""}
                        {server.billingStatus === "active" && server.nextBillAt
                          ? ` · renews ${new Date(server.nextBillAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                        {server.billingStatus === "past_due" && server.gracePeriodEndsAt
                          ? ` · grace period ends ${new Date(server.gracePeriodEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : ""}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setChangingServer(server)}>
                      Change plan
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {!currentUser.isAdmin && myRequests.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Server requests</CardTitle>
                  <CardDescription>Every server needs the admin's approval right now — here's where each one stands.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {myRequests.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
                    <div>
                      <p className="text-[13.5px] font-semibold text-text-hi">{r.name}</p>
                      <p className="mt-0.5 text-xs text-text-lo">
                        {r.serverTypeName} · {r.planName} · ${r.planPrice.toFixed(2)}/mo
                        {r.status === "denied" && r.denialReason ? ` · ${r.denialReason}` : ""}
                      </p>
                    </div>
                    <Badge tone={requestTone[r.status]}>{r.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Invoice history</CardTitle>
                <CardDescription>Your past and pending invoices.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-y border-line-soft text-xs text-text-lo">
                      <th className="px-5 py-2.5 font-medium">Invoice</th>
                      <th className="px-5 py-2.5 font-medium">Date</th>
                      <th className="px-5 py-2.5 font-medium">Description</th>
                      <th className="px-5 py-2.5 font-medium">Amount</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-line-soft last:border-b-0">
                        <td className="px-5 py-3 font-mono text-xs text-text-lo">{invoice.id}</td>
                        <td className="px-5 py-3 text-text-md">{invoice.date}</td>
                        <td className="px-5 py-3 text-text-md">{invoice.description}</td>
                        <td className={`px-5 py-3 font-medium ${invoice.amount < 0 ? "text-good" : "text-text-hi"}`}>
                          {invoice.amount < 0 ? "+" : ""}${Math.abs(invoice.amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={invoiceTone[invoice.status]}>{invoice.status}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button className="text-text-lo transition-colors hover:text-accent-300">
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-text-lo">Account balance</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-text-hi">${currentUser.balance.toFixed(2)}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setAddingFunds(true)}>
                <Plus size={14} /> Add funds
              </Button>
            </div>
            <p className="mt-4 text-[13px] text-text-lo">
              Deploying or resizing a server draws from this balance directly.
            </p>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Payment provider</CardTitle>
                <CardDescription>Who processes your card payments.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500/10">
                  <ShieldCheck size={16} className="text-accent-400" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-text-hi">Stripe</p>
                  <p className="text-xs text-text-lo">
                    Card details are entered on Stripe's secure checkout page and never touch our servers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {changingServer && (
        <ChangePlanModal
          open={!!changingServer}
          onClose={() => setChangingServer(null)}
          serverName={changingServer.name}
          currentPlanId={plans.find((p) => p.name === changingServer.plan)?.id ?? plans[0].id}
          onConfirm={handlePlanChange}
        />
      )}

      <AddFundsModal open={addingFunds} onClose={() => setAddingFunds(false)} />
      <DeployServerModal open={deploying} onClose={() => setDeploying(false)} onDeployed={handleDeployed} />
    </DashboardShell>
  );
}
