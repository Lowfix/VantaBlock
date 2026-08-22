# Infrastructure Reference

VantaBlock talks to **real** self-hosted Pterodactyl infrastructure, not a mock. This file
documents the physical topology and every hard-won config lesson from operating it. Read this
before touching anything Pterodactyl/Wings/DNS/relay-related — several of these mistakes are easy
to repeat if you don't know the history.

## Topology

| Box | Role | Address | Notes |
|---|---|---|---|
| "CasaOS" box | Pterodactyl **Panel** + MariaDB + a dedicated customer-database MariaDB | `192.168.1.248` (LAN) | Debian, SSH user `glitch`. Also runs the VantaBlock app itself (Express API + built frontend), deployed via `scripts/deploy-server.ps1`. **Correction to an earlier note**: `glitch` *can* run `docker`/`docker compose` directly over SSH with the deploy key (`~/.ssh/vantablock_deploy`) — confirmed working for `docker ps`, `docker compose up -d <service>`, and `docker exec` (verified when standing up the customer-database container below). The compose stack lives at `/opt/pterodactyl/docker-compose.yml` + `/opt/pterodactyl/.env`, mirrored in this repo at `pterodactyl/docker-compose.yml`/`pterodactyl/.env` for reference — the two should be kept in sync by hand (no automated deploy pushes this file). |
| "Main Node" | Wings (Pterodactyl node id **2**) | LAN `192.168.1.113` (from `WINGS_NODE_IPS` env) | The only Wings node — a prior node (id 1, this dev machine) was retired 2026-08-16. **Corrected 2026-08-23, direct from the user**: this is a genuinely separate physical box running **native Debian**, with Wings installed as a **native systemd service directly on the OS** — not Docker, not WSL2. An earlier session's write-up claimed "natively inside a WSL2 'Ubuntu' distro," reasoning from indirect evidence (this *dev* machine's own separate, unrelated WSL Ubuntu distro) rather than direct access to the Main Node itself — that WSL2 claim was wrong and has been removed; don't resurrect it. `pterodactyl/wings/Dockerfile` in this repo is dead/reference-only regardless of which node story is true — Wings itself isn't Dockerized on any current node, though it still uses Docker normally to run the actual Minecraft server containers, same as any Wings install. **No SSH access path to this box is documented anywhere** (not the repo, not `/home/glitch/.ssh`, not `/opt/vantablock/.ssh`), so it is the one box that can't be inspected or audited from an agent session. **Reviewed 2026-08-22 and deliberately accepted** — nothing is blocked by it and core functionality doesn't need it, so this is a known, accepted gap rather than an open TODO. Don't re-raise it as a finding; if a future task genuinely needs to inspect Wings' own host (log rotation, disk, its `config.yml`), that's the point to ask the user for access. |
| Relay VM | Hides the home IP for real Minecraft traffic | Oracle Cloud, `vantablock-relay`, public IP in `RELAY_HOST` | Main Node reaches it over a WireGuard tunnel (`10.10.10.x` addresses, `WINGS_NODE_RELAY_IPS`); its HAProxy forwards each relayed server's port over that tunnel. Managed by `server/relay.ts` via SSH — reads/writes `/etc/haproxy/haproxy.cfg` inside markered `# --- VANTABLOCK MANAGED SECTION START/END ---` blocks, validates with `haproxy -c` before ever swapping the live config, serializes concurrent writes through an in-process mutation queue (`withMutationLock`). |
| Cloudflare Tunnel | Public HTTPS ingress | `vantablock.duxy.online` | Fronts the customer-facing Node app **and** is how the browser's game-server console websocket reaches Wings (Wings' real listening port 8080 is only reachable through the tunnel's standard HTTPS ingress, not directly). |
| nginx (bare-metal, on the CasaOS box) | Reverse proxy in front of the VantaBlock app | `127.0.0.1:8081` (what the Cloudflare Tunnel actually points at) | `/etc/nginx/sites-available/vantablock.conf` — serves `/opt/vantablock/dist` directly for the SPA (`try_files $uri /index.html`), proxies `/api/` to the real Express process on `127.0.0.1:3001`. Not a Docker container, not managed by this repo or the deploy script — a real system service (`systemctl` needs root/sudo; the deploy key's `glitch` user is in the `sudo` group but has no NOPASSWD entry, so config edits/reloads need an interactive password, not something this agent can run non-interactively over SSH). See the `client_max_body_size` gotcha below. |
| Tailscale (`tailscaled` on the CasaOS box) | Out-of-band remote access to the infra box | `udp/41641`, tailnet addressing | Undocumented until 2026-08-21 but running and enabled. It is how a dev machine on a *different* network reaches `192.168.1.248` at all. **Consequence for every other note in this file: "LAN-only" actually means "LAN + anything on the tailnet."** Any port bound `0.0.0.0` on the CasaOS box is reachable from every tailnet device, not just the house LAN. |
| `db-viewer.mjs` (CasaOS box) | Read-only browser for the app's SQLite DB | `127.0.0.1:8082` | Deliberate — a real enabled systemd **user** unit (`vantablock-dbviewer.service`), not a stray process. Opens `server/data.db` with better-sqlite3's `readonly: true` and serves a table browser plus an arbitrary-`SELECT` page. Loopback-bound, so it's only reachable with a shell or an SSH port-forward on that box. **Hardened 2026-08-22** — it was unauthenticated and printed `users.password_hash` and the plaintext `users.pterodactyl_client_key` in full; it now has Basic Auth *and* strips those two columns from both the table browser and the raw-SQL page (including via query aliases). Not in the repo; lives only on the box, so a deploy will neither update nor overwrite it — edit it in place and `systemctl --user restart vantablock-dbviewer`. |
| Nightly backup job (CasaOS box) | Backs up `server/data.db` **and** `/opt/vantablock/.env` | `vantablock-backup.timer` (systemd **user** unit), 03:30 daily | `scripts/backup-db.sh` + `scripts/db-snapshot.mjs`, in the repo so deploys keep them current. One archive per run holding a `VACUUM INTO` snapshot (verified: `integrity_check` + row counts vs. live) plus `.env`. Plain copy in `~/vantablock-backups` (0700 dir, 0600 files — it contains secrets), AES-256 encrypted copy pushed to the Relay VM's `~/vantablock-backups`. Retention 30 local / 60 off-site. **Restore runbook is the header comment of `backup-db.sh`.** Passphrase: `~/.vantablock-backup.pass` on the box *and* the owner's password manager — **never** move it into `.env`, since it decrypts the archive that contains `.env`. The job deliberately **fails (non-zero) if the off-site copy fails even when the local one worked**, so a broken relay link surfaces in `systemctl --user --failed` instead of rotting quietly. Added 2026-08-22. **Scope is the VantaBlock app only — the Pterodactyl side is deliberately not covered yet.** If the CasaOS drive died today you'd lose Panel's own MariaDB (every Pterodactyl user/server/node/allocation record), Panel's `APP_KEY` + `HASHIDS_SALT` (`/opt/pterodactyl/data/panel-var/.env` — without it, encrypted values in Panel's DB are undecryptable even with the DB in hand), the customer plugin databases, `/opt/pterodactyl/.env`, the nginx config, the cloudflared tunnel token and the relay SSH key. Minecraft worlds themselves are unaffected — those live on the Main Node. **Reviewed 2026-08-22 and consciously deferred to "when this goes public"** — it's a known accepted gap for the friends/free phase, not an oversight. Don't re-raise it as a finding; the extension is small when it's wanted (APP_KEY is 100 bytes, a Panel DB dump compresses to a few MB, and it can ride along in the same archive). |
| Cloudflare DNS | Per-server subdomains | zone for `duxy.online` (`CLOUDFLARE_ZONE_ID`) | `server/cloudflare.ts` — an A record plus a `_minecraft._tcp` SRV record per subdomain (SRV is what lets a player connect without typing a port). Both records are **not proxied** (`proxied: false`) — this is raw TCP reached directly, not through Cloudflare's edge. |

