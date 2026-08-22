import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

const RELAY_HOST = process.env.RELAY_HOST || "";
const RELAY_SSH_USER = process.env.RELAY_SSH_USER || "ubuntu";
const RELAY_SSH_KEY_PATH = process.env.RELAY_SSH_KEY_PATH || "";

const HAPROXY_CFG_PATH = "/etc/haproxy/haproxy.cfg";
const REMOTE_STAGED_PATH = "/tmp/haproxy-vantablock-next.cfg";
const MANAGED_START = "# --- VANTABLOCK MANAGED SECTION START ---";
const MANAGED_END = "# --- VANTABLOCK MANAGED SECTION END ---";

export function isRelayConfigured(): boolean {
  return Boolean(RELAY_HOST && RELAY_SSH_KEY_PATH);
}

/** The relay's own public IP — what a relayed server's DNS should point at. */
export function getRelayPublicIp(): string | null {
  return isRelayConfigured() ? RELAY_HOST : null;
}

function sshArgs(command: string[]): string[] {
  return [
    "-i",
    RELAY_SSH_KEY_PATH,
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=8",
    "-o",
    "BatchMode=yes",
    `${RELAY_SSH_USER}@${RELAY_HOST}`,
    ...command,
  ];
}

async function ssh(command: string[]): Promise<string> {
  const { stdout } = await execFileAsync("ssh", sshArgs(command));
  return stdout;
}

async function scpUp(localPath: string, remotePath: string): Promise<void> {
  await execFileAsync("scp", [
    "-i",
    RELAY_SSH_KEY_PATH,
    "-o",
    "StrictHostKeyChecking=accept-new",
    "-o",
    "ConnectTimeout=8",
    localPath,
    `${RELAY_SSH_USER}@${RELAY_HOST}:${remotePath}`,
  ]);
}

function blockStart(subdomain: string): string {
  return `# vantablock:start:${subdomain}`;
}
function blockEnd(subdomain: string): string {
  return `# vantablock:end:${subdomain}`;
}

// Per-source-IP connection/rate limiting against a shared stick-table (defined
// once in the relay's unmanaged global/defaults section — see the DDoS
// hardening DEVLOG entry, 2026-08-21). Every relayed server's listener tracks
// against the same table by source IP, so a flood aimed at one server's port
// is throttled the same as a flood spread across several. Thresholds are
// deliberately generous — a real player behind carrier-grade NAT can share an
// IP with dozens of others — while still well below what an actual flood
// produces.
const SOURCE_LIMIT_TABLE = "st_source_limit";
const MAX_CONCURRENT_PER_SOURCE = 30;
const MAX_CONN_RATE_PER_SOURCE = 20; // per the table's conn_rate(3s) window

function buildBlock(subdomain: string, port: number, backendIp: string): string {
  const name = `mc_${subdomain.replace(/-/g, "_")}`;
  return [
    blockStart(subdomain),
    `listen ${name}`,
    `    bind *:${port}`,
    `    mode tcp`,
    `    tcp-request connection track-sc0 src table ${SOURCE_LIMIT_TABLE}`,
    `    tcp-request connection reject if { sc0_conn_cur gt ${MAX_CONCURRENT_PER_SOURCE} }`,
    `    tcp-request connection reject if { sc0_conn_rate gt ${MAX_CONN_RATE_PER_SOURCE} }`,
    `    server target ${backendIp}:${port}`,
    blockEnd(subdomain),
  ].join("\n");
}

function removeBlock(managed: string, subdomain: string): string {
  const start = managed.indexOf(blockStart(subdomain));
  if (start === -1) return managed;
  const endMarker = blockEnd(subdomain);
  const end = managed.indexOf(endMarker, start);
  if (end === -1) return managed;
  return managed.slice(0, start) + managed.slice(end + endMarker.length);
}

function replaceManagedSection(fullConfig: string, transform: (managed: string) => string): string {
  const startIdx = fullConfig.indexOf(MANAGED_START);
  const endIdx = fullConfig.indexOf(MANAGED_END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error("The relay's haproxy.cfg is missing its managed-section markers — refusing to touch it.");
  }
  const before = fullConfig.slice(0, startIdx + MANAGED_START.length);
  const managed = fullConfig.slice(startIdx + MANAGED_START.length, endIdx);
  const after = fullConfig.slice(endIdx);
  return `${before}\n${transform(managed).trim()}\n${after}`;
}

/**
 * Stages the new config on the relay, validates it with haproxy's own syntax
 * checker, and only then swaps it in and reloads — a bad config must never be
 * able to take down every relayed server's traffic.
 */
