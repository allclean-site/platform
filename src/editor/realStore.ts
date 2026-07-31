/**
 * Content-edit persistence for the imported (real) site.
 *
 * The base pages live read-only in /public/import/allclean/*.json. Client edits are stored as
 * OVERRIDES — a per-page map of blockId → edited HTML — so we never rewrite the 15MB base and can
 * diff/export just what changed. localStorage by default; a Supabase adapter can slot in later
 * (same shape as storage.ts), scoped per tenant.
 */

/**
 * A block's stored value:
 *   html string — this block is overridden (`""` means the section was deleted)
 *   null        — TOMBSTONE: "no override here", written on purpose
 *   key absent  — this layer has no opinion; a lower layer decides
 *
 * The tombstone is what makes undo work across people. Edits live in three stacked layers (published
 * → shared draft → this browser) and a higher layer used to say "revert this" simply by dropping its
 * key — which reads as "no opinion", so the lower layer's value came straight back. Undoing an edit
 * that had already reached the draft resurrected it on the next sync and still published it; and
 * restoring a section that had already been published was impossible. `null` states the intent
 * explicitly, so it survives the merge, the sync and the publish.
 */
export type StoredValue = string | null;
export type StoredPageOverrides = Record<string, StoredValue>;
export type StoredSiteOverrides = Record<string, StoredPageOverrides>;

/** After merging there are no tombstones left — only real overrides. */
export type PageOverrides = Record<string, string>;              // blockId -> html
export type SiteOverrides = Record<string, PageOverrides>;        // pageId -> {blockId: html}

/**
 * Merge override layers weakest-first, honouring tombstones: a `null` in a later layer removes what
 * an earlier one set. Used for what the canvas shows, what the draft stores and what gets published,
 * so all three agree about what an undo means.
 */
export function mergeOverrideLayers(...layers: (StoredPageOverrides | undefined)[]): PageOverrides {
  const out: PageOverrides = {};
  for (const layer of layers) {
    if (!layer) continue;
    for (const k of Object.keys(layer)) {
      const v = layer[k];
      if (v === null) delete out[k];
      else out[k] = v;
    }
  }
  return out;
}

const key = (tenant: string, site: string) => `editor-v2:real-overrides:${tenant}:${site}`;

export function loadOverrides(tenant: string, site: string): StoredSiteOverrides {
  try {
    const raw = localStorage.getItem(key(tenant, site));
    return raw ? (JSON.parse(raw) as StoredSiteOverrides) : {};
  } catch {
    return {};
  }
}

/** @returns false when the browser refused to store (quota/private mode). */
export function saveOverrides(tenant: string, site: string, all: StoredSiteOverrides): boolean {
  try {
    localStorage.setItem(key(tenant, site), JSON.stringify(all));
  } catch {
    // Out of quota or storage blocked: tell the caller instead of losing the edit silently.
    return false;
  }
  return true;
}

// Applying overrides is part of the shared render core (same code the publisher runs), so the editor
// and the published site can never disagree about what an override means.
export { applyOverrides } from "./renderCore.js";
