import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Check } from "lucide-react";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Input, Label, FieldError } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { GoogleButton } from "../components/ui/GoogleButton";
import { useUser } from "../context/UserContext";
import { signInWithGoogle } from "../lib/googleAuth";
import { useToast } from "../components/ui/Toast";
import { cn } from "../lib/cn";

interface FormState {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  inviteCode: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, loginWithGoogle } = useUser();
  const { push } = useToast();
  const [form, setForm] = useState<FormState>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
  });
  const [errors, setErrors] = useState<Partial<FormState> & { terms?: string }>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignUp() {
    if (!form.inviteCode.trim()) {
      setErrors((e) => ({ ...e, inviteCode: "Enter your invite code first" }));
      return;
    }
    setGoogleLoading(true);
    try {
      const accessToken = await signInWithGoogle();
      await loginWithGoogle(accessToken, form.inviteCode.trim());
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof Error ? err.message : "Google sign-in failed.", "warn");
    } finally {
      setGoogleLoading(false);
    }
  }

  const passwordStrength = getStrength(form.password);

  function validate(): boolean {
    const next: Partial<FormState> & { terms?: string } = {};
    if (!form.username) next.username = "Username is required";
    else if (form.username.length < 3) next.username = "Username must be at least 3 characters";

    if (!form.email) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address";

    if (!form.password) next.password = "Password is required";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters";

    if (!form.confirmPassword) next.confirmPassword = "Confirm your password";
    else if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match";

    if (!agreed) next.terms = "You must accept the terms to continue";

    if (!form.inviteCode.trim()) next.inviteCode = "An invite code is required";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await register({
        username: form.username,
        email: form.email,
        password: form.password,
        inviteCode: form.inviteCode.trim(),
      });
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof Error ? err.message : "Registration failed.", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Deploy your first server in under a minute.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            placeholder="Kestrel_"
            value={form.username}
            error={errors.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          />
          <FieldError>{errors.username}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            error={errors.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            error={errors.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          {form.password && (
            <div className="mt-2 flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors",
                    i < passwordStrength.score ? passwordStrength.color : "bg-panel-3"
                  )}
                />
              ))}
            </div>
          )}
          {form.password && !errors.password && (
            <p className="mt-1.5 text-xs text-text-lo">{passwordStrength.label}</p>
          )}
          <FieldError>{errors.password}</FieldError>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={form.confirmPassword}
            error={errors.confirmPassword}
            onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          />
          <FieldError>{errors.confirmPassword}</FieldError>
        </div>

        <div>
          <Label htmlFor="inviteCode">Invite code</Label>
          <Input
            id="inviteCode"
            placeholder="e.g. 7F3KQPX2RT"
            value={form.inviteCode}
            error={errors.inviteCode}
            onChange={(e) => setForm((f) => ({ ...f, inviteCode: e.target.value }))}
            className="uppercase"
          />
          <FieldError>{errors.inviteCode}</FieldError>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setAgreed((a) => !a)}
            className="flex items-start gap-2.5 text-left"
          >
            <span
              className={cn(
                "mt-0.5 flex shrink-0 items-center justify-center rounded border transition-colors",
                agreed ? "border-accent-500 bg-accent-500" : "border-line bg-panel-2"
              )}
              style={{ height: 18, width: 18 }}
            >
              {agreed && <Check size={12} className="text-white" strokeWidth={3} />}
            </span>
            <span className="text-[13px] text-text-lo">
              I agree to the <span className="font-medium text-text-md">Terms of Service</span> and{" "}
              <span className="font-medium text-text-md">Privacy Policy</span>
            </span>
          </button>
          <FieldError>{errors.terms}</FieldError>
        </div>

        <Button type="submit" className="w-full mt-2" size="lg" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-line-soft" />
        <span className="text-xs text-text-lo">Or</span>
        <div className="h-px flex-1 bg-line-soft" />
      </div>

      <GoogleButton label="Sign up with Google" loading={googleLoading} onClick={handleGoogleSignUp} />

      <p className="mt-8 text-center text-[13.5px] text-text-lo">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent-400 hover:text-accent-300">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

function getStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[0-9]/.test(password) && /[a-zA-Z]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const map = [
    { label: "Weak", color: "bg-bad" },
    { label: "Weak", color: "bg-bad" },
    { label: "Fair", color: "bg-warn" },
    { label: "Good", color: "bg-accent-400" },
    { label: "Strong", color: "bg-good" },
  ];
  return { score, ...map[score] };
}
