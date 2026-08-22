import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, LifeBuoy } from "lucide-react";
import { DashboardShell } from "../../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { useUser } from "../../context/UserContext";
import { usePolling } from "../../lib/usePolling";
import { TicketThreadModal } from "../../components/support/TicketThreadModal";

interface Ticket {
  id: number;
  serverIdentifier: string | null;
  serverName: string | null;
  subject: string;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  username: string | null;
  email: string | null;
}

export function OwnerSupportPage() {
  const { user: currentUser } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);

  function loadTickets() {
    fetch("/api/support/tickets", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTickets)
      .finally(() => setLoading(false));
  }

  useEffect(loadTickets, []);
  usePolling(loadTickets, 15000);

  if (!currentUser) return null;
  if (!currentUser.isOwner) return <Navigate to="/dashboard" replace />;

  const open = tickets.filter((t) => t.status === "open");
  const closed = tickets.filter((t) => t.status === "closed");

  function TicketRow({ t }: { t: Ticket }) {
    return (
      <button
        onClick={() => setOpenTicketId(t.id)}
        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5 text-left transition-colors hover:border-line-soft"
      >
        <div>
          <p className="text-[13.5px] font-semibold text-text-hi">{t.subject}</p>
          <p className="mt-0.5 text-xs text-text-lo">
            {t.username ? `${t.username} (${t.email})` : "Deleted user"}
            {t.serverName ? ` · ${t.serverName}` : ""} · Updated{" "}
            {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <Badge tone={t.status === "open" ? "warn" : "good"}>{t.status}</Badge>
      </button>
    );
  }

  return (
    <DashboardShell title="Support">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Open tickets</CardTitle>
              <CardDescription>Everything waiting on a reply, across every customer.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={20} className="animate-spin text-accent-400" />
              </div>
            ) : open.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <LifeBuoy size={24} className="text-text-lo" />
                <p className="text-[13.5px] font-medium text-text-hi">Nothing open</p>
              </div>
            ) : (
              open.map((t) => <TicketRow key={t.id} t={t} />)
            )}
          </CardContent>
        </Card>

        {closed.length > 0 && (
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Closed</CardTitle>
                <CardDescription>Previously resolved tickets.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {closed.map((t) => (
                <TicketRow key={t.id} t={t} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <TicketThreadModal ticketId={openTicketId} onClose={() => setOpenTicketId(null)} isOwnerView onUpdated={loadTickets} />
    </DashboardShell>
  );
}
