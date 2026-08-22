# Backend Reference

Express 5 + better-sqlite3, TypeScript, ESM (`type: module` in package.json). Entry point
`server/index.ts`. Runs as a plain Node process — no framework magic, no ORM. See
[PROJECT.md](PROJECT.md) for roles/flags/plans context, [INFRASTRUCTURE.md](INFRASTRUCTURE.md)
for what's actually running on the real Pterodactyl boxes this talks to.

## Entry point (`server/index.ts`)

- Loads `.env` via `./loadEnv.js` (first import — has side effects, must stay first).
- Stripe webhook (`POST /api/billing/webhook`) is registered **before** `express.json()` because
  Stripe's signature check needs the raw request bytes — `express.json()` would consume/reserialize
  the body and break it.
- All other routers mounted after `express.json()` + `cookie-parser()`:

  | Prefix | Router file | Auth |
  |---|---|---|
  | `/api/auth` | `routes/auth.ts` | public |
  | `/api/account` | `routes/account.ts` | any logged-in user |
  | `/api/servers` | `routes/servers.ts` | any logged-in user (scoped to own servers) |
  | `/api/bank` | `routes/bank.ts` | admin-only |
  | `/api/accounts` | `routes/accounts.ts` | owner-only |
  | `/api/overview` | `routes/overview.ts` | owner-only |
  | `/api/owner` | `routes/ownerConsole.ts` | owner-only |
  | `/api/requests` | `routes/requests.ts` | mixed (own requests vs admin-only list/approve/deny) |
  | `/api/billing` | `routes/billing.ts` | any logged-in user |
  | `/api/public/stats` | `routes/publicStats.ts` | public (feeds the landing page) |
  | `/api/support` | `routes/support.ts` | any logged-in user (owner-only subset) |

