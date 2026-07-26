/** Static export: a Page JSON → a complete, indexable HTML document.
 *
 * The <head> is assembled entirely from `page.meta` — the seam where the auto-SEO
 * pipeline (title/description/OG/JSON-LD) lives (EDITOR_V2_PLAN.md §6). Block bodies
 * are wrapped in `.site-root` so the shared stylesheet applies identically to the
 * editor preview and the exported page. */

import type { Page, Theme, Block } from "../types";
import { getBlockDef } from "../blocks/registry";
import { styleAttrStr } from "../blocks/style";
import { esc } from "../lib/html";

/** Render just the block bodies (no <head>). Shared by the full-page renderer and tests.
 *  Each block is wrapped in `.blockwrap` carrying its presentation overrides. */
export function renderBlocks(blocks: Block[], theme: Theme, editing = false): string {
  return blocks
    .map((block) => {
      const html = getBlockDef(block.type).renderStatic({ block, theme, editing });
      return `<div class="blockwrap"${styleAttrStr(block.style as any)}>${html}</div>`;
    })
    .join("\n");
}

/** Auto-SEO: build the <head> from page meta. */
function renderHead(page: Page, opts: RenderOptions): string {
  const m = page.meta;
  const tags: string[] = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}">`,
    `<meta property="og:title" content="${esc(m.og?.title ?? m.title)}">`,
    `<meta property="og:description" content="${esc(m.og?.description ?? m.description)}">`,
  ];
  if (m.og?.image) tags.push(`<meta property="og:image" content="${esc(m.og.image)}">`);
  // hreflang alternates (multilingual SEO).
  for (const alt of opts.alternates ?? []) {
    tags.push(`<link rel="alternate" hreflang="${esc(alt.lang)}" href="${esc(alt.href)}">`);
  }
  for (const schema of m.schema ?? []) {
    tags.push(`<script type="application/ld+json">${JSON.stringify(schema)}</script>`);
  }
  if (opts.css) tags.push(`<style>${opts.css}</style>`);
  return tags.join("\n    ");
}

export interface RenderOptions {
  /** Inline stylesheet (the shared site.css) to embed in <head>. */
  css?: string;
  /** hreflang alternates: { lang, href }[] for translations of this page. */
  alternates?: { lang: string; href: string }[];
}

export function renderPage(page: Page, theme: Theme, opts: RenderOptions = {}): string {
  return (
    `<!doctype html>\n` +
    `<html lang="${esc(page.lang)}">\n` +
    `  <head>\n    ${renderHead(page, opts)}\n  </head>\n` +
    `  <body>\n    <div class="site-root">\n${renderBlocks(page.blocks, theme)}\n    </div>\n  </body>\n` +
    `</html>\n`
  );
}
