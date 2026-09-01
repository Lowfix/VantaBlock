import { Link, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { UserProvider, useUser } from "../context/UserContext";
import { ToastProvider } from "../components/ui/Toast";

// Plays the role of the old app's RequireAuth: hold rendering until the (demo)
// user record has "loaded", so pages that seed local form state from the user
// (AccountSettingsPage) don't initialize from null.
function DemoReady({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  if (loading || !user) {
    return (
      <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center bg-void">
        <Loader2 size={22} className="animate-spin text-accent-400" />
      </div>
    );
  }
  return <>{children}</>;
}

// Wraps every /panel-preview route: the user/toast providers the recovered
// panel pages expect, plus the always-visible honesty pill. The demo is meant
// to look and behave exactly like the real panel will — the pill is what keeps
// that honest.
export function PanelDemoScope() {
  return (
    <UserProvider>
      <ToastProvider>
        {/* Slim, always-visible strip at the very top: the obvious way home
            (users read "Log out" as scary, not as "back to the site"), plus
            the demo-honesty note that used to live in a bottom pill. The
            panel layouts' sticky headers and fixed sidebar are offset by
            top-8 to sit below it — keep them in sync with its h-8. */}
        <div className="fixed inset-x-0 top-0 z-50 flex h-8 items-center justify-center gap-2 overflow-hidden border-b border-accent-500/25 bg-ink px-3 text-[12px]">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-1.5 font-semibold text-accent-300 transition-colors hover:text-accent-200"
          >
            <ArrowLeft size={12} />
            Back to vantablock.net
          </Link>
          <span className="hidden text-text-lo sm:inline">·</span>
          <span className="hidden min-w-0 items-center gap-1.5 truncate text-text-lo sm:flex">
            <Sparkles size={11} className="shrink-0 text-accent-400" />
            Panel demo — sample data, nothing is real or saved
          </span>
        </div>
        <div className="h-8" aria-hidden />
        <DemoReady>
          <Outlet />
        </DemoReady>
      </ToastProvider>
    </UserProvider>
  );
}
