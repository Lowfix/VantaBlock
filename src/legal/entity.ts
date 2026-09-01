// The one place the legal documents get "who we are" from. Everything below is
// interpolated into the Terms / Privacy / Refund / AUP text, so forming an LLC,
// picking a domain, or moving means editing this file — not four documents.
//
// All values are real as of 2026-09-01 (Tulare County; @vantablock.net
// mailboxes via Cloudflare Email Routing). Remaining gates before flipping
// LEGAL_PAGES_ENABLED: attorney review, FBN filing, DMCA agent registration
// — see the 2026-08-29 DEVLOG entry on legal pages.
export const LEGAL_ENTITY = {
  /** Trade name used throughout. Swap to the LLC's legal name once formed. */
  name: "Vantablock",
  /** How the operating party is described in the Terms. */
  operatorDescription: "an individual operating as a sole proprietorship under the name \"Vantablock\"",
  /** Governing law + venue. */
  state: "California",
  country: "United States",
  /** The California county whose courts hear disputes (user operates from Visalia). */
  county: "Tulare County",
  /** Real addresses on vantablock.net — Cloudflare Email Routing forwards
   *  all four to the operator's inbox (set up 2026-09-01). */
  legalEmail: "legal@vantablock.net",
  privacyEmail: "privacy@vantablock.net",
  abuseEmail: "abuse@vantablock.net",
  supportEmail: "support@vantablock.net",
  /** Where the site + servers live. Stated in the Privacy Policy. */
  dataLocation: "California, United States",
  /** Payment processor(s) named in the Terms / Privacy Policy once billing exists. */
  paymentProcessors: "Stripe",
} as const;
