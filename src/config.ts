// Site-wide feature flags. Keep this file tiny and boring.

/**
 * The four legal documents (/legal/*), the footer's Legal column, and the
 * signup form's consent line.
 *
 * ON in `npm run dev` so the documents can be worked on locally; OFF in
 * production builds (what Cloudflare Pages deploys) until src/legal/entity.ts
 * has real values instead of `[County]` / `*@vantablock.example` and the
 * drafts have had a legal review. To launch them, change this to `true`
 * (or delete the flag and its three call sites once they're live for good).
 */
export const LEGAL_PAGES_ENABLED: boolean = import.meta.env.DEV;