## Customer-created databases (the panel's Databases tab)

The Databases tab (`DatabaseTab.tsx` → `server/routes/servers.ts`'s `/:identifier/databases*` routes
→ `server/pterodactyl.ts`'s client-API wrappers) was fully coded from the start, but for a while
didn't actually work — Panel had no MySQL "Database Host" registered, so every create attempt
failed with `NoSuitableDatabaseHostException`. This is now fixed with a **dedicated** MariaDB
instance, deliberately separate from Panel's own `database` container so customer data (LuckPerms
tables, plugin data, etc. — including cross-server data shared via a Velocity network) never
shares a MySQL instance with Panel's internal state:

- **Container**: `customer-db` service in `/opt/pterodactyl/docker-compose.yml` (mirrored in this
  repo at `pterodactyl/docker-compose.yml`), `mariadb:10.11`, published on host port **3307**
  (Panel's own DB already owns 3306). Root password in `/opt/pterodactyl/.env`'s
  `CUSTOMER_DB_ROOT_PASSWORD`. Bring it up/down with `docker compose up -d customer-db` /
  `down customer-db` **specifically** — never `docker compose up -d` with no service name, since
  that recreates `panel` too and re-triggers Pterodactyl's egg-reseeding (see below).
- **Registered in Panel** as Database Host id 1, "Customer Databases", pointed at
  `192.168.1.248:3307` with username `root` — **not** `127.0.0.1`, because this address is handed
  straight to the actual Minecraft server process (on the separate Wings/Main Node box) as its
  connection host, not just used by Panel internally. Scoped to node id 2 ("Main Node") via the
  form's `node_id` field, since that's the only node.
- Root's `MYSQL_ROOT_HOST` is `%` (open to any host) — a deliberate simplification: this port is
  LAN-only (never exposed through the Cloudflare Tunnel or a public port-forward), and per-database
  credentials are what a plugin actually connects with day to day, not the root account.
- This registration was done by replaying Panel's own admin login (email/password from
  `/opt/pterodactyl/.env`'s `PANEL_ADMIN_EMAIL`/`PANEL_ADMIN_PASSWORD` — a genuine `root_admin: true`
  Pterodactyl account from initial setup, confirmed via the Application API) and submitting the
  classic Blade `POST /admin/databases` form directly (`name`, `host`, `port`, `username`,
  `password`, `node_id`, `_token`) — same cookie/CSRF-replay pattern as
  `mintClientApiKeyForUser()`. Pterodactyl's Application API does not expose database-host
  management, so this **is** the only way to automate this step; redo it the same way if this
  host ever needs to be recreated (e.g. after a Panel container recreate wipes... actually it
  won't — Database Host records live in Panel's own `database` container's `panel` schema, not in
  an egg, so they survive a `panel` container recreate fine. They would **not** survive the
  `customer-db` container being destroyed with its volume, e.g. `docker compose down -v`).
