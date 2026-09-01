import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, RotateCcw, Send } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/cn";
import { demoFetch } from "../../demo/api";

interface TicketMessage {
  id: number;
  isOwner: boolean;
  body: string;
  createdAt: string;
  username: string | null;
}

interface TicketDetail {
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

interface TicketThreadModalProps {
  ticketId: number | null;
  onClose: () => void;
  isOwnerView?: boolean;
  onUpdated?: () => void;
}

export function TicketThreadModal({ ticketId, onClose, isOwnerView = false, onUpdated }: TicketThreadModalProps) {
  const { push } = useToast();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);

  function load() {
    if (!ticketId) return;
    demoFetch(`/api/support/tickets/${ticketId}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTicket(data.ticket);
          setMessages(data.messages);
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (ticketId) {
      setLoading(true);
      setReply("");
      load();
    } else {
      setTicket(null);
      setMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function handleReply() {
    if (!ticketId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await demoFetch(`/api/support/tickets/${ticketId}/reply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to send your reply.");
      }
      setReply("");
      load();
      onUpdated?.();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to send your reply.", "warn");
    } finally {
      setSending(false);
    }
  }

  function handleGoToServer() {
    if (!ticket?.serverIdentifier) return;
    onClose();
    navigate(`/owner/servers?tab=all&identifier=${encodeURIComponent(ticket.serverIdentifier)}`);
  }

  async function handleResolve(action: "close" | "reopen") {
    if (!ticketId) return;
    setResolving(true);
    try {
      const res = await demoFetch(`/api/support/tickets/${ticketId}/${action}`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error();
      push(action === "close" ? "Ticket closed." : "Ticket reopened.", action === "close" ? "success" : "info");
      load();
      onUpdated?.();
    } catch {
      push(`Failed to ${action} this ticket.`, "warn");
    } finally {
      setResolving(false);
    }
  }

  return (
    <Modal
      open={!!ticketId}
      onClose={onClose}
      title={ticket?.subject ?? "Ticket"}
      description={
        ticket ? (
          <>
            {isOwnerView ? (ticket.username ? `${ticket.username} (${ticket.email})` : "Deleted user") : "Opened"}
            {ticket.serverName &&
              (isOwnerView && ticket.serverIdentifier ? (
                <>
                  {" — "}
                  <button
                    onClick={handleGoToServer}
                    className="underline decoration-dotted underline-offset-2 transition-colors hover:text-accent-400"
                  >
                    {ticket.serverName}
                  </button>
                </>
              ) : (
                ` — ${ticket.serverName}`
              ))}
          </>
        ) : undefined
      }
      className="!max-w-lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-accent-400" />
        </div>
      ) : ticket ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge tone={ticket.status === "open" ? "warn" : "good"}>{ticket.status}</Badge>
            {isOwnerView && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleResolve(ticket.status === "open" ? "close" : "reopen")}
                disabled={resolving}
              >
                {ticket.status === "open" ? <CheckCircle2 size={13} /> : <RotateCcw size={13} />}
                {ticket.status === "open" ? "Close ticket" : "Reopen ticket"}
              </Button>
            )}
          </div>

          <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-line bg-panel-2 p-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.isOwner ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3.5 py-2.5 text-[13px]",
                    m.isOwner ? "bg-accent-500/15 text-text-hi" : "bg-panel-3 text-text-hi"
                  )}
                >
                  <p className="mb-1 text-[11px] font-medium text-text-lo">
                    {m.isOwner ? "Support" : m.username ?? "Deleted user"} &middot;{" "}
                    {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <Textarea
              placeholder="Write a reply..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={handleReply} disabled={sending || !reply.trim()}>
                <Send size={13} /> {sending ? "Sending..." : "Send reply"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <p className="py-8 text-center text-[13px] text-text-lo">Couldn't load this ticket.</p>
      )}
    </Modal>
  );
}
