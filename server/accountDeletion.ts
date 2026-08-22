import { db } from "./db.js";
import * as pterodactyl from "./pterodactyl.js";
import * as cloudflare from "./cloudflare.js";
import * as relay from "./relay.js";
import type { UserRow } from "./db.js";
import { logActivity } from "./activityLog.js";
import { decryptClientKey } from "./secretCrypto.js";

/**
 * Tears down a user everywhere — their real Pterodactyl servers, their mirrored
 * Pterodactyl account, and every local row referencing them. Used by both
 * self-service account deletion and the owner's admin-initiated deletion.
 * Only the owner-initiated path is logged as an activity event — a user
 * deleting their own account is a private action, not something for the
 * owner's admin-actions feed.
 */
export async function deleteUserEverywhere(user: UserRow, initiatedByOwner = false): Promise<void> {
  // Best-effort cleanup on Pterodactyl's side — a failure here shouldn't block
  // deletion, since this app's own record is what actually controls access.
  if (user.pterodactyl_client_key) {
    const clientKey = decryptClientKey(user.pterodactyl_client_key);
    try {
      const servers = await pterodactyl.listClientServers(clientKey);
      for (const s of servers) {
        try {
          const details = await pterodactyl.getServerDetails(clientKey, s.identifier);
          await pterodactyl.deleteApplicationServer(details.internalId);
        } catch {
          // continue cleaning up the rest even if one server fails to delete
        }
      }
    } catch {
      // listing servers failed — nothing to clean up, or Pterodactyl is unreachable
    }
  }
  if (user.pterodactyl_user_id) {
    try {
      await pterodactyl.deleteApplicationUser(user.pterodactyl_user_id);
    } catch {
      // leftover Pterodactyl user with no local owner — harmless, not worth blocking on
    }
  }

  // Clean up any subdomains those servers had — otherwise the DNS record and
  // relay forwarding rule outlive the server they pointed at.
  const subdomains = db
    .prepare("SELECT subdomain FROM servers WHERE user_id = ? AND subdomain IS NOT NULL")
    .all(user.id) as { subdomain: string }[];
  for (const { subdomain } of subdomains) {
    await cloudflare.deleteMinecraftSubdomain(subdomain).catch(() => {});
    await relay.removeRelayRoute(subdomain).catch(() => {});
  }

  db.prepare(
    "DELETE FROM server_plugins WHERE server_identifier IN (SELECT pterodactyl_identifier FROM servers WHERE user_id = ?)"
  ).run(user.id);
  db.prepare("DELETE FROM servers WHERE user_id = ?").run(user.id);
  db.prepare("DELETE FROM server_requests WHERE user_id = ?").run(user.id);
  db.prepare("DELETE FROM invoices WHERE user_id = ?").run(user.id);
  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);

  if (initiatedByOwner) {
    logActivity("account_deleted", "admin", `${user.username}'s account was deleted by the owner`);
  }
}
