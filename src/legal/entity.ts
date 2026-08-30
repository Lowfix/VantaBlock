// The one place the legal documents get "who we are" from. Everything below is
// interpolated into the Terms / Privacy / Refund / AUP text, so forming an LLC,
// picking a domain, or moving means editing this file — not four documents.
//
// Values marked TODO are placeholders that must be filled in before these
// pages go live (see the 2026-08-29 DEVLOG entry on legal pages).
export const LEGAL_ENTITY = {
  /** Trade name used throughout. Swap to the LLC's legal name once formed. */
  name: "Vantablock",
  /** How the operating party is described in the Terms. */
  operatorDescription: "an individual operating as a sole proprietorship under the name \"Vantablock\"",
  /** Governing law + venue. */
  state: "California",
  country: "United States",
  /** TODO: the California county whose courts hear disputes (where you operate from). */
  county: "[County]",
  /** TODO: replace with real mailboxes once a domain exists. */
  legalEmail: "legal@vantablock.example",
  privacyEmail: "privacy@vantablock.example",
  abuseEmail: "abuse@vantablock.example",
  supportEmail: "support@vantablock.example",
  /** Where the site + servers live. Stated in the Privacy Policy. */
  dataLocation: "California, United States",
  /** Payment processor(s) named in the Terms / Privacy Policy once billing exists. */
  paymentProcessors: "Stripe",
} as const;
