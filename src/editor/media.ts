/**
 * Media library («Галерея») — every photo/video the site uses or the client uploaded, per tenant.
 * Removing media from a page never loses the asset: it stays in the gallery to re-insert, and assets
 * deleted from the gallery itself go to a restorable Trash («Корзина»). Existing site media is
 * auto-indexed from the rendered page so the gallery is useful immediately.
 *
 * Interface phase: metadata in localStorage; asset bytes live in Supabase Storage (via image.ts) when
 * configured, else images fall back to data URLs. The same shape maps to a future `media` table.
 */

import { downscale, putToStorage, blobToDataUrl } from "./image";
import { toCanonical, hasPreviewPath } from "./assetPaths";

export type MediaType = "image" | "video";
export interface MediaAsset {
  id: string;
  url: string;
  type: MediaType;
  name: string;
  size?: number;
  at: string;          // added ISO
  deleted?: boolean;   // in Trash
  deletedAt?: string;
}

const KEY = (tenant: string) => `leadgenium:media:${tenant}`;
const uid = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function loadMedia(tenant: string): MediaAsset[] {
  try { return JSON.parse(localStorage.getItem(KEY(tenant)) || "[]"); } catch { return []; }
}
function save(tenant: string, list: MediaAsset[]) { localStorage.setItem(KEY(tenant), JSON.stringify(list)); }

export const activeMedia = (tenant: string) => loadMedia(tenant).filter((m) => !m.deleted);
export const trashedMedia = (tenant: string) => loadMedia(tenant).filter((m) => m.deleted);

/** Add an asset (or return the existing one for the same url; restores it from Trash if needed). */
export function addMedia(tenant: string, a: { url: string; type: MediaType; name?: string; size?: number }): MediaAsset {
  const list = loadMedia(tenant);
  const existing = list.find((m) => m.url === a.url);
  if (existing) {
    if (existing.deleted) { existing.deleted = false; delete existing.deletedAt; save(tenant, list); }
    return existing;
  }
  const asset: MediaAsset = { id: uid(), url: a.url, type: a.type, name: a.name || fileNameOf(a.url), size: a.size, at: new Date().toISOString() };
  save(tenant, [asset, ...list]);
  return asset;
}

export function trashMedia(tenant: string, id: string) {
  const list = loadMedia(tenant);
  const m = list.find((x) => x.id === id);
  if (m) { m.deleted = true; m.deletedAt = new Date().toISOString(); save(tenant, list); }
}
export function restoreMedia(tenant: string, id: string) {
  const list = loadMedia(tenant);
  const m = list.find((x) => x.id === id);
  if (m) { m.deleted = false; delete m.deletedAt; save(tenant, list); }
}
export function purgeMedia(tenant: string, id: string) {
  save(tenant, loadMedia(tenant).filter((x) => x.id !== id));
}

function fileNameOf(url: string): string {
  try { return decodeURIComponent(url.split("/").pop()!.split("?")[0]) || "файл"; } catch { return "файл"; }
}

/**
 * What makes two files the SAME picture (or the same video) to a person choosing one.
 *
 * The markup carries a photo several times over: Webflow generates responsive copies next to the
 * original (`feature-image.jpg` / `-p-500.jpg` / `-p-800.jpg`) for srcset, and a background video
 * ships as both mp4 and webm. Keyed by url alone, the gallery lists each of them — which is precisely
 * the "повторы" the client asked us to remove. Same rule as scripts/gen-media-manifest.mjs, so what
 * the manifest brings in and what the open page adds cannot disagree about what counts as a duplicate.
 */
export function mediaIdentity(url: string, type: MediaType): string {
  const bare = url.split("?")[0];
  return type === "video"
    ? "video|" + bare.replace(/\.[a-z0-9]+$/i, "")
    : "image|" + bare.replace(/-p-\d+(?=\.[a-z0-9]+$)/i, "");
}

/**
 * Load the whole SITE's media, not just the open page.
 *
 * `indexMediaFromDoc` below can only see the document the canvas has loaded, so the gallery showed the
 * current page's dozen addresses and none of the photos living on the other 37 pages — which made
 * "выбрать из галереи" useless for its whole purpose. The manifest (`_media.json`, written by
 * scripts/gen-media-manifest.mjs at build time) is the site-wide index: one small request, already
 * deduplicated, with logos/icons and Webflow's responsive copies filtered out.
 *
 * Merged into the same library, so an asset the client uploaded and an asset that came with the site
 * sit side by side, and the Trash still applies to both. Safe to call on every editor load.
 */
