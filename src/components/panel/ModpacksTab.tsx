import { useState } from "react";
import { Blocks, Boxes } from "lucide-react";
import type { GameServer } from "../../mock-data/servers";
import { modpacks } from "../../mock-data/modpacks";
import type { Modpack } from "../../mock-data/modpacks";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

export function ModpacksTab({ server }: { server: GameServer }) {
  const supportsModpacks = server.software === "Forge" || server.software === "Fabric";
  const defaultIndex = server.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % modpacks.length;

  const [currentId, setCurrentId] = useState<string | null>(supportsModpacks ? modpacks[defaultIndex].id : null);
  const [switching, setSwitching] = useState<Modpack | null>(null);
  const { push } = useToast();

  const current = modpacks.find((m) => m.id === currentId) ?? null;

  function handleSwitch() {
    if (!switching) return;
    setCurrentId(switching.id);
    push(`Switched to "${switching.name}". Restarting server to apply the modpack...`, "success");
    setSwitching(null);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-panel/60 p-5">
        <div className="flex items-center gap-2 text-[13px] font-medium text-text-lo">
          <Blocks size={14} className="text-accent-400" />
          Currently installed
        </div>
        {current ? (
          <div className="mt-2">
            <p className="text-[15px] font-semibold text-text-hi">{current.name}</p>
            <p className="mt-1 text-[13px] text-text-lo">
              {current.modCount} mods · Minecraft {current.version}
            </p>
            <p className="mt-2 text-[13px] text-text-md">{current.description}</p>
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-text-lo">
            No modpack installed — running {server.software} {server.version}. Switch to one of the modpacks below to get started.
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2 text-[13px] text-text-md">
          <Boxes size={14} className="text-accent-400" />
          Modpack catalog
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modpacks.map((pack) => {
            const isCurrent = pack.id === currentId;
            return (
              <div key={pack.id} className="flex flex-col rounded-xl border border-line bg-panel/60 p-4">
                <p className="text-[13.5px] font-medium text-text-hi">{pack.name}</p>
                <p className="mt-1 text-xs text-text-lo">
                  {pack.modCount} mods · Minecraft {pack.version}
                </p>
                <p className="mt-2.5 flex-1 text-[13px] text-text-md">{pack.description}</p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent}
                  onClick={() => setSwitching(pack)}
                >
                  {isCurrent ? "Installed" : "Switch to this modpack"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={!!switching}
        onClose={() => setSwitching(null)}
        title="Switch modpack"
        description="Switching modpacks will restart your server and may require a world reset. Continue?"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSwitching(null)}>
            Cancel
          </Button>
          <Button onClick={handleSwitch}>Switch modpack</Button>
        </div>
      </Modal>
    </div>
  );
}