- Verified end-to-end (not just "should work"): created a real database via the client API,
  confirmed the generated per-database username/password actually authenticates over the network
  against `192.168.1.248:3307` and is scoped to only that database, then deleted it.

## Real hardware vs. marketing copy

The actual Main Node CPU is an **AMD Ryzen 7 5700U** (DDR4, ~4.37GHz max, confirmed via `lscpu`).
The site's marketing copy advertises a **Ryzen 9 9955HX / DDR5 / 5.4GHz** on purpose — see
[PROJECT.md](PROJECT.md)'s "Marketing copy: intentionally aspirational" section. Don't conflate
the two when reasoning about actual node capacity/allocation — `getFreeAllocationId()` and node
status queries reflect Pterodactyl's real recorded node capacity, which is based on the real
hardware, not the marketing numbers.

## Config gotchas (each one caused a real production incident this session)

**Wings' `remote` config field vs. Panel's node `daemon_listen`/`fqdn` — two different things:**
- Wings' own `remote` field (in its local `config.yml`) is for **Wings→Panel** communication and
  must be the real LAN address of the Panel box (`http://192.168.1.248`). Setting it to the public
  site domain (`https://vantablock.duxy.online`) — which is **not** where Panel is actually
  served, that domain routes to the separate customer-facing Node app — crash-loops Wings
  (`fatal: failed to retrieve server configurations... HTTP/404`) because it can't reach Panel at
  all. Fix: revert to the LAN IP and restart.
- The Panel **node record**'s `scheme`+`fqdn`+`daemon_listen` metadata is what Panel uses to
  construct the browser-facing websocket URL for the live console — a completely separate
  concern from Wings' own `remote`. The correct value here ended up `daemon_listen: 443`, since
  Wings' real listening port 8080 is only reachable via the Cloudflare Tunnel's standard HTTPS
  ingress.

