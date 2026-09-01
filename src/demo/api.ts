// demoFetch — a drop-in stand-in for fetch() that serves the panel demo from
// the in-memory store instead of the network. The route surface and response
// shapes mirror the OLD Express backend exactly (each recovered
// components/panel/*Tab.tsx documents what it expects), which is what lets the
// recovered panel UI run unmodified. Returns real Response objects so
// res.ok/res.status/res.json() all behave.

import {
  demoUser,
  demoServers,
  demoTickets,
  demoInvoices,
  findServer,
  deployServer,
  powerAction,
  handleCommand,
  ensureEngine,
  planLimits,
  logActivity,
  pushConsole,
  resolveDir,
  resolveFile,
  nextId,
  uuid,
  type DemoServer,
  type DemoFileNode,
  type DemoTicket,
} from "./store";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const noContent = () => new Response(null, { status: 204 });
const errRes = (error: string, status = 400) => json({ error }, status);
const notFound = () => json({ error: "Not found." }, 404);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();
const timeStamp = () => new Date().toTimeString().slice(0, 8);
const info = (msg: string) => `[${timeStamp()} INFO]: ${msg}`;

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length: 18 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function userPayload() {
  return { ...demoUser, avatarUrl: undefined };
}

function toMyServer(s: DemoServer) {
  // Console/stats report full detail; the list endpoint's status vocabulary
  // has no "restarting", matching the old MyPterodactylServer type.
  return {
    identifier: s.identifier,
    name: s.name,
    ramAllocated: s.ramAllocated,
    diskAllocated: s.diskAllocated,
    planId: s.planId,
    serverType: s.serverType,
    status: s.status,
    cpuUsed: s.cpuUsed,
    ramUsed: s.ramUsed,
    diskUsed: s.diskUsed,
    billingStatus: s.billingStatus,
    nextBillAt: s.nextBillAt,
    gracePeriodEndsAt: s.gracePeriodEndsAt,
  };
}

const SERVER_IP = "45.132.240.18";
const ROOT_DOMAIN = "vantablock.net";

function subdomainState(s: DemoServer) {
  return {
    subdomain: s.subdomain,
    rootDomain: ROOT_DOMAIN,
    configured: !!s.subdomain,
    relayed: !!s.subdomain,
    forwarding: s.subdomain ? { port: s.port, targetIp: SERVER_IP } : null,
  };
}

// A small Modrinth-flavored plugin catalog for the search flow.
const PLUGIN_CATALOG = [
  { source: "modrinth" as const, projectId: "chunky", name: "Chunky", author: "pop4959", description: "Pre-generates chunks, quickly and efficiently.", downloads: 1_804_211 },
  { source: "modrinth" as const, projectId: "coreprotect", name: "CoreProtect", author: "Intelli", description: "Fast, efficient block logging, rollbacks and restores.", downloads: 1_122_874 },
  { source: "modrinth" as const, projectId: "viaversion", name: "ViaVersion", author: "ViaVersion", description: "Allow newer clients to join older server versions.", downloads: 3_390_040 },
  { source: "modrinth" as const, projectId: "vault", name: "Vault", author: "MilkBowl", description: "Permissions, chat & economy API to give plugins easy hooks.", downloads: 2_251_930 },
  { source: "modrinth" as const, projectId: "geyser", name: "Geyser", author: "GeyserMC", description: "Lets Bedrock players join your Java server.", downloads: 2_884_119 },
  { source: "modrinth" as const, projectId: "simple-voice-chat", name: "Simple Voice Chat", author: "henkelmax", description: "Proximity voice chat for your server.", downloads: 1_540_302 },
  { source: "modrinth" as const, projectId: "worldguard", name: "WorldGuard", author: "EngineHub", description: "Guard areas of the world against players and disasters.", downloads: 1_923_557 },
  { source: "modrinth" as const, projectId: "tab", name: "TAB", author: "NEZNAMY", description: "All-in-one tablist, nametag and scoreboard plugin.", downloads: 998_416 },
  { source: "modrinth" as const, projectId: "essentialsx", name: "EssentialsX", author: "EssentialsX Team", description: "The essential plugin suite for Minecraft servers.", downloads: 5_204_774 },
  { source: "modrinth" as const, projectId: "luckperms", name: "LuckPerms", author: "Luck", description: "A permissions plugin for Minecraft servers.", downloads: 4_871_002 },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Administrator: ["control.console", "control.start", "control.stop", "control.restart", "file.read", "file.write", "backup.create", "backup.delete", "user.create", "user.delete", "settings.rename"],
  Support: ["control.console", "control.start", "control.stop", "control.restart", "file.read"],
  Viewer: ["control.console", "websocket.connect"],
};

