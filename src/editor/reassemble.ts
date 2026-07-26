/**
 * Reassemble an imported page (section blocks + verbatim structural pieces) into the full HTML
 * document. This is the TS twin of scripts/import-to-blocks.py's `reassemble()` — with unedited
 * blocks it reproduces the live mirror byte-for-byte; with edited `block.content.html` it produces
 * the edited page. Used by both the editor's iframe canvas and the static export.
 */

export type Region = "header" | "main" | "footer";

export interface ImportedBlock {
  id: string;
  type: "section";
  content: { html: string; label?: string; region?: Region };
}

export interface ImportedPage {
  id: string;
  slug: string;
  lang: string;
  group: string;
  meta: { title: string; description: string };
  /** Verbatim: doctype…<body>, and </body>…end. */
  prefix: string;
  suffix: string;
  /** Verbatim body scaffold pieces (empty when `wrapped` is false). */
  bodyPrefix: string;
  pwOpen: string;
  mainOpen: string;
  pwClose: string;
  mainClose: string;
  tailScripts: string;
  blocks: ImportedBlock[];
  wrapped: boolean;
}

/** Lightweight page entry from _pages.json (no heavy html). */
export interface PageIndexEntry {
  id: string;
  file: string;
  slug: string;
  lang: string;
  group: string;
  title: string;
  blocks: { id: string; label?: string; region?: Region }[];
}

export interface SiteIndex {
  siteId: string;
  tenantId: string;
  domain: string;
  locales: string[];
  defaultLocale: string;
  pages: PageIndexEntry[];
}

const html = (p: ImportedPage) =>
  p.blocks.find((b) => b.content.region === "header")?.content.html ?? "";

export function reassemble(p: ImportedPage): string {
  if (!p.wrapped) {
    return p.prefix + p.blocks.map((b) => b.content.html).join("") + p.suffix;
  }
  const header = html(p);
  const footer = p.blocks.find((b) => b.content.region === "footer")?.content.html ?? "";
  const mains = p.blocks.filter((b) => b.content.region === "main").map((b) => b.content.html).join("");
  const body =
    p.bodyPrefix + p.pwOpen + header + p.mainOpen + mains + p.mainClose + footer + p.pwClose + p.tailScripts;
  return p.prefix + body + p.suffix;
}
