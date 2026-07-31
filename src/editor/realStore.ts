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

// Applying overrides is part of the shared render core (same code the publisher runs), so the editor
// and the published site can never disagree about what an override means.
export { applyOverrides } from "./renderCore.js";
