# Pterodactyl Panel Theme (VantaBlock branding)

The real production Pterodactyl Panel (`pterodactyl-panel-1` on `192.168.1.248`, see
[INFRASTRUCTURE.md](INFRASTRUCTURE.md)) is themed to match the VantaBlock website — violet
accent (`#8257ff` family) on a near-black surface (`#0a0a0d`/`#121216`/…), matching
`src/index.css`'s palette — instead of stock Pterodactyl blue/gray. The panel is also renamed
from "Pterodactyl" to "VantaBlock" throughout.

**To re-apply the whole theme (e.g. after a container recreate wiped it — see "Why this doesn't
persist" below), just run:**

```
npm run deploy:panel-theme
```

That runs [scripts/deploy-panel-theme.ps1](../scripts/deploy-panel-theme.ps1), which does
everything described below against the real production box. It's safe to re-run any time.

## What's actually being changed, and why it took this many pieces

Pterodactyl's customer-facing UI is a React app styled three different ways, and a **separate
legacy admin UI** styled a fourth way. A single CSS override does not reach all of them — this
took real trial and error (verified in a disposable local Docker container before ever touching
production) to map out:

| Layer | Styling mechanism | How it's themed here |
|---|---|---|
| Most React UI (backgrounds, borders, plain text) | Tailwind utility classes applied directly in JSX | Would be reachable by a plain CSS override, but superseded by the config edit below |
| Buttons, inputs, badges (older components) | `styled-components` + `twin.macro`, colors resolved **from `tailwind.config.js` at build time** | `tailwind.config.js`'s `primary`/`gray`/`neutral`/`cyan`/`blue` palettes are replaced with VantaBlock's violet/near-black scale (`pterodactyl/theme/tailwind.config.js`), then the whole frontend is rebuilt |
| Newer buttons/inputs | CSS Modules with `@apply` | Same fix — `@apply bg-blue-600` etc. resolves through the same `tailwind.config.js`, so the config edit covers these too |
| Login card specifically | Hardcoded `bg-white` / a mascot `<img>`, not tied to any color scale at all | Direct source edits: `pterodactyl/theme/LoginFormContainer.tsx` (dark card, VantaBlock logo, spacing) and `pterodactyl/theme/LoginContainer.tsx` (removes the `light` prop from the username/password fields so they use the dark input style, fixes the "Forgot password?" link contrast) |
| **Legacy Admin section** (Databases/Nodes/Users/Settings/…) | Entirely separate: server-rendered Blade views + a **precompiled, no-source-in-image** AdminLTE/Bootstrap CSS bundle (`public/themes/pterodactyl/css/pterodactyl.css`) | Direct hex-value substitution in that compiled CSS file — there's no SCSS source shipped in the runtime image to rebuild from, so `pterodactyl/theme/pterodactyl.css` *is* the edited, ready-to-copy-in artifact. Semantic colors (red=danger, green=success, orange/yellow=warning) were deliberately left alone; only the structural blue/slate-gray chrome was recolored. |
| Panel/company name ("Pterodactyl" → "VantaBlock") | A DB-backed setting (`settings` table, key `settings::app:name`), normally set via the Admin → Settings UI | Set directly via `php artisan tinker` (no raw SQL password needed, and no need to create/use a real admin login) |

On top of the theme itself, the [Blueprint](https://blueprint.zip) extension framework is
installed first (`beta-2026-08` release) — it's what makes Panel accept a packaged CSS
extension (`pterodactyl/theme/extension/`) at all instead of us just clobbering more core files.
Blueprint was verified compatible with this Panel version (1.15.0/1.15.1, Laravel 12) by testing
in a throwaway local container first, **not** by trying it directly on production — the version
gap was real enough (Blueprint's own Docker distribution targets an older Panel base with no
documented migration path) that this was worth de-risking first.

## Two real bugs hit along the way (already fixed in the script/artifacts)

- **BusyBox's `ln` doesn't support `-r`** (relative symlinks), which Blueprint's installer relies
  on for linking an extension's CSS into the build. It fails **silently** — Blueprint still
  prints "SUCCESS" — and the theme just never actually compiles in. Fix: `apk add coreutils`
  (GNU coreutils' `ln` does support `-r`) *before* installing any Blueprint extension.
- **`yarn install` order matters.** Blueprint's release archive overwrites `package.json` and
  `yarn.lock` (it ships its own fork of several core files). Running `yarn install` *before*
  extracting that archive builds `node_modules` against the *old* lockfile, which is missing
  packages the *new* `webpack.config.js` needs (e.g. `crypto-browserify`) — the build then fails
  with a confusing `Cannot find module` error. Always: extract Blueprint's release **first**,
  *then* `yarn install`.
- A stale **babel-loader cache** (`node_modules/.cache`) can make a `tailwind.config.js` color
  change silently not take effect even after a clean `yarn run build:production` — babel doesn't
  treat the Tailwind config as a cache-invalidating dependency for `twin.macro`-processed files.
  Always `rm -rf node_modules/.cache` before rebuilding after a palette change.
- Webpack needs `NODE_OPTIONS=--openssl-legacy-provider` on this Node/OpenSSL combination
  (`loader-utils`'s default MD4 hash isn't supported by OpenSSL 3+). Blueprint's own installer
  sets this internally; our manual rebuild steps set it explicitly.

## Why this doesn't persist across a container recreate

Per `pterodactyl/docker-compose.yml`, only `data/panel-var`, the nginx conf, and logs are
bind-mounted into `pterodactyl-panel-1` — the rest of `/app` (Blueprint, `node_modules`, the
edited source files above, the compiled `public/assets/`) lives **only in the container's
writable layer**. A plain `docker compose restart` is fine. A recreate (`docker compose up -d`,
needed after any `.env` change, a Panel image update, or the container being removed for any
reason) wipes all of it back to stock Pterodactyl — same class of risk as the documented
egg-reseeding issue in [INFRASTRUCTURE.md](INFRASTRUCTURE.md). It cannot affect real data,
servers, or Wings — only the Panel's own look reverts.

The user explicitly chose to accept this tradeoff rather than maintain a custom Docker image
(more durable, but a real ongoing maintenance burden) — see the decision recorded in this
project's session history. If that ever changes, `npm run deploy:panel-theme` is exactly the
"redo it" step.

## Where the actual artifacts live

`pterodactyl/theme/` in this repo — edit these files (not files inside the live container) if the
palette or copy needs to change, then re-run `npm run deploy:panel-theme`:

- `tailwind.config.js` — the palette itself; change colors here first
- `LoginFormContainer.tsx` / `LoginContainer.tsx` — login page layout/copy
- `pterodactyl.css` — legacy Admin UI recolor
- `vantablock-logo.svg` — the logo shown on the login page (currently reuses `public/favicon.svg`)
- `extension/` — the Blueprint "vantablock" extension source (`conf.yml`, `root.css`,
  `view.blade.php`) that recolors the React dashboard/account/server pages
