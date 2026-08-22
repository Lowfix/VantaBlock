# Backend Reference — RETIRED, 2026-08-22

**There is no backend anymore.** `server/` (the entire Express app — routers, SQLite schema/`db.ts`,
the Pterodactyl API wrapper, provisioning, auth, billing, everything) was deleted in full as part
of a full infrastructure teardown. This file previously documented that backend in detail (routes,
schema, provisioning flow, every supporting module) — none of it is current anymore, and it has
been replaced with this short note rather than kept as a stale 400-line reference that looks
authoritative but describes code that no longer exists.

**If you need the real details** — exact routes, table schema, the provisioning state machine,
how a specific module worked — they're fully recoverable from git history, not from memory of this
file's old content:

```
git log --oneline --follow -- server/          # every commit that touched the backend
git show <hash>:server/index.ts                # any file, as of any commit
git show <hash>^:server/                        # the whole server/ tree, right before deletion
```

Check `.claude/DEVLOG.md` for the exact commit that deleted `server/` if you need the last commit
where it still existed in full.

**What existed, in one paragraph, for context (not as a spec to build against):** an Express +
better-sqlite3 (WAL mode) API, no migrations folder — `db.ts` itself was the migration system.
Wrapped a self-hosted Pterodactyl Panel + Wings install: provisioning, a Pterodactyl client-API
wrapper, DNS/subdomain management via Cloudflare, a relay VM for routing Minecraft traffic. Had
owner/admin/member roles, a six-tier plan system with request-vs-instant-deploy approval, an
internal support ticket system, Stripe billing (never actually charging — `freePlan()` zeroed
prices), feature flags, and real security hardening work (session secrets, timing-safe auth,
encrypted-at-rest Pterodactyl client keys, rate limiting) done across several sessions.

**If the authenticated app is ever rebuilt**, that history is the actual reference — read the real
commits for the real implementation rather than trusting a paraphrase, here or anywhere else, of
what used to be true. See PROJECT.md's History section for why this was deleted and when.
