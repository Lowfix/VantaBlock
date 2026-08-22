# VantaBlock — Project Overview

VantaBlock is a **real** Minecraft server hosting platform — not a demo. It's a React/Express
app that wraps a genuine, self-hosted Pterodactyl Panel + Wings install, publicly reachable at
`https://vantablock.duxy.online` via a Cloudflare Tunnel.

Read this file first. See also: [BACKEND.md](BACKEND.md), [FRONTEND.md](FRONTEND.md),
[INFRASTRUCTURE.md](INFRASTRUCTURE.md), [WORKFLOWS.md](WORKFLOWS.md).

## Current phase: friends/free hosting

This is **not yet a paying business** — it's in a "friends/free" phase, dressed up to look and
operate like a real company (real infra, real support tickets, real account roles), but nothing
is actually charged. Concretely:

- `freePlan()` (server/plans.ts) zeroes out the price of whatever plan a customer picks before
  it's actually provisioned — the plan's RAM/disk/CPU tiers are real and enforced, only the price
  isn't charged.
- The Stripe integration (`stripeBilling.ts`, `stripe_topups` feature flag) exists and works, but
  isn't the normal path right now — customers aren't expected to add real funds.
- Despite being free, **treat this as a real product** when building features: real support
  tickets (not fake success toasts), real account roles, real infra decisions. The user explicitly
  wants the free phase to still feel and operate like a legitimate company.
- **Nobody is actually hosting on the platform yet** — every server currently on it is the user's
  own test server. This is why the game-world/Wings-node backup gap (see INFRASTRUCTURE.md — only
  the VantaBlock app's own `data.db`/`.env` are backed up; Panel's + the customer database's
  MariaDB and the actual Minecraft world files on Wings nodes are not) is a **deliberate,
  discussed-and-agreed deferral (2026-08-23)**, not an oversight — there's nothing real to lose
  right now, and the user wants to build it properly once real storage (local + offsite) is in
  place, rather than bolt something temporary on now. Don't "fix" this unprompted; it becomes
  urgent specifically when real customers start hosting real servers, not before.

Do not assume "no real billing" means shortcuts are fine elsewhere — provisioning, Pterodactyl
API calls, DNS, and the relay are all hitting real infrastructure and must be treated with the
same care as a paid product.

**SUPERSEDED same day — full teardown in progress, not deferred.** An earlier version of this note
(still visible in git history as of commit `ab95daa`) said only Panel/Wings/the surrounding boxes
were getting torn down "once real hardware is acquired," with the Express app and `data.db` kept
as a durable asset. That was accurate for a few minutes and then the user gave a much broader,
**immediate** instruction that supersedes it entirely: **the whole backend is being deleted now,
not deferred** — `server/` (the entire Express app), `data.db`, and every authenticated page
(login, register, dashboard, server panel, billing, support, owner console — everything) are all
being removed from the codebase in this same session, confirmed explicitly by the user. **What
survives is only the public marketing landing page**, reduced to a pure static site with no
backend, no database, no auth, no live-data fetches (including removing Hero's live-stats card,
which pulled real numbers from the backend being deleted). Deployment is moving to **Cloudflare
Pages reading directly from GitHub** — see WORKFLOWS.md — so there's no deploy script to maintain
either. Panel, Wings (the Main Node), the customer/Panel MariaDB, Redis, and the Relay VM are all
being destroyed on the infrastructure side in parallel with this code change, per INFRASTRUCTURE.md.

If you're reading this and the codebase still has `server/`, dashboard pages, or `data.db` in it,
that means the teardown was interrupted or is still in progress — check DEVLOG.md for the latest
status before assuming either the old (kept-backend) or new (landing-page-only) story is current.
When rebuilding infrastructure later on new hardware, the website itself is expected to stay
exactly as this teardown leaves it (a static landing page) unless the user explicitly asks to
rebuild the authenticated app too — that's a bigger decision than just "get new hardware."

## Marketing copy: intentionally aspirational

The site's marketing copy (Features.tsx, Hero.tsx, Pricing.tsx, AuthLayout.tsx, Footer.tsx,
`src/mock-data/plans.ts`) advertises **AMD Ryzen 9 9955HX / 96GB DDR5 / 5.4GHz** hardware.

**This is not the real current hardware.** The actual Main Node CPU (confirmed via `lscpu` on the
real machine) is an **AMD Ryzen 7 5700U, DDR4, ~4.37GHz max**. The user knows this and explicitly
chose to keep the aspirational copy ("no put it all back" — see git-less revert history) because
the real node hardware hasn't been upgraded yet but the marketing is written for where the
business is headed. **Do not "fix" this copy to match real hardware** unless the user explicitly
asks again — it has already been corrected and reverted back on purpose once this session.