export async function syncSiteMedia(tenant: string, dataUrl: string): Promise<number> {
  let items: { url: string; type: MediaType }[];
  try {
    const res = await fetch(`${dataUrl}/_media.json`, { cache: "no-cache" });
    if (!res.ok) return 0;
    const manifest = await res.json();
    items = Array.isArray(manifest?.items) ? manifest.items : [];
  } catch {
    return 0;                       // no manifest yet → the per-page indexer still fills the gallery
  }
  const list = loadMedia(tenant);
  const seen = new Set(list.map((m) => mediaIdentity(m.url, m.type)));
  const additions: MediaAsset[] = [];
  for (const it of items) {
    if (!it?.url) continue;
    const key = mediaIdentity(it.url, it.type === "video" ? "video" : "image");
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push({
      id: uid(), url: it.url, type: it.type === "video" ? "video" : "image",
      name: fileNameOf(it.url), at: new Date().toISOString(),
    });
  }
  if (additions.length) save(tenant, [...additions, ...list]);
  return additions.length;
}

/** Auto-index the media already present in a rendered page document (img / video / source / CSS bg),
 *  so the gallery reflects the real site without any manual upload. Idempotent (dedupes by url). */
export function indexMediaFromDoc(tenant: string, doc: Document): number {
  const found: { url: string; type: MediaType }[] = [];
  const push = (raw: string | null | undefined, type: MediaType) => {
    if (!raw) return;
    const u = raw.trim();
    if (!u || u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("#")) return;
    // Skip SVGs — those are logos/UI icons (phone, viber, telegram…), not swappable photos.
    if (type === "image" && /\.svg(\?|$)/i.test(u)) return;
    // We read these out of the editor IFRAME, where assets are served under /site-assets/*. Store the
    // canonical site path instead, or picking from the gallery would publish a url nothing serves.
    found.push({ url: toCanonical(u), type });
  };
  doc.querySelectorAll("img").forEach((el) => { push(el.getAttribute("src"), "image"); });
  doc.querySelectorAll("video").forEach((el) => { push(el.getAttribute("src"), "video"); });
  doc.querySelectorAll("source").forEach((el) => {
    const t = (el.getAttribute("type") || "").startsWith("video") || el.closest("video") ? "video" : "image";
    push(el.getAttribute("src"), t as MediaType);
  });
  // inline background-image url(...)
  doc.querySelectorAll<HTMLElement>("[style*='background']").forEach((el) => {
    const m = /url\((['"]?)(.*?)\1\)/i.exec(el.style.backgroundImage || "");
    if (m) push(m[2], "image");
  });

  // Self-heal legacy libraries built by older indexers: drop SVG icons + de-duplicate by url. Runs on
  // every editor load, so a client's stale gallery cleans itself up without clearing localStorage.
  const seen = new Set<string>();
  const cleaned: MediaAsset[] = [];
  let removed = 0;
  let fixed = 0;
  for (const m of loadMedia(tenant)) {
    if (m.type === "image" && /\.svg(\?|$)/i.test(m.url)) { removed++; continue; }
    // Heal entries saved with the iframe's preview prefix (incl. ones that accumulated several).
    if (hasPreviewPath(m.url)) { m.url = toCanonical(m.url); fixed++; }
    const key = mediaIdentity(m.url, m.type);
    if (seen.has(key)) { removed++; continue; }
    seen.add(key);
    cleaned.push(m);
  }

  const additions: MediaAsset[] = [];
  for (const f of found) {
    const key = mediaIdentity(f.url, f.type);
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push({ id: uid(), url: f.url, type: f.type, name: fileNameOf(f.url), at: new Date().toISOString() });
  }
  if (additions.length || removed || fixed) save(tenant, [...additions, ...cleaned]);
  return additions.length;
}

/** Upload a picked File to the library. Images are downscaled; video is uploaded as-is (needs Storage).
 *  Returns the created asset, or null (user cancel / video without Storage / failure). */
export async function uploadMediaFile(tenant: string, file: File): Promise<MediaAsset | null> {
  const isVideo = file.type.startsWith("video/");
  try {
    if (isVideo) {
      const ext = file.name.split(".").pop() || "mp4";
      const url = await putToStorage(tenant, file, ext, file.type);
      if (!url) return null; // video is too large to inline — Storage is required
      return addMedia(tenant, { url, type: "video", name: file.name, size: file.size });
    }
    const { blob, ext, type } = await downscale(file);
    const url = (await putToStorage(tenant, blob, ext, type)) || (await blobToDataUrl(blob));
    return addMedia(tenant, { url, type: "image", name: file.name, size: blob.size });
  } catch {
    return null;
  }
}