function stripTicket(t: DemoTicket) {
  const { messages: _messages, ...rest } = t;
  return rest;
}

function scheduleStaffReply(ticket: DemoTicket) {
  setTimeout(() => {
    if (ticket.status === "closed") return;
    ticket.messages.push({
      id: nextId(),
      author: "staff",
      authorName: "Vantablock Support",
      body: "Thanks for the message! You're in the panel demo, so this reply is automated — but once accounts are live, a real person answers here, usually within a few hours.",
      createdAt: nowIso(),
    });
    ticket.updatedAt = nowIso();
  }, 6000 + Math.random() * 3000);
}

async function parseBody(init?: RequestInit): Promise<Record<string, unknown>> {
  const body = init?.body;
  if (!body || typeof body !== "string") return {};
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function demoFetch(input: string, init?: RequestInit): Promise<Response> {
  ensureEngine();
  await sleep(90 + Math.random() * 160); // a hint of network latency, for realism
  const url = new URL(input, "http://demo.local");
  const path = url.pathname;
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body instanceof FormData ? {} : await parseBody(init);

  // ---- auth/account --------------------------------------------------------
  if (path === "/api/auth/me" && method === "GET") return json(userPayload());
  if ((path === "/api/auth/login" || path === "/api/auth/register" || path === "/api/auth/google") && method === "POST") return json(userPayload());
  if (path === "/api/auth/logout" && method === "POST") return noContent();
  if (path === "/api/account/profile" && method === "PATCH") {
    for (const key of ["firstName", "lastName", "username", "email"] as const) {
      const value = body[key];
      if (typeof value === "string" && value.trim()) demoUser[key] = value.trim();
    }
    demoUser.avatarInitials = `${demoUser.firstName[0] ?? "K"}${demoUser.lastName[0] ?? "V"}`.toUpperCase();
    return json(userPayload());
  }
  if (path === "/api/account/settings" && method === "PATCH") {
    if (typeof body.twoFactorEnabled === "boolean") demoUser.twoFactorEnabled = body.twoFactorEnabled;
    if (body.notificationPrefs && typeof body.notificationPrefs === "object") {
      demoUser.notificationPrefs = { ...demoUser.notificationPrefs, ...(body.notificationPrefs as Partial<typeof demoUser.notificationPrefs>) };
    }
    return json(userPayload());
  }
  if (path === "/api/account/password" && method === "POST") return noContent();
  if (path === "/api/account" && method === "DELETE") return errRes("Account deletion is disabled in the demo — this is sample data shared with the tour.", 400);
  if (path === "/api/account/invoices" && method === "GET") return json(demoInvoices);
  if (path === "/api/requests/mine" && method === "GET") return json([]);
  if (path === "/api/billing/demo-topup" && method === "POST") {
    const amount = Number(body.amount) || 0;
    if (amount <= 0) return errRes("Enter an amount greater than $0.");
    demoUser.balance = +(demoUser.balance + amount).toFixed(2);
    demoInvoices.unshift({
      id: `INV-${2400 + Math.floor(Math.random() * 90)}`,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      description: "Account credit (demo top-up)",
      amount: -amount,
      status: "paid",
    });
    return json(userPayload());
  }

  // ---- support -------------------------------------------------------------
  if (path === "/api/support/tickets/mine" && method === "GET") {
    return json([...demoTickets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(stripTicket));
  }
  if (path === "/api/support/tickets" && method === "POST") {
    const ticket: DemoTicket = {
      id: nextId(),
      serverIdentifier: typeof body.serverIdentifier === "string" ? body.serverIdentifier : null,
      serverName: typeof body.serverName === "string" ? body.serverName : null,
      subject: String(body.subject ?? "(no subject)"),
      status: "open",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: [{ id: nextId(), author: "you", authorName: demoUser.username, body: String(body.message ?? ""), createdAt: nowIso() }],
    };
    demoTickets.push(ticket);
    scheduleStaffReply(ticket);
    return json({ id: ticket.id });
  }
  const ticketMatch = path.match(/^\/api\/support\/tickets\/(\d+)(?:\/([a-z-]+))?$/);
  if (ticketMatch) {
    const ticket = demoTickets.find((t) => t.id === Number(ticketMatch[1]));
    if (!ticket) return notFound();
    const action = ticketMatch[2];
    if (!action && method === "GET") {
      return json({
        ticket: { ...stripTicket(ticket), username: demoUser.username, email: demoUser.email },
        messages: ticket.messages.map((m) => ({
          id: m.id,
          isOwner: m.author === "staff",
          body: m.body,
          createdAt: m.createdAt,
          username: m.authorName,
        })),
      });
    }
    if (action === "reply" && method === "POST") {
      ticket.messages.push({ id: nextId(), author: "you", authorName: demoUser.username, body: String(body.message ?? ""), createdAt: nowIso() });
      ticket.updatedAt = nowIso();
      if (ticket.status === "closed") ticket.status = "open";
      scheduleStaffReply(ticket);
      return noContent();
    }
    if ((action === "close" || action === "resolve") && method === "POST") {
      ticket.status = "closed";
      ticket.updatedAt = nowIso();
      return noContent();
    }
    if ((action === "reopen" || action === "open") && method === "POST") {
      ticket.status = "open";
      ticket.updatedAt = nowIso();
      return noContent();
    }
  }

  // ---- servers -------------------------------------------------------------
  if (path === "/api/servers" && method === "GET") return json(demoServers.map(toMyServer));
  if (path === "/api/servers" && method === "POST") {
    const name = String(body.name ?? "").trim();
    if (!name) return errRes("Give your server a name.");
    if (demoServers.length >= 6) return errRes("Server limit reached for the demo — delete one first.");
    deployServer({
      name,
      planId: typeof body.planId === "string" ? body.planId : "sapling",
      serverTypeId: typeof body.serverTypeId === "string" ? body.serverTypeId : "paper",
      version: typeof body.version === "string" ? body.version : "latest",
      generateSubdomain: body.generateSubdomain !== false,
    });
    return json({ status: "deploying" });
  }

  const serverMatch = path.match(/^\/api\/servers\/([a-z0-9-]+)(?:\/(.*))?$/);
  if (!serverMatch) return notFound();
  const server = findServer(serverMatch[1]);
  if (!server) return notFound();
  const rest = serverMatch[2] ?? "";

  // -- core
  if (rest === "" && method === "GET") {
    return json({
      identifier: server.identifier,
      status: server.status,
      cpuUsed: server.cpuUsed,
      ramUsed: server.ramUsed,
      diskUsed: server.diskUsed,
      uptimeMs: server.startedAt ? Date.now() - server.startedAt : 0,
      ip: SERVER_IP,
      port: server.port,
      playersOnline: server.onlinePlayers.length,
      playersMax: server.playersMax,
      playerNames: server.onlinePlayers,
      billingStatus: server.billingStatus,
      nextBillAt: server.nextBillAt,
      gracePeriodEndsAt: server.gracePeriodEndsAt,
    });
  }
  if (rest === "" && method === "DELETE") {
    demoServers.splice(demoServers.indexOf(server), 1);
    return noContent();
  }
  if (rest === "power" && method === "POST") {
    const action = String(body.action ?? "");
    if (action === "start" || action === "stop" || action === "restart" || action === "kill") {
      powerAction(server, action);
      return noContent();
    }
    return errRes("Unknown power action.");
  }
  if (rest === "command" && method === "POST") {
    handleCommand(server, String(body.command ?? ""));
    return noContent();
  }
  if (rest === "plan" && method === "PATCH") {
    const planId = String(body.planId ?? "");
    const limits = planLimits(planId);
    server.planId = planId;
    server.ramAllocated = limits.ram;
    server.diskAllocated = limits.disk;
    server.playersMax = limits.playersMax;
    logActivity(server, "server:plan.change", `Plan changed to ${planId}`);
    return json({});
  }
  if (rest === "settings/rename" && method === "POST") {
    const name = String(body.name ?? "").trim();
    if (!name) return errRes("Name can't be empty.");
    server.name = name;
    logActivity(server, "server:settings.rename", `Renamed to ${name}`);
    return json({});
  }
  if (rest === "settings/reinstall" && method === "POST") {
    logActivity(server, "server:install.start", "Reinstall started");
    powerAction(server, "kill");
    pushConsole(server, info("Reinstalling server — resetting to the egg's default files..."));
    setTimeout(() => {
      logActivity(server, "server:install.complete", "Reinstall finished", true);
      powerAction(server, "start");
    }, 3500);
    return json({});
  }

  // -- subdomain
  if (rest === "subdomain" && method === "GET") return json(subdomainState(server));
  if (rest === "subdomain" && method === "PUT") {
    const sub = String(body.subdomain ?? "").toLowerCase().trim();
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(sub)) return errRes("Subdomains are 3-32 characters: letters, numbers, and dashes.");
    if (demoServers.some((s) => s !== server && s.subdomain === sub)) return errRes("That subdomain is already taken.");
    server.subdomain = sub;
    server.allocations.forEach((a) => { if (a.is_default) a.ip_alias = `${sub}.${ROOT_DOMAIN}`; });
    logActivity(server, "server:subdomain.update", `${sub}.${ROOT_DOMAIN}`);
    return json(subdomainState(server));
  }
  if (rest === "subdomain" && method === "DELETE") {
    server.subdomain = null;
    server.allocations.forEach((a) => { a.ip_alias = null; });
    logActivity(server, "server:subdomain.delete");
    return noContent();
  }

  // -- backups
  if (rest === "backups" && method === "GET") return json({ backups: server.backups });
  if (rest === "backups" && method === "POST") {
    const backup = {
      uuid: uuid(),
      name: String(body.name ?? "").trim() || `manual-${new Date().toISOString().slice(0, 10)}`,
      bytes: 0,
      created_at: nowIso(),
      completed_at: null as string | null,
      is_successful: false,
      is_locked: false,
    };
    server.backups.unshift(backup);
    logActivity(server, "server:backup.start", backup.name);
    setTimeout(() => {
      backup.bytes = Math.round(900_000_000 + Math.random() * 500_000_000);
      backup.completed_at = nowIso();
      backup.is_successful = true;
      logActivity(server, "server:backup.complete", backup.name, true);
      if (server.status === "online") pushConsole(server, info(`Backup "${backup.name}" complete (${(backup.bytes / 1e9).toFixed(1)} GB)`));
    }, 2600);
    return json({ backup });
  }
  const backupMatch = rest.match(/^backups\/([a-f0-9-]+)(?:\/([a-z]+))?$/);
  if (backupMatch) {
    const backup = server.backups.find((b) => b.uuid === backupMatch[1]);
    if (!backup) return notFound();
    const sub = backupMatch[2];
    if (sub === "restore" && method === "POST") {
      logActivity(server, "server:backup.restore", backup.name);
      if (server.status === "online") pushConsole(server, info(`Restoring backup "${backup.name}"...`));
      return noContent();
    }
    if (sub === "lock" && method === "POST") {
      backup.is_locked = !backup.is_locked;
      return noContent();
    }
    if (sub === "download" && method === "GET") return errRes("Backup downloads are turned off in this demo.");
    if (!sub && method === "DELETE") {
      if (backup.is_locked) return errRes("This backup is locked — unlock it first.");
      server.backups = server.backups.filter((b) => b !== backup);
      logActivity(server, "server:backup.delete", backup.name);
      return noContent();
    }
  }

  // -- databases
  if (rest === "databases" && method === "GET") return json({ databases: server.databases });
  if (rest === "databases" && method === "POST") {
    if (server.databases.length >= 2) return errRes("Database limit reached for your plan.");
    const name = String(body.name ?? "db").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24) || "db";
    const db = {
      id: uuid(),
      name: `s_${server.identifier.slice(0, 4)}_${name}`,
      username: `u_${uuid().slice(0, 8)}`,
      host: "db.vantablock.net",
      port: 3306,
      connectionsFrom: "%",
      maxConnections: 10,
      password: genPassword(),
    };
    server.databases.push(db);
    logActivity(server, "server:database.create", db.name);
    return json(db);
  }
  const dbMatch = rest.match(/^databases\/([a-f0-9-]+)(?:\/([a-z-]+))?$/);
  if (dbMatch) {
    const db = server.databases.find((d) => d.id === dbMatch[1]);
    if (!db) return notFound();
    if (dbMatch[2] === "rotate-password" && method === "POST") {
      db.password = genPassword();
      return json(db);
    }
    if (!dbMatch[2] && method === "DELETE") {
      server.databases = server.databases.filter((d) => d !== db);
      logActivity(server, "server:database.delete", db.name);
      return noContent();
    }
  }

  // -- files
  if (rest === "files" && method === "GET") {
    const directory = url.searchParams.get("directory") ?? "/";
    const dirNode = resolveDir(server, directory);
    if (!dirNode) return notFound();
    const files = Object.entries(dirNode).map(([name, node]) => ({
      name,
      is_file: node.is_file,
      size: node.size,
      modified_at: node.modified_at,
      mimetype: node.mimetype,
    }));
    return json({ files });
  }
  if (rest === "files/contents" && method === "GET") {
    const file = url.searchParams.get("file") ?? "";
    const found = resolveFile(server, file);
    if (!found) return notFound();
    if (found.node.content === undefined) return errRes("This file isn't editable as text.");
    return json({ content: found.node.content });
  }
  if (rest === "files/contents" && method === "PUT") {
    const filePath = String(body.file ?? "");
    const content = String(body.content ?? "");
    const found = resolveFile(server, filePath);
    if (found) {
      found.parent[found.name] = { ...found.node, content, size: content.length, modified_at: nowIso() };
    } else {
      const parts = filePath.split("/").filter(Boolean);
      const name = parts.pop()!;
      const parent = resolveDir(server, parts.join("/"));
      if (!parent) return notFound();
      parent[name] = { is_file: true, size: content.length, modified_at: nowIso(), mimetype: "text/plain", content };
    }
    logActivity(server, "server:file.write", filePath);
    return noContent();
  }
  if (rest === "files/rename" && method === "PUT") {
    const dirNode = resolveDir(server, String(body.root ?? "/"));
    const from = String(body.from ?? "");
    const to = String(body.to ?? "");
    if (!dirNode || !dirNode[from]) return notFound();
    if (dirNode[to]) return errRes("Something with that name already exists here.");
    dirNode[to] = dirNode[from];
    delete dirNode[from];
    logActivity(server, "server:file.rename", `${from} → ${to}`);
    return noContent();
  }
  if (rest === "files/delete" && method === "POST") {
    const dirNode = resolveDir(server, String(body.root ?? "/"));
    if (!dirNode) return notFound();
    for (const name of (body.files as string[]) ?? []) delete dirNode[name];
    logActivity(server, "server:file.delete", ((body.files as string[]) ?? []).join(", "));
    return noContent();
  }
  if (rest === "files/folder" && method === "POST") {
    const dirNode = resolveDir(server, String(body.root ?? "/"));
    const name = String(body.name ?? "").trim();
    if (!dirNode) return notFound();
    if (!name) return errRes("Folder name can't be empty.");
    if (dirNode[name]) return errRes("Something with that name already exists here.");
    dirNode[name] = { is_file: false, size: 0, modified_at: nowIso(), mimetype: "inode/directory", children: {} };
    return noContent();
  }
  if (rest === "files/upload" && method === "POST") {
    const form = init?.body;
    if (!(form instanceof FormData)) return errRes("Nothing to upload.");
    const file = form.get("file");
    const directory = String(form.get("directory") ?? "/");
    if (!(file instanceof File)) return errRes("Nothing to upload.");
    const dirNode = resolveDir(server, directory);
    if (!dirNode) return notFound();
    const isText = file.type.startsWith("text/") || file.type.includes("json") || file.type.includes("yaml") || file.type === "";
    const node: DemoFileNode = {
      is_file: true,
      size: file.size,
      modified_at: nowIso(),
      mimetype: file.type || "text/plain",
    };
    if (isText && file.size < 200_000) node.content = await file.text();
    dirNode[file.name] = node;
    logActivity(server, "server:file.upload", file.name);
    return noContent();
  }

  // -- plugins
  if (rest === "plugins" && method === "GET") {
    return json({ supported: server.serverType === "paper", featureEnabled: true, installed: server.installedPlugins, unmanaged: [] });
  }
  if (rest === "plugins/search" && method === "GET") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const results = PLUGIN_CATALOG.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    return json({ results });
  }
  const versionsMatch = rest.match(/^plugins\/modrinth\/([^/]+)\/versions$/);
  if (versionsMatch && method === "GET") {
    const base = 3 + Math.floor(Math.random() * 4);
    return json({
      versions: [
        { versionId: `${versionsMatch[1]}-v${base}20`, versionName: `${base}.2.0`, gameVersions: ["1.21.4", "1.21.3"] },
        { versionId: `${versionsMatch[1]}-v${base}11`, versionName: `${base}.1.1`, gameVersions: ["1.21.1", "1.20.6"] },
        { versionId: `${versionsMatch[1]}-v${base}04`, versionName: `${base}.0.4`, gameVersions: ["1.20.4"] },
      ],
    });
  }
  if (rest === "plugins/install" && method === "POST") {
    const projectId = String(body.projectId ?? "");
    if (server.installedPlugins.some((p) => p.projectId === projectId)) return errRes("That plugin is already installed.");
    const projectName = String(body.projectName ?? projectId);
    const versionName = String(body.versionName ?? "1.0.0");
    const fileName = `${projectName.replace(/\s+/g, "")}-${versionName}.jar`;
    server.installedPlugins.push({
      id: nextId(),
      source: "modrinth",
      projectId,
      projectName,
      projectAuthor: String(body.projectAuthor ?? "unknown"),
      versionId: String(body.versionId ?? "v1"),
      versionName,
      fileName,
      enabled: true,
      updateAvailable: false,
    });
    const plugins = server.files["plugins"];
    if (plugins?.children) plugins.children[fileName] = { is_file: true, size: Math.round(1_000_000 + Math.random() * 4_000_000), modified_at: nowIso(), mimetype: "application/java-archive" };
    logActivity(server, "server:plugin.install", projectName);
    if (server.status === "online") pushConsole(server, info(`Downloaded ${fileName} — restart to load it`));
    return json({});
  }
  if (rest === "plugins/unmanaged" && method === "DELETE") return noContent();
  const pluginMatch = rest.match(/^plugins\/(\d+)(?:\/([a-z]+))?$/);
  if (pluginMatch) {
    const plugin = server.installedPlugins.find((p) => p.id === Number(pluginMatch[1]));
    if (!plugin) return notFound();
    if (!pluginMatch[2] && method === "DELETE") {
      server.installedPlugins = server.installedPlugins.filter((p) => p !== plugin);
      const plugins = server.files["plugins"];
      if (plugins?.children) delete plugins.children[plugin.fileName];
      logActivity(server, "server:plugin.uninstall", plugin.projectName);
      return noContent();
    }
    if (pluginMatch[2] === "update" && method === "POST") {
      plugin.versionId = String(body.versionId ?? plugin.versionId);
      plugin.versionName = String(body.versionName ?? plugin.versionName);
      plugin.updateAvailable = false;
      return json({});
    }
    if (pluginMatch[2] === "toggle" && method === "POST") {
      plugin.enabled = !plugin.enabled;
      return json({});
    }
  }

  // -- network
  if (rest === "network/allocations" && method === "GET") return json({ allocations: server.allocations });
  if (rest === "network/allocations" && method === "POST") {
    if (server.allocations.length >= 3) return errRes("Allocation limit reached for your plan.");
    server.allocations.push({ id: nextId(), ip: SERVER_IP, ip_alias: null, port: 25700 + Math.floor(Math.random() * 200), notes: null, is_default: false });
    return json({});
  }
  const allocMatch = rest.match(/^network\/allocations\/(\d+)(?:\/([a-z]+))?$/);
  if (allocMatch) {
    const alloc = server.allocations.find((a) => a.id === Number(allocMatch[1]));
    if (!alloc) return notFound();
    if (allocMatch[2] === "primary" && method === "POST") {
      server.allocations.forEach((a) => { a.is_default = a === alloc; });
      return noContent();
    }
    if (!allocMatch[2] && method === "DELETE") {
      if (alloc.is_default) return errRes("You can't delete the primary allocation.");
      server.allocations = server.allocations.filter((a) => a !== alloc);
      return noContent();
    }
  }

  // -- startup
  if (rest === "startup" && method === "GET") return json({ startupCommand: server.startupCommand, variables: server.startupVariables });
  if (rest === "startup/variable" && method === "PUT") {
    const variable = server.startupVariables.find((v) => v.env_variable === body.key);
    if (!variable) return notFound();
    variable.server_value = String(body.value ?? "");
    logActivity(server, "server:startup.update", String(body.key));
    return json({});
  }

  // -- schedules
  if (rest === "schedules" && method === "GET") return json({ schedules: server.schedules });
  if (rest === "schedules" && method === "POST") {
    const schedule = {
      id: nextId(),
      name: String(body.name ?? "New schedule"),
      cron: {
        minute: String(body.minute ?? "0"),
        hour: String(body.hour ?? "0"),
        day_of_week: String(body.day_of_week ?? "*"),
        day_of_month: String(body.day_of_month ?? "*"),
      },
      is_active: body.is_active !== false,
      last_run_at: null,
      tasks: [] as { id: number; action: string; payload: string }[],
    };
    server.schedules.push(schedule);
    return json({ schedule });
  }
  const scheduleMatch = rest.match(/^schedules\/(\d+)(?:\/([a-z]+))?$/);
  if (scheduleMatch) {
    const schedule = server.schedules.find((s) => s.id === Number(scheduleMatch[1]));
    if (!schedule) return notFound();
    const sub = scheduleMatch[2];
    if (!sub && method === "PATCH") {
      if (typeof body.name === "string") schedule.name = body.name;
      schedule.cron = {
        minute: String(body.minute ?? schedule.cron.minute),
        hour: String(body.hour ?? schedule.cron.hour),
        day_of_week: String(body.day_of_week ?? schedule.cron.day_of_week),
        day_of_month: String(body.day_of_month ?? schedule.cron.day_of_month),
      };
      if (typeof body.is_active === "boolean") schedule.is_active = body.is_active;
      return json({});
    }
    if (!sub && method === "DELETE") {
      server.schedules = server.schedules.filter((s) => s !== schedule);
      return noContent();
    }
    if (sub === "tasks" && method === "POST") {
      schedule.tasks.push({ id: nextId(), action: String(body.action ?? "command"), payload: String(body.payload ?? "") });
      return json({});
    }
    if (sub === "execute" && method === "POST") {
      schedule.last_run_at = nowIso();
      for (const task of schedule.tasks) {
        if (task.action === "power" && ["start", "stop", "restart", "kill"].includes(task.payload)) {
          powerAction(server, task.payload as "start" | "stop" | "restart" | "kill");
        } else if (task.action === "backup") {
          await demoFetch(`/api/servers/${server.identifier}/backups`, { method: "POST", body: JSON.stringify({ name: `schedule-${schedule.name.toLowerCase().replace(/\s+/g, "-")}` }) });
        } else if (task.action === "command") {
          handleCommand(server, task.payload);
        }
      }
      logActivity(server, "server:schedule.execute", schedule.name, true);
      return noContent();
    }
  }

  // -- subusers
  if (rest === "users" && method === "GET") return json({ users: server.subusers });
  if (rest === "users" && method === "POST") {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email.includes("@")) return errRes("Enter a valid email address.");
    if (server.subusers.some((u) => u.email === email)) return errRes("That user already has access.");
    server.subusers.push({ uuid: uuid(), email, permissions: ROLE_PERMISSIONS[String(body.role ?? "Viewer")] ?? ROLE_PERMISSIONS.Viewer, created_at: nowIso() });
    logActivity(server, "server:subuser.create", email);
    return json({});
  }
  const subuserMatch = rest.match(/^users\/([a-f0-9-]+)$/);
  if (subuserMatch && method === "DELETE") {
    server.subusers = server.subusers.filter((u) => u.uuid !== subuserMatch[1]);
    logActivity(server, "server:subuser.delete");
    return noContent();
  }

  // -- activity
  if (rest === "activity" && method === "GET") return json({ activity: server.activity });

  return notFound();
}
