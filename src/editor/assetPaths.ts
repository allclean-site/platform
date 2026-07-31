/**
 * Asset paths: one rule, enforced in one place.
 *
 * The imported site references its assets from the domain root (/images, /video, /fonts, /js,
 * /logo.svg). Inside the cabinet those would collide with the platform's own root, so the editor
 * iframe is served a rewritten copy under /site-assets/*.
 *
 * That rewrite is a PREVIEW-ONLY concern, and forgetting it caused a nasty bug: the editor saves a
 * block by reading its innerHTML back out of the iframe, so the rewritten paths were stored as the
 * override, re-rewritten on the next load (/site-assets/site-assets/…, growing by one prefix per
 * save) and finally published — where nothing serves that path, so the hero video 404'd and rendered
 * as a white box.
 *
 * The rule now: STORED and PUBLISHED html always uses canonical root paths; the /site-assets prefix
 * exists only while markup lives inside the iframe. Everything crossing that boundary goes through
 * `toPreview` (going in) or `toCanonical` (coming out).
 */

const BASE = "/site-assets";
const DIRS = "images|video|fonts|js";

/** Canonical → preview (used when rendering markup inside the editor iframe). */
export function toPreview(html: string): string {
  // Collapse first so an already-rewritten string can't gain another prefix.
  return toCanonical(html)
    .split("/logo.svg").join(`${BASE}/logo.svg`)
    .split("/images/").join(`${BASE}/images/`)
    .split("/video/").join(`${BASE}/video/`)
    .split("/fonts/").join(`${BASE}/fonts/`)
    .split("/js/").join(`${BASE}/js/`);
}

/**
 * Preview → canonical. Collapses ANY number of accumulated prefixes, so markup corrupted by the old
 * save path (…/site-assets/site-assets/video/hero.webm) heals itself the next time it is loaded.
 */
export function toCanonical(html: string): string {
  return html
    .replace(new RegExp(`(?:${BASE})+/(${DIRS})/`, "g"), "/$1/")
    .replace(new RegExp(`(?:${BASE})+/logo\\.svg`, "g"), "/logo.svg");
}

/** True when the string still carries a preview prefix (i.e. it must not be stored/published). */
export function hasPreviewPath(s: string): boolean {
  return new RegExp(`(?:${BASE})+/(?:${DIRS})/|(?:${BASE})+/logo\\.svg`).test(s);
}

/** Canonicalise every value of a pageId → blockId → html map (heals stored overrides on load).
 *  Tombstones (null) carry no markup, so they pass through untouched. */
export function canonicalizeOverrides<T extends Record<string, Record<string, string | null>>>(all: T): T {
  for (const pid of Object.keys(all)) {
    const page = all[pid];
    for (const bid of Object.keys(page)) {
      const html = page[bid];
      if (typeof html === "string" && hasPreviewPath(html)) page[bid] = toCanonical(html);
    }
  }
  return all;
}
