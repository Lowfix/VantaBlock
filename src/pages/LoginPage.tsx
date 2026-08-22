import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthLayout } from "../components/layout/AuthLayout";
import { Input, Label, FieldError } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { GoogleButton } from "../components/ui/GoogleButton";
import { useUser } from "../context/UserContext";
import { signInWithGoogle } from "../lib/googleAuth";
import { useToast } from "../components/ui/Toast";

interface FormState {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useUser();
  const { push } = useToast();
  const [form, setForm] = useState<FormState>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const accessToken = await signInWithGoogle();
      await loginWithGoogle(accessToken);
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof Error ? err.message : "Google sign-in failed.", "warn");
    } finally {
      setGoogleLoading(false);
    }
  }

  function validate(): boolean {
    const next: Partial<FormState> = {};
    if (!form.email) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email address";
    if (!form.password) next.password = "Password is required";
    else if (form.password.length < 8) next.password = "Password must be at least 8 characters";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      push(err instanceof Error ? err.message : "Log in failed.", "warn");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to manage your servers.">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="mb-1.5">
              Password
            </Label>
            <Link to="/#" className="text-xs font-medium text-accent-400 hover:text-accent-300 mb-1.5">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            error={errors.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          />
          <FieldError>{errors.password}</FieldError>
        </div>

        <Button type="submit" className="w-full mt-2" size="lg" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />}
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-line-soft" />
        <span className="text-xs text-text-lo">Or</span>
        <div className="h-px flex-1 bg-line-soft" />
      </div>

      <GoogleButton label="Sign in with Google" loading={googleLoading} onClick={handleGoogleSignIn} />

      <p className="mt-4 text-center text-[13.5px] text-text-lo">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-accent-400 hover:text-accent-300">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
