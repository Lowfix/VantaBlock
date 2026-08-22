export const PANEL_URL = process.env.PTERODACTYL_URL || "http://localhost";
const APP_KEY = process.env.PTERODACTYL_APP_KEY || "";

// PANEL_URL is used for server-to-server API calls, so it's often a loopback/LAN
// address that only this box can reach (e.g. Panel and this app co-located on the
// same machine, talking over 127.0.0.1). A link handed to the owner's own browser
// needs Panel's actual externally-reachable address instead — falls back to
// PANEL_URL for simpler setups where the two are already the same reachable host.
export const PANEL_PUBLIC_URL = process.env.PTERODACTYL_PUBLIC_URL || PANEL_URL;

// The Minecraft status ping (used for real player counts) only knows about the one
// server we provisioned by hand — a future "buy a plan" flow would need to store
// host/port per mirrored server instead of relying on this fixed pair.
export const LIVE_SERVER_IDENTIFIER = process.env.PTERODACTYL_LIVE_SERVER || "";
export const LIVE_SERVER_HOST = new URL(PANEL_URL).hostname;
export const LIVE_SERVER_PORT = Number(process.env.PTERODACTYL_LIVE_PORT) || 25565;

export function isApplicationApiConfigured(): boolean {
  return Boolean(APP_KEY);
}

interface PterodactylErrorBody {
  errors?: { code?: string; status?: string; detail?: string }[];
}

// Panel throttles the Application API at 256 requests/minute *per key* — and
// there's only one key for this whole app, so provisioning, the owner console's
// reconcile pass and every install poll all share that one budget. Measured
// live: `x-ratelimit-limit: 256` with a `retry-after` on the 429. Server-to-
// server calls have nobody to show a 429 to, so they wait out the (always
// short — the window is one minute) retry-after instead of failing a deploy
// that was about to succeed. Client-API calls deliberately don't do this: those
// are per-user keys driving a browser tab, where surfacing a 429 immediately
// (see `pterodactylErrorStatus` in routes/servers.ts) beats stalling a request.
const APP_THROTTLE_RETRIES = 3;
const APP_THROTTLE_MAX_WAIT_SECONDS = 15;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Every outbound call to Panel goes through here so none of them can hang
 * forever. Node's fetch has no default request timeout; what it does have is
 * undici's 300s `headersTimeout`, which is not a deliberate choice on our part
 * and is far too long to hold a browser request open. Measured against a stub
 * that accepts the TCP connection and then never answers (2026-08-21 load
 * test): a single `GET /api/servers/:id/files` sat there for **305 seconds**
 * before Express gave up — one wedged Wings would pile up in-flight requests
 * for five minutes each, and the owner dashboard polls every 15s.
 *
 * An abort is normalised into a plain message so `pterodactylErrorStatus` in
 * routes/servers.ts can turn it into a 504 instead of a generic 502 — "the
 * panel didn't answer in time" and "the panel refused this" are different
 * problems for whoever's reading the logs.
 */
export const PANEL_TIMEOUT_MESSAGE = "Pterodactyl did not respond in time.";

async function panelFetch(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  // A caller that brought its own signal (none today) opts out rather than
  // silently having two abort sources fighting over the same request.
  const signal = init.signal ?? (timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined);
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new Error(PANEL_TIMEOUT_MESSAGE);
    }
    throw err;
  }
}

