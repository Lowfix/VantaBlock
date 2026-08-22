import { db } from "./db.js";

export type FeatureKey =
  | "server_requests"
  | "require_server_approval"
  | "stripe_topups"
  | "new_registration"
  | "google_auth"
  | "self_service_subdomains"
  | "plugin_browser";

interface FeatureMeta {
  key: FeatureKey;
  label: string;
  description: string;
}

export const FEATURES: FeatureMeta[] = [
  {
    key: "server_requests",
    label: "Server requests",
    description:
      "Customers can submit a new server for approval. Only matters while approval is required below — doesn't affect the owner/admin's own instant deploys.",
  },
  {
    key: "require_server_approval",
    label: "Require approval for new servers",
    description:
      "On: customer deploys go into a request queue for the owner to approve. Off: customers deploy instantly, same as the owner — no approval step at all.",
  },
  {
    key: "stripe_topups",
    label: "Add funds via card",
    description: "Customers can add money to their balance through Stripe.",
  },
  {
    key: "new_registration",
    label: "New account registration",
    description: "New visitors can create an account with email and password. Existing accounts can still log in.",
  },
  {
    key: "google_auth",
    label: "Google sign-in/sign-up",
    description: "Turns off Google sign-in and sign-up entirely — existing Google-linked accounts won't be able to log in while this is off.",
  },
  {
    key: "self_service_subdomains",
    label: "Self-service subdomains",
    description: "Customers (and admins, on their own servers) can set or change a server's subdomain from the Players tab.",
  },
  {
    key: "plugin_browser",
    label: "Plugin browser (install/update/uninstall)",
    description:
      "Customers can install, update, uninstall, and enable/disable real Modrinth plugins from the Plugins tab. Off: browsing and viewing installed plugins still works, but every mutating action is blocked — a kill switch for pulling the feature fast if a live install goes wrong.",
  },
];

const seedFlag = db.prepare("INSERT OR IGNORE INTO feature_flags (key, enabled) VALUES (?, 1)");
for (const feature of FEATURES) seedFlag.run(feature.key);

export function isFeatureEnabled(key: FeatureKey): boolean {
  const row = db.prepare("SELECT enabled FROM feature_flags WHERE key = ?").get(key) as { enabled: number } | undefined;
  return row ? row.enabled === 1 : true;
}

export function getAllFlags(): (FeatureMeta & { enabled: boolean })[] {
  return FEATURES.map((f) => ({ ...f, enabled: isFeatureEnabled(f.key) }));
}

export function setFeatureEnabled(key: FeatureKey, enabled: boolean): void {
  db.prepare("UPDATE feature_flags SET enabled = ? WHERE key = ?").run(enabled ? 1 : 0, key);
}
