# VantaBlock

Minecraft server hosting platform — React/Express frontend and API wrapping a **real**,
self-hosted Pterodactyl Panel + Wings install, publicly live at `https://vantablock.duxy.online`.
This is not a demo or prototype; provisioning, DNS, and the console all hit real infrastructure.

Detailed docs live in `.claude/` — **read the relevant one(s) before making non-trivial changes**:

- **[.claude/PROJECT.md](.claude/PROJECT.md)** — product context: current "friends/free" phase
  (nothing is actually charged yet, but treat it as a real product), why the marketing copy
  advertises hardware the platform doesn't actually run yet (intentional, don't "fix" it),
  owner/admin/member roles, feature flags, plan lineup, request-vs-instant-deploy flow, support
  tickets.
- **[.claude/BACKEND.md](.claude/BACKEND.md)** — `server/`: Express routers, SQLite schema (no
  migrations folder — `db.ts` itself is the migration system), Pterodactyl API wrapper,
  provisioning flow, every supporting module.
- **[.claude/FRONTEND.md](.claude/FRONTEND.md)** — `src/`: routing/nav conventions, the real-server-
  data merge pattern (`useMyServers` + `mergeMyServers`), live console/stats (websocket vs.
  polling), UI primitives, and what's actually live vs. leftover in `mock-data/`.
- **[.claude/INFRASTRUCTURE.md](.claude/INFRASTRUCTURE.md)** — the real box topology (Panel+DB box,
  Wings "Main Node", relay VM, Cloudflare Tunnel/DNS) and every config gotcha that has already
  caused a real incident once (Wings `remote` vs. `allowed_origins` vs. Panel's `daemon_listen`,
  egg-reseeding, the abandoned lazymc sleep-server experiment).
- **[.claude/WORKFLOWS.md](.claude/WORKFLOWS.md)** — dev/test/deploy mechanics, the established
  local end-to-end testing + cleanup discipline, PowerShell-vs-Bash syntax hazards.
- **[.claude/PANEL_THEME.md](.claude/PANEL_THEME.md)** — the VantaBlock-branded Pterodactyl Panel
  theme (Blueprint framework + `tailwind.config.js` palette + legacy Admin UI recolor + login
  page edits): what each piece does and why, the real bugs hit building it, why it doesn't
  survive a Panel container recreate, and `npm run deploy:panel-theme` to redo it.
- **[.claude/DEVLOG.md](.claude/DEVLOG.md)** — shared, dated changelog across sessions/agents.
  **Add an entry whenever you ship a nontrivial change or fix a real bug** (especially a
  non-obvious or recurring one) — check it before debugging something that feels familiar, so you
  don't re-solve an already-solved problem from scratch.

## Must-know before touching anything

- **No git repository.** There is no `git log`/`git diff`/`git revert` to lean on — reverting a
  change means manually re-applying the exact reverse edit. Track file state carefully during
  multi-step work.
- **Nothing is really charged yet.** `freePlan()` zeroes prices before provisioning — real
  RAM/disk/CPU tiers are still enforced, but don't build payment-gating logic that assumes real
  charges are happening today.
- **Marketing hardware copy (Ryzen 9 9955HX / DDR5 / 5.4GHz) is intentionally aspirational** — the
  real Main Node is a Ryzen 7 5700U. Already corrected-then-reverted once at the user's explicit
  request; don't change it again without being asked.
- **The Pterodactyl/Wings boxes this app talks to are real production**, not a staging copy —
  config changes there affect real running Minecraft servers. See INFRASTRUCTURE.md before editing
  anything Wings/Panel/relay/DNS-related.
- Windows host; both a PowerShell tool and a Bash (Git Bash) tool are available — they are **not**
  interchangeable syntax-wise (see WORKFLOWS.md).