async function pterodactylFetch<T>(
  path: string,
  apiKey: string,
  init: RequestInit = {},
  options: { retryOnThrottle?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  const { retryOnThrottle = false, timeoutMs } = options;
  for (let attempt = 0; ; attempt++) {
    const res = await panelFetch(
      `${PANEL_URL}${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init.headers,
        },
      },
      // Fresh per attempt, so waiting out a throttle doesn't eat the next
      // attempt's time budget.
      timeoutMs
    );

    if (res.status === 429 && retryOnThrottle && attempt < APP_THROTTLE_RETRIES) {
      // Safe to retry even for a POST: Laravel's throttle middleware rejects the
      // request before the controller runs, so nothing was created.
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitSeconds = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter + 1 : 5, APP_THROTTLE_MAX_WAIT_SECONDS);
      await res.body?.cancel().catch(() => {});
      await sleep(waitSeconds * 1000);
      continue;
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as PterodactylErrorBody | null;
      const detail = body?.errors?.[0]?.detail;
      throw new Error(detail || `Pterodactyl API responded with ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}

// Client-API calls are what a browser tab is waiting on — power buttons, the
// file manager, schedules, backups, databases. Measured against the real node:
// a directory listing is ~210ms sequentially and ~500ms with 24 requests in
// flight, so 30s is two orders of magnitude of headroom and still fails the
// request long before the user gives up on the page.
const CLIENT_REQUEST_TIMEOUT_MS = 30_000;

// Except the two that do real work on disk inside the container: compressing a
// world folder or unpacking a large archive legitimately takes minutes on the
// Ryzen 7 the Main Node actually runs, and timing those out at 30s would turn a
// working feature into a broken one.
const CLIENT_ARCHIVE_TIMEOUT_MS = 300_000;

// Moving file bytes (reading a big latest.log, writing a config) — slower than a
// JSON round trip, nowhere near an archive operation.
const CLIENT_FILE_TIMEOUT_MS = 120_000;

// The four HTML/CSRF round trips in `mintClientApiKeyForUser` below. These run
// inline during signup, so a wedged Panel here stalls a real person waiting on
// the register button, not a background job.
const PANEL_WEB_FLOW_TIMEOUT_MS = 30_000;

function clientFetch<T>(path: string, apiKey: string, init: RequestInit = {}, timeoutMs = CLIENT_REQUEST_TIMEOUT_MS): Promise<T> {
  return pterodactylFetch<T>(path, apiKey, init, { timeoutMs });
}

// Every Application API call is a small JSON round trip to a box on the LAN, and
// Node's fetch has no default timeout — a Panel that accepts the connection and
// then stops answering would otherwise hang the caller forever. That matters
// most for provisioning, which holds a process-wide lock across its create call
// (see provisioning.ts): one hung request there would stall every future deploy.
const APP_REQUEST_TIMEOUT_MS = 45_000;

function applicationFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return pterodactylFetch<T>(path, APP_KEY, init, { retryOnThrottle: true, timeoutMs: APP_REQUEST_TIMEOUT_MS });
}

export type PowerSignal = "start" | "stop" | "restart" | "kill";

interface ResourcesResponse {
  attributes: {
    current_state: "running" | "starting" | "stopping" | "offline";
    is_suspended: boolean;
    resources: {
      memory_bytes: number;
      cpu_absolute: number;
      disk_bytes: number;
      uptime: number;
    };
  };
}

export async function getServerResources(apiKey: string, identifier: string) {
  return clientFetch<ResourcesResponse>(`/api/client/servers/${identifier}/resources`, apiKey);
}

export async function sendPowerAction(apiKey: string, identifier: string, signal: PowerSignal) {
  await clientFetch(`/api/client/servers/${identifier}/power`, apiKey, {
    method: "POST",
    body: JSON.stringify({ signal }),
  });
}

export async function sendCommand(apiKey: string, identifier: string, command: string) {
  await clientFetch(`/api/client/servers/${identifier}/command`, apiKey, {
    method: "POST",
    body: JSON.stringify({ command }),
  });
}

interface WebsocketCredentials {
  data: { token: string; socket: string };
}

export async function getWebsocketCredentials(apiKey: string, identifier: string) {
  return clientFetch<WebsocketCredentials>(`/api/client/servers/${identifier}/websocket`, apiKey);
}

/**
 * Reads the server's own on-disk log file (reset by Minecraft on each boot) so the
 * console can show real history from before the browser connected — including
 * everything that happened while the user was away entirely, not just what this
 * browser happened to see live.
 */
export async function getConsoleHistory(apiKey: string, identifier: string): Promise<string[]> {
  const res = await panelFetch(
    `${PANEL_URL}/api/client/servers/${identifier}/files/contents?file=${encodeURIComponent("logs/latest.log")}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
    CLIENT_FILE_TIMEOUT_MS
  );
  if (!res.ok) return [];
  const text = await res.text();
  return text.split("\n").filter((line) => line.trim().length > 0).slice(-200);
}

interface ClientServerListResponse {
  data: {
    attributes: {
      identifier: string;
      name: string;
      description: string;
      limits: { memory: number; disk: number; cpu: number };
    };
  }[];
}

export async function listClientServers(apiKey: string) {
  const res = await clientFetch<ClientServerListResponse>("/api/client", apiKey);
  return res.data.map((entry) => entry.attributes);
}

/**
 * Every server that genuinely still exists on Pterodactyl, application-wide (not
 * scoped to one user's client key) — used to reconcile our local `servers` table
 * against reality, since a server deleted outside our own app (directly in
 * Pterodactyl, or by hand during testing) leaves no trace for us to notice
 * otherwise.
 */
export async function listAllRealServerIdentifiers(): Promise<Set<string>> {
  const res = await applicationFetch<{ data: { attributes: { identifier: string } }[] }>(
    "/api/application/servers?per_page=200"
  );
  return new Set(res.data.map((entry) => entry.attributes.identifier));
}

export async function getServerDetails(apiKey: string, identifier: string): Promise<{ internalId: number; name: string }> {
  const res = await clientFetch<{ attributes: { internal_id: number; name: string } }>(
    `/api/client/servers/${identifier}`,
    apiKey
  );
  return { internalId: res.attributes.internal_id, name: res.attributes.name };
}

// Each node's `fqdn` (e.g. wings1.duxy.online) is a Cloudflare-tunneled hostname
// used only for Panel↔Wings control traffic — it isn't reachable by a router's
// port-forward rule, which needs the node's actual LAN address instead. There are
// only ever a couple of physical nodes, so this is a small fixed map rather than
// something discoverable through Pterodactyl's own API.
const WINGS_NODE_LAN_IPS: Record<number, string> = (() => {
  try {
    return JSON.parse(process.env.WINGS_NODE_IPS || "{}");
  } catch {
    return {};
  }
})();

// Each node's address on the relay VM's WireGuard tunnel (10.10.10.x) — this is
// what the relay's HAProxy forwards a server's traffic to, once that node has
// its own tunnel set up. A node missing from this map just isn't relayed yet.
const WINGS_NODE_RELAY_IPS: Record<number, string> = (() => {
  try {
    return JSON.parse(process.env.WINGS_NODE_RELAY_IPS || "{}");
  } catch {
    return {};
  }
})();

/** Every node currently wired into the relay, node id -> its tunnel address. */
export function getRelayNodeMap(): Record<number, string> {
  return WINGS_NODE_RELAY_IPS;
}

async function getServerNodeId(internalServerId: number): Promise<number> {
  const server = await applicationFetch<{ attributes: { node: number } }>(`/api/application/servers/${internalServerId}`);
  return server.attributes.node;
}

/**
 * The Wings node's own LAN address — what a router's port-forward rule for this
 * server needs to point at, since the node (not the Panel) is what's actually
 * listening on the server's allocated port.
 */
export async function getNodeAddress(internalServerId: number): Promise<string> {
  const nodeId = await getServerNodeId(internalServerId);
  const node = await applicationFetch<{ attributes: NodeAttributes }>(`/api/application/nodes/${nodeId}`);
  return WINGS_NODE_LAN_IPS[nodeId] ?? node.attributes.fqdn;
}

/**
 * The node's relay-tunnel address, if that node has been wired into the relay
 * VM — null means this server's traffic isn't relayed yet and should fall back
 * to the direct home-IP path.
 */
export async function getNodeRelayAddress(internalServerId: number): Promise<string | null> {
  const nodeId = await getServerNodeId(internalServerId);
  return WINGS_NODE_RELAY_IPS[nodeId] ?? null;
}

// ---------------------------------------------------------------------------
// Server provisioning (deploy new servers, resize existing ones)
// ---------------------------------------------------------------------------

interface NodeAttributes {
  id: number;
  name: string;
  fqdn: string;
  memory: number;
  disk: number;
  allocated_resources: { memory: number; disk: number };
  maintenance_mode: boolean;
}

async function listNodes(): Promise<NodeAttributes[]> {
  const res = await applicationFetch<{ data: { attributes: NodeAttributes }[] }>("/api/application/nodes?per_page=50");
  return res.data.map((entry) => entry.attributes);
}

export interface NodeStatus {
  id: number;
  name: string;
  maintenanceMode: boolean;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedMb: number;
  diskTotalMb: number;
}

/**
 * Per-node capacity for the owner's overview — comes straight from
 * Pterodactyl's own records. A prior version of this also did a live
 * reachability probe against the node's LAN address, but that probe's
 * "connected" result depended on node metadata (daemon_listen/scheme) that
 * doesn't reliably reflect Wings' actual listening port, making it a
 * confusing, sometimes-wrong signal rather than a trustworthy one. Removed
 * rather than fixed — node health is better checked directly if ever needed.
 */
export async function getNodeStatuses(): Promise<NodeStatus[]> {
  const nodes = await listNodes();
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    maintenanceMode: n.maintenance_mode,
    memoryUsedMb: n.allocated_resources.memory,
    memoryTotalMb: n.memory,
    diskUsedMb: n.allocated_resources.disk,
    diskTotalMb: n.disk,
  }));
}

/**
 * Picks a free allocation on whichever node currently has the most free memory
 * headroom, skipping any node that turns out to have no free allocations left —
 * and skipping any node flagged for maintenance in Pterodactyl entirely, so
 * taking one node down (e.g. shutting off the machine it runs on for the night)
 * just routes new deploys to the next available one instead of hanging.
 */
export async function getFreeAllocationId(): Promise<number | null> {
  const [first] = await listFreeAllocationIds(1);
  return first ?? null;
}

/**
 * The same pick, but returns several candidates in preference order instead of
 * one. Two deploys running at the same moment both read "allocation X is free"
 * before either has claimed it — measured for real, 4 concurrent calls all
 * returned the same id — and Pterodactyl then fails all but one of the creates
 * (sometimes a clean 422 "The selected allocation.default is invalid", sometimes
 * a bare 500 when the two creates interleave inside Panel). Handing the caller a
 * short list lets it fall forward to the next free port instead of failing a
 * deploy while ports are still available. `provisionServer()` also serializes
 * the pick-then-create window so this fallback is only needed when something
 * *outside* this process (a second app instance, or someone creating a server in
 * Panel by hand) took the port first.
 */
export async function listFreeAllocationIds(limit = 4): Promise<number[]> {
  const nodes = await listNodes();
  const available = nodes.filter((n) => !n.maintenance_mode);
  // Sort by utilization percentage (not raw free memory) so a node with a much
  // larger declared ceiling doesn't always win just for having more headroom.
  const byUtilization = [...available].sort(
    (a, b) => a.allocated_resources.memory / a.memory - b.allocated_resources.memory / b.memory
  );

  const candidates: number[] = [];
  for (const node of byUtilization) {
    const res = await applicationFetch<{ data: { attributes: { id: number; assigned: boolean } }[] }>(
      `/api/application/nodes/${node.id}/allocations?per_page=50`
    );
    for (const entry of res.data) {
      if (!entry.attributes.assigned) candidates.push(entry.attributes.id);
      if (candidates.length >= limit) return candidates;
    }
  }
  return candidates;
}

export async function createServerForOwner(input: {
  name: string;
  ownerId: number;
  allocationId: number;
  memory: number;
  disk: number;
  cpu: number;
  eggId: number;
  dockerImage: string;
  startup: string;
  environment: Record<string, string>;
}): Promise<{ id: number; identifier: string }> {
  const res = await applicationFetch<{ attributes: { id: number; identifier: string } }>("/api/application/servers", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      user: input.ownerId,
      egg: input.eggId,
      docker_image: input.dockerImage,
      startup: input.startup,
      environment: input.environment,
      limits: { memory: input.memory, swap: 0, disk: input.disk, io: 500, cpu: input.cpu },
      feature_limits: { databases: 1, allocations: 1, backups: 1 },
      allocation: { default: input.allocationId },
      start_on_completion: false,
    }),
  });
  return { id: res.attributes.id, identifier: res.attributes.identifier };
}

export async function isServerInstalled(serverId: number): Promise<boolean> {
  const res = await applicationFetch<{ attributes: { container: { installed: number | boolean } } }>(
    `/api/application/servers/${serverId}`
  );
  return Boolean(res.attributes.container.installed);
}

export async function updateServerBuild(
  serverId: number,
  allocationId: number,
  input: { memory: number; disk: number; cpu: number }
): Promise<void> {
  await applicationFetch(`/api/application/servers/${serverId}/build`, {
    method: "PATCH",
    body: JSON.stringify({
      allocation: allocationId,
      limits: { memory: input.memory, swap: 0, io: 500, cpu: input.cpu, disk: input.disk },
      feature_limits: { databases: 1, allocations: 1, backups: 1 },
    }),
  });
}

interface CreateUserResponse {
  attributes: { id: number };
}

export async function createApplicationUser(input: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<number> {
  const res = await applicationFetch<CreateUserResponse>("/api/application/users", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      username: input.username,
      first_name: input.firstName,
      last_name: input.lastName,
      password: input.password,
    }),
  });
  return res.attributes.id;
}

export async function setServerOwner(serverId: number, name: string, ownerId: number): Promise<void> {
  await applicationFetch(`/api/application/servers/${serverId}/details`, {
    method: "PATCH",
    body: JSON.stringify({ name, user: ownerId }),
  });
}

export async function deleteApplicationServer(serverId: number): Promise<void> {
  await applicationFetch(`/api/application/servers/${serverId}`, { method: "DELETE" });
}

// Pterodactyl's own suspend/unsuspend: Wings stops a running server the moment it's
// suspended and refuses to start it again until unsuspended — exactly the "shut down
// and unable to be started again until paid" behavior billing needs, enforced at the
// daemon level rather than something Vantablock has to police itself.
export async function suspendServer(serverId: number): Promise<void> {
  await applicationFetch(`/api/application/servers/${serverId}/suspend`, { method: "POST" });
}

export async function unsuspendServer(serverId: number): Promise<void> {
  await applicationFetch(`/api/application/servers/${serverId}/unsuspend`, { method: "POST" });
}

export async function deleteApplicationUser(pterodactylUserId: number): Promise<void> {
  await applicationFetch(`/api/application/users/${pterodactylUserId}`, { method: "DELETE" });
}

interface ApplicationUserDetails {
  attributes: { id: number; email: string; username: string; first_name: string; last_name: string };
}

export async function getApplicationUser(pterodactylUserId: number) {
  const res = await applicationFetch<ApplicationUserDetails>(`/api/application/users/${pterodactylUserId}`);
  return res.attributes;
}

export async function setApplicationUserPassword(pterodactylUserId: number, password: string): Promise<void> {
  const user = await getApplicationUser(pterodactylUserId);
  await applicationFetch(`/api/application/users/${pterodactylUserId}`, {
    method: "PATCH",
    body: JSON.stringify({
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      password,
    }),
  });
}

function parseSetCookies(res: Response, jar: Map<string, string>) {
  for (const raw of res.headers.getSetCookie()) {
    const pair = raw.split(";")[0];
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function extractCsrfToken(html: string): string {
  const match = html.match(/csrf-token" content="([^"]*)"/);
  if (!match) throw new Error("Could not read Pterodactyl's CSRF token.");
  return match[1];
}

/**
 * Client (account) API keys are only self-issuable through the panel's normal web
 * session — the Application API has no endpoint for minting one on a user's behalf.
 * This replays that same login + CSRF + "create API key" flow the panel's own
 * frontend uses, so a brand-new mirrored user ends up with a real, working key.
 */
export async function mintClientApiKeyForUser(email: string, password: string, description: string): Promise<string> {
  const jar = new Map<string, string>();

  const page1 = await panelFetch(`${PANEL_URL}/`, {}, PANEL_WEB_FLOW_TIMEOUT_MS);
  parseSetCookies(page1, jar);
  const csrf1 = extractCsrfToken(await page1.text());

  const loginRes = await panelFetch(`${PANEL_URL}/auth/login`, {
    method: "POST",
    headers: {
      "X-CSRF-TOKEN": csrf1,
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ user: email, password }),
  }, PANEL_WEB_FLOW_TIMEOUT_MS);
  parseSetCookies(loginRes, jar);
  if (!loginRes.ok) {
    throw new Error("Could not authenticate the mirrored Pterodactyl account.");
  }

  const page2 = await panelFetch(`${PANEL_URL}/`, { headers: { Cookie: cookieHeader(jar) } }, PANEL_WEB_FLOW_TIMEOUT_MS);
  parseSetCookies(page2, jar);
  const csrf2 = extractCsrfToken(await page2.text());

  const keyRes = await panelFetch(`${PANEL_URL}/api/client/account/api-keys`, {
    method: "POST",
    headers: {
      "X-CSRF-TOKEN": csrf2,
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: cookieHeader(jar),
    },
    body: JSON.stringify({ description, allowed_ips: [] }),
  }, PANEL_WEB_FLOW_TIMEOUT_MS);
  if (!keyRes.ok) {
    throw new Error("Could not create a Pterodactyl API key for the mirrored account.");
  }
  const data = (await keyRes.json()) as { attributes: { identifier: string }; meta: { secret_token: string } };
  return data.attributes.identifier + data.meta.secret_token;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export interface FileObject {
  name: string;
  mode: string;
  size: number;
  is_file: boolean;
  is_symlink: boolean;
  mimetype: string;
  created_at: string;
  modified_at: string;
}

interface FileListResponse {
  data: { attributes: FileObject }[];
}

export async function listFiles(apiKey: string, identifier: string, directory: string): Promise<FileObject[]> {
  const res = await clientFetch<FileListResponse>(
    `/api/client/servers/${identifier}/files/list?directory=${encodeURIComponent(directory)}`,
    apiKey
  );
  return res.data.map((entry) => entry.attributes);
}

export async function getFileContents(apiKey: string, identifier: string, file: string): Promise<string> {
  const res = await panelFetch(
    `${PANEL_URL}/api/client/servers/${identifier}/files/contents?file=${encodeURIComponent(file)}`,
    { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
    CLIENT_FILE_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Could not read ${file} (${res.status}).`);
  return res.text();
}

export async function writeFile(apiKey: string, identifier: string, file: string, content: string): Promise<void> {
  const res = await panelFetch(
    `${PANEL_URL}/api/client/servers/${identifier}/files/write?file=${encodeURIComponent(file)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "text/plain" },
      body: content,
    },
    CLIENT_FILE_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`Could not write ${file} (${res.status}).`);
}

interface SignedUrlResponse {
  attributes: { url: string };
}

/**
 * Pterodactyl's upload flow is two-step: this mints a short-lived, pre-signed
 * URL that points directly at Wings (not the Panel), then the actual bytes get
 * POSTed there as multipart/form-data. There's no plain "PUT the file" endpoint
 * for binary content on the client API — `files/write` (used by `writeFile`
 * above) only accepts a raw text body, which mangles binary data like jars.
 */
export async function getFileUploadUrl(apiKey: string, identifier: string): Promise<string> {
  const res = await clientFetch<SignedUrlResponse>(`/api/client/servers/${identifier}/files/upload`, apiKey);
  return res.attributes.url;
}

export async function uploadFile(
  apiKey: string,
  identifier: string,
  directory: string,
  fileName: string,
  data: Buffer
): Promise<void> {
  const signedUrl = await getFileUploadUrl(apiKey, identifier);
  const url = `${signedUrl}&directory=${encodeURIComponent(directory)}`;

  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(data)]), fileName);

  // The signed URL points directly at Wings, not the Panel. A plain `fetch` has
  // no timeout by default, so if that host is ever unreachable this would hang
  // forever instead of failing — bound it so a real network problem surfaces as
  // a clear error instead of a stuck spinner.
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not reach the game server node to upload ${fileName} (${cause}).`);
  }
  if (!res.ok) throw new Error(`Could not upload ${fileName} (${res.status}).`);
}

export async function createFolder(apiKey: string, identifier: string, root: string, name: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/files/create-folder`, apiKey, {
    method: "POST",
    body: JSON.stringify({ root, name }),
  });
}

export async function deleteFiles(apiKey: string, identifier: string, root: string, files: string[]): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/files/delete`, apiKey, {
    method: "POST",
    body: JSON.stringify({ root, files }),
  });
}

