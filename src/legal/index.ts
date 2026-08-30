import type { LegalDocument } from "./types";
import { terms } from "./terms";
import { privacy } from "./privacy";
import { refunds } from "./refunds";
import { acceptableUse } from "./acceptable-use";

/** Display order — used by the footer, the legal sidebar, and prev/next links. */
export const LEGAL_DOCS: LegalDocument[] = [terms, privacy, refunds, acceptableUse];

export function getLegalDoc(slug: string | undefined): LegalDocument | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}

export { LEGAL_ENTITY } from "./entity";
export type { LegalDocument, LegalSection, LegalSlug } from "./types";
