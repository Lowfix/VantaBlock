// The in-memory "backend" behind the panel demo. Everything the recovered
// panel UI talks to (via demoFetch in ../demo/api.ts and the demo
// liveConsoleStore) reads and mutates this module-level state. Nothing is
// persisted anywhere — a reload starts the demo fresh, which is exactly the
// honesty contract the preview banner states.
//
// Design rule: state shapes here mirror what the OLD Express/Pterodactyl API
// returned (see the interfaces in each components/panel/*Tab.tsx), so the
// recovered UI runs unmodified. If a tab expects `{ backups: Backup[] }`,
// this store keeps exactly that Backup shape.

import { consoleLineGenerators, mockPlayerNames } from "../mock-data/console";
import { plans } from "../mock-data/plans";

// ---------------------------------------------------------------------------
// Types (aligned with the tabs' expectations)
// ---------------------------------------------------------------------------

export interface DemoBackup {
  uuid: string;
  name: string;
  bytes: number;
  created_at: string;
  completed_at: string | null;
  is_successful: boolean;
  is_locked: boolean;
}

export interface DemoDatabase {
  id: string;
  name: string;
  username: string;
  host: string;
  port: number;
  connectionsFrom: string;
  maxConnections: number;
  password: string | null;
}

export interface DemoAllocation {
  id: number;
  ip: string;
  ip_alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
}

export interface DemoSchedule {
  id: number;
  name: string;
  cron: { minute: string; hour: string; day_of_week: string; day_of_month: string };
  is_active: boolean;
  last_run_at: string | null;
  tasks: { id: number; action: string; payload: string }[];
}

export interface DemoSubuser {
  uuid: string;
  email: string;
  permissions: string[];
  created_at: string;
}

export interface DemoActivity {
  id: string;
  event: string;
  is_api: boolean;
  ip: string | null;
  description: string | null;
  timestamp: string;
}

export interface DemoStartupVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  server_value: string;
  is_editable: boolean;
}

export interface DemoInstalledPlugin {
  id: number;
  source: "modrinth";
  projectId: string;
  projectName: string;
  projectAuthor: string;
  versionId: string;
  versionName: string;
  fileName: string;
  enabled: boolean;
  updateAvailable: boolean;
}

export interface DemoFileNode {
  is_file: boolean;
  size: number;
  modified_at: string;
  mimetype: string;
  /** Text content for editable files; undefined for binaries/dirs. */
  content?: string;
  children?: Record<string, DemoFileNode>;
}