export async function renameFile(apiKey: string, identifier: string, root: string, from: string, to: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/files/rename`, apiKey, {
    method: "PUT",
    body: JSON.stringify({ root, files: [{ from, to }] }),
  });
}

export async function compressFiles(apiKey: string, identifier: string, root: string, files: string[]): Promise<FileObject> {
  const res = await clientFetch<{ attributes: FileObject }>(
    `/api/client/servers/${identifier}/files/compress`,
    apiKey,
    { method: "POST", body: JSON.stringify({ root, files }) },
    CLIENT_ARCHIVE_TIMEOUT_MS
  );
  return res.attributes;
}

export async function decompressFile(apiKey: string, identifier: string, root: string, file: string): Promise<void> {
  await clientFetch(
    `/api/client/servers/${identifier}/files/decompress`,
    apiKey,
    { method: "POST", body: JSON.stringify({ root, file }) },
    CLIENT_ARCHIVE_TIMEOUT_MS
  );
}

// ---------------------------------------------------------------------------
// Schedules
// ---------------------------------------------------------------------------

export interface ScheduleTask {
  id: number;
  sequence_id: number;
  action: string;
  payload: string;
  time_offset: number;
  is_queued: boolean;
  continue_on_failure: boolean;
}

export interface Schedule {
  id: number;
  name: string;
  cron: { minute: string; hour: string; day_of_week: string; day_of_month: string };
  is_active: boolean;
  is_processing: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  tasks: ScheduleTask[];
}

interface ScheduleResponse {
  attributes: Omit<Schedule, "tasks"> & {
    relationships?: { tasks?: { data: { attributes: ScheduleTask }[] } };
  };
}

function mapSchedule(res: ScheduleResponse["attributes"]): Schedule {
  return {
    id: res.id,
    name: res.name,
    cron: res.cron,
    is_active: res.is_active,
    is_processing: res.is_processing,
    last_run_at: res.last_run_at,
    next_run_at: res.next_run_at,
    tasks: (res.relationships?.tasks?.data ?? []).map((t) => t.attributes),
  };
}

export async function listSchedules(apiKey: string, identifier: string): Promise<Schedule[]> {
  const res = await clientFetch<{ data: ScheduleResponse[] }>(`/api/client/servers/${identifier}/schedules`, apiKey);
  return res.data.map((entry) => mapSchedule(entry.attributes));
}

export async function createSchedule(
  apiKey: string,
  identifier: string,
  input: { name: string; minute: string; hour: string; day_of_month: string; day_of_week: string; is_active: boolean }
): Promise<Schedule> {
  // This build's schedule controller reads an undocumented "month" field when
  // computing the next-run timestamp and 500s with a TypeError if it's absent —
  // it's not in the validated fields, but the endpoint still needs it.
  const res = await clientFetch<ScheduleResponse>(`/api/client/servers/${identifier}/schedules`, apiKey, {
    method: "POST",
    body: JSON.stringify({ ...input, month: "*" }),
  });
  return mapSchedule(res.attributes);
}

export async function updateSchedule(
  apiKey: string,
  identifier: string,
  scheduleId: number,
  input: Partial<{ name: string; minute: string; hour: string; day_of_month: string; day_of_week: string; is_active: boolean }>
): Promise<Schedule> {
  const res = await clientFetch<ScheduleResponse>(`/api/client/servers/${identifier}/schedules/${scheduleId}`, apiKey, {
    method: "POST",
    body: JSON.stringify({ month: "*", ...input }),
  });
  return mapSchedule(res.attributes);
}

export async function deleteSchedule(apiKey: string, identifier: string, scheduleId: number): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/schedules/${scheduleId}`, apiKey, { method: "DELETE" });
}

