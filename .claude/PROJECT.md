# VantaBlock — Project Overview

VantaBlock is now a **pure static marketing landing page** — a React/Vite frontend with no
backend, no database, and no authenticated app behind it. It used to be a full Minecraft server
hosting platform (React/Express frontend + API wrapping a self-hosted Pterodactyl Panel + Wings
install); that entire backend and every authenticated page were deleted from this codebase on
2026-08-22 as part of a full infrastructure teardown (Panel, Wings, the Main Node, both MariaDBs,
Redis, and the Relay VM were all destroyed on the infra side at the same time — see
INFRASTRUCTURE.md for what, if anything, survives there).

Read this file first. See also: [BACKEND.md](BACKEND.md) (now describes the **retired** backend —
useful only as reference if the authenticated app is ever rebuilt), [FRONTEND.md](FRONTEND.md),
[INFRASTRUCTURE.md](INFRASTRUCTURE.md), [WORKFLOWS.md](WORKFLOWS.md).

## What the site is today

A single page (`src/pages/LandingPage.tsx`) — hero, features, an invite-only/plan-tiers notice,
a closing CTA, footer. No routing library (`react-router-dom` was removed — there's nothing to
route to), no login/register/dashboard, no live data fetching of any kind. Every button on the
page either scrolls to the `#pricing` section or goes nowhere functional yet (footer's
placeholder links) — there is no signup or contact flow behind any of them right now.

**Deploys via Cloudflare Pages reading directly from `github.com/Lowfix/VantaBlock`** — push to
`main`, Pages auto-builds (`npm run build`, output `dist/`) and republishes. There is no custom
deploy script anymore (`scripts/deploy-server.ps1` and `scripts/deploy-panel-theme.ps1` were both
deleted in the same teardown — the first had nothing left to deploy, the second had no Panel left
to theme). `scripts/start-dev.ps1`/`stop-dev.ps1` were deleted too — they existed to boot the old
WSL/Wings/Express dev stack, none of which exists anymore. Local dev is just `npm run dev`.

**Marketing copy is still intentionally aspirational.** `Hero.tsx`, `Features.tsx`,
`FriendsPhaseNotice.tsx`, `Footer.tsx`, and `src/mock-data/plans.ts` (the only surviving
`mock-data` file — `FriendsPhaseNotice` reads its plan tiers straight from it) still advertise
**AMD Ryzen 9 9955HX / 96GB DDR5 / 5.4GHz** hardware and describe an invite-only free phase with
plan tiers. None of that is backed by anything live anymore — it's copy describing what the
*product* is meant to be, independent of whatever infrastructure exists behind it at any given
moment. **Don't "fix" this to match reality** (there currently isn't a "reality" to match — no
servers, no invite system) unless the user explicitly asks; this has been asked-then-reverted
before on the hardware-specs question specifically.

## History: what got deleted, and why

Until 2026-08-22, this was a real, live Minecraft hosting platform (`server/`: Express routers,
SQLite (`data.db`), Pterodactyl API wrapper, provisioning, owner/admin/member roles, feature
flags, a six-tier plan lineup, a request-vs-instant-deploy approval flow, an internal support
ticket system, Stripe integration). All of that is gone from this repo now — deleted in full,
not archived here. If any of those specifics matter again (rebuilding the authenticated app,
understanding a past decision), they're recoverable from git history before commit `<the teardown
commit — check DEVLOG.md for its hash>`, not from this file or BACKEND.md, which now only
describes what *used* to exist.

The teardown was explicit and immediate, not deferred: an earlier plan (still visible in git
history, commit `ab95daa`) was to keep the website/database as a durable asset and only rebuild
Panel/Wings on new hardware later. That plan was superseded the same day (commit `adbd60a`) by a
broader, immediate instruction — delete the whole backend and every authenticated page now, keep
only the static landing page. If rebuilding infrastructure later leads to also rebuilding the
authenticated app, that's a distinct, bigger decision than "get new hardware" and needs its own
explicit go-ahead — don't assume it's implied.

## No git repository — **stale, corrected 2026-08-22**

An earlier version of this file said there was no git repo and no `git log`/`git diff`/`git
revert` to rely on. That's no longer true — this is a real git repo
(`github.com/Lowfix/VantaBlock`, `main` branch), pushing has needed the user's explicit
confirmation each session so far (don't assume standing permission), and `git log`/`git diff`/
`git show` are all normal, reliable tools here now. Use them instead of manually tracking file
state the way earlier sessions had to.
