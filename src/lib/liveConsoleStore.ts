// Module-level (outside React) store for live console connections. A connection,
// once opened for a given server identifier, keeps running and buffering output
// here regardless of which component is mounted or subscribed — so navigating
// away and back (or just switching tabs) never loses console history. On first
// connect it also seeds itself from the server's own on-disk log file, so history
// survives even a full page reload or closing the site and coming back later —
// as long as the server itself is still around, the log is the source of truth,
// not anything cached in the browser.

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

interface RawStatsPayload {
  cpu_absolute: number;
  memory_bytes: number;
  memory_limit_bytes: number;
  disk_bytes: number;
  network: { rx_bytes: number; tx_bytes: number };
  uptime: number;
  state: string;
}

interface ConsoleCacheEntry {
  snapshot: ConsoleSnapshot;
  ws: WebSocket | null;
  listeners: Set<() => void>;
  retryTimer: ReturnType<typeof setTimeout> | null;
  attempt: number;
}

export const EMPTY_SNAPSHOT: ConsoleSnapshot = { lines: [], connected: false, stats: null };

const cache = new Map<string, ConsoleCacheEntry>();

function updateSnapshot(entry: ConsoleCacheEntry, patch: Partial<ConsoleSnapshot>) {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.listeners.forEach((fn) => fn());
}

function scheduleRetry(identifier: string, entry: ConsoleCacheEntry) {
  const delay = Math.min(2000 * 2 ** entry.attempt, 30000);
  entry.attempt += 1;
  entry.retryTimer = setTimeout(() => connect(identifier, entry), delay);
}

async function connect(identifier: string, entry: ConsoleCacheEntry) {
  try {
    const res = await fetch(`/api/servers/${identifier}/console`, { credentials: "include" });
    if (!res.ok) {
      scheduleRetry(identifier, entry);
      return;
    }
    const creds = (await res.json()) as { token: string; socket: string };

    const ws = new WebSocket(creds.socket);
    entry.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: "auth", args: [creds.token] }));
    };

    ws.onmessage = (event) => {
      let msg: { event: string; args?: string[] };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.event === "auth success") {
        entry.attempt = 0;
        updateSnapshot(entry, { connected: true });
      } else if (msg.event === "console output" && msg.args?.[0] !== undefined) {
        updateSnapshot(entry, { lines: [...entry.snapshot.lines.slice(-500), msg.args[0]] });
      } else if (msg.event === "stats" && msg.args?.[0] !== undefined) {
        try {
          const raw = JSON.parse(msg.args[0]) as RawStatsPayload;
          updateSnapshot(entry, {
            stats: {
              cpuAbsolute: raw.cpu_absolute,
              memoryBytes: raw.memory_bytes,
              memoryLimitBytes: raw.memory_limit_bytes,
              diskBytes: raw.disk_bytes,
              networkRxBytes: raw.network.rx_bytes,
              networkTxBytes: raw.network.tx_bytes,
              uptimeMs: raw.uptime,
              state: raw.state,
            },
          });
        } catch {
          // ignore malformed stats payloads
        }
      } else if (msg.event === "token expiring" || msg.event === "token expired") {
        ws.close();
      }
    };

    ws.onclose = () => {
      updateSnapshot(entry, { connected: false });
      scheduleRetry(identifier, entry);
    };

    ws.onerror = () => ws.close();
  } catch {
    scheduleRetry(identifier, entry);
  }
}

async function seedHistory(identifier: string, entry: ConsoleCacheEntry) {
  try {
    const res = await fetch(`/api/servers/${identifier}/console/history`, { credentials: "include" });
    if (res.ok) {
      const data = (await res.json()) as { lines: string[] };
      if (data.lines.length) {
        updateSnapshot(entry, { lines: data.lines });
      }
    }
  } catch {
    // Best effort — live streaming still works fine starting from an empty buffer.
  }
  connect(identifier, entry);
}

function ensureConnection(identifier: string): ConsoleCacheEntry {
  let entry = cache.get(identifier);
  if (entry) return entry;

  entry = { snapshot: EMPTY_SNAPSHOT, ws: null, listeners: new Set(), retryTimer: null, attempt: 0 };
  cache.set(identifier, entry);
  seedHistory(identifier, entry);
  return entry;
}

export function subscribeLiveConsole(identifier: string, onChange: () => void): () => void {
  const entry = ensureConnection(identifier);
  entry.listeners.add(onChange);
  return () => {
    entry.listeners.delete(onChange);
  };
}

export function getLiveConsoleSnapshot(identifier: string): ConsoleSnapshot {
  return cache.get(identifier)?.snapshot ?? EMPTY_SNAPSHOT;
}

export function sendLiveCommand(identifier: string, command: string) {
  fetch(`/api/servers/${identifier}/command`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  }).catch(() => {});
}