export async function executeSchedule(apiKey: string, identifier: string, scheduleId: number): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/schedules/${scheduleId}/execute`, apiKey, { method: "POST" });
}

export async function createTask(
  apiKey: string,
  identifier: string,
  scheduleId: number,
  input: { action: string; payload: string; time_offset: number; continue_on_failure?: boolean }
): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/schedules/${scheduleId}/tasks`, apiKey, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteTask(apiKey: string, identifier: string, scheduleId: number, taskId: number): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/schedules/${scheduleId}/tasks/${taskId}`, apiKey, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

export interface StartupVariable {
  name: string;
  description: string;
  env_variable: string;
  default_value: string;
  server_value: string;
  is_editable: boolean;
  rules: string;
}

export async function getStartup(apiKey: string, identifier: string) {
  const res = await clientFetch<{ data: { attributes: StartupVariable }[]; meta: { startup_command: string; raw_startup_command: string } }>(
    `/api/client/servers/${identifier}/startup`,
    apiKey
  );
  return {
    startupCommand: res.meta.startup_command,
    variables: res.data.map((entry) => entry.attributes),
  };
}

export async function updateStartupVariable(apiKey: string, identifier: string, key: string, value: string) {
  await clientFetch(`/api/client/servers/${identifier}/startup/variable`, apiKey, {
    method: "PUT",
    body: JSON.stringify({ key, value }),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function renameServer(apiKey: string, identifier: string, name: string, description: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/settings/rename`, apiKey, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

