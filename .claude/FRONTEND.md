# Frontend Reference

**This describes the current, post-teardown app — a single static landing page. If you're looking
for the old authenticated dashboard/console/billing UI this file used to document, that's gone;
see PROJECT.md's History section and git history before the 2026-08-22 teardown commit.**

React 19 + TypeScript + Vite 8 + Tailwind 4 (via `@tailwindcss/vite`). No router, no state
management library, no Context — the whole app is one page rendering statically.

## Folder layout

```
src/
  pages/LandingPage.tsx   The only page
  components/landing/     Hero, Features, FriendsPhaseNotice, CTASection, AmbientBackground
  components/layout/      PublicNavbar, Footer, Logo
  components/illustrations/  VoxelIsland, FloatingVoxels (decorative, parallax-driven)
  components/ui/          Button, Badge — the only two primitives still in use
  lib/                    cn(), useParallax, useElementHeight — small, dependency-free helpers
  mock-data/plans.ts      The only surviving mock-data file — real plan-tier content, not fake data
```

## `App.tsx` / `main.tsx`

`App.tsx` renders `<LandingPage />` directly — no `<Routes>`, no providers. `main.tsx` is
untouched boilerplate (`createRoot` + `<StrictMode>`). If a second page is ever genuinely needed,
that's the point to reach for a router again — don't add one preemptively for a one-page site.

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
  a signup action.
- `FriendsPhaseNotice`'s plan cards no longer have a "Request {plan}" button — there's no invite
  or request system to submit to anymore. Same reasoning for Hero's old "Deploy your server"
  button and `FriendsPhaseNotice`'s old "I have an invite code" button, both removed.
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
