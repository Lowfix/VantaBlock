import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../../lib/cn";

type ToastTone = "success" | "info" | "warn";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const icons: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 size={16} className="text-good" />,
  info: <Info size={16} className="text-accent-400" />,
  warn: <TriangleAlert size={16} className="text-warn" />,
};

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 3600);
  }, []);

  const dismiss = (id: number) => setToasts((t) => t.filter((toast) => toast.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {createPortal(
        <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg border border-line bg-panel-2 px-4 py-3 text-[13px] text-text-hi shadow-glow-md animate-fade-in-up min-w-[260px]"
              )}
              style={{ animationDuration: "0.2s" }}
            >
              {icons[toast.tone]}
              <span className="flex-1">{toast.message}</span>
              <button onClick={() => dismiss(toast.id)} className="text-text-lo hover:text-text-hi" aria-label="Dismiss notification">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}