- `GET /api/health` — plain liveness check, used by the deploy script.
- A **global error handler** is registered last, after every router (Express identifies one by
  arity — it must keep all four parameters). Anything a route throws lands here and comes back as
  JSON `{ error }`, never Express's built-in **HTML** page, which leaked a full stack trace with
  absolute paths whenever `NODE_ENV` was unset. `SQLITE_BUSY` maps to a 503 + `Retry-After` (it's
  transient — the client should retry), `SQLITE_CONSTRAINT_*` to a 409 with the raw SQL text kept
  server-side. Route-level `try/catch` (e.g. `servers.ts`'s `handle()`) still wins where present;
  this is the backstop for everything else.
- The monthly billing cron (`billingCron.ts`) is **deliberately not started** — this phase runs
  free for friends with no top-ups, so charging balances / suspending for non-payment would be a
  bug right now. Don't re-enable it without the user asking.

## Database (`server/db.ts`)

Single SQLite file (`server/data.db`, WAL mode), schema applied via idempotent
`CREATE TABLE IF NOT EXISTS` + manual `PRAGMA table_info` / `ALTER TABLE ADD COLUMN` checks at
module load — **this file itself is the migration system**.

**Concurrency model — read this before "fixing" a lock problem** (measured 2026-08-21, see DEVLOG):
better-sqlite3 is **synchronous on a single connection**, so writes from within this process are
serialized and cannot contend with each other — 40 concurrent writers sustained 2142 req/s with
zero lock errors. WAL and a 5000ms `busy_timeout` are both set explicitly at the top of `db.ts`.
The only real contention is **another process** writing the same file (a one-off maintenance
script against the live DB, or two API instances overlapping on restart), and it is worse than it
looks: the busy handler sleeps *on the event loop thread*, so the whole API — `/api/health`
included — freezes for as long as the other process holds the lock. That is inherent to a
synchronous driver and can't be fixed in application code; `index.ts`'s error handler just makes
the eventual failure a retryable 503 instead of a 500. **Don't hold a long write transaction
against the live `data.db` from a script.**

Anything writing more than one row uses `db.transaction(...)` invoked as **`.immediate(...)`**
(see `deployCharge.ts`, `support.ts`). Not a style preference: the default deferred `BEGIN` takes a
read lock and only upgrades at the first write, and SQLite fails that upgrade with an immediate
`SQLITE_BUSY` that `busy_timeout` is **not permitted to retry**. `BEGIN IMMEDIATE` takes the write
lock up front, where the timeout does apply.

Indexes for the hot query shapes live in one block at the **bottom** of `db.ts` (added after a load
test found several page-load queries doing full scans). Because the driver is synchronous, a scan
doesn't just slow its own request — it blocks every other request for the duration, so a new query
on a growing table wants an index sooner here than it would behind an async driver. To add a column to an existing table,
follow the existing pattern: check `PRAGMA table_info`, `ALTER TABLE ... ADD COLUMN` if missing,
optionally backfill existing rows. There is no separate migrations folder.

Tables:

- **`users`** — profile, `password_hash` (null for Google-only accounts), `auth_provider`,
  `balance`, invoice-preview fields, 2FA flag (visual only — see FRONTEND.md), notification prefs,
  `pterodactyl_user_id` + `pterodactyl_client_key` (plaintext — local-dev-only simplification,
  flagged in the code as needing encryption for a real production build), `is_admin`, `suspended`.
- **`servers`** — local mirror of a real Pterodactyl server: `pterodactyl_identifier` (the string
  id used in Pterodactyl's client API URLs, unique), `pterodactyl_id` (Pterodactyl's internal
  numeric id, used for Application API calls), `plan_id` (empty string `""` means a custom-configured
  server, not from a fixed tier), `server_type`, `status`, `billing_status`, `next_bill_at`,
  `grace_period_ends_at`, `subdomain` (unique, nullable), `subdomain_relayed` (0/1 — whether the
  *current* subdomain was set up via the relay VM; recorded at save time, not inferred later, since
  a node can become relay-capable after a subdomain already exists), `ram_mb`/`disk_mb`/`cpu_percent`
  (non-null only for a custom-configured server).
- **`invoices`** — ledger rows; `amount` can be negative (top-ups shown as negative debits against
  balance additions — check existing call sites before assuming sign convention); `stripe_session_id`
  nullable with a **partial unique index** (SQLite can't add a UNIQUE column via ALTER TABLE) that
  stops a retried Stripe webhook from double-crediting.
- **`server_requests`** — pending/approved/denied customer deploy requests; `ram_mb`/`disk_mb`/
  `cpu_percent` are filled in by the owner **at approval time**, not by the requester (null while
  pending); `generate_subdomain` (0/1, default 1).
- **`activity_log`** — durable log of events with no other trace (admin actions, deletions).
  Combined at read time with live derived events from `users`/`servers`/`server_requests`/
  `invoices` — see `activityLog.ts` below. Don't assume this table alone is the full activity feed.
- **`support_tickets`** / **`support_ticket_messages`** — see PROJECT.md's Support Tickets section
  for the product behavior; schema is a straightforward ticket + threaded-messages pair, `is_owner`
  0/1 on each message.
- **`feature_flags`** — `key` PRIMARY KEY, `enabled` 0/1, seeded from the `FEATURES` array in
  `featureFlags.ts` on every boot via `INSERT OR IGNORE` (adding a new flag = add it to that array,
  the table picks it up automatically).
- **`invite_codes`** — single-use signup codes; `used_by_user_id` null until consumed.

## Auth (`server/auth.ts`)

JWT in an httpOnly cookie (`vb_session`, 30-day expiry, `sameSite: "lax"`), signed with
`SESSION_SECRET` (falls back to a hardcoded dev secret if unset — **must** be set in real prod).
`requireAuth` middleware also re-checks `suspended` on every request (not just at login) and
clears the cookie + 403s if the account was suspended after the session was issued.
`toPublicUser()` is the canonical shape sent to the frontend — computes `isAdmin`/`isOwner` from
`ADMIN_EMAIL` + `is_admin` inline (matches `adminGate.ts`'s logic; if you change one, check the
other).

## Pterodactyl integration (`server/pterodactyl.ts`)

Thin typed wrapper over both Pterodactyl APIs — **Application API** (`APP_KEY`, full admin power,
used for anything cross-user: creating servers/users, suspending, node/allocation queries) and
**Client API** (per-user `pterodactyl_client_key`, scoped to that user's own servers — everything
in `servers.ts` routes uses this). Notable pieces:

- `mintClientApiKeyForUser()` — the Application API has **no endpoint** to mint a client key on a
  user's behalf, so this replays Panel's own login → CSRF → "create API key" web flow by hand
  (cookie jar, CSRF token scraping). Fragile by nature — if Panel's web UI internals change, this
  breaks silently. Used once, right after `pterodactylMirror.ts` creates the mirrored user.
- `listFreeAllocationIds(limit)` / `getFreeAllocationId()` — free port allocations on whichever
  non-maintenance-mode node has the lowest utilization **percentage** (not raw free memory, so a
  node with a much larger ceiling doesn't always win just for headroom), in preference order.
  Returns several candidates because **the pick isn't a claim**: nothing reserves the port until
  the create call lands, so two simultaneous deploys read the same "free" allocation (measured: 4
  concurrent calls, 4× the same id) and Panel fails all but one. `provisionServer()` both
  serializes the pick→create window and walks these candidates — see the Provisioning section.
- **Application-API calls retry on Panel's throttle; client-API calls don't.** Panel allows
  **256 requests/minute per API key**, and this app has exactly one Application key shared by
  provisioning, install polling and every owner-console reconcile — so a deploy burst really does
  exhaust it (measured with `x-ratelimit-limit: 256` + `retry-after` on the 429). `applicationFetch`
  waits out the `retry-after` (≤3 attempts, fresh 45s timeout per attempt — Node's `fetch` has no
  default timeout and a hung call would hold the deploy lock). Client-API calls are per-user keys
  driving a browser tab, so those still surface the 429 immediately (`pterodactylErrorStatus` in
  `routes/servers.ts`) rather than stalling a request.
- `WINGS_NODE_LAN_IPS` / `WINGS_NODE_RELAY_IPS` — small fixed `{nodeId: ip}` maps from env JSON
  (`WINGS_NODE_IPS`, `WINGS_NODE_RELAY_IPS`), because a node's Pterodactyl-recorded `fqdn` is a
  Cloudflare-tunneled hostname good only for Panel↔Wings control traffic, not a real LAN address a
  router port-forward or the relay's HAProxy can target directly.
- `getNodeStatuses()` explicitly does **not** do a live reachability probe anymore — a prior
  version did, but it depended on node metadata (`daemon_listen`/`scheme`) that doesn't reliably
  reflect Wings' actual listening port, producing a confusing/wrong "connected" signal. Removed
  rather than fixed.
- `createSchedule()`/`updateSchedule()` inject an undocumented `month: "*"` field — this
  Pterodactyl build's schedule controller reads it when computing the next-run timestamp and 500s
  with a TypeError if it's absent, even though it's not in the validated fields.
- Files/Schedules/Startup/Subusers/Backups/Network(allocations)/Databases/Activity — all
  client-API wrappers, one function per Pterodactyl endpoint, used directly by the matching tab
  component's route handler in `servers.ts`.
- **Silent-undefined-field trap, already hit once**: `mapDatabase()`'s `DatabaseResponse` interface
  originally declared the database-name field as `database`, but the real live Panel's client API
  actually returns it as `name`. Since `res.json()` (via `JSON.stringify`) silently drops object
  keys whose value is `undefined` rather than erroring, this shipped and passed a typecheck cleanly
  while quietly omitting the database name from every response — only caught by an actual live
  end-to-end test through the app's own routes, not by code review or by testing directly against
  Pterodactyl's raw API (which happens to echo back whatever shape you send, masking the mismatch
  in a naive test). **Lesson**: when wrapping a third-party API response, verify the interface
  against a real raw response body at least once — don't assume a `DatabaseResponse`-shaped
  TypeScript interface for a piece of this integration was ever actually validated against a live
  payload just because it typechecks and "looks like" every other wrapper in this file.

## Provisioning (`server/provisioning.ts`, `server/deployCharge.ts`)

`provisionServer()` — picks a free allocation, calls the Application API to create the real
server, inserts a local `servers` row with `status = 'installing'`, then **returns immediately**;
the actual install (jar download, EULA accept, boot) is finished by `finishProvisioning()` running
in the background (polls `isServerInstalled()` up to 5 minutes). On success: writes `eula.txt`
directly (server is left **stopped** — shouldn't start consuming resources or show "online" until
the user actually presses start), and if `generateSubdomain` was requested, picks the server's
default allocation, generates a unique slugified subdomain, and — if the relay is configured and
this server's node has a relay tunnel — routes through `relay.upsertRelayRoute()` +
`cloudflare.upsertMinecraftSubdomain()` pointed at the relay's public IP; otherwise DNS points
straight at `PUBLIC_IP`. Subdomain failure here is **non-fatal** — logged, user can still set one
manually later from the Subdomain tab.

`deployCharge.ts`'s `deployAndCharge()` is the shared wrapper used by both instant admin deploys
and request-approval: calls `provisionServer()`, then debits the plan price from the user's
balance and inserts an invoice row (price will be `0` under `freePlan()` in the current free
phase — see PROJECT.md).

**Concurrency and partial failure** (all six behaviours below exist because a concurrent-deploy
load test produced them for real on 2026-08-22 — see DEVLOG):

- **The allocation pick→create window is serialized** process-wide (`withAllocationLock`). Picking a
  free port and claiming it are two API calls, and simultaneous deploys otherwise all pick the same
  one: four concurrent deploys used to come out as 1 success + 3 bare Panel 500s with eight ports
  free. The lock only covers the create call (~0.5s); installs still run concurrently.
- **A create that loses its port falls forward** to the next candidate from
  `listFreeAllocationIds()` — that covers races this process can't lock out (a second instance,
  someone creating a server directly in Panel). Errors that aren't about the allocation are
  surfaced immediately rather than retried on every port.
- **A failed local INSERT deletes the server that was just created.** Otherwise the real server sits
  on the node with no local row, and `reconcileServers()` only detects the *opposite* drift (local
  row, no real server), so nothing would ever find it again.
- **Transient install-poll errors don't fail the deploy.** One throttled `isServerInstalled()` call
  used to abort the watcher and mark a perfectly healthy installing server `failed` (a state
  `reconcileServers()` won't clean up, because the server really does exist). Only "could not be
  found" gives up early. The `eula.txt` write is retried and, failing that, logged rather than
  failing the deploy.
- **`resumeInterruptedProvisioning()`** (called from `index.ts` after `listen`) picks up rows left
  at `status = 'installing'` by an API restart mid-deploy — the watcher is in-memory only, so those
  rows would otherwise stay "Installing…" forever. A resumed install skips subdomain generation:
  that choice isn't recorded on the row.
- **`claimSubdomain()` writes the slug to the row before any DNS exists**, so the unique index
  decides who gets a contested name. The old select-then-write-later version let two same-name
  deploys settle on the same slug and silently repoint the first server's DNS record at the second
  server's port. **`PUT /:identifier/subdomain` in `servers.ts` follows the same claim-first
  ordering** (it had its own copy of the same race) — claim the row, then allocations/relay/DNS,
  release the claim back to the previous value on failure, and delete the *old* name's records only
  once the new ones are live. If you add another path that assigns a subdomain, copy this ordering;
  a "is it taken?" SELECT followed by awaits is not a claim.

## Server types (`server/serverTypes.ts`)

Fixed list of real Pterodactyl eggs from nest 1 ("Minecraft"): `vanilla` (egg 5), `paper` (egg 3),
`forge` (egg 4), `neoforge` (egg 16, pinned to `java_17` docker image — NeoForge's bundled
ModLauncher/ASM can't parse class files from newer JVMs for the versions this egg supports),
`fabric` (egg 15). Each has its own `startup` command string and `environment(version)` function
(different eggs expect different env var names for "which MC version" — not interchangeable).
**Do not repurpose egg id 17** ("Paper (Sleeping-Servers)") — it's an orphaned custom egg from an
abandoned lazymc sleep-server experiment (fully reverted; see INFRASTRUCTURE.md) and isn't
referenced anywhere in current code.

## Plugins (`server/plugins.ts`, `server/modrinth.ts`)

Lets a customer browse and install real Paper plugins from the panel's Plugins tab instead of
manually uploading jars. Plan: `.claude/plans/agile-riding-salamander.md`.

**Modrinth-only — Hangar support was removed entirely on 2026-08-21, not just hidden.** Hangar
(PaperMC's own official repo) was built and verified live end-to-end alongside Modrinth, briefly
pulled from just the *selectable* sources on 2026-08-20 (code left intact for an easy re-enable),
then fully deleted the next day at the user's explicit request — `server/hangar.ts` no longer
exists, and every `"hangar"` dispatch branch in `plugins.ts` is gone (confirmed no production
`server_plugins` row referenced it before deleting). `PluginSource` is now a single-value literal
type (`"modrinth"`). See the 2026-08-21 DEVLOG entry if Hangar ever needs to come back — its real,
hands-on-verified API shapes are kept below and in that history for exactly that reason, but
nothing in the current code calls them. SpigotMC remains deliberately out of scope — no official
API, and the common workaround (Spiget) is an unofficial scraper mirror; don't add it without
re-raising that decision with the user.

**Verified API shapes** (as of 2026-08-20 — Hangar's is now historical reference only, kept in case
the source returns; re-verify with a live `curl` before trusting either if that day comes, don't
assume they're still accurate):

- **Hangar** (code removed, API shape kept for reference), base `https://hangar.papermc.io/api/v1`,
  unauthenticated, no observed rate-limit headers:
  - `GET /projects?query=<term>&platform=PAPER&limit=<n>` → `{pagination, result: HangarProject[]}`.
    A project's real path identifier is `namespace.slug`, **not** its numeric `id`. Also has `stats.downloads`, `description`, `avatarUrl`.
  - `GET /projects/{slug}/versions?limit=<n>` → `{pagination, result: HangarVersion[]}`. A version's
    real identifier is its `name` string (e.g. `"2.1.1"`), **not** its numeric `id`.
    `downloads` is keyed **per platform** (`downloads.PAPER.downloadUrl`, `downloads.PAPER.fileInfo.name`) — always read the `PAPER` key.
  - `GET /projects/{slug}/versions/{versionName}` → single version, same shape — used to re-resolve
    a fresh download URL at install/update time.
- **Modrinth** (the only source actually in use today), base `https://api.modrinth.com/v2`,
  unauthenticated for reads but **send a real `User-Agent` header** identifying this app, confirmed
  rate limit `300/min` via `X-Ratelimit-Limit`:
  - `GET /search?query=<term>&facets=[["project_type:plugin"]]&limit=<n>` → `{hits: [...], total_hits}`.
    **A hit's top-level `project_type` can say `"mod"` even when it matched the `plugin` facet** —
    the facet matches against an internal `all_project_types` list, not that field. Don't use
    `project_type` for display logic; rely on it having matched the facet plus `categories`
    containing `paper`/`spigot`/`bukkit`. Identifier to use is `project_id`.
  - `GET /project/{id}/version?loaders=["paper"]` → a **bare array**, no wrapper object (unlike
    Hangar's `{pagination, result}` — the two sources don't share a response envelope, normalize
    separately). A version's identifier is its `id`. Each version has `files[]`; pick the file with
    `primary: true` (fall back to `files[0]` if none is marked primary — a version can ship extra
    non-primary files like a sources jar).
  - `GET /version/{id}` → single version, same shape as a list item — used to re-resolve a fresh
    download URL at install/update time.

**Non-negotiable security rule**: the install/update routes never accept a client-supplied URL —
that's an SSRF + arbitrary-file-write primitive onto a real production game server. `modrinth.ts`
is the only module that talks to the outside world; every route only ever passes
`(source, projectId, versionId)`, and for updates specifically `source`/`projectId` are read from
the existing trusted `server_plugins` DB row, never from the request body — only
`versionId`/`versionName` come from the request on an update.

**Design**:
- `server/plugins.ts` is the only module `servers.ts` imports for this feature — it owns the
  `server_plugins` table, and reconciles it against a live
  `pterodactyl.listFiles(apiKey, identifier, "/plugins")` call on every read so a jar
  uploaded/deleted directly through the Files tab is never silently invisible or silently wrong —
  it shows up as a distinct "unmanaged" entry (filename + enabled state only, no metadata, no
  re-adding a zip parser to read `plugin.yml`).
- `server_plugins` table (`db.ts`): `(server_identifier, source, project_id, project_name,
  project_author, version_id, version_name, file_name, enabled, installed_at, updated_at)`, unique
  on `(server_identifier, file_name)`. This table is what makes "update available" checking
  possible (compare each row's `version_id` against the source's current newest version) without
  re-parsing jar internals on every page load — a stateless "just list the directory" design
  couldn't do this. `projectName`/`projectAuthor`/`versionName` are **display-only** metadata,
  accepted from the client the same way the search UI already showed them (never used for any
  file/network operation) — sparing a redundant project-detail lookup call.
- **Only Paper is plugin-capable** (`SERVER_TYPES` — vanilla/forge/neoforge/fabric aren't) — checked
  against the local `servers.server_type` column, since Pterodactyl itself has no opinion and would
  happily let a jar get uploaded to any server type's `/plugins` folder. This is purely this app's
  own product policy, enforced server-side on every mutating route (not just client-side UI gating).
- **No native Paper/Spigot runtime enable/disable** — implemented via renaming `file.jar` ↔
  `file.jar.disabled` (`togglePlugin`), which — like install/update/uninstall — only takes effect on
  the next restart, since Paper only scans `/plugins` at boot. `updatePlugin` preserves a disabled
  plugin's disabled state across the version swap (uploads as the enabled filename, then
  immediately renames to `.disabled` if the row was already disabled) rather than silently
  re-enabling something an admin deliberately turned off.
- `ensurePluginsFolder()` calls `pterodactyl.createFolder` before every install/update and swallows
  the error — a brand-new server that's never been booted has no `/plugins` directory yet (Paper
  creates it on first boot), and `uploadFile` doesn't create missing parent directories on its own.
- `downloadJar()` enforces a 100MB cap (via `Content-Length` when present, and the actual buffer
  size regardless) and requires the resolved filename to end in `.jar` before ever calling
  `pterodactyl.uploadFile` — the one point where bytes from a third party land on a real server.
- **Feature flag**: `plugin_browser` (`server/featureFlags.ts`), checked inline per mutating route
  (`requirePluginBrowserEnabled()` in `servers.ts`) the same way `self_service_subdomains` is —
  browsing/listing (`GET .../plugins`, `.../search`, `.../versions`) is never gated, only
  install/update/uninstall/toggle 403 when it's off. The `GET .../plugins` response includes
  `featureEnabled` so the UI can disable buttons without a second round trip.
- **Cleanup fan-out**: a `server_plugins` row must be deleted alongside its `servers` row at all
  three existing cleanup points — `accountDeletion.ts`'s `deleteUserEverywhere`, `servers.ts`'s
  `DELETE /:identifier`, and `ownerConsole.ts`'s `reconcileServers` stale-server loop.

**Routes** (all under the existing `/:identifier` + `requireClientKey` chain in `servers.ts`):
```
GET    .../plugins                                  -> { supported, featureEnabled, installed, unmanaged }
GET    .../plugins/search?source=modrinth&q=         -> { results }  (source must be "modrinth" — see above)
GET    .../plugins/:source/:projectId/versions       -> { versions }  (newest first)
POST   .../plugins/install    { source, projectId, projectName, projectAuthor, versionId, versionName }
DELETE .../plugins/unmanaged  { fileName, enabled }
DELETE .../plugins/:pluginRowId
POST   .../plugins/:pluginRowId/update  { versionId, versionName }
POST   .../plugins/:pluginRowId/toggle
```

**Verified for real** (2026-08-20, disposable Paper servers, full cleanup after — see DEVLOG; this
predates Hangar's 2026-08-21 removal, so "both sources" below is historical): search/versions
against both live sources; install from both Hangar and Modrinth (real small plugins); the on-disk
file appearing in `/plugins` and the DB row appearing in `GET .../plugins`; toggle flipping the
real on-disk filename between `X.jar`/`X.jar.disabled`; update swapping the jar and updating the DB
row, including the disabled-state-preserved-across-update path; uninstall removing both the file
and the row; the `plugin_browser` flag blocking mutations while leaving browsing up; the non-Paper
400/`supported:false` gate.

## Supporting modules

- **`accountDeletion.ts`** — `deleteUserEverywhere(user, initiatedByOwner?)`: single shared
  best-effort teardown (real Pterodactyl servers + application user, subdomain/relay cleanup,
  local `servers`/`server_requests`/`invoices`/`users` rows). Only logs an activity event when the
  owner initiated it — self-deletion stays private.
- **`activityLog.ts`** — `logActivity()` writes durable one-off events; `getActivity(categories?)`
  merges that table with live-derived events from other tables at read time. Overview's feed
  excludes payment/$ events; Owner Console's `/activity` includes everything.
- **`inviteCodes.ts`** — generates unambiguous random codes, atomic single-use consumption
  (`UPDATE ... WHERE used_by_user_id IS NULL`) to avoid a double-use race.
- **`minecraftStatus.ts`** — direct Minecraft server-list ping (via `minecraft-server-util`, not
  through Pterodactyl at all) for real live player counts/names.
- **`pterodactylMirror.ts`** — on signup, best-effort creates a real Pterodactyl Application user
  + mints a client API key for them (retries with a suffixed username on collision), stored on the
  local user row.
- **`billingConstants.ts`** — `BILLING_PERIOD_DAYS = 30`, `GRACE_PERIOD_DAYS = 3`.
- **`stripeBilling.ts`** — `grossUpForStripeFee()` surfaces Stripe's cut as a visible surcharge to
  the customer rather than absorbing it silently; webhook handler double-credit-guards via the
  `invoices.stripe_session_id` unique index.

## Route-by-route summary

See the full method/path list for every router in the git-less commit history of this doc's
authoring session — the short version, one line per file:

- **`auth.ts`** — register (invite-gated, feature-flagged)/login/Google OAuth/logout/`me`.
- **`account.ts`** — self-service profile/settings/password/invoices/account deletion.
- **`accounts.ts`** (owner-only) — list all accounts, per-account detail, grant/revoke admin,
  suspend/unsuspend, reset password, delete another account.
- **`bank.ts`** (admin-only) — add/deduct/set balance + invoice rows, edit username/email, manually
  trigger the billing cron.
- **`billing.ts`** — create a Stripe PaymentIntent for a top-up (feature-flagged).
- **`overview.ts`** (owner-only) — the shared owner dashboard payload: infra + node status, live
  aggregate CPU/RAM, growth metrics, merged activity feed (no payment events).
- **`ownerConsole.ts`** (owner-only) — exports `reconcileServers()` (deletes local rows with no
  matching real Pterodactyl server, used by both this router and Overview); full server list,
  invoice ledger, per-user billing summary, full activity feed (includes payments), feature-flag
  get/toggle, infra/relay status, invite code list/create/delete.
- **`publicStats.ts`** (public) — aggregate non-customer-specific stats for the landing page.
- **`requests.ts`** — customer's own requests; admin-only list/approve(with plan
  downgrade)/deny.
- **`servers.ts`** — by far the largest router; every server-scoped Pterodactyl client-API action
  (power, console, files, schedules, startup, settings, subusers, backups, network/allocations,
  databases, subdomain, activity) plus create/list/delete and admin-only plan changes.
- **`support.ts`** — see PROJECT.md; ticket CRUD, reply (auto-reopens on customer reply), close/reopen.

When adding a new server-scoped route, follow `servers.ts`'s existing pattern: mount under
`/:identifier`, go through the `requireClientKey` middleware, and call the matching
`pterodactyl.ts` wrapper rather than hitting the Pterodactyl API directly from the route handler.
