import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Terminal,
  FolderOpen,
  Database,
  Clock,
  UsersRound,
  History,
  Archive,
  Network,
  Link2,
  Rocket,
  Settings,
  DoorOpen,
  Users2,
  PlugZap,
  Blocks,
  UserCog,
  BookOpen,
  LifeBuoy,
  ChevronDown,
  ChevronRight,
  Menu as MenuIcon,
  X,
  LogOut,
  ChevronsUpDown,
  Check,
  Loader2,
} from "lucide-react";
import { servers as initialServers } from "../mock-data/servers";
import type { GameServer, ServerStatus } from "../mock-data/servers";
import { Logo } from "../components/layout/Logo";
import { cn } from "../lib/cn";
import { useToast } from "../components/ui/Toast";
import { useLiveServerStats } from "../lib/useLiveServerStats";
import { useLiveConsole } from "../lib/useLiveConsole";
import { useMyServers, mergeMyServers, pterodactylServerId } from "../lib/useMyServers";

const PTERO_PREFIX = "ptero-";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { Input, Textarea } from "../components/ui/Input";
import { ConsoleTab } from "../components/panel/ConsoleTab";
import { FilesTab } from "../components/panel/FilesTab";
import { PlayersTab } from "../components/panel/PlayersTab";
import { SettingsTab } from "../components/panel/SettingsTab";
import { BackupsTab } from "../components/panel/BackupsTab";
import { TasksTab } from "../components/panel/TasksTab";
import { DatabaseTab } from "../components/panel/DatabaseTab";
import { UsersTab } from "../components/panel/UsersTab";
import { ActivityLogTab } from "../components/panel/ActivityLogTab";
import { PortsTab } from "../components/panel/PortsTab";
import { SubdomainTab } from "../components/panel/SubdomainTab";
import { StartupTab } from "../components/panel/StartupTab";
import { PluginsTab } from "../components/panel/PluginsTab";
import { ModpacksTab } from "../components/panel/ModpacksTab";
import { demoFetch } from "../demo/api";

type TabId =
  | "console"
  | "files"
  | "database"
  | "schedules"
  | "users"
  | "activity"
  | "backups"
  | "ports"
  | "subdomain"
  | "startup"
  | "settings"
  | "players"
  | "plugins"
  | "modpacks";

interface NavItem {
  id: TabId;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

interface NavSection {
  id: string;
  label: string;
  defaultOpen: boolean;
  items: NavItem[];
}

const serverManagementItems: NavItem[] = [
  { id: "console", label: "Console", icon: Terminal },
  { id: "files", label: "File Manager", icon: FolderOpen },
  { id: "database", label: "Database", icon: Database },
  { id: "schedules", label: "Schedules", icon: Clock },
  { id: "users", label: "Users", icon: UsersRound },
  { id: "activity", label: "Activity Logs", icon: History },
  { id: "backups", label: "Backups", icon: Archive },
  { id: "ports", label: "Ports & Proxies", icon: Network },
  { id: "subdomain", label: "Subdomain", icon: Link2 },
  { id: "startup", label: "Startup", icon: Rocket },
  { id: "settings", label: "Settings", icon: Settings },
];

const minecraftItems: NavItem[] = [
  { id: "players", label: "Player Manager", icon: Users2 },
  { id: "plugins", label: "Plugins", icon: PlugZap },
  { id: "modpacks", label: "Modpacks", icon: Blocks },
];

const navSections: NavSection[] = [
  { id: "server-management", label: "Server Management", defaultOpen: true, items: serverManagementItems },
  { id: "minecraft", label: "Minecraft", defaultOpen: true, items: minecraftItems },
];

const statusTone: Record<ServerStatus, string> = {
  online: "bg-good",
  offline: "bg-text-lo",
  starting: "bg-warn",
  stopping: "bg-warn",
  restarting: "bg-warn",
};

const transitionMap: Record<string, { pending: ServerStatus; done: ServerStatus; verb: string }> = {
  start: { pending: "starting", done: "online", verb: "started" },
  stop: { pending: "stopping", done: "offline", verb: "stopped" },
  restart: { pending: "restarting", done: "online", verb: "restarted" },
  kill: { pending: "stopping", done: "offline", verb: "killed" },
};

function useUtcClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return time.toUTCString().slice(17, 25);
}

