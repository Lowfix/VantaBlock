import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { Label, Textarea } from "../ui/Input";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

interface StartupVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  server_value: string;
  is_editable: boolean;
}

export function StartupTab({ identifier }: { identifier: string }) {
  const [startupCommand, setStartupCommand] = useState("");
  const [variables, setVariables] = useState<StartupVariable[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const { push } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/startup`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { startupCommand: string; variables: StartupVariable[] };
      setStartupCommand(data.startupCommand);
      setVariables(data.variables);
      setEdited(Object.fromEntries(data.variables.map((v) => [v.env_variable, v.server_value])));
    } catch {
      push("Could not load startup configuration.", "warn");
    } finally {
      setLoading(false);
    }
  }, [identifier, push]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveVariable(variable: StartupVariable) {
    const value = edited[variable.env_variable] ?? variable.server_value;
    setSavingKey(variable.env_variable);
    try {
      const res = await fetch(`/api/servers/${identifier}/startup/variable`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: variable.env_variable, value }),
      });
      if (!res.ok) throw new Error();
      push(`${variable.name} updated. Restart the server to apply.`, "success");
      load();
    } catch {
      push(`Failed to update ${variable.name}.`, "warn");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-text-lo">
        <Loader2 size={16} className="animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Startup command</CardTitle>
            <CardDescription>
              The resolved command used to launch your server, with the variables below substituted in. Read-only — edit the
              variables to change it.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={startupCommand} readOnly rows={3} className="font-mono text-[12.5px] opacity-70" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Environment variables</CardTitle>
            <CardDescription>Defined by this server's egg. Only variables marked editable can be changed here.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {variables.length === 0 && <p className="text-[13px] text-text-lo">No environment variables.</p>}
          {variables.map((v) => (
            <div key={v.env_variable} className="rounded-lg border border-line bg-panel-2 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`var-${v.env_variable}`}>
                  {v.name} <span className="font-mono text-xs text-text-lo">({v.env_variable})</span>
                </Label>
              </div>
              {v.description && <p className="mb-2 text-xs text-text-lo">{v.description}</p>}
              <div className="flex items-center gap-2">
                <Input
                  id={`var-${v.env_variable}`}
                  value={edited[v.env_variable] ?? v.server_value}
                  onChange={(e) => setEdited((prev) => ({ ...prev, [v.env_variable]: e.target.value }))}
                  disabled={!v.is_editable}
                  className="font-mono flex-1"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!v.is_editable || savingKey === v.env_variable || (edited[v.env_variable] ?? v.server_value) === v.server_value}
                  onClick={() => handleSaveVariable(v)}
                >
                  {savingKey === v.env_variable ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