async function pushConfig(content: string): Promise<void> {
  const tmpPath = path.join(os.tmpdir(), `haproxy-vantablock-${Date.now()}.cfg`);
  await fs.writeFile(tmpPath, content, "utf8");
  try {
    await scpUp(tmpPath, REMOTE_STAGED_PATH);
    await ssh(["sudo", "haproxy", "-c", "-f", REMOTE_STAGED_PATH]);
    await ssh(["sudo", "cp", REMOTE_STAGED_PATH, HAPROXY_CFG_PATH]);
    await ssh(["sudo", "systemctl", "reload", "haproxy"]);
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}

// upsertRelayRoute/removeRelayRoute each do a read-modify-write of the exact
// same remote file (read the live config, transform it in memory, write the
// whole thing back). Without serializing that, two calls landing close
// together — e.g. several servers getting subdomains around the same time
// during a load test — can race: the second call reads the file before the
// first call's write lands, then overwrites it with a version that never
// saw the first call's change, silently dropping or duplicating routes.
// Node's single-threaded event loop makes an in-process queue enough to fix
// this, since every mutation from this app instance funnels through it.
let mutationQueue: Promise<unknown> = Promise.resolve();

function withMutationLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(fn, fn);
  mutationQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Adds (or replaces) this server's forwarding rule on the relay — the public
 * port it's reachable on, forwarded over the WireGuard tunnel to the Wings
 * node actually hosting it.
 */
export async function upsertRelayRoute(subdomain: string, port: number, backendIp: string): Promise<void> {
  if (!isRelayConfigured()) {
    throw new Error("The relay isn't configured on this server yet.");
  }
  return withMutationLock(async () => {
    const current = await ssh(["cat", HAPROXY_CFG_PATH]);
    const updated = replaceManagedSection(current, (managed) => {
      const withoutOld = removeBlock(managed, subdomain);
      return `${withoutOld}\n${buildBlock(subdomain, port, backendIp)}`;
    });
    await pushConfig(updated);
  });
}

/**
 * Removes this server's forwarding rule from the relay. Best-effort by
 * design — callers should catch failures rather than block a subdomain
 * removal on the relay being reachable.
 */
export async function removeRelayRoute(subdomain: string): Promise<void> {
  if (!isRelayConfigured()) return;
  return withMutationLock(async () => {
    const current = await ssh(["cat", HAPROXY_CFG_PATH]);
    const updated = replaceManagedSection(current, (managed) => removeBlock(managed, subdomain));
    await pushConfig(updated);
  });
}

export interface RelayRoute {
  subdomain: string;
  port: number;
  backendIp: string;
}

/**
 * Reads back what's actually live on the relay right now, straight from its
 * own config — the same source of truth the app writes to, rather than
 * re-deriving it from local state that could have drifted.
 */
export async function listActiveRoutes(): Promise<RelayRoute[]> {
  if (!isRelayConfigured()) return [];
  const current = await ssh(["cat", HAPROXY_CFG_PATH]);
  const startIdx = current.indexOf(MANAGED_START);
  const endIdx = current.indexOf(MANAGED_END);
  if (startIdx === -1 || endIdx === -1) return [];
  const managed = current.slice(startIdx + MANAGED_START.length, endIdx);

  const routes: RelayRoute[] = [];
  const blockRe = /# vantablock:start:(\S+)[\s\S]*?bind \*:(\d+)[\s\S]*?server target ([\d.]+):(\d+)[\s\S]*?# vantablock:end:\1/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(managed))) {
    routes.push({ subdomain: match[1], port: Number(match[2]), backendIp: match[3] });
  }
  return routes;
}

export interface RelayNodeTunnel {
  nodeId: number;
  tunnelIp: string;
  connected: boolean;
  lastHandshakeSecondsAgo: number | null;
}

export interface RelayStatus {
  reachable: boolean;
  haproxyActive: boolean;
  routes: RelayRoute[];
  nodes: RelayNodeTunnel[];
}

/**
 * Live status of the relay itself — reachability, HAProxy's own state, and
 * per-node tunnel health (from WireGuard's own handshake tracking, not just
 * "is a peer configured"). `nodeRelayIps` is node id -> tunnel address.
 */
export async function getRelayStatus(nodeRelayIps: Record<number, string>): Promise<RelayStatus> {
  if (!isRelayConfigured()) {
    return { reachable: false, haproxyActive: false, routes: [], nodes: [] };
  }
  try {
    const [haproxyState, wgDump, routes] = await Promise.all([
      ssh(["sudo", "systemctl", "is-active", "haproxy"]).catch(() => "unknown"),
      ssh(["sudo", "wg", "show", "wg0", "dump"]).catch(() => ""),
      listActiveRoutes().catch(() => [] as RelayRoute[]),
    ]);

    // dump format: first line is the interface itself, one line per peer after
    // that — tab-separated, allowed-ips is field 3, latest-handshake is field 4.
    const peerLines = wgDump
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split("\t"));

    const nodes: RelayNodeTunnel[] = Object.entries(nodeRelayIps).map(([nodeIdStr, tunnelIp]) => {
      const nodeId = Number(nodeIdStr);
      const peer = peerLines.find((fields) => fields[3] === `${tunnelIp}/32`);
      if (!peer) return { nodeId, tunnelIp, connected: false, lastHandshakeSecondsAgo: null };
      const latestHandshake = Number(peer[4] ?? 0);
      const lastHandshakeSecondsAgo = latestHandshake > 0 ? Math.floor(Date.now() / 1000) - latestHandshake : null;
      // WireGuard peers re-handshake roughly every 2 minutes when active
      // (PersistentKeepalive = 25s) — anything within 5 minutes is healthy.
      const connected = lastHandshakeSecondsAgo !== null && lastHandshakeSecondsAgo < 300;
      return { nodeId, tunnelIp, connected, lastHandshakeSecondsAgo };
    });

    return {
      reachable: true,
      haproxyActive: haproxyState.trim() === "active",
      routes,
      nodes,
    };
  } catch {
    return { reachable: false, haproxyActive: false, routes: [], nodes: [] };
  }
}
