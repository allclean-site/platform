/** Типы для legal-pages.mjs: генератор юридических страниц зовут и сборка, и кабинет. */
export interface LegalPage {
  slug: string;
  pair: string;
  lang: string;
  title: string;
  metaTitle: string;
  metaDesc: string;
  updated: string;
  lead?: string;
  blocks?: unknown[];
  footNote?: string;
}
export declare const LEGAL_PAGES: LegalPage[];
export declare const OPERATOR: Record<string, unknown>;
export declare function renderLegalMain(page: LegalPage): string;