export function ServerPanelPage() {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const [servers, setServers] = useState<GameServer[]>(initialServers);
  const [activeTab, setActiveTab] = useState<TabId>("console");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    "server-management": true,
    minecraft: true,
    account: false,
    support: false,
  });
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [livePlayerNames, setLivePlayerNames] = useState<string[]>([]);

  const utcTime = useUtcClock();
  const { servers: myServers, loading: myServersLoading } = useMyServers();

  const myIdentifier = serverId?.startsWith(PTERO_PREFIX) ? serverId.slice(PTERO_PREFIX.length) : null;
  const isLiveServer = myIdentifier !== null;
  const { stats: liveStats, unreachable: liveUnreachable } = useLiveServerStats(myIdentifier);
  const live = useLiveConsole(myIdentifier);

  useEffect(() => {
    if (!myServers.length) return;
    setServers((list) => mergeMyServers(list, myServers));
  }, [myServers]);

  const server = servers.find((s) => s.id === serverId);

  useEffect(() => {
    if (!liveStats) return;
    const targetId = pterodactylServerId(liveStats.identifier);
    setServers((list) =>
      list.map((s) =>
        s.id === targetId
          ? {
              ...s,
              status: liveStats.status,
              cpuUsed: liveStats.cpuUsed,
              ramUsed: liveStats.ramUsed,
              diskUsed: liveStats.diskUsed,
              ip: liveStats.ip,
              port: liveStats.port,
              playersOnline: liveStats.playersOnline,
              playersMax: liveStats.playersMax,
              billingStatus: liveStats.billingStatus,
              nextBillAt: liveStats.nextBillAt,
              gracePeriodEndsAt: liveStats.gracePeriodEndsAt,
            }
          : s
      )
    );
    setLivePlayerNames(liveStats.playerNames);
  }, [liveStats]);

  useEffect(() => {
    if (isLiveServer && liveUnreachable) {
      push("Lost connection to the Pterodactyl panel — retrying...", "warn");
    }
  }, [isLiveServer, liveUnreachable, push]);

  function toggleSection(id: string) {
    setSectionsOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handlePower(action: "start" | "stop" | "restart" | "kill") {
    if (!server) return;

    if (isLiveServer && myIdentifier) {
      push(`Sending ${action} to ${server.name}...`, "info");
      demoFetch(`/api/servers/${myIdentifier}/power`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
        .then((res) => {
          if (!res.ok) throw new Error();
          push(`${action[0].toUpperCase()}${action.slice(1)} sent to ${server.name}.`, "success");
        })
        .catch(() => push(`Failed to send ${action} to ${server.name}.`, "warn"));
      return;
    }

    const transition = transitionMap[action];
    setServers((list) => list.map((s) => (s.id === server.id ? { ...s, status: transition.pending } : s)));
    push(`${server.name} is ${transition.pending}...`, "info");

    setTimeout(() => {
      setServers((list) =>
        list.map((s) =>
          s.id === server.id
            ? {
                ...s,
                status: transition.done,
                cpuUsed: transition.done === "online" ? Math.floor(20 + Math.random() * 40) : 0,
                uptime: transition.done === "online" ? "just now" : "0m",
              }
            : s
        )
      );
      push(`${server.name} ${transition.verb} successfully.`, "success");
    }, 1800);
  }

  function handleLeaveServer() {
    setLeaveOpen(false);
    push("You have left this server.", "warn");
    navigate("/panel-preview");
  }

  async function handleSubmitTicket() {
    if (!supportSubject.trim() || !supportMessage.trim() || submittingTicket) return;
    setSubmittingTicket(true);
    try {
      const res = await demoFetch("/api/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
          serverIdentifier: myIdentifier,
          serverName: server?.name,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to submit your ticket.");
      push("Support ticket submitted. We'll respond soon.", "success");
      setSupportOpen(false);
      setSupportSubject("");
      setSupportMessage("");
    } catch (err) {
      push(err instanceof Error ? err.message : "Failed to submit your ticket.", "warn");
    } finally {
      setSubmittingTicket(false);
    }
  }

  if (!server) {
    if (myServersLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-void">
          <Loader2 size={22} className="animate-spin text-accent-400" />
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-void">
        <div className="text-center">
          <p className="text-text-hi text-lg font-semibold">Server not found</p>
          <button onClick={() => navigate("/panel-preview")} className="mt-3 text-accent-400 hover:text-accent-300 text-sm">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const busy = server.status === "starting" || server.status === "stopping" || server.status === "restarting";
  const serverIdShort = server.id.replace("srv-", "").slice(0, 8).padEnd(8, "0");

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Link to="/panel-preview">
          <Logo />
        </Link>
        <button className="p-1 text-text-lo hover:text-text-hi lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {navSections.map((section) => (
          <div key={section.id}>
            <button
              onClick={() => toggleSection(section.id)}
              className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-lo hover:text-text-md"
            >
              {section.label}
              {sectionsOpen[section.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
            {sectionsOpen[section.id] && (
              <div className="mt-1 space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                        active
                          ? "bg-accent-500/10 text-accent-300 shadow-[0_0_0_1px_rgba(130,87,255,0.2)_inset]"
                          : "text-text-md hover:bg-panel-2 hover:text-text-hi"
                      )}
                    >
                      <Icon size={15} />
                      {item.label}
                    </button>
                  );
                })}
                {section.id === "server-management" && (
                  <button
                    onClick={() => setLeaveOpen(true)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-text-lo transition-colors hover:bg-panel-2 hover:text-bad"
                  >
                    <DoorOpen size={15} />
                    Leave Server
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        <div>
          <button
            onClick={() => toggleSection("account")}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-lo hover:text-text-md"
          >
            Account Management
            {sectionsOpen.account ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {sectionsOpen.account && (
            <div className="mt-1 space-y-0.5">
              <Link
                to="/panel-preview/account"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-text-md transition-colors hover:bg-panel-2 hover:text-text-hi"
              >
                <UserCog size={15} />
                Account Settings
              </Link>
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => toggleSection("support")}
            className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-lo hover:text-text-md"
          >
            Support
            {sectionsOpen.support ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {sectionsOpen.support && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => setKnowledgeOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-text-md transition-colors hover:bg-panel-2 hover:text-text-hi"
              >
                <BookOpen size={15} />
                Knowledge Base
              </button>
              <button
                onClick={() => setSupportOpen(true)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-text-md transition-colors hover:bg-panel-2 hover:text-text-hi"
              >
                <LifeBuoy size={15} />
                Contact Support
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-void">
      <aside className="hidden w-64 shrink-0 border-r border-line-soft bg-ink lg:block">{sidebarContent}</aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 bg-ink shadow-glow-md animate-fade-in-up">{sidebarContent}</div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-8 z-30 flex h-16 items-center justify-between border-b border-line-soft bg-void/90 px-4 backdrop-blur-lg sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="p-1 text-text-lo hover:text-text-hi lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
              <MenuIcon size={20} />
            </button>

            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((o) => !o)}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-panel-2 px-3 py-2 text-left transition-colors hover:bg-panel-3"
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", statusTone[server.status])} />
                <span className="min-w-0 truncate text-[13.5px] font-medium text-text-hi">
                  {server.name} <span className="text-text-lo">— {serverIdShort}</span>
                </span>
                <ChevronsUpDown size={14} className="shrink-0 text-text-lo" />
              </button>

              {switcherOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSwitcherOpen(false)} />
                  <div className="absolute left-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border border-line bg-panel-2 py-1 shadow-glow-md animate-fade-in-up">
                    {servers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSwitcherOpen(false);
                          navigate(`/panel-preview/servers/${s.id}`);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-[13px] text-text-md transition-colors hover:bg-panel-3 hover:text-text-hi"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusTone[s.status])} />
                          <span className="truncate">{s.name}</span>
                        </span>
                        {s.id === server.id && <Check size={14} className="shrink-0 text-accent-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <span className="hidden text-[13px] text-text-lo sm:block">
              UTC Time: <span className="font-mono text-text-md">{utcTime}</span>
            </span>
            <Link to="/panel-preview" className="flex items-center gap-1.5 text-[13px] font-medium text-text-lo transition-colors hover:text-bad">
              <LogOut size={14} />
              Logout
            </Link>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">
          {activeTab === "console" && (
            <ConsoleTab
              server={server}
              identifier={myIdentifier}
              onPower={handlePower}
              busy={busy}
              live={isLiveServer ? live : undefined}
            />
          )}
          {activeTab === "files" && <FilesTab identifier={myIdentifier!} />}
          {activeTab === "database" && <DatabaseTab identifier={myIdentifier!} />}
          {activeTab === "schedules" && <TasksTab identifier={myIdentifier!} />}
          {activeTab === "users" && <UsersTab identifier={myIdentifier!} />}
          {activeTab === "activity" && <ActivityLogTab identifier={myIdentifier!} />}
          {activeTab === "backups" && <BackupsTab identifier={myIdentifier!} />}
          {activeTab === "ports" && <PortsTab identifier={myIdentifier!} />}
          {activeTab === "subdomain" && <SubdomainTab identifier={myIdentifier!} />}
          {activeTab === "startup" && <StartupTab identifier={myIdentifier!} />}
          {activeTab === "settings" && <SettingsTab identifier={myIdentifier!} server={server} />}
          {activeTab === "players" && (
            <PlayersTab
              identifier={myIdentifier}
              online={server.status === "online"}
              playersOnline={server.playersOnline}
              playersMax={server.playersMax}
              live={isLiveServer ? { names: livePlayerNames, sendCommand: live.sendCommand } : undefined}
            />
          )}
          {activeTab === "plugins" && <PluginsTab identifier={myIdentifier!} server={server} />}
          {activeTab === "modpacks" && <ModpacksTab server={server} />}
        </main>
      </div>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave server"
        description={`You'll lose access to "${server.name}" unless the owner invites you back. Are you sure?`}
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleLeaveServer}>
            Leave server
          </Button>
        </div>
      </Modal>

      <Modal open={knowledgeOpen} onClose={() => setKnowledgeOpen(false)} title="Knowledge base" description="Popular articles for server owners.">
        <div className="space-y-2.5">
          {[
            "How to install a modpack from CurseForge",
            "Configuring a Velocity proxy network",
            "Migrating worlds from another host",
            "Setting up scheduled backups",
          ].map((article) => (
            <button
              key={article}
              onClick={() => setKnowledgeOpen(false)}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-panel-2 px-4 py-3 text-left text-[13px] text-text-md transition-colors hover:border-line-soft hover:text-text-hi"
            >
              {article}
              <ChevronRight size={14} className="text-text-lo" />
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={supportOpen} onClose={() => setSupportOpen(false)} title="Contact support" description="We typically respond within a few hours.">
        <div className="space-y-4">
          <Input placeholder="Subject" value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} />
          <Textarea placeholder="Describe your issue..." value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} rows={4} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSupportOpen(false)} disabled={submittingTicket}>
            Cancel
          </Button>
          <Button onClick={handleSubmitTicket} disabled={submittingTicket || !supportSubject.trim() || !supportMessage.trim()}>
            {submittingTicket ? "Submitting..." : "Submit ticket"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
