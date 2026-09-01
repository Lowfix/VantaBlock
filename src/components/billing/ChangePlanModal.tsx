import { useState } from "react";
import { Check } from "lucide-react";
import { plans } from "../../mock-data/plans";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { cn } from "../../lib/cn";

interface ChangePlanModalProps {
  open: boolean;
  onClose: () => void;
  serverName: string;
  currentPlanId: string;
  onConfirm: (planId: string) => void;
}

export function ChangePlanModal({ open, onClose, serverName, currentPlanId, onConfirm }: ChangePlanModalProps) {
  const [selected, setSelected] = useState(currentPlanId);

  return (
    <Modal open={open} onClose={onClose} title="Change plan" description={`Choose a new plan for ${serverName}.`} className="!max-w-lg">
      <div className="space-y-2.5">
        {plans.map((plan) => {
          const active = selected === plan.id;
          const isCurrent = plan.id === currentPlanId;
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                active ? "border-accent-500/60 bg-accent-500/5" : "border-line bg-panel-2 hover:border-line-soft"
              )}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-text-hi">{plan.name}</span>
                  {isCurrent && <span className="text-[11px] text-text-lo">(current)</span>}
                </div>
                <p className="text-xs text-text-lo">
                  {plan.ram}GB RAM · {plan.vCores}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[13.5px] font-semibold text-text-hi">${plan.price.toFixed(2)}/mo</span>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    active ? "border-accent-500 bg-accent-500" : "border-line"
                  )}
                >
                  {active && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={selected === currentPlanId}
          onClick={() => {
            onConfirm(selected);
            onClose();
          }}
        >
          Confirm change
        </Button>
      </div>
    </Modal>
  );
}
