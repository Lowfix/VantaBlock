import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { UserX, Ban, Search, ShieldCheck, Crown, Plus, X, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Textarea } from "../ui/Input";
import { useToast } from "../ui/Toast";
import { cn } from "../../lib/cn";
import { demoFetch } from "../../demo/api";

interface WhitelistEntry {
  name: string;
}
interface OpEntry {
  name: string;
  level: number;
}
interface BannedEntry {
  name: string;
  reason: string;
}

interface LivePlayers {
  names: string[];
  sendCommand: (command: string) => void;
}

type SubTab = "online" | "whitelist" | "ops" | "banned";

async function readJsonFile<T>(identifier: string, file: string): Promise<T[]> {
  const res = await demoFetch(`/api/servers/${identifier}/files/contents?file=${encodeURIComponent(file)}`, {
    credentials: "include",
  });
  if (res.status === 404) {
    // Fresh servers don't have this file until the first player is ever
    // whitelisted/opped/banned — that's a normal empty state, not an error.
    return [];
  }
  if (!res.ok) {
    throw new Error(`Failed to load ${file} (${res.status}).`);
  }
  const body = (await res.json()) as { content: string };
  const parsed = JSON.parse(body.content);
  return Array.isArray(parsed) ? parsed : [];
}

export function PlayersTab({
  identifier,
  online,
  playersOnline,
  playersMax,
  live,
}: {
  identifier: string | null;
  online: boolean;
  playersOnline: number;
  playersMax: number;
  live?: LivePlayers;
}) {
  const [subTab, setSubTab] = useState<SubTab>("online");
  const [query, setQuery] = useState("");
  const [kicking, setKicking] = useState<string | null>(null);
  const [banning, setBanning] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");

  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [ops, setOps] = useState<OpEntry[]>([]);
  const [banned, setBanned] = useState<BannedEntry[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [addingWhitelist, setAddingWhitelist] = useState(false);
  const [addingOp, setAddingOp] = useState(false);
  const [newName, setNewName] = useState("");
  const { push } = useToast();

  const loadLists = useCallback(async () => {
    if (!identifier) return;
    try {
      const [wl, ops, bans] = await Promise.all([
        readJsonFile<WhitelistEntry>(identifier, "whitelist.json"),
        readJsonFile<OpEntry>(identifier, "ops.json"),
        readJsonFile<BannedEntry>(identifier, "banned-players.json"),
      ]);
      setWhitelist(wl);
      setOps(ops);
      setBanned(bans);
    } catch {
      push("Could not load player lists.", "warn");
    }
  }, [identifier, push]);

  useEffect(() => {
    loadLists().finally(() => setListsLoading(false));
  }, [loadLists]);

  function refreshAfterCommand() {
    setTimeout(() => loadLists(), 1200);
  }

  const onlinePlayers = live?.names ?? [];
  const filteredOnline = onlinePlayers.filter((name) => name.toLowerCase().includes(query.toLowerCase()));

  function handleKick() {
    if (!kicking || !live) return;
    live.sendCommand(`kick ${kicking}`);
    push(`Kick command sent for ${kicking}.`, "warn");
    setKicking(null);
  }

  function handleBan() {
    if (!banning || !live) return;
    live.sendCommand(`ban ${banning}${banReason ? ` ${banReason}` : ""}`);
    push(`Ban command sent for ${banning}.`, "warn");
    setBanning(null);
    setBanReason("");
    refreshAfterCommand();
  }

  function handleUnban(name: string) {
    if (!live) return;
    live.sendCommand(`pardon ${name}`);
    push(`${name} was unbanned.`, "success");
    setBanned((list) => list.filter((b) => b.name !== name));
    refreshAfterCommand();
  }

  function handleAddWhitelist(e: FormEvent) {
    e.preventDefault();
    if (!live || !newName.trim()) return;
    live.sendCommand(`whitelist add ${newName.trim()}`);
    push(`Whitelist command sent for ${newName.trim()}.`, "success");
    setAddingWhitelist(false);
    setNewName("");
    refreshAfterCommand();
  }

  function handleRemoveWhitelist(name: string) {
    if (!live) return;
    live.sendCommand(`whitelist remove ${name}`);
    setWhitelist((list) => list.filter((w) => w.name !== name));
    push(`${name} removed from the whitelist.`, "warn");
    refreshAfterCommand();
  }

  function handleOpOnline(name: string) {
    if (!live) return;
    live.sendCommand(`op ${name}`);
    push(`${name} is now an operator.`, "success");
    refreshAfterCommand();
  }

  function handleDeopOnline(name: string) {
    if (!live) return;
    live.sendCommand(`deop ${name}`);
    push(`${name} is no longer an operator.`, "warn");
    refreshAfterCommand();
  }

  function handleAddOp(e: FormEvent) {
    e.preventDefault();
    if (!live || !newName.trim()) return;
    live.sendCommand(`op ${newName.trim()}`);
    push(`Op command sent for ${newName.trim()}.`, "success");
    setAddingOp(false);
    setNewName("");
    refreshAfterCommand();
  }

  function handleRemoveOp(name: string) {
    if (!live) return;
    live.sendCommand(`deop ${name}`);
    setOps((list) => list.filter((o) => o.name !== name));
    push(`${name} is no longer an operator.`, "warn");
    refreshAfterCommand();
  }

  const subTabs: { id: SubTab; label: string; count?: number }[] = [
    { id: "online", label: "Online", count: onlinePlayers.length },
    { id: "whitelist", label: "Whitelist", count: whitelist.length },
    { id: "ops", label: "Operators", count: ops.length },
    { id: "banned", label: "Banned", count: banned.length },
  ];

  return (
    <div className="rounded-xl border border-line bg-panel/60">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div
          role="tablist"
          className="flex items-center gap-1 rounded-lg border border-line bg-panel-2 p-1"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            if (tabs.length === 0) return;
            e.preventDefault();
            const currentIndex = tabs.findIndex((t) => t === document.activeElement);
            const delta = e.key === "ArrowRight" ? 1 : -1;
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + tabs.length) % tabs.length;
            tabs[nextIndex]?.focus();
            tabs[nextIndex]?.click();
          }}
        >
          {subTabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={subTab === t.id}
              tabIndex={subTab === t.id ? 0 : -1}
              onClick={() => setSubTab(t.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                subTab === t.id ? "bg-panel-3 text-text-hi" : "text-text-lo hover:text-text-md"
              )}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 text-text-lo">{t.count}</span>}
            </button>
          ))}
        </div>
        {subTab === "online" && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-lo" />
            <Input
              placeholder="Search players..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 w-52 text-[13px]"
              style={{ paddingLeft: 30 }}
            />
          </div>
        )}
        {subTab === "whitelist" && (
          <Button size="sm" onClick={() => setAddingWhitelist(true)} disabled={!online}>
            <Plus size={14} /> Whitelist player
          </Button>
        )}
        {subTab === "ops" && (
          <Button size="sm" onClick={() => setAddingOp(true)} disabled={!online}>
            <Plus size={14} /> Add operator
          </Button>
        )}
      </div>

      {subTab === "online" && (
        <>
          <p className="px-4 pt-3 text-[13px] text-text-md">
            <span className="font-semibold text-text-hi">{playersOnline}</span> / {playersMax} players online
          </p>
          <div className="divide-y divide-line-soft">
            {filteredOnline.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] text-text-lo">
                {query ? "No players match your search." : "No players are currently online."}
              </p>
            )}
            {filteredOnline.map((name) => (
              <div key={name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-[12px] font-semibold text-accent-300">
                    {name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-text-hi">{name}</span>
                      <span className="h-1.5 w-1.5 rounded-full bg-good" />
                    </div>
                    <p className="text-xs text-text-lo">Online now</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ops.some((o) => o.name === name) ? (
                    <Button variant="secondary" size="sm" onClick={() => handleDeopOnline(name)}>
                      <Crown size={13} /> De-op
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => handleOpOnline(name)}>
                      <Crown size={13} /> Op
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setKicking(name)}>
                    <UserX size={13} /> Kick
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setBanning(name)}>
                    <Ban size={13} /> Ban
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {subTab !== "online" && listsLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-accent-400" />
        </div>
      )}

      {subTab === "whitelist" && !listsLoading && (
        <div className="divide-y divide-line-soft">
          {whitelist.length === 0 && (
            <p className="px-4 py-8 text-center text-[13px] text-text-lo">No players are whitelisted.</p>
          )}
          {whitelist.map((w) => (
            <div key={w.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-text-hi">
                <ShieldCheck size={14} className="text-good" /> {w.name}
              </span>
              <button
                onClick={() => handleRemoveWhitelist(w.name)}
                disabled={!online}
                className="rounded-md p-1.5 text-text-lo hover:bg-panel-3 hover:text-bad disabled:opacity-30"
                aria-label={`Remove ${w.name} from whitelist`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {subTab === "ops" && !listsLoading && (
        <div className="divide-y divide-line-soft">
          {ops.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-text-lo">No operators set.</p>}
          {ops.map((o) => (
            <div key={o.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2 text-[13.5px] font-medium text-text-hi">
                <Crown size={14} className="text-warn" /> {o.name}
                <span className="text-xs text-text-lo">level {o.level}</span>
              </span>
              <button
                onClick={() => handleRemoveOp(o.name)}
                disabled={!online}
                className="rounded-md p-1.5 text-text-lo hover:bg-panel-3 hover:text-bad disabled:opacity-30"
                aria-label={`Remove op from ${o.name}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {subTab === "banned" && !listsLoading && (
        <div className="divide-y divide-line-soft">
          {banned.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-text-lo">No banned players.</p>}
          {banned.map((b) => (
            <div key={b.name} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <span className="flex items-center gap-2 text-[13.5px] font-medium text-text-hi">
                  <Ban size={14} className="text-bad" /> {b.name}
                </span>
                {b.reason && <p className="mt-0.5 pl-[22px] text-xs text-text-lo">{b.reason}</p>}
              </div>
              <Button variant="secondary" size="sm" onClick={() => handleUnban(b.name)} disabled={!online}>
                Unban
              </Button>
            </div>
          ))}
        </div>
      )}

      {!online && subTab !== "online" && (
        <p className="border-t border-line-soft px-4 py-2.5 text-xs text-text-lo">
          Server must be online to add or remove entries — these lists are still shown from the last known state.
        </p>
      )}

      <Modal open={!!kicking} onClose={() => setKicking(null)} title="Kick player" description={`Kick ${kicking} from the server? They can rejoin immediately.`}>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setKicking(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleKick}>
            Kick player
          </Button>
        </div>
      </Modal>

      <Modal open={!!banning} onClose={() => setBanning(null)} title="Ban player" description={`Ban ${banning} from the server.`}>
        <Textarea placeholder="Ban reason (optional)" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBanning(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBan}>
            Ban player
          </Button>
        </div>
      </Modal>

      <Modal
        open={addingWhitelist}
        onClose={() => setAddingWhitelist(false)}
        title="Whitelist player"
        description="Works even if the player isn't currently online."
      >
        <form onSubmit={handleAddWhitelist}>
          <Input placeholder="Player username" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAddingWhitelist(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              Whitelist player
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={addingOp}
        onClose={() => setAddingOp(false)}
        title="Add operator"
        description="Grants full operator permissions — works even if the player isn't currently online."
      >
        <form onSubmit={handleAddOp}>
          <Input placeholder="Player username" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAddingOp(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!newName.trim()}>
              Add operator
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
