# Workflows: Dev, Build, Deploy

This is a real git repo (`github.com/Lowfix/VantaBlock`, `main` branch) — an earlier version of
this file (and PROJECT.md) said otherwise; that was corrected 2026-08-22, see PROJECT.md. Use
`git log`/`git diff`/`git show` normally. Pushing to `main` has needed the user's explicit
confirmation each session so far — don't assume standing permission to push just because a commit
was authorized. Windows host, PowerShell primary shell, Bash tool also available — see the
syntax-hazard note near the bottom before writing any command with `$env:` or similar.

Since the 2026-08-22 teardown (see PROJECT.md), this is a static frontend only — no backend, no
database, no auth to test against. Most of what used to be documented here (the local end-to-end
testing methodology involving invite codes/Pterodactyl accounts, the `deploy-server.ps1` file-copy
deploy, `dev:all`/`start:all`/`stop:all` for running the old Express API + WSL Wings stack) no
longer applies and has been removed rather than left stale — see git history before the teardown
commit if any of that mechanics is ever needed again.

## `tsc --noEmit -p .` is a false-negative trap in this repo — use `tsc -b` instead

The root `tsconfig.json` is solution-style (`"files": []` + `"references"` to
`tsconfig.app.json`/`tsconfig.node.json`). Running `npx tsc --noEmit -p .` against that file checks
*nothing* — there's no `files`/`include` list for it to check, and it silently exits clean
regardless of real errors in `src/`. This passed "clean" repeatedly during a real session while a
genuine type bug sat unnoticed until `npm run build`'s `tsc -b` (project-reference build mode,
which actually checks the referenced projects) caught it. **Always use `npx tsc -b` (add `--force`
to bypass incremental-build caching if you suspect stale state) — never trust a bare
`tsc --noEmit -p .` in this repo.**

## Local dev

Just `npm run dev` — Vite dev server on port 5173. Nothing else to start; there's no API, no
database, no second process. `npm run build` (`tsc -b && vite build`) produces `dist/`; `npm run
preview` serves that build locally to sanity-check the production bundle before pushing.

## Deploy — Cloudflare Pages, not a custom script

Deploys automatically from GitHub: Cloudflare Pages watches `main` on
`github.com/Lowfix/VantaBlock`, builds with `npm run build`, and serves `dist/`. **"Deploying" is
just committing and pushing to `main`** — there is no `deploy:*` npm script anymore
(`scripts/deploy-server.ps1` and `scripts/deploy-panel-theme.ps1` were both deleted in the
2026-08-22 teardown; neither had a live target left to deploy to). Confirm `npm run build` is
clean locally before pushing — Pages will fail the same way, just less visibly and with a slower
feedback loop.

If Cloudflare Pages isn't connected to the GitHub repo yet on the user's end, that's a one-time
setup step in the Cloudflare dashboard (Pages project → connect to `github.com/Lowfix/VantaBlock`,
framework preset "Vite", build command `npm run build`, output directory `dist`) — not something
to attempt from here.

## PowerShell vs. Bash tool syntax hazard

Both a Bash tool (Git Bash / POSIX) and a PowerShell tool are available — **they are not
interchangeable**:

- `$env:VAR` syntax only works in the PowerShell tool; Bash needs `$VAR` / `export VAR=`.
- When handing the user a command to run themselves, write it in valid **Windows PowerShell 5.1**
  syntax if that's their shell: no `&&`/`||` (use `;` or `if ($?) { ... }`), no bash-style
  here-strings.
- `Out-File -Encoding utf8` in PowerShell adds a **BOM**, which breaks strict JSON parsers (e.g. a
  JSON body piped into `curl`). Use `[System.IO.File]::WriteAllText(...)` instead for JSON payloads.

## Auto-mode classifier blocks

Some actions get blocked by the permission classifier even with clear multi-turn context
establishing the change is wanted — has hit both remote production config changes and, in one
session, `git push`/writing to a remote `.env`. Workaround: retry once (sometimes succeeds on
retry); if still blocked, hand the user the exact command to run themselves rather than repeatedly
retrying the same blocked call, and don't ask a peer session to run it in your place — that's
routing around the block under a different name, not resolving it.