export async function reinstallServer(apiKey: string, identifier: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/settings/reinstall`, apiKey, { method: "POST" });
}

// ---------------------------------------------------------------------------
// Subusers ("Users" tab)
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS = {
  Administrator: [
    "control.console", "control.start", "control.stop", "control.restart",
    "database.read", "database.create", "database.update", "database.delete", "database.view_password",
    "schedule.read", "schedule.create", "schedule.update", "schedule.delete",
    "user.read", "user.create", "user.update", "user.delete",
    "backup.read", "backup.create", "backup.delete", "backup.download", "backup.restore",
    "allocation.read", "allocation.create", "allocation.update", "allocation.delete",
    "file.read", "file.read-content", "file.create", "file.update", "file.delete", "file.archive", "file.sftp",
    "startup.read", "startup.update", "startup.docker-image",
    "settings.rename", "settings.reinstall",
    "activity.read", "websocket.connect",
  ],
  Support: [
    "control.console", "control.start", "control.stop", "control.restart",
    "file.read", "file.read-content", "file.create", "file.update", "file.archive",
    "backup.read", "backup.create",
    "schedule.read", "activity.read", "websocket.connect",
  ],
  Viewer: ["control.console", "file.read", "file.read-content", "backup.read", "schedule.read", "activity.read", "websocket.connect"],
} as const;

export type SubuserRole = keyof typeof ROLE_PERMISSIONS;

export interface Subuser {
  uuid: string;
  email: string;
  permissions: string[];
  created_at: string;
}

interface SubuserResponse {
  attributes: Subuser;
}

export async function listSubusers(apiKey: string, identifier: string): Promise<Subuser[]> {
  const res = await clientFetch<{ data: SubuserResponse[] }>(`/api/client/servers/${identifier}/users`, apiKey);
  return res.data.map((entry) => entry.attributes);
}

export async function createSubuser(apiKey: string, identifier: string, email: string, permissions: string[]): Promise<Subuser> {
  const res = await clientFetch<SubuserResponse>(`/api/client/servers/${identifier}/users`, apiKey, {
    method: "POST",
    body: JSON.stringify({ email, permissions }),
  });
  return res.attributes;
}

export async function deleteSubuser(apiKey: string, identifier: string, subuserUuid: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/users/${subuserUuid}`, apiKey, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Backups
// ---------------------------------------------------------------------------

export interface Backup {
  uuid: string;
  name: string;
  ignored_files: string[];
  sha256_hash: string | null;
  bytes: number;
  created_at: string;
  completed_at: string | null;
  is_successful: boolean;
  is_locked: boolean;
}

interface BackupResponse {
  attributes: Backup;
}

export async function listBackups(apiKey: string, identifier: string): Promise<Backup[]> {
  const res = await clientFetch<{ data: BackupResponse[] }>(`/api/client/servers/${identifier}/backups`, apiKey);
  return res.data.map((entry) => entry.attributes);
}

export async function createBackup(apiKey: string, identifier: string, name: string): Promise<Backup> {
  const res = await clientFetch<BackupResponse>(`/api/client/servers/${identifier}/backups`, apiKey, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.attributes;
}

export async function deleteBackup(apiKey: string, identifier: string, backupUuid: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/backups/${backupUuid}`, apiKey, { method: "DELETE" });
}

export async function restoreBackup(apiKey: string, identifier: string, backupUuid: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/backups/${backupUuid}/restore`, apiKey, { method: "POST" });
}

export async function toggleBackupLock(apiKey: string, identifier: string, backupUuid: string): Promise<Backup> {
  const res = await clientFetch<BackupResponse>(`/api/client/servers/${identifier}/backups/${backupUuid}/lock`, apiKey, {
    method: "POST",
  });
  return res.attributes;
}

export async function getBackupDownloadUrl(apiKey: string, identifier: string, backupUuid: string): Promise<string> {
  const res = await clientFetch<{ attributes: { url: string } }>(
    `/api/client/servers/${identifier}/backups/${backupUuid}/download`,
    apiKey
  );
  return res.attributes.url;
}

// ---------------------------------------------------------------------------
// Network (Ports & Proxies / allocations)
// ---------------------------------------------------------------------------

export interface Allocation {
  id: number;
  ip: string;
  ip_alias: string | null;
  port: number;
  notes: string | null;
  is_default: boolean;
}

interface AllocationResponse {
  attributes: Allocation;
}

export async function listAllocations(apiKey: string, identifier: string): Promise<Allocation[]> {
  const res = await clientFetch<{ data: AllocationResponse[] }>(`/api/client/servers/${identifier}/network/allocations`, apiKey);
  return res.data.map((entry) => entry.attributes);
}

export async function createAllocation(apiKey: string, identifier: string): Promise<Allocation> {
  const res = await clientFetch<AllocationResponse>(`/api/client/servers/${identifier}/network/allocations`, apiKey, {
    method: "POST",
  });
  return res.attributes;
}

export async function updateAllocationNotes(apiKey: string, identifier: string, allocationId: number, notes: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/network/allocations/${allocationId}`, apiKey, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function setPrimaryAllocation(apiKey: string, identifier: string, allocationId: number): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/network/allocations/${allocationId}/primary`, apiKey, {
    method: "POST",
  });
}