## Roles: Owner / Admin / Member

Defined in `server/adminGate.ts`:

- **Owner** — the one account whose email matches the `ADMIN_EMAIL` env var, exactly
  (case-insensitive). Permanent, can't be demoted or suspended through the app itself. Gets a
  completely separate nav/console (`ownerConsoleNavItems` in `DashboardShell.tsx`) — not the
  customer dashboard with extra items appended.
- **Admin** — any other account with `is_admin = 1`. Promoted via the owner's Account Management
  tab. Gets the same operational powers as the owner (instant deploy without approval, Bank
  access, approving/denying requests) but is revocable by the owner at any time.
- **Member** — everyone else. Subject to `require_server_approval` (if enabled) and can't touch
  Bank, Accounts, or owner-console-only routes.

`isOwnerUser(userId)` / `isAdminUser(userId)` in `adminGate.ts` are the source of truth — always
gate new owner/admin-only routes and pages through these, don't reinvent role checks.

## Feature flags (server/featureFlags.ts)

Stored in the `feature_flags` SQLite table, all default `enabled = 1`, toggled from the Owner
Settings page:

| Key | Effect when OFF |
|---|---|
| `server_requests` | Customers can't submit a new-server request at all (only matters while approval is required). |
| `require_server_approval` | Customer deploys go instant, same as owner/admin — no approval queue. |
| `stripe_topups` | Customers can't add funds via card. |
| `new_registration` | New signups blocked; existing accounts can still log in. |
| `google_auth` | Google sign-in/sign-up disabled entirely, including for existing Google-linked accounts. |
| `self_service_subdomains` | Customers (and admins, on their own servers) can't set/change a subdomain from the Players tab. |

## Plan lineup (server/plans.ts, mirrored in src/mock-data/plans.ts)

Six tiers, current as of this write-up — **verify against the live file before assuming these
numbers are still current**, plans have been restructured before at the user's request:

| id | name | RAM | Disk | CPU | vCores (marketing) |
|---|---|---|---|---|---|
| sprout | Sprout | 2GB | 20GB | 200% | 2 vCores @ 5.4GHz |
| sapling | Sapling | 4GB | 40GB | 200% | 2 vCores @ 5.4GHz |
| thicket | Thicket | 6GB | 60GB | 300% | 3 vCores @ 5.4GHz |
| grove | Grove | 8GB | 80GB | 400% | 4 vCores @ 5.4GHz |
| woodland | Woodland | 10GB | 100GB | 400% | 4 vCores @ 5.4GHz |
| redwood | Redwood | 12GB | 120GB | 500% | 5 vCores @ 5.4GHz |

`customPlanLimits()` builds an ad-hoc plan (id `""`, name `"Custom"`) for admin instant-deploys
that specify raw RAM/disk/CPU numbers directly instead of picking a tier. `freePlan()` wraps any
`PlanLimits` with its price zeroed — used for every non-Stripe customer deploy/request-approval
in this free phase.

## Request-vs-instant-deploy flow

- **Owner/Admin**: instant deploy, any RAM/disk/CPU via raw number fields (`customPlanLimits`).
- **Customer, `require_server_approval` ON** (default): picks a plan from the dropdown
  (`DeployServerModal.tsx`), lands in `server_requests` as `pending`. Owner/admin reviews in
  Requests, can approve at the same plan or **downgrade** to a lower one
  (`AcceptRequestModal.tsx` — dropdown defaults to what was requested), or deny with a reason.
  Approval always uses `freePlan()`.
- **Customer, `require_server_approval` OFF**: deploys instantly, same as owner, still via a plan
  dropdown (not raw numbers) and still free.

## Support tickets

Internal ticketing system (not external email) — `support_tickets` /
`support_ticket_messages` tables, `server/routes/support.ts`, mounted at `/api/support`.
Customer-facing at `/support` (`SupportPage.tsx`), owner-facing at `/owner/support`
(`OwnerSupportPage.tsx`), shared thread view is `TicketThreadModal.tsx` (`isOwnerView` prop toggles
owner-only controls). Tickets can be general or optionally attached to a specific server
(`serverIdentifier`/`serverName`, populated automatically when opened from a server's own panel).
A customer replying to a closed ticket auto-reopens it; the owner closes explicitly when done. No
email/external notifications — the owner is expected to just check the Owner Console.

## No git repository

This project is **not** a git repo. There is no `git log`/`git diff`/`git revert` to fall back on.
Reverting a change means manually re-applying the exact reverse edits. Be extra careful about
losing track of "what state is this file actually in" during multi-step edits, and don't assume
you can recover a prior version any way other than remembering/re-deriving it.
