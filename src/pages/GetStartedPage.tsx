import { useState } from "react";
import type { FormEvent, InputHTMLAttributes } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Cpu, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { VoxelIsland } from "../components/illustrations/VoxelIsland";
import { buttonVariants } from "../components/ui/Button";
import { plans } from "../mock-data/plans";
import { cn } from "../lib/cn";

// Mock signup/login page — NOT wired to any backend. Adapted from the old
// LoginPage.tsx/RegisterPage.tsx/AuthLayout.tsx (deleted in the 2026-08-22
// teardown, see commit 584357a^) rather than built from scratch: same
// split-card layout, same VoxelIsland/highlight-list side panel, same field
// styling — with every real bit (fetch calls, UserContext, Google OAuth,
// react-router `useNavigate` on success) stripped out. Submitting either
// form never calls anything and never fakes a logged-in state; it swaps the
// form for an honest "this is a preview" message instead. See DEVLOG.md.

const highlights = [
  { icon: Cpu, text: "Dedicated Ryzen 9 9955HX cores" },
  { icon: Zap, text: "DDR5 memory, not oversubscribed" },
  { icon: ShieldCheck, text: "Enterprise DDoS filtering" },
];

const fieldBase =
  "w-full rounded-lg border border-line bg-panel-2 px-3.5 h-10 text-sm text-text-hi placeholder:text-text-lo " +
  "outline-none transition-colors duration-150 focus:border-accent-500/60 focus:bg-panel " +
  "focus:ring-4 focus:ring-accent-500/10";

function Field({ label, id, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-text-md">
        {label}
      </label>
      <input id={id} name={id} className={fieldBase} {...props} />
    </div>
  );
}

type Mode = "signup" | "login";

export function GetStartedPage() {
  const [searchParams] = useSearchParams();
  const planId = searchParams.get("plan");
  const plan = plans.find((p) => p.id === planId);

  const [mode, setMode] = useState<Mode>("signup");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "signup") {
      const data = new FormData(e.currentTarget);
      if (data.get("password") !== data.get("confirmPassword")) {
        setError("Passwords do not match.");
        return;
      }
    }
    setError(null);
    setSubmitted(true);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-void px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-600/10 blur-[130px]" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-line bg-panel/80 shadow-glow-md backdrop-blur-sm lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
          <Link to="/" className="mb-8 inline-block w-fit">
            <Logo />
          </Link>

          <div className="w-full max-w-sm">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">
              {plan ? `${plan.name} plan` : "Get started"}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-hi">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-[14px] text-text-lo">
              {plan
                ? `You're signing up for the ${plan.name} plan — $${plan.price.toFixed(2)}/mo, ${plan.ram}GB DDR5 RAM.`
                : mode === "signup"
                  ? "Deploy your first server in under a minute."
                  : "Log in to manage your servers."}
            </p>

            {submitted ? (
              <div className="mt-8 rounded-xl border border-accent-500/30 bg-accent-500/10 p-5" role="status" aria-live="polite">
                <div className="flex items-center gap-2 text-accent-300">
                  <Sparkles size={18} />
                  <p className="text-sm font-semibold">You're looking at a preview</p>
                </div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-text-md">
                  Real accounts aren't live yet — you're seeing an early preview of what signing up
                  will look like. Nothing was submitted or saved
                  {plan ? `, and no ${plan.name} server was deployed` : ""}. When public signups open,
                  this is the form you'll use.
                </p>
                <Link to="/#pricing" className={cn(buttonVariants({ variant: "secondary" }), "mt-4 w-full")}>
                  Back to plans
                </Link>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                  {mode === "signup" && <Field id="username" label="Username" placeholder="Kestrel_" required minLength={3} />}

                  <Field id="email" label="Email address" type="email" placeholder="you@example.com" required />

                  <Field
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="••••••••"
                    required
                    minLength={mode === "signup" ? 8 : undefined}
                  />

                  {mode === "signup" && (
                    <Field id="confirmPassword" label="Confirm password" type="password" placeholder="••••••••" required minLength={8} />
                  )}

                  {error && <p className="text-xs text-bad">{error}</p>}

                  <button type="submit" className={buttonVariants({ size: "lg", className: "mt-2 w-full" })}>
                    {mode === "signup" ? "Create account" : "Log in"}
                  </button>
                </form>

                <p className="mt-6 text-center text-[13.5px] text-text-lo">
                  {mode === "signup" ? (
                    <>
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("login")}
                        className="font-medium text-accent-400 hover:text-accent-300"
                      >
                        Log in
                      </button>
                    </>
                  ) : (
                    <>
                      Don't have an account?{" "}
                      <button
                        type="button"
                        onClick={() => switchMode("signup")}
                        className="font-medium text-accent-400 hover:text-accent-300"
                      >
                        Create one
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="relative hidden flex-col items-center justify-center border-l border-line-soft bg-ink/70 px-10 py-10 lg:flex">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
          <VoxelIsland className="relative" />

          <div className="relative mt-4 text-center">
            <p className="text-[13px] font-semibold uppercase tracking-wider text-accent-400">Vantablock</p>
            <h2 className="mt-2 text-balance text-xl font-bold leading-snug tracking-tight text-text-hi">
              Built for communities that don't tolerate lag.
            </h2>
          </div>

          <div className="relative mt-7 w-full max-w-xs space-y-2.5">
            {highlights.map((h) => (
              <div key={h.text} className="flex items-center gap-3 rounded-xl border border-line bg-panel/60 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-500/10 text-accent-400">
                  <h.icon size={14} />
                </span>
                <span className="text-[13px] text-text-md">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
