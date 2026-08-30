# VantaBlock

A **static marketing landing page** — React/Vite frontend, no backend, no database, no auth.
Deploys via Cloudflare Pages reading directly from `github.com/Lowfix/VantaBlock`.

**This used to be a full Minecraft hosting platform** (React/Express + a self-hosted Pterodactyl
Panel + Wings install) — the entire backend and every authenticated page were deleted on
2026-08-22 as part of a full infrastructure teardown. See [.claude/PROJECT.md](.claude/PROJECT.md)
for why and what survives. If you're expecting `server/`, a database, or a login flow and don't
see one, that's not missing by accident — read PROJECT.md before assuming anything is broken.

Detailed docs live in `.claude/` — **read the relevant one(s) before making non-trivial changes**:

- **[.claude/PROJECT.md](.claude/PROJECT.md)** — read this first. What the site is today, the
  teardown history (what got deleted and why), and the still-relevant "marketing copy is
  intentionally aspirational" note.
- **[.claude/FRONTEND.md](.claude/FRONTEND.md)** — `src/`: the one page, what survived the
  teardown (and why), the two remaining UI primitives, styling conventions.
- **[.claude/BACKEND.md](.claude/BACKEND.md)** — **retired.** The backend it used to describe is
  gone; this is now a short pointer to git history for anyone who needs the old implementation
  details, not living documentation.
- **[.claude/INFRASTRUCTURE.md](.claude/INFRASTRUCTURE.md)** — documents infrastructure (Panel,
  Wings, relay VM) that was being torn down in parallel with the code change above — treat its
  specifics as historical unless you've independently verified the boxes it describes still exist.
- **[.claude/WORKFLOWS.md](.claude/WORKFLOWS.md)** — dev (`npm run dev`) and deploy (push to
  `main`, Cloudflare Pages builds it) mechanics, PowerShell-vs-Bash syntax hazards.
- **[.claude/PANEL_THEME.md](.claude/PANEL_THEME.md)** — historical: documents Pterodactyl Panel
  theming work done before Panel itself was torn down. Not currently actionable
  (`npm run deploy:panel-theme` no longer exists — there's no Panel left to deploy it to).
- **[.claude/DEVLOG.md](.claude/DEVLOG.md)** — shared, dated changelog across sessions/agents.
  **Add an entry whenever you ship a nontrivial change or fix a real bug** (especially a
  non-obvious or recurring one) — check it before debugging something that feels familiar, so you
  don't re-solve an already-solved problem from scratch.

## Must-know before touching anything

- **There is no backend.** Don't add API calls, a database, or auth logic without first confirming
  with the user that the authenticated app is actually being rebuilt — that's a bigger decision
  than a normal feature request, see PROJECT.md's History section.
- **Marketing hardware copy (Ryzen 9 9955HX / DDR5 / 5.4GHz) is intentionally aspirational** —
  describes what the product is meant to be, not any currently-running infrastructure (there
  currently isn't any). Already corrected-then-reverted once at the user's explicit request on the
  "does this match real hardware" question; don't change it again without being asked.
- **The legal documents (`src/legal/`) are unreviewed drafts.** Written 2026-08-29 for a
  California sole proprietor; `src/legal/entity.ts` still has TODO placeholders (`[County]`,
  `*@vantablock.example`) that must be real before a push takes them live, and the whole set
  should get an attorney's read. Don't quietly change the substantive choices recorded in the
  DEVLOG entry (refund triggers, age, venue, grace/retention periods) — those were the user's.
- **This is a real git repo** (`github.com/Lowfix/VantaBlock`, `main`). Pushing has needed the
  user's explicit confirmation each session so far — don't assume standing permission.
- Windows host; both a PowerShell tool and a Bash (Git Bash) tool are available — they are **not**
  interchangeable syntax-wise (see WORKFLOWS.md).
