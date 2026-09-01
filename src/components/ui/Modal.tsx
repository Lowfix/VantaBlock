import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      // Trap Tab/Shift+Tab inside the dialog — without this, focus escapes
      // to the page behind the modal once it reaches either end.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Move focus into the dialog on open. If a child already grabbed focus
    // (e.g. an `autoFocus` form field, applied during React's commit phase
    // before this effect runs) leave it alone; otherwise focus the first
    // focusable element, or the dialog container itself as a fallback for
    // confirm-style modals with nothing but non-focusable text — without
    // this, keyboard focus silently stays on whatever was behind the modal.
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      const firstFocusable = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog).focus();
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in-up"
        onClick={onClose}
        style={{ animationDuration: "0.2s" }}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-line bg-panel-2 shadow-glow-md animate-fade-in-up outline-none",
          className
        )}
        style={{ animationDuration: "0.25s" }}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line-soft px-6 py-5">
            <div>
              {title && <h2 className="text-[15px] font-semibold text-text-hi tracking-tight">{title}</h2>}
              {description && <p className="mt-1 text-[13px] text-text-lo">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-text-lo transition-colors hover:bg-panel-3 hover:text-text-hi"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="min-h-0 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
