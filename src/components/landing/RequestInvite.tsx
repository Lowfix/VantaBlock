import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { Modal } from "../ui/Modal";
import { buttonVariants } from "../ui/Button";
import { cn } from "../../lib/cn";

// "Request an invite" — an honest placeholder by explicit choice (2026-09-01):
// invite requests aren't open yet and there's no public contact channel, so
// the button opens a modal that says exactly that instead of a form that
// pretends to submit. When a real request channel exists (email/Discord/form),
// this is the one component to rewire.
export function RequestInvite({ size = "lg", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants({ variant: "outline", size }), className)}
      >
        Request an invite
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invites come from friends, for now"
        description="Vantablock is in a private beta."
        className="!max-w-md"
      >
        <div className="space-y-4">
          <p className="text-[13.5px] leading-relaxed text-text-md">
            During the beta, invites are passed along personally by people already hosting with us —
            there's no request queue yet. If you know someone running a server here, ask them for a
            code; it works on the sign-up page.
          </p>
          <div className="flex items-start gap-2.5 rounded-lg border border-line bg-panel-2 px-3.5 py-3">
            <Mail size={14} className="mt-0.5 shrink-0 text-accent-400" />
            <p className="text-[12.5px] leading-relaxed text-text-lo">
              Public invite requests will open here when we're ready for more servers. Until then,
              you can see exactly what you'd be getting in the panel demo.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setOpen(false)} className={buttonVariants({ variant: "secondary" })}>
              Close
            </button>
            <Link to="/panel-preview" className={buttonVariants({ variant: "primary" })}>
              Explore the panel demo
            </Link>
          </div>
        </div>
      </Modal>
    </>
  );
}