export async function deleteAllocation(apiKey: string, identifier: string, allocationId: number): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/network/allocations/${allocationId}`, apiKey, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Databases
// ---------------------------------------------------------------------------

export interface ManagedDatabase {
  id: string;
  name: string;
  username: string;
  host: string;
  port: number;
  connectionsFrom: string;
  maxConnections: number;
  password: string | null;
}

interface DatabaseResponse {
  attributes: {
    id: string;
    name: string;
    username: string;
    connections_from: string;
    max_connections: number;
    host: { address: string; port: number };
    relationships?: { password?: { attributes: { password: string } } };
  };
}

function mapDatabase(attrs: DatabaseResponse["attributes"]): ManagedDatabase {
  return {
    id: attrs.id,
    name: attrs.name,
    username: attrs.username,
    host: attrs.host.address,
    port: attrs.host.port,
    connectionsFrom: attrs.connections_from,
    maxConnections: attrs.max_connections,
    password: attrs.relationships?.password?.attributes.password ?? null,
  };
}

// `include=password` is what the official Pterodactyl panel itself passes to show
// credentials without a rotate — the password is otherwise omitted from the response.
export async function listDatabases(apiKey: string, identifier: string): Promise<ManagedDatabase[]> {
  const res = await clientFetch<{ data: DatabaseResponse[] }>(
    `/api/client/servers/${identifier}/databases?include=password`,
    apiKey
  );
  return res.data.map((entry) => mapDatabase(entry.attributes));
}

export async function createDatabase(apiKey: string, identifier: string, name: string): Promise<ManagedDatabase> {
  const res = await clientFetch<DatabaseResponse>(`/api/client/servers/${identifier}/databases?include=password`, apiKey, {
    method: "POST",
    body: JSON.stringify({ database: name, remote: "%" }),
  });
  return mapDatabase(res.attributes);
}

export async function rotateDatabasePassword(apiKey: string, identifier: string, databaseId: string): Promise<ManagedDatabase> {
  const res = await clientFetch<DatabaseResponse>(
    `/api/client/servers/${identifier}/databases/${databaseId}/rotate-password?include=password`,
    apiKey,
    { method: "POST" }
  );
  return mapDatabase(res.attributes);
}

export async function deleteDatabase(apiKey: string, identifier: string, databaseId: string): Promise<void> {
  await clientFetch(`/api/client/servers/${identifier}/databases/${databaseId}`, apiKey, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  id: string;
  event: string;
  is_api: boolean;
  ip: string | null;
  description: string | null;
  properties: Record<string, unknown>;
  timestamp: string;
}

export async function getActivity(apiKey: string, identifier: string): Promise<ActivityEntry[]> {
  const res = await clientFetch<{ data: { attributes: ActivityEntry }[] }>(`/api/client/servers/${identifier}/activity`, apiKey);
  return res.data.map((entry) => entry.attributes);
}
