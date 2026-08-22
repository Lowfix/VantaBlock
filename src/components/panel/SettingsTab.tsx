import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import type { GameServer } from "../../mock-data/servers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/Card";
import { Input, Label, Textarea } from "../ui/Input";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

export function SettingsTab({ identifier, server }: { identifier: string; server: GameServer }) {
  const navigate = useNavigate();
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [reinstalling, setReinstalling] = useState(false);
  const [confirmReinstall, setConfirmReinstall] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { push } = useToast();

  async function handleDelete() {
    setConfirmDelete(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/servers/${identifier}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      push(`${server.name} has been deleted.`, "success");
      navigate("/dashboard");
    } catch {
      push("Failed to delete this server.", "warn");
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/settings/rename`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description }),
      });
      if (!res.ok) throw new Error();
      push("Server settings saved.", "success");
    } catch {
      push("Failed to save settings.", "warn");
    } finally {
      setSaving(false);
    }
  }

  async function handleReinstall() {
    setConfirmReinstall(false);
    setReinstalling(true);
    try {
      const res = await fetch(`/api/servers/${identifier}/settings/reinstall`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      push("Reinstall started — the server will restart and reset to the egg's default files.", "warn");
    } catch {
      push("Failed to start reinstall.", "warn");
    } finally {
      setReinstalling(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>General</CardTitle>
            <CardDescription>Basic identity for your server.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="server-name">Server name</Label>
            <Input id="server-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Resources & network</CardTitle>
            <CardDescription>Allocated by your plan — contact support to change these.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-line bg-panel-2 px-4 py-3">
            <p className="text-xs text-text-lo">Memory / Disk</p>
            <p className="mt-1 text-[13px] text-text-hi">
              {server.ramAllocated} GB / {server.diskAllocated} GB
            </p>
          </div>
          <div className="rounded-lg border border-line bg-panel-2 px-4 py-3">
            <p className="text-xs text-text-lo">Connection address</p>
            <p className="mt-1 font-mono text-[13px] text-text-hi">
              {server.ip ? `${server.ip}:${server.port}` : "Not available yet — set a subdomain in the Players tab"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 !border-bad/30">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2 text-bad">
              <AlertTriangle size={16} /> Danger zone
            </CardTitle>
            <CardDescription>These actions can't be undone.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
            <div>
              <p className="text-[13.5px] font-medium text-text-hi">Reinstall server</p>
              <p className="text-xs text-text-lo">Wipes files back to the egg's default install.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmReinstall(true)} disabled={reinstalling}>
              {reinstalling ? "Reinstalling..." : "Reinstall"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-panel-2 px-4 py-3.5">
            <div>
              <p className="text-[13.5px] font-medium text-text-hi">Delete server</p>
              <p className="text-xs text-text-lo">Permanently deletes this server and all its files.</p>
            </div>
            <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete server"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={confirmReinstall}
        onClose={() => setConfirmReinstall(false)}
        title="Reinstall server"
        description="This will stop your server, wipe its files back to the default install, and run the install script again. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReinstall(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReinstall}>
            Reinstall
          </Button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete server"
        description={`This permanently deletes "${server.name}" and all its files. This cannot be undone.`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete server
          </Button>
        </div>
      </Modal>
    </div>
  );
}
