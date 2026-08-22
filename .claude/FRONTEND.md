# Frontend Reference

React 19 + TypeScript + Vite 8 + Tailwind 4 (via `@tailwindcss/vite`), React Router 7. No state
management library — plain React state + Context + a couple of module-level external stores. See
[PROJECT.md](PROJECT.md) for the product/role model this UI implements.

## Folder layout convention

```
src/
  pages/                Top-level routed pages
  pages/owner/           Owner-console-only sub-pages (separate nav, see DashboardShell)
  components/<feature>/  Feature-grouped components: account, billing, dashboard,
                         illustrations, landing, layout, panel, support
  components/ui/         Generic design-system primitives only — nothing feature-specific
  lib/                   Hooks + utilities (polling, live console/stats, merge logic, cn(), etc.)
  context/               React Context providers
  mock-data/             Mixed — see below, don't assume "mock-data" means fake/unused
```

`src/components/panel/*.tsx` holds every server-panel tab (Console, Files, Players, Settings,
Backups, Tasks, Database, Users, ActivityLog, Ports, Subdomain, Startup, Plugins, Modpacks) —
these are the tab components rendered inside `ServerPanelPage.tsx`. Adding a new tab still means
editing `ServerPanelPage.tsx` in three places: the `TabId` union, a `NavItem` entry in one of the
two nav-section arrays, and a hardcoded `{activeTab === "..." && <Tab .../>}` content block — this
file has no single tab-registry array to update instead.

## Routing (`src/App.tsx`)

Flat `<Routes>` list, every authenticated route wrapped in `<RequireAuth>`
(`components/layout/RequireAuth.tsx`). No nested layout routes — `DashboardShell` is composed
inside each page component instead of at the router level. When adding a new authenticated page,
follow the existing pattern: add the page import, add a `<Route>` wrapped in `RequireAuth`, then
wire a nav entry in `DashboardShell.tsx` (see below) — routing and nav are two separate places you
must update.

## Navigation (`src/components/layout/DashboardShell.tsx`)

Two **completely separate** nav item lists, not one list with extra items appended:

- `baseNavItems` — regular customer nav (Overview, Support, Account Settings). Admins (not owner)
  get `[...baseNavItems, ...adminNavItems]` (adds "Creation Requests").
- `ownerConsoleNavItems` — the owner's own nav, a business console, not the customer dashboard.
  Currently: Overview, Servers, Accounts, Activity, Infrastructure, Support, Settings.

`currentUser.isOwner` picks which list renders. When adding an owner-only page, add its nav entry
to `ownerConsoleNavItems`, not `adminNavItems` — admin and owner have different navs even though
`isAdminUser()` returns true for both server-side.

## Auth/user state (`src/context/UserContext.tsx`)

`apiFetch<T>()` — the one place that wraps `fetch` with `credentials: "include"` + JSON handling,
throwing on non-2xx using the server's `{error}` field. **Always** use this (or a fetch call that
follows the same `credentials: "include"` pattern) for any authenticated API call — a bare `fetch`
without `credentials: "include"` will silently fail to send the session cookie.

`UserProvider` loads `/api/auth/me` on mount, exposes `login`/`register`/`loginWithGoogle`/
`updateProfile`/`updateSettings`/`changePassword`/`deleteAccount`/`logout`/`refreshUser`, and
polls `refreshUser` every 5s via `usePolling` (only while logged in) — this is how a balance
change from the billing cron or an owner's Bank action shows up without a manual page refresh.

## Real server data pattern

This is the trickiest convention in the codebase — get it wrong and you'll show stale or
placeholder data:

1. `src/mock-data/servers.ts` defines `GameServer` — the rich shape every panel/dashboard
   component actually consumes. Its `servers` array is deliberately **empty** (comment explains
   real data now comes from the API).
2. `src/lib/useMyServers.ts` polls `GET /api/servers` every 3s, returning `MyPterodactylServer[]`
   — the real, live API shape (leaner than `GameServer`).
3. `mergeMyServers(list, myServers)` merges live poll results into a `GameServer[]` local-state
   array: updates existing entries in place via `applyLiveFields` (keyed by
   `pterodactylServerId(identifier)` = `"ptero-" + identifier`), appends new ones as placeholders
   via `toGameServerPlaceholder`.
4. Pages hold the merged `GameServer[]` as local state and pass it down — components never touch
   the raw `MyPterodactylServer` shape directly.

