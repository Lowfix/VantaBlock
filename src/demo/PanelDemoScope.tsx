import { Link, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { UserProvider, useUser } from "../context/UserContext";
import { ToastProvider } from "../components/ui/Toast";

// Plays the role of the old app's RequireAuth: hold rendering until the (demo)
// user record has "loaded", so pages that seed local form state from the user
// (AccountSettingsPage) don't initialize from null.
function DemoReady({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void">
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
        <DemoReady>
          <Outlet />
        </DemoReady>
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[90] w-full max-w-[calc(100vw-1.5rem)] -translate-x-1/2 sm:w-auto">
          <div className="pointer-events-auto mx-auto flex w-fit max-w-full items-center gap-2.5 rounded-full border border-accent-500/40 bg-ink/95 py-1.5 pl-3.5 pr-2 text-[12.5px] text-text-md shadow-glow-sm backdrop-blur">
            <Sparkles size={13} className="shrink-0 text-accent-300" />
            <span className="min-w-0 truncate whitespace-nowrap">
              <span className="font-semibold text-accent-300">Panel demo</span> — sample data, nothing is real or saved
            </span>
            <Link
              to="/"
              className="rounded-full border border-line bg-panel-2 px-2.5 py-0.5 font-medium text-text-md transition-colors hover:border-accent-500/40 hover:text-text-hi"
            >
              Exit
            </Link>
          </div>
        </div>
      </ToastProvider>
    </UserProvider>
  );
}