export interface DemoTicketMessage {
  id: number;
  author: "you" | "staff";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface DemoTicket {
  id: number;
  serverIdentifier: string | null;
  serverName: string | null;
  subject: string;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  messages: DemoTicketMessage[];
}

export type DemoStatus = "online" | "offline" | "starting" | "stopping";

export interface DemoServer {
  identifier: string;
  name: string;
  planId: string;
  serverType: string; // vanilla | paper | fabric | forge | neoforge
  version: string;
  status: DemoStatus;
  ramAllocated: number; // GB
  diskAllocated: number; // GB
  ramUsed: number; // GB
  cpuUsed: number; // %
  diskUsed: number; // GB
  startedAt: number | null;
  playersMax: number;
  onlinePlayers: string[];
  subdomain: string | null;
  port: number;
  billingStatus: "active" | "past_due" | "suspended";
  nextBillAt: string | null;
  gracePeriodEndsAt: string | null;
  files: Record<string, DemoFileNode>;
  backups: DemoBackup[];
  databases: DemoDatabase[];
  allocations: DemoAllocation[];
  schedules: DemoSchedule[];
  subusers: DemoSubuser[];
  activity: DemoActivity[];
  startupCommand: string;
  startupVariables: DemoStartupVariable[];
  installedPlugins: DemoInstalledPlugin[];
  consoleLines: string[];
  consoleListeners: Set<() => void>;
}

export interface DemoUserState {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatarInitials: string;
  hasPassword: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  memberSince: string;
  balance: number;
  nextInvoiceDate: string;
  nextInvoiceAmount: number;
  twoFactorEnabled: boolean;
  notificationPrefs: {
    serverAlerts: boolean;
    billingReminders: boolean;
    productUpdates: boolean;
    marketingEmails: boolean;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = () => new Date().toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
const timeStamp = () => new Date().toTimeString().slice(0, 8);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
let idCounter = 1000;
export const nextId = () => ++idCounter;
export const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });

function textFile(content: string, mimetype = "text/plain", agedDays = 3): DemoFileNode {
  return { is_file: true, size: content.length, modified_at: daysAgo(agedDays), mimetype, content };
}
function binFile(size: number, mimetype = "application/octet-stream", agedDays = 8): DemoFileNode {
  return { is_file: true, size, modified_at: daysAgo(agedDays), mimetype };
}
function dir(children: Record<string, DemoFileNode>, agedDays = 5): DemoFileNode {
  return { is_file: false, size: 0, modified_at: daysAgo(agedDays), mimetype: "inode/directory", children };
}

export function planLimits(planId: string) {
  const plan = plans.find((p) => p.id === planId) ?? plans[1];
  return {
    ram: plan.ram,
    disk: parseInt(plan.storage, 10) || 40,
    playersMax: parseInt(plan.players.replace(/[^0-9]/g, ""), 10) || 20,
  };
}

const SERVER_PROPERTIES = `#Minecraft server properties
motd=A Vantablock server
enable-command-block=false
gamemode=survival
difficulty=normal
max-players={MAX}
online-mode=true
pvp=true
spawn-protection=16
view-distance=10
simulation-distance=10
white-list=true
level-name=world
server-port=25565
`;

function makeFiles(serverName: string, playersMax: number, software: string): Record<string, DemoFileNode> {
  const ops = [{ name: "Kestrel_", level: 4 }];
  const whitelist = [{ name: "Kestrel_" }, { name: "wildberry_pie" }, { name: "GraniteFox" }];
  const banned: { name: string; reason: string }[] = [];
  const files: Record<string, DemoFileNode> = {
    "server.properties": textFile(SERVER_PROPERTIES.replace("{MAX}", String(playersMax)).replace("A Vantablock server", serverName)),
    "eula.txt": textFile("#By changing the setting below to TRUE you are indicating your agreement to the Minecraft EULA.\neula=true\n"),
    "ops.json": textFile(JSON.stringify(ops, null, 2), "application/json"),
    "whitelist.json": textFile(JSON.stringify(whitelist, null, 2), "application/json"),
    "banned-players.json": textFile(JSON.stringify(banned, null, 2), "application/json"),
    "server.jar": binFile(49_872_113, "application/java-archive", 20),
    world: dir({
      "level.dat": binFile(8_192, "application/octet-stream", 0),
      region: dir({ "r.0.0.mca": binFile(6_442_388, "application/octet-stream", 0), "r.0.-1.mca": binFile(4_120_003, "application/octet-stream", 0) }),
      playerdata: dir({}),
    }),
    logs: dir({ "latest.log": binFile(212_884, "text/plain", 0) }),
  };
  if (software === "paper") {
    files["bukkit.yml"] = textFile("settings:\n  allow-end: true\n  warn-on-overload: true\n", "text/yaml");
    files["spigot.yml"] = textFile("settings:\n  debug: false\n  save-user-cache-on-stop-only: false\n", "text/yaml");
    files["plugins"] = dir({
      "EssentialsX-2.20.1.jar": binFile(2_931_775, "application/java-archive", 12),
      "LuckPerms-5.4.128.jar": binFile(4_207_664, "application/java-archive", 12),
      "WorldEdit-7.3.6.jar": binFile(6_104_412, "application/java-archive", 12),
    });
  }
  if (software === "fabric" || software === "forge" || software === "neoforge") {
    files["mods"] = dir({});
  }
  return files;
}

const BASE_STARTUP_VARIABLES: DemoStartupVariable[] = [
  {
    name: "Server Jar File",
    description: "The name of the server jarfile to run the server with.",
    env_variable: "SERVER_JARFILE",
    default_value: "server.jar",
    server_value: "server.jar",
    is_editable: true,
  },
  {
    name: "Minecraft Version",
    description: "The version of Minecraft to install. Use \"latest\" to install the latest release.",
    env_variable: "MINECRAFT_VERSION",
    default_value: "latest",
    server_value: "1.21.4",
    is_editable: true,
  },
  {
    name: "Build Number",
    description: "The build to install. Use \"latest\" for the newest build of the chosen version.",
    env_variable: "BUILD_NUMBER",
    default_value: "latest",
    server_value: "latest",
    is_editable: true,
  },
];

function makeServer(opts: {
  identifier: string;
  name: string;
  planId: string;
  serverType: string;
  version: string;
  status: DemoStatus;
  subdomain: string | null;
  port: number;
  seededPlayers?: string[];
}): DemoServer {
  const limits = planLimits(opts.planId);
  const online = opts.status === "online";
  return {
    identifier: opts.identifier,
    name: opts.name,
    planId: opts.planId,
    serverType: opts.serverType,
    version: opts.version,
    status: opts.status,
    ramAllocated: limits.ram,
    diskAllocated: limits.disk,
    ramUsed: online ? +(limits.ram * rand(0.55, 0.8)).toFixed(1) : 0,
    cpuUsed: online ? Math.round(rand(20, 45)) : 0,
    diskUsed: +(limits.disk * rand(0.25, 0.4)).toFixed(1),
    startedAt: online ? Date.now() - 1000 * 60 * 60 * rand(3, 30) : null,
    playersMax: limits.playersMax,
    onlinePlayers: online ? (opts.seededPlayers ?? []) : [],
    subdomain: opts.subdomain,
    port: opts.port,
    billingStatus: "active",
    nextBillAt: daysFromNow(17),
    gracePeriodEndsAt: null,
    files: makeFiles(opts.name, limits.playersMax, opts.serverType),
    backups: [
      {
        uuid: uuid(),
        name: `auto-${new Date(Date.now() - 86400000).toISOString().slice(0, 10)}`,
        bytes: 1_284_772_413,
        created_at: daysAgo(1),
        completed_at: daysAgo(1),
        is_successful: true,
        is_locked: false,
      },
      {
        uuid: uuid(),
        name: "before-1.21.4-update",
        bytes: 1_119_004_882,
        created_at: daysAgo(6),
        completed_at: daysAgo(6),
        is_successful: true,
        is_locked: true,
      },
    ],
    databases: [
      {
        id: uuid(),
        name: `s_${opts.identifier.slice(0, 4)}_main`,
        username: `u_${opts.identifier.slice(0, 6)}`,
        host: "db.vantablock.net",
        port: 3306,
        connectionsFrom: "%",
        maxConnections: 10,
        password: null,
      },
    ],
    allocations: [
      { id: nextId(), ip: "45.132.240.18", ip_alias: opts.subdomain ? `${opts.subdomain}.vantablock.net` : null, port: opts.port, notes: null, is_default: true },
    ],
    schedules: [
      {
        id: nextId(),
        name: "Nightly restart",
        cron: { minute: "0", hour: "4", day_of_week: "*", day_of_month: "*" },
        is_active: true,
        last_run_at: new Date(new Date().setHours(4, 0, 12, 0) - (new Date().getHours() < 4 ? 86400000 : 0)).toISOString(),
        tasks: [
          { id: nextId(), action: "power", payload: "restart" },
          { id: nextId(), action: "backup", payload: "" },
        ],
      },
    ],
    subusers: [
      { uuid: uuid(), email: "wildberry@example.com", permissions: ["control.console", "control.start", "control.stop"], created_at: daysAgo(21) },
    ],
    activity: [
      { id: uuid(), event: "server:backup.complete", is_api: true, ip: null, description: "Nightly backup completed", timestamp: daysAgo(1) },
      { id: uuid(), event: "server:power.start", is_api: false, ip: "203.0.113.7", description: null, timestamp: daysAgo(2) },
      { id: uuid(), event: "auth:login", is_api: false, ip: "203.0.113.7", description: null, timestamp: daysAgo(2) },
    ],
    startupCommand: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}",
    startupVariables: BASE_STARTUP_VARIABLES.map((v) => ({ ...v, server_value: v.env_variable === "MINECRAFT_VERSION" ? opts.version : v.server_value })),
    installedPlugins:
      opts.serverType === "paper"
        ? [
            { id: nextId(), source: "modrinth", projectId: "essentialsx", projectName: "EssentialsX", projectAuthor: "EssentialsX Team", versionId: "v2201", versionName: "2.20.1", fileName: "EssentialsX-2.20.1.jar", enabled: true, updateAvailable: false },
            { id: nextId(), source: "modrinth", projectId: "luckperms", projectName: "LuckPerms", projectAuthor: "Luck", versionId: "v54128", versionName: "5.4.128", fileName: "LuckPerms-5.4.128.jar", enabled: true, updateAvailable: false },
            { id: nextId(), source: "modrinth", projectId: "worldedit", projectName: "WorldEdit", projectAuthor: "EngineHub", versionId: "v736", versionName: "7.3.6", fileName: "WorldEdit-7.3.6.jar", enabled: true, updateAvailable: true },
          ]
        : [],
    consoleLines: [],
    consoleListeners: new Set(),
  };
}

