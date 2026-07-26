/**
 * Content-edit persistence for the imported (real) site.
 *
 * The base pages live read-only in /public/import/allclean/*.json. Client edits are stored as
 * OVERRIDES — a per-page map of blockId → edited HTML — so we never rewrite the 15MB base and can
 * diff/export just what changed. localStorage by default; a Supabase adapter can slot in later
 * (same shape as storage.ts), scoped per tenant.
 */

export type PageOverrides = Record<string, string>;              // blockId -> html
export type SiteOverrides = Record<string, PageOverrides>;        // pageId -> {blockId: html}

const key = (tenant: string, site: string) => `editor-v2:real-overrides:${tenant}:${site}`;

export function loadOverrides(tenant: string, site: string): SiteOverrides {
  try {
    const raw = localStorage.getItem(key(tenant, site));
    return raw ? (JSON.parse(raw) as SiteOverrides) : {};
  } catch {
    return {};
  }
}

export function saveOverrides(tenant: string, site: string, all: SiteOverrides): void {
  localStorage.setItem(key(tenant, site), JSON.stringify(all));
}

/** Apply a page's overrides onto its freshly-fetched blocks (mutates copies' content.html). */
export function applyOverrides<T extends { id: string; content: { html: string } }>(
  blocks: T[],
  overrides: PageOverrides | undefined
): T[] {
  if (!overrides) return blocks;
  return blocks.map((b) => (overrides[b.id] != null ? { ...b, content: { ...b.content, html: overrides[b.id] } } : b));
}
