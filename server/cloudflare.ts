const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID || "";
export const PUBLIC_IP = process.env.PUBLIC_IP || "";

export const ROOT_DOMAIN = process.env.CLOUDFLARE_ROOT_DOMAIN || "duxy.online";

export function isConfigured(): boolean {
  return Boolean(CF_API_TOKEN && CF_ZONE_ID && PUBLIC_IP);
}

interface CloudflareResponse<T> {
  success: boolean;
  result: T;
  errors?: { message?: string }[];
}

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isConfigured()) {
    throw new Error("Subdomains aren't configured on this server yet.");
  }
  const res = await fetch(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = (await res.json()) as CloudflareResponse<T>;
  if (!res.ok || !body.success) {
    throw new Error(body.errors?.[0]?.message || `Cloudflare API responded with ${res.status}`);
  }
  return body.result;
}

async function findRecordId(type: string, name: string): Promise<string | null> {
  const records = await cfFetch<{ id: string }[]>(
    `/zones/${CF_ZONE_ID}/dns_records?type=${type}&name=${encodeURIComponent(name)}`
  );
  return records[0]?.id ?? null;
}

async function upsertRecord(type: string, name: string, body: Record<string, unknown>): Promise<void> {
  const existingId = await findRecordId(type, name);
  if (existingId) {
    await cfFetch(`/zones/${CF_ZONE_ID}/dns_records/${existingId}`, { method: "PUT", body: JSON.stringify(body) });
  } else {
    await cfFetch(`/zones/${CF_ZONE_ID}/dns_records`, { method: "POST", body: JSON.stringify(body) });
  }
}

/**
 * Minecraft needs an SRV record to resolve a hostname without the player typing a
 * port — its target must itself be a real hostname, so a plain (non-proxied, since
 * this is raw TCP the server is reached at directly, not through Cloudflare's edge)
 * A record backing it is created too.
 */
export async function upsertMinecraftSubdomain(subdomain: string, port: number, targetIp?: string): Promise<void> {
  const hostname = `${subdomain}.${ROOT_DOMAIN}`;
  const srvName = `_minecraft._tcp.${hostname}`;

  await upsertRecord("A", hostname, { type: "A", name: hostname, content: targetIp || PUBLIC_IP, ttl: 300, proxied: false });
  await upsertRecord("SRV", srvName, {
    type: "SRV",
    name: srvName,
    data: { priority: 0, weight: 5, port, target: hostname },
    ttl: 300,
  });
}

export async function deleteMinecraftSubdomain(subdomain: string): Promise<void> {
  const hostname = `${subdomain}.${ROOT_DOMAIN}`;
  const srvName = `_minecraft._tcp.${hostname}`;

  const aId = await findRecordId("A", hostname);
  if (aId) await cfFetch(`/zones/${CF_ZONE_ID}/dns_records/${aId}`, { method: "DELETE" });

  const srvId = await findRecordId("SRV", srvName);
  if (srvId) await cfFetch(`/zones/${CF_ZONE_ID}/dns_records/${srvId}`, { method: "DELETE" });
}