// ---------------------------------------------------------------------------
// The state itself
// ---------------------------------------------------------------------------

export const demoUser: DemoUserState = {
  firstName: "Kestrel",
  lastName: "Vale",
  username: "Kestrel_",
  email: "kestrel@example.com",
  avatarInitials: "KV",
  hasPassword: true,
  isAdmin: false,
  isOwner: false,
  memberSince: new Date(Date.now() - 94 * 86400000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  balance: 25.0,
  nextInvoiceDate: daysFromNow(17),
  nextInvoiceAmount: 0,
  twoFactorEnabled: false,
  notificationPrefs: { serverAlerts: true, billingReminders: true, productUpdates: true, marketingEmails: false },
};

export const demoServers: DemoServer[] = [
  makeServer({
    identifier: "3f9a21b7",
    name: "Emberfall SMP",
    planId: "grove",
    serverType: "paper",
    version: "1.21.4",
    status: "online",
    subdomain: "emberfall",
    port: 25565,
    seededPlayers: ["Kestrel_", "wildberry_pie", "GraniteFox"],
  }),
  makeServer({
    identifier: "8c4d55e0",
    name: "Skyblock Weekends",
    planId: "sapling",
    serverType: "fabric",
    version: "1.21.4",
    status: "offline",
    subdomain: "skyblock",
    port: 25567,
  }),
];

export const demoTickets: DemoTicket[] = [
  {
    id: nextId(),
    serverIdentifier: "3f9a21b7",
    serverName: "Emberfall SMP",
    subject: "Pre-generating the world for a new region?",
    status: "closed",
    createdAt: daysAgo(12),
    updatedAt: daysAgo(11),
    messages: [
      { id: nextId(), author: "you", authorName: "Kestrel_", body: "We're opening a new frontier — is it safe to pre-generate 10k blocks out with Chunky, or will that trip any limits?", createdAt: daysAgo(12) },
      { id: nextId(), author: "staff", authorName: "Vantablock Support", body: "Totally fine — Chunky at default throttle won't hit any limits on your plan. Kick it off overnight and the nightly backup will catch the new chunks too.", createdAt: daysAgo(11) },
    ],
  },
];

export const demoInvoices = [
  { id: "INV-2415", date: new Date(Date.now() - 4 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), description: "Grove plan — Emberfall SMP (friends phase)", amount: 0, status: "paid" as const },
  { id: "INV-2402", date: new Date(Date.now() - 4 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), description: "Sapling plan — Skyblock Weekends (friends phase)", amount: 0, status: "paid" as const },
  { id: "INV-2361", date: new Date(Date.now() - 34 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), description: "Grove plan — Emberfall SMP (friends phase)", amount: 0, status: "paid" as const },
  { id: "INV-2318", date: new Date(Date.now() - 41 * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), description: "Account credit", amount: -25, status: "paid" as const },
];

let nextPort = 25569;
const toSlug = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "server";

/** Create a brand-new server (the deploy flow) and boot it shortly after. */
export function deployServer(opts: {
  name: string;
  planId: string;
  serverTypeId: string;
  version: string;
  generateSubdomain: boolean;
}): DemoServer {
  const version = !opts.version || opts.version === "latest" ? "1.21.4" : opts.version;
  const server = makeServer({
    identifier: uuid().slice(0, 8),
    name: opts.name,
    planId: opts.planId,
    serverType: opts.serverTypeId,
    version,
    status: "offline",
    subdomain: opts.generateSubdomain ? toSlug(opts.name) : null,
    port: nextPort++,
  });
  // Fresh server: no history or extras seeded.
  server.backups = [];
  server.subusers = [];
  server.installedPlugins = [];
  server.activity = [{ id: uuid(), event: "server:install.start", is_api: true, ip: null, description: "Provisioning new server", timestamp: now() }];
  demoServers.push(server);
  pushConsole(server, info(`Installing ${opts.serverTypeId} ${version}...`));
  setTimeout(() => {
    logActivity(server, "server:install.complete", "Installation finished", true);
    powerAction(server, "start");
  }, 2500);
  return server;
}

export function findServer(identifier: string): DemoServer | undefined {
  return demoServers.find((s) => s.identifier === identifier);
}

export function logActivity(server: DemoServer, event: string, description: string | null = null, isApi = false) {
  server.activity.unshift({ id: uuid(), event, is_api: isApi, ip: isApi ? null : "203.0.113.7", description, timestamp: now() });
  server.activity = server.activity.slice(0, 50);
}

// ---------------------------------------------------------------------------
// Console + live engine
// ---------------------------------------------------------------------------

export function pushConsole(server: DemoServer, line: string) {
  server.consoleLines = [...server.consoleLines.slice(-500), line];
  server.consoleListeners.forEach((fn) => fn());
}

const info = (msg: string) => `[${timeStamp()} INFO]: ${msg}`;

const BOOT_LINES = (server: DemoServer): string[] => [
  `Starting minecraft server version ${server.version}`,
  "Loading properties",
  "Default game type: SURVIVAL",
  `Starting Minecraft server on *:${server.port}`,
  'Preparing level "world"',
  "Preparing start region for dimension minecraft:overworld",
  `Done (${rand(4, 9).toFixed(3)}s)! For help, type "help"`,
];

function randomPlayerNotOnline(server: DemoServer): string | null {
  const candidates = mockPlayerNames.filter((n) => !server.onlinePlayers.includes(n));
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** One shared heartbeat drives stat wobble + ambient console chatter. */
let engineStarted = false;
export function ensureEngine() {
  if (engineStarted) return;
  engineStarted = true;
  setInterval(() => {
    for (const server of demoServers) {
      if (server.status !== "online") continue;
      // Wobble the live stats around plausible values.
      const load = 0.15 + 0.5 * (server.onlinePlayers.length / Math.max(1, server.playersMax));
      server.cpuUsed = Math.max(3, Math.min(96, Math.round(server.cpuUsed + rand(-6, 6) + (load * 40 - server.cpuUsed) * 0.08)));
      const targetRam = server.ramAllocated * (0.45 + load * 0.4);
      server.ramUsed = +Math.max(0.4, Math.min(server.ramAllocated * 0.96, server.ramUsed + rand(-0.15, 0.15) + (targetRam - server.ramUsed) * 0.05)).toFixed(1);

      // Ambient console traffic.
      if (Math.random() < 0.3) {
        const template = consoleLineGenerators[Math.floor(Math.random() * consoleLineGenerators.length)];
        let player = server.onlinePlayers[Math.floor(Math.random() * server.onlinePlayers.length)];
        if (template.includes("joined the game")) {
          const joiner = randomPlayerNotOnline(server);
          if (!joiner || server.onlinePlayers.length >= server.playersMax) continue;
          server.onlinePlayers = [...server.onlinePlayers, joiner];
          player = joiner;
        } else if (template.includes("left the game") || template.includes("lost connection")) {
          if (server.onlinePlayers.length <= 1) continue; // keep the demo populated
          server.onlinePlayers = server.onlinePlayers.filter((n) => n !== player);
        } else if (!player) {
          continue;
        }
        // Generator strings carry their own "[{time} INFO]:" prefix already.
        pushConsole(server, template.replace("{time}", timeStamp()).replace("{player}", player ?? ""));
      }
    }
  }, 2500);
}

export function powerAction(server: DemoServer, action: "start" | "stop" | "restart" | "kill") {
  ensureEngine();
  if (action === "kill") {
    server.status = "offline";
    server.startedAt = null;
    server.onlinePlayers = [];
    server.cpuUsed = 0;
    server.ramUsed = 0;
    pushConsole(server, info("Server process killed"));
    logActivity(server, "server:power.kill");
    return;
  }

  if (action === "start") {
    if (server.status !== "offline") return;
    server.status = "starting";
    logActivity(server, "server:power.start");
    const boot = BOOT_LINES(server);
    boot.forEach((line, i) => setTimeout(() => pushConsole(server, info(line)), 350 * (i + 1)));
    setTimeout(() => {
      server.status = "online";
      server.startedAt = Date.now();
      server.cpuUsed = Math.round(rand(18, 35));
      server.ramUsed = +(server.ramAllocated * rand(0.4, 0.55)).toFixed(1);
      setTimeout(() => {
        if (server.status === "online" && !server.onlinePlayers.includes("Kestrel_")) {
          server.onlinePlayers = [...server.onlinePlayers, "Kestrel_"];
          pushConsole(server, info("Kestrel_ joined the game"));
        }
      }, 4000);
    }, 350 * boot.length + 500);
    return;
  }

  // stop / restart
  if (server.status !== "online") return;
  server.status = "stopping";
  logActivity(server, action === "restart" ? "server:power.restart" : "server:power.stop");
  pushConsole(server, info("Stopping the server"));
  pushConsole(server, info("Saving chunks for level 'ServerLevel[world]'/minecraft:overworld"));
  server.onlinePlayers = [];
  setTimeout(() => {
    pushConsole(server, info("ThreadedAnvilChunkStorage: All dimensions are saved"));
    server.status = "offline";
    server.startedAt = null;
    server.cpuUsed = 0;
    server.ramUsed = 0;
    if (action === "restart") {
      setTimeout(() => powerAction(server, "start"), 900);
    }
  }, 1800);
}

// ---------------------------------------------------------------------------
// Console commands (typed into the console, or sent by PlayersTab actions)
// ---------------------------------------------------------------------------

function readJson<T>(server: DemoServer, file: string): T[] {
  const node = server.files[file];
  if (!node?.content) return [];
  try {
    const parsed = JSON.parse(node.content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(server: DemoServer, file: string, value: unknown) {
  const content = JSON.stringify(value, null, 2);
  server.files[file] = { ...(server.files[file] ?? textFile("", "application/json")), is_file: true, content, size: content.length, modified_at: now(), mimetype: "application/json" };
}

export function handleCommand(server: DemoServer, rawCommand: string) {
  const command = rawCommand.trim().replace(/^\//, "");
  if (!command) return;
  pushConsole(server, info(`Kestrel_ issued server command: /${command}`));
  if (server.status !== "online") {
    pushConsole(server, info("Server is not running."));
    return;
  }
  const [verb, ...rest] = command.split(/\s+/);
  const arg = rest.join(" ");

  switch (verb.toLowerCase()) {
    case "help":
      pushConsole(server, info("Available demo commands: /list, /say <msg>, /tps, /whitelist add|remove <player>, /op <player>, /deop <player>, /kick <player>, /ban <player>, /pardon <player>, /stop"));
      break;
    case "list":
      pushConsole(server, info(`There are ${server.onlinePlayers.length} of a max of ${server.playersMax} players online: ${server.onlinePlayers.join(", ")}`));
      break;
    case "say":
      pushConsole(server, info(`[Server] ${arg || ""}`));
      break;
    case "tps":
      pushConsole(server, info("TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0"));
      break;
    case "stop":
      powerAction(server, "stop");
      break;
    case "whitelist": {
      const [sub, player] = rest;
      const list = readJson<{ name: string }>(server, "whitelist.json");
      if (sub === "add" && player) {
        if (!list.some((e) => e.name === player)) writeJson(server, "whitelist.json", [...list, { name: player }]);
        pushConsole(server, info(`Added ${player} to the whitelist`));
      } else if (sub === "remove" && player) {
        writeJson(server, "whitelist.json", list.filter((e) => e.name !== player));
        pushConsole(server, info(`Removed ${player} from the whitelist`));
      } else if (sub === "list") {
        pushConsole(server, info(`There are ${list.length} whitelisted players: ${list.map((e) => e.name).join(", ")}`));
      } else {
        pushConsole(server, info("Usage: /whitelist add|remove|list"));
      }
      break;
    }
    case "op": {
      const ops = readJson<{ name: string; level: number }>(server, "ops.json");
      if (arg && !ops.some((e) => e.name === arg)) writeJson(server, "ops.json", [...ops, { name: arg, level: 4 }]);
      pushConsole(server, info(arg ? `Made ${arg} a server operator` : "Usage: /op <player>"));
      break;
    }
    case "deop": {
      const ops = readJson<{ name: string; level: number }>(server, "ops.json");
      writeJson(server, "ops.json", ops.filter((e) => e.name !== arg));
      pushConsole(server, info(arg ? `Made ${arg} no longer a server operator` : "Usage: /deop <player>"));
      break;
    }
    case "kick":
      if (arg && server.onlinePlayers.includes(arg)) {
        server.onlinePlayers = server.onlinePlayers.filter((n) => n !== arg);
        pushConsole(server, info(`Kicked ${arg}: Kicked by an operator`));
      } else {
        pushConsole(server, info("No player was found"));
      }
      break;
    case "ban": {
      const banned = readJson<{ name: string; reason: string }>(server, "banned-players.json");
      if (arg) {
        if (!banned.some((e) => e.name === arg)) writeJson(server, "banned-players.json", [...banned, { name: arg, reason: "Banned by an operator" }]);
        server.onlinePlayers = server.onlinePlayers.filter((n) => n !== arg);
        pushConsole(server, info(`Banned ${arg}: Banned by an operator`));
      }
      break;
    }
    case "pardon": {
      const banned = readJson<{ name: string; reason: string }>(server, "banned-players.json");
      writeJson(server, "banned-players.json", banned.filter((e) => e.name !== arg));
      pushConsole(server, info(arg ? `Unbanned ${arg}` : "Usage: /pardon <player>"));
      break;
    }
    default:
      pushConsole(server, info(`Unknown or incomplete command, see below for error`));
      pushConsole(server, info(`${verb}<--[HERE]`));
  }
}

// ---------------------------------------------------------------------------
// Files helpers used by the API layer
// ---------------------------------------------------------------------------

/** Resolve a directory node from a "/foo/bar" path; null if missing. */
export function resolveDir(server: DemoServer, dirPath: string): Record<string, DemoFileNode> | null {
  const parts = dirPath.split("/").filter(Boolean);
  let current: Record<string, DemoFileNode> = server.files;
  for (const part of parts) {
    const node = current[part];
    if (!node || node.is_file || !node.children) return null;
    current = node.children;
  }
  return current;
}

export function resolveFile(server: DemoServer, filePath: string): { parent: Record<string, DemoFileNode>; name: string; node: DemoFileNode } | null {
  const parts = filePath.split("/").filter(Boolean);
  const name = parts.pop();
  if (!name) return null;
  const parent = resolveDir(server, parts.join("/"));
  if (!parent || !parent[name]) return null;
  return { parent, name, node: parent[name] };
}
