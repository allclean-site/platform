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
    found.push({ url: u, type });
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
  for (const m of loadMedia(tenant)) {
    if (m.type === "image" && /\.svg(\?|$)/i.test(m.url)) { removed++; continue; }
    if (seen.has(m.url)) { removed++; continue; }
    seen.add(m.url);
    cleaned.push(m);
  }

  const additions: MediaAsset[] = [];
  for (const f of found) {
    if (seen.has(f.url)) continue;
    seen.add(f.url);
    additions.push({ id: uid(), url: f.url, type: f.type, name: fileNameOf(f.url), at: new Date().toISOString() });
  }
  if (additions.length || removed) save(tenant, [...additions, ...cleaned]);
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
