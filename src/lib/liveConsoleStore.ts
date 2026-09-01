// Demo implementation of the live-console store. Same exported surface as the
// original (which held real Pterodactyl WebSocket connections — see git
// history before 584357a), but backed by src/demo/store.ts: console lines come
// from the demo engine, "sending a command" runs the demo command handler, and
// stats are synthesized from the demo server's wobbling live numbers.

import {
  findServer,
  handleCommand,
  ensureEngine,
  pushConsole,
  type DemoServer,
} from "../demo/store";
import { initialConsoleLines } from "../mock-data/console";

export interface LiveResourceStats {
  cpuAbsolute: number;
  memoryBytes: number;
  memoryLimitBytes: number;
  diskBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  uptimeMs: number;
  state: string;
}

export interface ConsoleSnapshot {
  lines: string[];
  connected: boolean;
  stats: LiveResourceStats | null;
}

export const EMPTY_SNAPSHOT: ConsoleSnapshot = { lines: [], connected: false, stats: null };

interface Entry {
  snapshot: ConsoleSnapshot;
  listeners: Set<() => void>;
  net: { rx: number; tx: number };
  timer: ReturnType<typeof setInterval> | null;
  unhook: (() => void) | null;
}

const cache = new Map<string, Entry>();
const GB = 1024 * 1024 * 1024;

function buildStats(server: DemoServer, entry: Entry): LiveResourceStats | null {
  if (server.status === "offline") return null;
  if (server.status === "online") {
    entry.net.rx += Math.round(20_000 + Math.random() * 220_000);
    entry.net.tx += Math.round(60_000 + Math.random() * 700_000);
  }
  return {
    cpuAbsolute: server.cpuUsed,
    memoryBytes: Math.round(server.ramUsed * GB),
    memoryLimitBytes: Math.round(server.ramAllocated * GB),
    diskBytes: Math.round(server.diskUsed * GB),
    networkRxBytes: entry.net.rx,
    networkTxBytes: entry.net.tx,
    uptimeMs: server.startedAt ? Date.now() - server.startedAt : 0,
    state: server.status === "online" ? "running" : server.status,
  };
}

function refresh(identifier: string, entry: Entry) {
  const server = findServer(identifier);
  if (!server) return;
  entry.snapshot = {
    lines: server.consoleLines,
    connected: true,
    stats: buildStats(server, entry),
  };
  entry.listeners.forEach((fn) => fn());
}

/** Seed a plausible recent history for a server that was already running when
 * the demo opened, so the console doesn't start blank. */
function seedHistory(server: DemoServer) {
  if (server.consoleLines.length || server.status !== "online") return;
  server.consoleLines = initialConsoleLines.slice();
  for (const name of server.onlinePlayers) {
    if (!server.consoleLines.some((l) => l.includes(`${name} joined`))) {
      pushConsole(server, `[${new Date().toTimeString().slice(0, 8)} INFO]: ${name} joined the game`);
    }
  }
}

function ensureEntry(identifier: string): Entry {
  let entry = cache.get(identifier);
  if (entry) return entry;
  entry = {
    snapshot: EMPTY_SNAPSHOT,
    listeners: new Set(),
    net: { rx: Math.round(Math.random() * 5e8), tx: Math.round(Math.random() * 2e9) },
    timer: null,
    unhook: null,
  };
  cache.set(identifier, entry);

  ensureEngine();
  const server = findServer(identifier);
  if (server) {
    seedHistory(server);
    const onConsole = () => refresh(identifier, entry!);
    server.consoleListeners.add(onConsole);
    entry.unhook = () => server.consoleListeners.delete(onConsole);
    // Stats/uptime tick even when nothing prints to the console.
    entry.timer = setInterval(() => refresh(identifier, entry!), 2000);
    refresh(identifier, entry);
  }
  return entry;
}

export function subscribeLiveConsole(identifier: string, onChange: () => void): () => void {
  const entry = ensureEntry(identifier);
  entry.listeners.add(onChange);
  return () => {
    entry.listeners.delete(onChange);
  };
}

export function getLiveConsoleSnapshot(identifier: string): ConsoleSnapshot {
  return cache.get(identifier)?.snapshot ?? EMPTY_SNAPSHOT;
}

export function sendLiveCommand(identifier: string, command: string) {
  const server = findServer(identifier);
  if (server) handleCommand(server, command);
}
