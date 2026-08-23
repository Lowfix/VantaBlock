# Frontend Reference

**This describes the current, post-teardown app — a single static landing page. If you're looking
for the old authenticated dashboard/console/billing UI this file used to document, that's gone;
see PROJECT.md's History section and git history before the 2026-08-22 teardown commit.**

React 19 + TypeScript + Vite 8 + Tailwind 4 (via `@tailwindcss/vite`). No state management library,
no Context. Two pages as of 2026-08-22 (see below) — `react-router-dom` was fully removed in the
teardown and then reintroduced, minimally, when the second page became genuinely needed (see
DEVLOG.md's "Client-side routing reintroduced" entry) — don't add more router surface (data
routers, loaders, nested layouts) than the two flat `<Route>`s currently use unless a real need
shows up.

## Folder layout

```
src/
  pages/LandingPage.tsx     The marketing page (still the site's real content)
  pages/GetStartedPage.tsx  Mock signup/login page — NOT wired to any backend, see below
  components/landing/       Hero, Features, FriendsPhaseNotice, CTASection, AmbientBackground
  components/layout/        PublicNavbar, Footer, Logo
  components/illustrations/ VoxelIsland, FloatingVoxels (decorative, parallax-driven)
  components/ui/            Button, Badge — the only two primitives still in use
  lib/                      cn(), useParallax, useElementHeight — small, dependency-free helpers
  mock-data/plans.ts        The only surviving mock-data file — real plan-tier content, not fake data
```

## `App.tsx` / `main.tsx`

`App.tsx` wraps `<BrowserRouter><Routes>` around two routes: `/` (`LandingPage`) and `/get-started`
(`GetStartedPage`). Deliberately minimal — a plain `<Route>` list, no data routers/loaders, no
providers. `main.tsx` is untouched boilerplate (`createRoot` + `<StrictMode>`). **Cloudflare Pages
needs `public/_redirects` (`/*  /index.html  200`) for this to work** — without it, a direct load
or refresh of `/get-started` 404s, since Pages serves static files with no knowledge of
client-side routes. If a third page is ever needed, this is already the point to extend, not
reconsider — the router is back for good reason, see the DEVLOG entry.

## `GetStartedPage.tsx` — mock signup/login, not wired to anything real

Reached from every plan card's "Deploy {plan}" button (`FriendsPhaseNotice.tsx`) via
`/get-started?plan={plan.id}`, and directly. Adapted from the pre-teardown
`LoginPage.tsx`/`RegisterPage.tsx`/`AuthLayout.tsx` (recoverable via `git show 584357a^:...`) with
every real bit stripped — no `fetch`, no auth context, no OAuth. One component, a local `mode`
toggle covers both "sign up" and "log in" framing. Submitting either form never fakes success or a
logged-in state — it swaps to an explicit "this is a preview, nothing was submitted" banner. If
real accounts ever come back, this is the page to rewire, not a reason to assume auth already
exists elsewhere.

## `LandingPage.tsx`

Composes `PublicNavbar`, `Hero`, `Features`, `FriendsPhaseNotice`, `CTASection`, `Footer`, plus a
fixed-position decorative background layer (`AmbientBackground` + `FloatingVoxels`) that
parallax-scrolls at 55% of real scroll speed via `useParallax`. See the component's own comment
block for three real, already-solved CSS bugs in that layer (scrollable-area growth from a
transformed-but-still-`position:fixed` box, a percentage-height collapse against an ancestor with
no definite height, and a negative-z-index/stacking-context pitfall) — worth reading before
touching that layer again, so the same bugs don't get re-introduced.

## Every button/link on the page

There is currently no backend, so nothing here submits data or requires a session:

- `PublicNavbar`'s "Get started", Hero's "View pricing", and `CTASection`'s "View plans" all
  scroll to `FriendsPhaseNotice`'s `#pricing` section (`<a href="#pricing">`) — informational, not
  a signup action. **Left alone on purpose** when the per-card Deploy buttons below were added —
  this task was scoped to the plan cards only, not a site-wide CTA rewire.
- `FriendsPhaseNotice`'s plan cards each have a "Deploy {plan.name}" button/link
  (`PlanCardBody`, shared by the desktop fan and the mobile stacked list) to
  `/get-started?plan={plan.id}` — the mock signup/login page described above. Not a real
  deploy/invite/request flow; the destination is explicit about that.
- `Footer`'s column links (Product/Company/Resources/Legal) are pre-existing placeholder anchors
  (`/#`) — not part of the teardown, not currently wired to anything real either.

If a real contact/invite mechanism ever comes back, that's the place to wire one of these buttons
to something real rather than inventing a destination now.

## `src/components/ui/` — only two primitives survive

`Button` (exports both the `Button` component and `buttonVariants({variant, size, className})` —
almost everything on the page uses `buttonVariants` directly on an `<a>` rather than the `<button>`
component, since every CTA here is a same-page anchor, not a submit action) and `Badge`
(`tone: "neutral" | "accent" | "good" | "warn" | "bad"`). Every other primitive that used to live
here (Avatar, Card, Dropdown, GoogleButton, Input, Menu, Modal, ProgressBar, Slider, Tabs, Toast,
Toggle, UsageChart) was deleted in the teardown — none of them had a surviving consumer. Grep
before assuming one is safe to reintroduce casually; check what actually needs it first.

## `src/mock-data/plans.ts` — the one surviving file

Real, load-bearing content (not placeholder data) — six plan tiers (name, RAM, vCores, storage,
player cap, feature list), rendered by `FriendsPhaseNotice`'s plan-card grid. Every other
`mock-data/*.ts` file (`console.ts`, `invoices.ts`, `modpacks.ts`, `serverTypes.ts`, `servers.ts`,
`versions.ts`) existed to back the now-deleted dashboard/panel UI and was deleted along with it.

## Styling

Unchanged from before: Tailwind 4 utility classes, `cn()` (`src/lib/cn.ts`) for conditional class
merging, dark black-and-violet theme per the original build brief (`prompt.md` at repo root) —
avoid generic AI-SaaS defaults (purple gradient blobs, cliché layouts); the existing style (deep
blacks, violet accents, subtle glow, restrained motion) is still the bar to match.
