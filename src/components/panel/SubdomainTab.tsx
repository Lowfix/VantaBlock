import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { Label, FieldError } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { demoFetch } from "../../demo/api";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface SubdomainState {
  subdomain: string | null;
  rootDomain: string;
  configured: boolean;
  relayed: boolean;
  forwarding: { port: number; targetIp: string } | null;
}

export function SubdomainTab({ identifier }: { identifier: string }) {
  const [state, setState] = useState<SubdomainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [subdomain, setSubdomain] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { push } = useToast();

  const load = useCallback(async () => {
    try {
      const res = await demoFetch(`/api/servers/${identifier}/subdomain`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as SubdomainState;
      setState(data);
      setSubdomain(data.subdomain ?? "");
    } catch {
      push("Could not load subdomain settings.", "warn");
    }
  }, [identifier, push]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleSave() {
    const value = slugify(subdomain);
    if (!/^[a-z0-9-]{3,32}$/.test(value)) {
      setError("Use 3–32 lowercase letters, numbers, or hyphens only.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await demoFetch(`/api/servers/${identifier}/subdomain`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subdomain: value }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to save subdomain.");
      setState((s) => (s ? { ...s, subdomain: value } : s));
      setSubdomain(value);
      push(`Your server is now reachable at ${body.fullDomain}`, "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to save subdomain.", "warn");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await demoFetch(`/api/servers/${identifier}/subdomain`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setState((s) => (s ? { ...s, subdomain: null } : s));
      setSubdomain("");
      push("Subdomain removed.", "warn");
    } catch {
      push("Failed to remove subdomain.", "warn");
    } finally {
      setRemoving(false);
    }
  }

  if (loading || !state) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-line bg-panel/60 py-16">
        <Loader2 size={20} className="animate-spin text-accent-400" />
      </div>
    );
  }

  const suffix = `.${state.rootDomain}`;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Vantablock subdomain</CardTitle>
            <CardDescription>Free, included with your plan.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!state.configured && (
            <p className="rounded-lg border border-warn/25 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
              Subdomains aren't fully configured on this server yet — saving may fail until that's set up.
            </p>
          )}

          <div>
            <Label htmlFor="subdomain">Subdomain</Label>
            <div className="flex items-center overflow-hidden rounded-lg border border-line bg-panel-2 transition-colors duration-150 focus-within:border-accent-500/60 focus-within:bg-panel focus-within:ring-4 focus-within:ring-accent-500/10">
              <input
                id="subdomain"
                value={subdomain}
                onChange={(e) => {
                  setSubdomain(e.target.value);
                  setError("");
                }}
                className="h-10 min-w-0 flex-1 bg-transparent px-3.5 text-sm text-text-hi placeholder:text-text-lo outline-none"
              />
              <span className="shrink-0 pr-3.5 text-sm text-text-lo select-none">{suffix}</span>
            </div>
            <FieldError>{error}</FieldError>
          </div>

          <div className="rounded-lg border border-line bg-panel-2 px-4 py-3">
            <p className="text-xs text-text-lo">Connection address</p>
            <p className="mt-1 font-mono text-[13px] text-text-hi">
              {subdomain || "your-subdomain"}
              {suffix}
            </p>
            <p className="mt-1 text-xs text-text-lo">No port needed — players just enter this address.</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || removing}>
              {saving ? "Saving..." : "Save subdomain"}
            </Button>
            {state.subdomain && (
              <Button variant="danger" onClick={handleRemove} disabled={saving || removing}>
                <Trash2 size={13} /> Remove
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {state.relayed ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Traffic routing</CardTitle>
              <CardDescription>How players' connections reach this server.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-good/25 bg-good/10 px-4 py-3">
              <ShieldCheck size={18} className="shrink-0 text-good" />
              <p className="text-[13px] text-text-hi">
                Routed through Vantablock's relay — no setup needed, and it works automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Port forwarding required</CardTitle>
              <CardDescription>Your router needs to forward this server's port before the subdomain will work.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.forwarding ? (
              <div className="rounded-lg border border-line bg-panel-2 px-4 py-3">
                <div className="grid grid-cols-2 gap-2 text-xs text-text-lo">
                  <span>External port (TCP + UDP)</span>
                  <span>Forward to</span>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-2 font-mono text-[13px] text-text-hi">
                  <span>{state.forwarding.port}</span>
                  <span className="truncate">
                    {state.forwarding.targetIp}:{state.forwarding.port}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-text-lo">Couldn't determine this server's allocation yet.</p>
            )}
            <p className="text-xs text-text-lo">
              On your router, forward the port above (both TCP and UDP) to the address shown. Once that's done, the
              subdomain above will resolve straight to this server — no port needed on the player's end.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
