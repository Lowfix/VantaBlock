# Frontend Reference

**This describes the current, post-teardown app — a static marketing site. If you're looking for
the old authenticated dashboard/console/billing UI this file used to document, that's gone; see
PROJECT.md's History section and git history before the 2026-08-22 teardown commit.**

React 19 + TypeScript + Vite 8 + Tailwind 4 (via `@tailwindcss/vite`). No state management library,
no Context. Five routes across four pages as of 2026-08-29 (see below) — `react-router-dom` was fully removed in the
teardown and then reintroduced, minimally, when a second page became genuinely needed (see
DEVLOG.md's "Client-side routing reintroduced" entry). Don't add more router surface (data routers,
loaders, nested layouts) than the flat `<Route>` list currently uses unless a real need shows up.

## Folder layout

```
src/
  pages/LandingPage.tsx         The marketing page (still the site's main content)
  pages/LocationsPage.tsx       /locations — US dot-map with California as the one region, latency table
  pages/GetStartedPage.tsx      Mock signup/login page — NOT wired to any backend, see below
  pages/LegalPage.tsx           /legal/:slug — renders whichever of the four legal documents matches
  legal/                        The legal documents themselves (terms/privacy/refunds/acceptable-use.tsx),
                                entity.ts (who "we" are — ONE place to change), types.ts, index.ts
  components/landing/           Hero, Features, LocationsTeaser, FriendsPhaseNotice, FAQ, CTASection, AmbientBackground
  components/locations/         USMap (the map component) + usMapData.ts (GENERATED — see below)
  components/layout/            AmbientPage (shared page shell), PublicNavbar, Footer, Logo
  components/illustrations/     VoxelIsland, FloatingVoxels (decorative, parallax-driven)
  components/ui/                Button, Badge — the only two primitives still in use
  lib/                          cn(), useParallax, useElementHeight — small, dependency-free helpers
  mock-data/plans.ts            The only surviving mock-data file — real plan-tier content, not fake data
scripts/gen-us-map.mjs          One-off generator for usMapData.ts (not part of the build)
```

## `App.tsx` / `main.tsx`

`App.tsx` wraps `<BrowserRouter><Routes>` around the routes `/` (`LandingPage`), `/locations`
(`LocationsPage`), `/get-started` (`GetStartedPage`), and `/legal` + `/legal/:slug` (`LegalPage` —
bare `/legal` and unknown slugs redirect to `/legal/terms` inside the component), plus one tiny
non-route component, `ScrollManager`. Deliberately minimal — a plain `<Route>` list, no data routers/loaders, no
providers. `main.tsx` is untouched boilerplate (`createRoot` + `<StrictMode>`).

**`ScrollManager`** exists because a plain `<BrowserRouter>` neither resets scroll position on
client-side navigation nor scrolls to `#hash` targets (that's full-page-load behavior; `pushState`
skips it). On every location change it scrolls to the hash's element if there is one, else to the
top. This is what makes `/#pricing`-style links work from *other* pages (navbar/footer from
`/locations`, `GetStartedPage`'s "Back to plans") and keeps same-page anchors working too. Every
nav/footer href is therefore root-relative (`/#features`, never bare `#features`) and rendered via
`<Link>`; the only plain `<a href="/#">`s left are the footer's social icons.

**Cloudflare Pages needs `public/_redirects` (`/*  /index.html  200`) for any of this to work** —
without it, a direct load or refresh of `/locations` or `/get-started` 404s, since Pages serves
static files with no knowledge of client-side routes.

## `AmbientPage.tsx` — the shared page shell

Both `LandingPage` and `LocationsPage` render inside `<AmbientPage>`: a `min-h-screen bg-void`
wrapper with the fixed-position, parallax-scrolling decorative layer (`AmbientBackground` +
`FloatingVoxels`, scrolling at 55% of real scroll speed via `useParallax`, sized to the page's
measured pixel height via `useElementHeight`). It was extracted from `LandingPage.tsx` as a pure
move when the Locations page needed the identical treatment. **Read its comment block before
touching that layer** — it documents three real, already-solved CSS bugs (scrollable-area growth
from a transformed-but-still-`position:fixed` box, a percentage-height collapse against an
ancestor with no definite height, and a negative-z-index/stacking-context pitfall), so the same
bugs don't get re-introduced.

One consequence for page content: a fixed box paints above *non-positioned* in-flow content
regardless of DOM order, so any section/panel that should sit crisply on top of the decoration
(rather than have the starfield show through it) needs `relative`. `Footer`, every section on
`LocationsPage`, and `LocationsTeaser` do this; `Features`'s cards deliberately don't (the
translucency there is fine).

## `LandingPage.tsx`

Composes `PublicNavbar`, `Hero`, `Features`, `LocationsTeaser`, `FriendsPhaseNotice`, `FAQ`,
`CTASection`, `Footer` inside `AmbientPage`. Section anchors: `#features`, `#locations`,
`#pricing`, `#faq`.

## `LocationsPage.tsx` + `components/locations/`

The `/locations` page: hero ("Hosted in California."), the `USMap` in a panel, three region-fact
cards, an **estimated** latency-by-city table (`LATENCY` — marketing ballparks for a planned
region, not measurements; the copy says "approximate" and should keep saying so if the numbers are
tweaked), and a "more regions as we grow" CTA (no specific future regions are named — don't invent
any). Sets `document.title` while mounted. `LocationsTeaser` on the landing page reuses the same
map with three headline pings copied by hand from `LATENCY` — keep them in sync.

**`USMap.tsx`** draws a dot-matrix map of the contiguous US with California highlighted (state
fill/outline, brighter dots, a pulsing marker at the state's area centroid, and an HTML label pill
positioned by percentage over the SVG so it keeps a real font size on mobile — it sits to the
*right* of the marker because California hugs the viewBox's left edge). Each dot field is ONE
`<path>` of tiny arcs, not thousands of `<circle>`s. Pulse keyframes are scoped in the component
(same pattern as `AmbientBackground`) with a `prefers-reduced-motion` override.

**`usMapData.ts` is GENERATED — do not hand-edit.** `scripts/gen-us-map.mjs` projects the
public-domain `us-atlas` states TopoJSON (contiguous US only: AK/HI *and* the territories
AS/GU/MP/PR/VI are excluded — leaving the territories in shrinks the whole map to a corner, see the
2026-08-29 DEVLOG entry) with d3-geo's `geoAlbers` into a 960×600 viewBox, and writes the
coastline path, interior state borders, California's path/centroid, and two `"x,y x,y …"` dot
grids at 11px spacing. The generator's three packages (`us-atlas`, `topojson-client`, `d3-geo`)
are **not** project dependencies — install them `--no-save` only when regenerating (instructions
at the top of the script). Nothing map-related is fetched at runtime.

## `LegalPage.tsx` + `src/legal/` — the four legal documents

`/legal/terms`, `/legal/privacy`, `/legal/refunds`, `/legal/acceptable-use`. One page component
renders whichever `LegalDocument` matches the slug: title, "Last updated", a plain-language "short
version" box (`summary` bullets — with a line saying the full text controls), a sticky numbered
table of contents (`scroll-mt-24` sections so anchors clear the sticky navbar), the sections, and
prev/next links. The documents are **data, not pages**: each is a `LegalDocument` object in
`src/legal/*.tsx` whose section bodies are plain JSX (`<p>`, `<ul>`, `<strong>`, `<Link>`, `<a
href="#id">`) with **no classes** — `LegalPage`'s `PROSE` selector string styles them. Keep section
`id`s stable; they're deep-link anchors used across documents (e.g. the AUP links to
`/legal/terms#copyright`). The footer's Legal column is generated from `LEGAL_DOCS`.

**`entity.ts` is the single source for "who we are"** — trade name, sole-proprietor description,
governing state, county for venue, contact mailboxes, data location, payment processor. Every
document interpolates from it, so forming an LLC, getting a domain, or moving is one edit. **Its
`county` and the four `*Email` values are TODO placeholders** (`[County]`, `*@vantablock.example`)
that must be filled in before these pages are pushed live. The documents are drafts written for a
sole proprietor under California law and have **not** been reviewed by an attorney — the decisions
behind them (no refunds except our fault; 18+ account holders; informal resolution then courts, no
arbitration; 3-day/14-day payment grace and deletion windows; 30/14/90-day/7-year retention) are
recorded in the 2026-08-29 DEVLOG entry. Numbers that appear in more than one document (14-day
post-termination data retention, 24-hour outage threshold, 14 days' notice of material changes)
must stay in sync when edited.

## `GetStartedPage.tsx` — mock signup/login, not wired to anything real

Reached from every plan card's "Deploy {plan}" button (`FriendsPhaseNotice.tsx`) via
`/get-started?plan={plan.id}`, and directly. Adapted from the pre-teardown
`LoginPage.tsx`/`RegisterPage.tsx`/`AuthLayout.tsx` (recoverable via `git show 584357a^:...`) with
every real bit stripped — no `fetch`, no auth context, no OAuth. One component, a local `mode`
toggle covers both "sign up" and "log in" framing. Submitting either form never fakes success or a
logged-in state — it swaps to an explicit "this is a preview, nothing was submitted" banner. The
signup form carries the standard consent line ("By creating an account you confirm you're 18 or
older and agree to the Terms / AUP / Privacy Policy") linking to `/legal/*`. If real accounts ever
come back, this is the page to rewire, not a reason to assume auth already exists elsewhere. (It
does not use `AmbientPage` — it has its own centered-card layout.)

## Every button/link on the site

There is currently no backend, so nothing here submits data or requires a session:

- `PublicNavbar`: Features (`/#features`), Locations (`/locations`), Pricing (`/#pricing`), and
  "Get started" (`/#pricing`); logo → `/`. All `<Link>`s.
- Hero's "View pricing" and `CTASection`'s "View plans" scroll to `#pricing` — informational, not
  a signup action.
- `LocationsTeaser`'s "See the region" → `/locations`. `LocationsPage`'s closing CTAs → `/#pricing`
  and `/#features`.
- `FriendsPhaseNotice`'s plan cards each have a "Deploy {plan.name}" button/link
  (`PlanCardBody`, shared by the desktop fan and the mobile stacked list) to
  `/get-started?plan={plan.id}` — the mock signup/login page described above.
- `Footer`: two columns only since 2026-08-29. **Product** — Features, Server Locations, Pricing,
  FAQ. **Legal** — generated from `LEGAL_DOCS`, linking to `/legal/{slug}`. The Company column,
  the Resources column (Knowledge Base / Modpack Guides / API Docs / Affiliate Program) and
  Product's "Status Page" were removed on purpose until there's something real behind them — don't
  re-add placeholders. Copyright line is "© 2026 Vantablock" (no LLC exists). Social icons are the
  only `/#` placeholders left.

If a real contact/invite mechanism ever comes back, that's the place to wire one of these buttons
to something real rather than inventing a destination now.

## `src/components/ui/` — only two primitives survive

`Button` (exports both the `Button` component and `buttonVariants({variant, size, className})` —
almost everything on the site uses `buttonVariants` directly on an `<a>`/`<Link>` rather than the
`<button>` component, since every CTA here is a navigation, not a submit action) and `Badge`
(`tone: "neutral" | "accent" | "good" | "warn" | "bad"`). Every other primitive that used to live
here (Avatar, Card, Dropdown, GoogleButton, Input, Menu, Modal, ProgressBar, Slider, Tabs, Toast,
Toggle, UsageChart) was deleted in the teardown — none of them had a surviving consumer. Grep
before assuming one is safe to reintroduce casually; check what actually needs it first.

## `src/mock-data/plans.ts` — the one surviving file

Real, load-bearing content (not placeholder data) — six plan tiers (name, RAM, vCores, storage,
player cap, feature list); `FriendsPhaseNotice` displays the first three as a fanned deck. Every
other `mock-data/*.ts` file (`console.ts`, `invoices.ts`, `modpacks.ts`, `serverTypes.ts`,
`servers.ts`, `versions.ts`) existed to back the now-deleted dashboard/panel UI and was deleted
along with it.

## Styling

Unchanged from before: Tailwind 4 utility classes, `cn()` (`src/lib/cn.ts`) for conditional class
merging, dark black-and-violet theme per the original build brief (`prompt.md` at repo root) —
avoid generic AI-SaaS defaults (purple gradient blobs, cliché layouts); the existing style (deep
blacks, violet accents, subtle glow, restrained motion) is still the bar to match. SVG fills/strokes
use Tailwind's `fill-*`/`stroke-*` theme-color utilities (with `/opacity` modifiers) rather than
hard-coded hex, so the map picks up the same tokens as everything else.
