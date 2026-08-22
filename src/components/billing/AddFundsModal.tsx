import { useState } from "react";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { ArrowLeft } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Label, FieldError } from "../ui/Input";
import { grossUpForStripeFee, stripeFeePortion } from "../../lib/stripeFees";
import { stripePromise } from "../../lib/stripeClient";
import { useToast } from "../ui/Toast";
import { useUser } from "../../context/UserContext";

interface AddFundsModalProps {
  open: boolean;
  onClose: () => void;
}

const appearance: StripeElementsOptions["appearance"] = {
  theme: "night",
  variables: {
    colorPrimary: "#8257ff",
    colorBackground: "#17171c",
    colorText: "#f2f1f6",
    colorTextSecondary: "#8f8e9b",
    colorTextPlaceholder: "#8f8e9b",
    colorDanger: "#f2555a",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSizeBase: "13.5px",
    borderRadius: "8px",
    spacingGridRow: "12px",
  },
  rules: {
    ".Label": { color: "#b6b5c2", fontWeight: "500", marginBottom: "6px" },
    ".Input": { border: "1px solid #26262f", backgroundColor: "#17171c", boxShadow: "none" },
    ".Input:focus": { border: "1px solid rgba(130, 87, 255, 0.6)", boxShadow: "0 0 0 4px rgba(130, 87, 255, 0.1)" },
    ".Tab": { border: "1px solid #26262f", backgroundColor: "#17171c" },
    ".Tab:hover": { backgroundColor: "#1e1e25" },
    ".Tab--selected": { border: "1px solid rgba(130, 87, 255, 0.6)", backgroundColor: "#1e1e25" },
  },
};

const stripeFonts: StripeElementsOptions["fonts"] = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
];

export function AddFundsModal({ open, onClose }: AddFundsModalProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientSecret, setClientSecret] = useState("");
  const { push } = useToast();

  const netAmount = Number(amount);
  const validAmount = amount !== "" && Number.isFinite(netAmount) && netAmount > 0;
  const fee = validAmount ? stripeFeePortion(netAmount) : 0;
  const total = validAmount ? grossUpForStripeFee(netAmount) : 0;

  function reset() {
    setAmount("");
    setError("");
    setClientSecret("");
    setSubmitting(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleContinue() {
    if (!validAmount) {
      setError("Enter an amount greater than $0.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/billing/intent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: netAmount }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to start payment.");
      setClientSecret(body.clientSecret);
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to start payment.", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccess() {
    push("Payment received — your balance has been updated.", "success");
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add funds"
      description="Top up your balance with a card, handled securely through Stripe."
      className="!max-w-md"
    >
      {!clientSecret ? (
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

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleContinue} disabled={submitting || !validAmount}>
              {submitting ? "Loading..." : "Continue to payment"}
            </Button>
          </div>
        </div>
      ) : (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance, fonts: stripeFonts }}>
          <PaymentStep total={total} onBack={() => setClientSecret("")} onSuccess={handleSuccess} />
        </Elements>
      )}
    </Modal>
  );
}

function PaymentStep({ total, onBack, onSuccess }: { total: number; onBack: () => void; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { refreshUser } = useUser();
  const { push } = useToast();
  const [paying, setPaying] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setPaying(true);
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/billing?payment=success` },
      redirect: "if_required",
    });

    if (result.error) {
      push(result.error.message ?? "Payment failed.", "warn");
      setPaying(false);
      return;
    }

    if (result.paymentIntent?.status === "succeeded") {
      await refreshUser().catch(() => {});
      onSuccess();
    } else {
      push("Payment is processing — your balance will update shortly.", "info");
      setPaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          disabled={paying}
          className="flex items-center gap-1.5 text-[13px] text-text-lo transition-colors hover:text-text-hi disabled:opacity-40"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <Button onClick={handlePay} disabled={!stripe || paying}>
          {paying ? "Processing..." : `Pay $${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
}