`ServerPanelPage.tsx`'s `PTERO_PREFIX = "ptero-"` constant and `myIdentifier` derivation
(`serverId.slice(PTERO_PREFIX.length)`) is how the route's `:serverId` param gets turned back into
the real Pterodactyl identifier needed for API calls — follow this exact pattern (don't assume
`server.id` **is** the Pterodactyl identifier; it's the prefixed local id).

## Live console & stats

- **Console** (`src/lib/liveConsoleStore.ts`) — a **module-level, non-React** store keyed by
  server identifier, so the websocket connection and buffered output survive component
  unmount/remount and tab switches. Seeds itself from `GET /api/servers/:id/console/history` (the
  on-disk log tail), then `GET /api/servers/:id/console` for a Pterodactyl websocket token+URL,
  opens a raw `WebSocket` directly to Pterodactyl's client-API socket, handles `auth`/
  `console output`/`stats`/`token expiring` events, reconnects with exponential backoff (up to
  30s) on close. `useLiveConsole()` (`src/lib/useLiveConsole.ts`) exposes it via
  `useSyncExternalStore`.
- **Resource stats** (`src/lib/useLiveServerStats.ts`) — separate, plain polling of
  `GET /api/servers/:id` every 2s. Not websocket-based, don't conflate the two.
- **Line formatting** (`src/lib/consoleFormatting.ts`) — pure, framework-agnostic (no React/DOM)
  parser turning one raw console line into styled + link-aware tokens: ANSI SGR escapes (16-color
  only — confirmed no 256-color/truecolor ever appears, see the 2026-08-21 DEVLOG "ground truth"
  entry), raw/unconverted legacy `§`-color codes, and `https?://` link detection, all mapped onto
  theme-harmonized hex colors (not raw terminal ANSI). `ConsoleTab.tsx`'s render loop calls
  `formatConsoleLine()` for every line (live, history-seeded, and mock alike) — it degrades
  gracefully to plain text when a line has neither scheme. Being pure and dependency-free is
  deliberate: it was verified directly against real captured console samples via a plain Node
  script before ever being wired into the component.

## `usePolling.ts`

Tiny generic `setInterval` hook — reads the callback from a ref each tick, so callers don't need
to `useCallback`/memoize the function passed in. Used throughout (UserContext, SupportPage,
OwnerSupportPage, etc.) for "poll this endpoint every N seconds" patterns.

## `src/components/ui/` — design-system primitives

`Avatar`, `Badge` (`BadgeTone = "neutral" | "accent" | "good" | "warn" | "bad"`), `Button`, `Card`
(`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`), `Dropdown`, `GoogleButton`,
`Input` (also exports `Label`, `Textarea`, `Select`, `FieldError` from the same file — check
before assuming a new file is needed for a form primitive), `Menu` (also exports `MenuItem`,
`MenuSeparator`), `Modal` (`{ open, onClose, title?, description?, children, className? }`),
`ProgressBar`, `Slider`, `Tabs`, `Toast` (`useToast().push(message, tone)`), `Toggle`,
`UsageChart`. Reach for one of these before writing a new primitive from scratch.

## `src/mock-data/` — mixed purpose, don't assume "mock" = unused

- **Type-only / emptied on purpose** (real data comes from the API now, the file just keeps the
  shared TS interface): `servers.ts` (`GameServer`), `invoices.ts` (`Invoice`/`InvoiceStatus`).
- **Still actively used as real mock/seed data** (features not yet backed by live API data):
  `console.ts` (`ConsoleTab.tsx`), `modpacks.ts` (`ModpacksTab.tsx`). `plugins.ts` was removed once
  `PluginsTab.tsx` was rewired to the real Hangar/Modrinth backend — see BACKEND.md's Plugins
  section.
- **Static app configuration, not "mock" in the fake-data sense**: `plans.ts`, `serverTypes.ts`,
  `versions.ts` — real, load-bearing data shared across billing modals, `DeployServerModal`, the
  landing Pricing section, and `useMyServers`.

Before touching any `mock-data/*.ts` file, grep for its actual imports rather than assuming from
the folder name whether it's live config, seed data, or dead weight.

## Styling

Tailwind 4 utility classes throughout, `cn()` (`src/lib/cn.ts`) for conditional class merging.
Dark, black-and-violet theme per the original build brief (`prompt.md` at repo root) — avoid
generic AI-SaaS defaults (purple gradient blobs, cliché layouts) per that same brief; the existing
component style (deep blacks, violet accents, subtle glow, restrained motion) is the bar to match.
