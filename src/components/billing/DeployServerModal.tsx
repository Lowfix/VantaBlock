import { useState } from "react";
import { plans } from "../../mock-data/plans";
import { serverTypes } from "../../mock-data/serverTypes";
import { minecraftVersions } from "../../mock-data/versions";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input, Label } from "../ui/Input";
import { Dropdown } from "../ui/Dropdown";
import { Toggle } from "../ui/Toggle";
import { useToast } from "../ui/Toast";
import { useUser } from "../../context/UserContext";

interface DeployServerModalProps {
  open: boolean;
  onClose: () => void;
  onDeployed: (name: string, status: "deploying" | "pending") => void;
}

export function DeployServerModal({ open, onClose, onDeployed }: DeployServerModalProps) {
  const { user } = useUser();
  const [name, setName] = useState("");
  const [serverTypeId, setServerTypeId] = useState(serverTypes[1].id); // Paper by default
  const [version, setVersion] = useState("latest");
  const [selectedPlan, setSelectedPlan] = useState(plans[1].id); // Sapling by default
  const [ramMb, setRamMb] = useState("4096");
  const [diskMb, setDiskMb] = useState("40960");
  const [cpuPercent, setCpuPercent] = useState("200");
  const [generateSubdomain, setGenerateSubdomain] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const { push } = useToast();

  async function handleDeploy() {
    if (!name.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          // The admin's own instant deploys pick resources directly; a
          // customer request picks a plan instead (the owner can still
          // accept or downgrade it when reviewing the request).
          ...(user?.isAdmin
            ? { ramMb: Number(ramMb), diskMb: Number(diskMb), cpuPercent: Number(cpuPercent) }
            : { planId: selectedPlan }),
          serverTypeId,
          version: version.trim() || "latest",
          generateSubdomain,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; status?: "deploying" | "pending" } | null;
      if (!res.ok) {
        throw new Error(body?.error);
      }
      onDeployed(name.trim(), body?.status ?? "deploying");
      onClose();
      setName("");
      setServerTypeId(serverTypes[1].id);
      setVersion("latest");
      setSelectedPlan(plans[1].id);
      setRamMb("4096");
      setDiskMb("40960");
      setCpuPercent("200");
      setGenerateSubdomain(true);
    } catch (err) {
      push(err instanceof Error && err.message ? err.message : "Failed to deploy server.", "warn");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user?.isAdmin ? "Deploy new server" : "Request a new server"}
      description={
        user?.isAdmin
          ? "Choose a type, version, and resources for your new Minecraft server."
          : "Choose a type, version, and plan — we'll set it up once your request is approved."
      }
      className="!max-w-xl"
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="deploy-name">Server name</Label>
          <Input id="deploy-name" placeholder="My Minecraft Server" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="deploy-type">Server type</Label>
            <Dropdown
              value={serverTypeId}
              onChange={setServerTypeId}
              options={serverTypes.map((type) => ({ value: type.id, label: type.name, description: type.description }))}
            />
          </div>

          <div>
            <Label htmlFor="deploy-version">Minecraft version</Label>
            <Dropdown value={version} onChange={setVersion} options={minecraftVersions.map((v) => ({ value: v.id, label: v.label }))} />
          </div>
        </div>

        {user?.isAdmin ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="deploy-ram">RAM (MB)</Label>
              <Input id="deploy-ram" type="number" min={512} step={512} value={ramMb} onChange={(e) => setRamMb(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="deploy-disk">Disk (MB)</Label>
              <Input id="deploy-disk" type="number" min={1024} step={1024} value={diskMb} onChange={(e) => setDiskMb(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="deploy-cpu">CPU (%)</Label>
              <Input id="deploy-cpu" type="number" min={25} step={25} value={cpuPercent} onChange={(e) => setCpuPercent(e.target.value)} />
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="deploy-plan">Plan</Label>
            <Dropdown
              value={selectedPlan}
              onChange={setSelectedPlan}
              options={plans.map((plan) => ({
                value: plan.id,
                label: plan.name,
                description: `${plan.ram}GB RAM · ${plan.vCores} · ${plan.storage}`,
              }))}
            />
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border border-line bg-panel-2 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-text-hi">Generate a subdomain</p>
            <p className="mt-0.5 text-xs text-text-lo">
              Automatically create a free {name.trim() ? `${name.trim().toLowerCase().replace(/\s+/g, "-")}` : "yourserver"}.duxy.online address.
            </p>
          </div>
          <Toggle checked={generateSubdomain} onChange={setGenerateSubdomain} label="Generate a subdomain" />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={deploying}>
          Cancel
        </Button>
        <Button onClick={handleDeploy} disabled={deploying || !name.trim()}>
          {deploying ? "Submitting..." : user?.isAdmin ? "Deploy server" : "Request server"}
        </Button>
      </div>
    </Modal>
  );
}
