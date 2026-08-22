import { useEffect, useState } from "react";
import { plans } from "../../mock-data/plans";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Dropdown } from "../ui/Dropdown";
import { Label } from "../ui/Input";
import { useToast } from "../ui/Toast";

export interface AcceptableRequest {
  id: number;
  name: string;
  serverTypeName: string;
  version: string;
  username: string;
  planId: string;
  planName: string;
}

interface AcceptRequestModalProps {
  request: AcceptableRequest | null;
  onClose: () => void;
  onAccepted: () => void;
}

export function AcceptRequestModal({ request, onClose, onAccepted }: AcceptRequestModalProps) {
  const { push } = useToast();
  const [selectedPlan, setSelectedPlan] = useState(plans[0].id);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (request && plans.some((p) => p.id === request.planId)) {
      setSelectedPlan(request.planId);
    }
  }, [request]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${request!.id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlan }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to accept this request.");
      push("Request accepted — server is deploying.", "success");
      onAccepted();
      onClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to accept this request.", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title="Accept & configure"
      description={request ? `${request.name} — requested by ${request.username}` : undefined}
    >
      {request && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-panel-2 px-3.5 py-2.5 text-[13px] text-text-md">
            {request.serverTypeName} &middot; {request.version} &middot; requested {request.planName}
          </div>
          <div>
            <Label htmlFor="accept-plan">Plan</Label>
            <Dropdown
              value={selectedPlan}
              onChange={setSelectedPlan}
              options={plans.map((plan) => ({
                value: plan.id,
                label: plan.name,
                description: `${plan.ram}GB RAM · ${plan.vCores} · ${plan.storage}`,
              }))}
            />
            <p className="mt-1.5 text-xs text-text-lo">
              Defaults to what they requested — pick a lower plan here if you need to downgrade it.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Deploying..." : "Accept & deploy"}
        </Button>
      </div>
    </Modal>
  );
}