**Wings' own `api.port` (in its local `config.yml`) vs. what's actually reachable:**
Flip-flopped between 8080 (correct — what the tunnel actually forwards to) and 443 (wrong —
nothing listens on 8080 if this is set to 443, causing 502s through the tunnel) multiple times,
because re-running a `wings configure` copy-paste command from Panel's UI re-derives this value
from `daemon_listen` and silently overwrites a manually-corrected `api.port`. If Wings 502s through
the tunnel after any Panel-UI-driven "reconfigure" action, check this field first.

**Wings' `allowed_origins` — separate from `remote`, this was the actual console-403 fix:**
A raw WebSocket-upgrade test against the console endpoint returned `403 Forbidden` with
`Access-Control-Allow-Origin: http://192.168.1.248` — Wings only trusted Panel's own LAN address as
a browser origin, not the real public site domain. The fix is Wings' own **top-level**
`allowed_origins: []string` config key (confirmed via Wings' Go source, `config/config.go` —
sibling to `remote`, **not** nested under `api`), which exists specifically to add supplementary
trusted browser origins beyond Panel's own URL. Add `https://vantablock.duxy.online` to this list,
not to `remote`. Verified working via a hand-rolled raw TLS+HTTP-upgrade test achieving
`HTTP/1.1 101 Switching Protocols`.

