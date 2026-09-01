import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Label, FieldError } from "../ui/Input";
import { grossUpForStripeFee, stripeFeePortion } from "../../lib/stripeFees";
import { useToast } from "../ui/Toast";
import { useUser } from "../../context/UserContext";
import { demoFetch } from "../../demo/api";

// Demo version of the add-funds flow. The original (git history before
// 584357a) embedded a real Stripe PaymentElement here; the demo keeps the
// same amount + fee-breakdown step, then "processes" against the in-memory
// store instead of Stripe — and says so, right in the modal.

interface AddFundsModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddFundsModal({ open, onClose }: AddFundsModalProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const { push } = useToast();
  const { refreshUser } = useUser();

  const netAmount = Number(amount);
  const validAmount = amount !== "" && Number.isFinite(netAmount) && netAmount > 0;
  const fee = validAmount ? stripeFeePortion(netAmount) : 0;
  const total = validAmount ? grossUpForStripeFee(netAmount) : 0;

  function handleClose() {
    setAmount("");
    setError("");
    setPaying(false);
    onClose();
  }

  async function handlePay() {
    if (!validAmount) {
      setError("Enter an amount greater than $0.");
      return;
    }
    setError("");
    setPaying(true);
    try {
      const res = await demoFetch("/api/billing/demo-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: netAmount }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to add funds.");
      await refreshUser().catch(() => {});
      push("Funds added — your balance has been updated. (Demo — no card was charged.)", "success");
      handleClose();
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to add funds.", "warn");
      setPaying(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add funds"
      description="Top up your balance with a card, handled securely through Stripe."
      className="!max-w-md"
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="add-funds-amount">Amount to add</Label>
          <Input
            id="add-funds-amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="50.00"
            value={amount}
            error={error}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <FieldError>{error}</FieldError>
        </div>

        {validAmount && (
          <div className="space-y-1.5 rounded-lg border border-line bg-panel-2 px-4 py-3 text-[13px]">
            <div className="flex justify-between text-text-md">
              <span>Added to your balance</span>
              <span className="font-medium text-text-hi">${netAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-md">
              <span>Card processing fee</span>
              <span className="font-medium text-text-hi">${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-line-soft pt-1.5 font-semibold text-text-hi">
              <span>Total charged</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2.5 rounded-lg border border-accent-500/25 bg-accent-500/5 px-3.5 py-2.5">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent-400" />
          <p className="text-[12.5px] leading-relaxed text-text-lo">
            You're in the panel demo — Stripe's secure card form lives here in the real panel, so
            "paying" below just updates the sample balance. No card, no charge.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={handleClose} disabled={paying}>
            Cancel
          </Button>
          <Button onClick={handlePay} disabled={paying || !validAmount}>
            {paying ? "Processing..." : validAmount ? `Pay $${total.toFixed(2)}` : "Pay"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
