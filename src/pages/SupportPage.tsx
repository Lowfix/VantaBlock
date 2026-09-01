import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, LifeBuoy } from "lucide-react";
import { DashboardShell } from "../components/layout/DashboardShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Label, Textarea } from "../components/ui/Input";
import { useToast } from "../components/ui/Toast";
import { usePolling } from "../lib/usePolling";
import { TicketThreadModal } from "../components/support/TicketThreadModal";
import { demoFetch } from "../demo/api";

interface Ticket {
  id: number;
  serverIdentifier: string | null;
  serverName: string | null;
  subject: string;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
}

export function SupportPage() {
  const { push } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openTicketId, setOpenTicketId] = useState<number | null>(null);

  function loadTickets() {
    demoFetch("/api/support/tickets/mine", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setTickets)
      .finally(() => setLoading(false));
  }

  useEffect(loadTickets, []);
  usePolling(loadTickets, 15000);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    try {
      const res = await demoFetch("/api/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to submit your ticket.");
      push("Ticket submitted.", "success");
      setCreating(false);
      setSubject("");
      setMessage("");
      loadTickets();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to submit your ticket.", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell title="Support">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Your tickets</CardTitle>
            <CardDescription>Questions or issues with your account or a server — we'll reply here.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} /> New ticket
          </Button>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={20} className="animate-spin text-accent-400" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <LifeBuoy size={24} className="text-text-lo" />
              <p className="text-[13.5px] font-medium text-text-hi">No tickets yet</p>
              <p className="max-w-sm text-[13px] text-text-lo">Open one if you run into a problem or have a question.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                onClick={() => setOpenTicketId(t.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5 text-left transition-colors hover:border-line-soft"
              >
                <div>
                  <p className="text-[13.5px] font-semibold text-text-hi">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-text-lo">
                    {t.serverName ? `${t.serverName} · ` : ""}
                    Updated {new Date(t.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
                <Badge tone={t.status === "open" ? "warn" : "good"}>{t.status}</Badge>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Modal open={creating} onClose={() => setCreating(false)} title="New support ticket" description="Tell us what's going on.">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus />
          </div>
          <div>
            <Label htmlFor="ticket-message">Message</Label>
            <Textarea id="ticket-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !subject.trim() || !message.trim()}>
              {submitting ? "Submitting..." : "Submit ticket"}
            </Button>
          </div>
        </form>
      </Modal>

      <TicketThreadModal ticketId={openTicketId} onClose={() => setOpenTicketId(null)} onUpdated={loadTickets} />
    </DashboardShell>
  );
}
