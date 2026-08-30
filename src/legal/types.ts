import type { ReactNode } from "react";

export type LegalSlug = "terms" | "privacy" | "refunds" | "acceptable-use";

export interface LegalSection {
  /** Anchor id — stable, used in the table of contents and deep links. */
  id: string;
  title: string;
  /** Plain JSX (<p>, <ul>, <strong>, <Link>) — styled by LegalPage's container selectors. */
  body: ReactNode;
}

export interface LegalDocument {
  slug: LegalSlug;
  title: string;
  /** Short label for the sidebar / footer. */
  shortTitle: string;
  /** One-liner shown under the title and on cross-links. */
  description: string;
  /** ISO date, shown as "Last updated". Bump whenever the text changes. */
  lastUpdated: string;
  /** "The short version" bullets — a plain-language summary; the full text controls. */
  summary: string[];
  sections: LegalSection[];
}