**nginx's default `client_max_body_size` (1MB) silently blocks large uploads with zero app-level trace:**
The `vantablock.conf` nginx site (see topology table above) had no `client_max_body_size` override,
so any request body over nginx's global 1MB default got rejected with nginx's own plain-HTML `413`
page — **before the request ever reached the Express app**. This produced no server-side log line
at all (not even an auth-middleware rejection) and no JSON error body, so the frontend's generic
error-message fallback was all that showed up — looked exactly like a silent hang or a mysterious
app-level bug, and wasted real debugging time chasing Wings-reachability/timeout theories before a
direct `curl -F file=@<3MB file>` at the endpoint reproduced nginx's raw 413 page directly. Fixed by
adding `client_max_body_size 500m;` to the `server {}` block (matching the multer size cap in
`server/routes/servers.ts`'s upload route) and `sudo systemctl reload nginx`. **Lesson:** if an
endpoint that accepts a real request body (file upload, large JSON payload) fails with no trace in
the app's own logs at all, suspect a layer in front of the app (nginx here) rejecting it first,
before assuming the bug is in application code.

**nginx and the Express API both listened on `0.0.0.0`, not `127.0.0.1` — both fixed 2026-08-21.**
Confirmed via `ss -tln` on the CasaOS box: `listen 8081;` in `vantablock.conf` and Express's own
`app.listen(PORT)` both bound every interface, even though the Cloudflare Tunnel connects to nginx
locally and nothing else has a legitimate reason to reach either port directly. Verified reachable
directly over the LAN (`curl http://192.168.1.248:8081/api/health` from another machine on the
network → real `200`, bypassing Cloudflare entirely). Mattered beyond just "should be tighter": the
auth-rate-limiting entry below relies on trusting nginx's `X-Forwarded-For`
(`app.set("trust proxy", 1)`) to identify the real client IP — anyone with direct network access
could otherwise have bypassed that trust chain and spoofed the header.

- **Express side**: `server/index.ts`'s `app.listen(PORT)` now explicitly binds `127.0.0.1` — a
  plain app-code change + redeploy, no sudo needed.
- **nginx side**: changed `listen 8081;` to `listen 127.0.0.1:8081;` in
  `/etc/nginx/sites-available/vantablock.conf`. **Hit a real, non-obvious snag doing this**: the
  first reload attempt (`sudo systemctl reload nginx`) reported success but changed nothing —
  `curl` from the LAN still got a real `200`. It was fixed by `sudo kill -QUIT <pid>` on one of two
  visible nginx masters followed by `sudo systemctl restart nginx`, and confirmed via
  `sudo ss -tlnp | grep :8081` — one listener afterwards, `127.0.0.1:8081` only.

  **The explanation recorded at the time — "a second, orphaned nginx started manually outside
  systemd" — was wrong, and following it literally now would take Panel offline.** Re-audited
  2026-08-21 (see DEVLOG). There are always exactly two nginx masters on this box and both are
  legitimate:

  | cmdline | cgroup | what it is |
  |---|---|---|
  | `nginx -g daemon on; master_process on;` | `/system.slice/nginx.service` | the real systemd nginx — owns `127.0.0.1:8081` |
  | `nginx -g daemon off;` | `/system.slice/docker-<panel container id>.scope` | the **Pterodactyl Panel container's own nginx** — owns `0.0.0.0:80` |

  `daemon on; master_process on;` is not a hand-started signature — it is verbatim what Debian's
  packaged unit runs (`systemctl cat nginx` → `ExecStart=/usr/sbin/nginx -g 'daemon on;
  master_process on;'`). The `daemon off` master looks unmanaged from the host only because the
  `panel` service is `network_mode: host`, and container processes are visible in the host's
  `/proc` (so they show up in `pgrep`/`ss` like host processes). **That one is serving Panel on port
  80 — the address Wings' `remote` points at. Killing it takes Panel down.**

  The real reason the reload didn't take: **nginx cannot rebind a changed `listen` address on a
  reload** while the old socket is still held — `systemctl reload` exits 0, the bind failure only
  reaches `/var/log/nginx/error.log`, and the old config keeps serving. A `restart` is required.
  That restart is what actually applied `listen 127.0.0.1:8081`; the `kill -QUIT` had hit the real
  systemd nginx.

  **Lessons, corrected:** (1) changing a `listen` address needs `systemctl restart nginx`, not
  `reload` — and check `error.log`, since a failed reload still reports success. (2) `pgrep -a
  <daemon>` for duplicate masters is still a worthwhile check when a reload doesn't take, but
  **always confirm what a process actually is via `cat /proc/<pid>/cgroup` before signalling it** —
  a container running with host networking looks exactly like an unmanaged host daemon.
- Verified end-to-end after the fix: `curl http://192.168.1.248:8081/api/health` and
  `curl http://192.168.1.248:3001/api/health` both connection-refused from the LAN, while
  `https://vantablock.duxy.online/api/health` and `/api/public/stats` both still work normally
  through the tunnel. Whether the original `0.0.0.0` binding was also reachable from the public
  internet (vs. LAN-only) was never confirmed either way (no router access) — moot now that both
  are loopback-only.

**Redis and Panel's MariaDB were published on `0.0.0.0` — found 2026-08-21, fixed 2026-08-22.**
The nginx/Express hardening above closed the app's own ports, but `/opt/pterodactyl/docker-compose.yml`
also published `cache` as `6379:6379` and `database` as `3306:3306` with no bind address — confirmed
reachable from a machine on a different subnet. That Redis has **no password** and is Panel's
`SESSION_DRIVER`/`CACHE_DRIVER`/`QUEUE_DRIVER` store, so reaching it meant reading or forging Panel
sessions (including a `root_admin` one), on top of Redis' usual write-to-disk RCE exposure. Both are now
`"127.0.0.1:6379:6379"` / `"127.0.0.1:3306:3306"`, applied with `docker compose up -d database cache`.
Functionally a no-op: Panel is `network_mode: host` and already connected over `127.0.0.1`, and the
VantaBlock app has no MySQL or Redis client at all (SQLite-only), so Panel is the sole consumer of both.

Two things to carry forward from doing it. **Name both services** on that `up -d` — a bare `docker
compose up -d` recreates `panel` and re-triggers egg reseeding (below); naming them left `panel` running
untouched, confirmed by its unchanged uptime. And **recreating `cache` drops every active Panel session**
(Redis is the session store, that container has no volume), so Panel UI users get signed out — VantaBlock
logins are JWT cookies and are unaffected, as are running game servers.

**`3307` (customer-db) stays on `0.0.0.0` by design, but `root@%` is gone — fixed 2026-08-22.**
The port itself has to remain reachable off-box: the game-server process on the separate Main Node
connects to it directly over the network. What was *not* justified was `MYSQL_ROOT_HOST: "%"`, which
let MariaDB **root** authenticate from any host that could reach the port. The old note here flagged
that its "LAN-only" defence "was never quite true" given the Tailscale row above — that caveat is now
resolved, not by closing the port but by scoping the account.

Fix: `RENAME USER 'root'@'%' TO 'root'@'192.168.1.248'` (preserves password and grants atomically).
The key insight is that **game servers never connect as root** — Pterodactyl creates a per-database
user per customer database, and root is used only by *Panel*, which reaches the container from the
host and therefore presents as `192.168.1.248`. So scoping root touches the game-server data path
zero times. `root@localhost` is deliberately left in place as the recovery route via `docker exec`.

Verified after the change: from another machine on the LAN the server now answers
`ERROR 1130: Host '<ip>' is not allowed to connect` as its *first packet* (rejected at host level,
before any password check), while a host-network client still connects as `root@192.168.1.248` and a
full `CREATE DATABASE` + `CREATE USER` + `GRANT` + `DROP` cycle still succeeds — i.e. the customer
database feature still works.

**Still open (this fix does not cover it):** the port remains open to the whole LAN/tailnet, and
Pterodactyl creates customer database users with a "Connections From" host that defaults to `%`, so
individual customer database credentials may still be usable from anywhere that can reach 3307. That
residual needs the source-IP firewall restriction to `192.168.1.113`, which **cannot be done from an
agent session**: `glitch` has no passwordless sudo, and neither `iptables` nor `ufw` exists in its
PATH. It needs the user at a root shell. Currently moot in practice — zero customer databases are
provisioned — but it is the reason this entry is a partial fix rather than a complete one.

**Pterodactyl's database seeder wipes custom egg edits:**
`docker compose up -d panel` (needed whenever a `.env` change requires a full container recreate —
`docker compose restart` does **not** re-read `.env`) triggers Pterodactyl's built-in seeder on
boot, which resets shipped/stock eggs (e.g. Paper, egg id 3) back to their defaults, silently
wiping any manual customization. If an egg genuinely needs to diverge from stock, clone it to a
custom egg id first (id 17, "Paper (Sleeping-Servers)", currently orphaned/unused, exists from a
past experiment) rather than editing the stock egg directly.

**Panel's `.env` `APP_URL` / container-recreate hazard:**
Same `restart` vs. `up -d` distinction as above applies to `APP_URL`. The last confirmed-good value
was `https://vantablock.duxy.online`, but given how much back-and-forth this value went through in
one session, **re-verify it directly** (`docker exec` cat the `.env`, or check Panel's own admin
settings UI) before assuming it's still correct rather than trusting any prior note.

## Abandoned: lazymc sleep-servers (do not resurrect without re-reading this)

A full lazymc-based "sleep when idle" wrapper for Paper servers was built, tested, and then
**fully reverted** at the user's explicit request ("get rid of it, this is horrible software").
Do not rebuild this without a materially different approach — the reasons it failed:

- Wings' "Stop Command" sends literal stdin text to the container's foreground process. With
  lazymc as that foreground process (not `java` directly), a stop command went to lazymc's stdin
  instead of the real Minecraft process — and lazymc treats *any* stdin as an implicit wake
  trigger, so stopping a sleeping server could instead wake it, sometimes producing a confusing
  "Failed to proxy: Connection reset by peer" followed by an eventual real stop. This alone broke
  the Stop button.
- Wings mangles `>`/`<<` shell redirects inside the "startup" field (garbles them rather than
  executing a real redirect) — any solution needing to write files from the startup command has
  to do it in a real install script instead.
- Wings converts `{{VAR}}` → the **literal text** `${VAR}` (not the real value) via its own
  preprocessing pass, before anything else touches the startup string — must reference the real
  `$VAR` env var directly, never a `{{}}` token, in anything downstream of that conversion.
- Egg id 17 was cloned specifically to survive the seeder-wipe issue above; it's now dead code
  kept around only because deleting a Pterodactyl egg isn't necessary — don't reuse it for
  something unrelated without renaming/repurposing it deliberately.

If a "reduce idle resource usage" feature is requested again, treat it as a fresh design problem —
don't default back to lazymc.

## Testing infra changes

There's no staging Pterodactyl instance — the boxes above **are** production. Any Wings/Panel
config change happens on the real box the real customer servers run on. Prefer the smallest,
most targeted config change (see the `allowed_origins` fix above vs. the `remote` mistake) and
verify with a direct low-level check (raw curl/WebSocket test, `lscpu`, direct MySQL query) rather
than assuming a fix worked — this session caught a false "0 rows in servers table" data-loss scare
this way (turned out to be the user intentionally deleting their own test server, confirmed by
checking `activity_log` for the absence of a delete event, then the user's own clarification).
