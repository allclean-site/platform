/**
 * Media manifest for the gallery — every photo and video the SITE uses, not just the open page.
 *
 * The gallery used to be built by walking the rendered document in the editor iframe, so it only ever
 * knew the page the client happened to be on: the home page offers 36 <img> tags but only 13 distinct
 * addresses, five of them SVG icons, so the client saw twelve items and none of the photos from the
 * other 37 pages. "Choose from the gallery" was therefore useless for exactly the thing it is for —
 * reusing a photo that already exists somewhere on the site.
 *
 * Reading all 38 pages from the browser would mean 38 requests of a ~700KB document each, on every
 * editor load. Instead this walks the imported mirror once, at build time, and writes a small index
 * the gallery can fetch in one go.
 *
 * Excluded on purpose: SVG (logos and UI icons — phone, viber, telegram — are not swappable photos),
 * anything whose path reads as a logo/icon/favicon, and inline data/blob urls. Deduped by address.
 *
 *   node scripts/gen-media-manifest.mjs [site]      # default: allclean
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = process.argv[2] || "allclean";
const DIR = join(ROOT, "public", "import", site);

const IMG_EXT = /\.(?:jpe?g|png|gif|webp|avif|bmp)(?:\?|#|$)/i;
const VID_EXT = /\.(?:mp4|webm|ogv|mov|m4v)(?:\?|#|$)/i;
/** Brand marks and interface icons — never content the client would swap. */
const NOT_CONTENT = /\.svg(?:\?|#|$)|(?:^|\/)(?:logo|logotype|favicon|icon|icons|sprite)[-_./]|[-_/](?:logo|icon)\.(?!.*\/)/i;

const isSkippable = (u) => !u || /^(?:data:|blob:|#|javascript:)/i.test(u);

function typeOf(url, hint) {
  if (VID_EXT.test(url)) return "video";
  if (IMG_EXT.test(url)) return "image";
  return hint || null;            // unknown extension (e.g. a CDN url without one) → use the tag
}

function collect(html, out) {
  const add = (raw, hint) => {
    if (isSkippable(raw)) return;
    // Inline styles arrive escaped (`url(&quot;/video/hero-poster.jpg&quot;)`) — unescape and drop the
    // quotes, or the same file lands in the gallery twice under two spellings of one address.
    const url = raw.trim()
      .replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&")
      .replace(/^["']+|["']+$/g, "").trim();
    if (!url || isSkippable(url) || NOT_CONTENT.test(url)) return;
    const type = typeOf(url, hint);
    if (!type) return;
    const seen = out.get(url);
    if (seen) seen.pages++;
    else out.set(url, { url, type, pages: 1 });
  };

  for (const m of html.matchAll(/<img\b[^>]*?\ssrc=["']([^"']+)["']/gi)) add(m[1], "image");
  for (const m of html.matchAll(/<video\b[^>]*?\ssrc=["']([^"']+)["']/gi)) add(m[1], "video");
  // <source> is used by both <picture> and <video>; the extension decides, and a bare `type=` helps.
  for (const m of html.matchAll(/<source\b([^>]*)>/gi)) {
    const tag = m[1];
    const src = /\ssrc=["']([^"']+)["']/i.exec(tag);
    if (!src) continue;
    const t = /\stype=["']([^"']+)["']/i.exec(tag);
    add(src[1], t ? (t[1].startsWith("video") ? "video" : "image") : null);
  }
  // Webflow keeps a background video's full variant list here — the mp4 is often ONLY in this attribute.
  for (const m of html.matchAll(/\sdata-video-urls=["']([^"']+)["']/gi)) {
    for (const u of m[1].split(",")) add(u, "video");
  }
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*[^;"']*url\((["']?)([^)"']+)\1\)/gi)) add(m[2], "image");
  for (const m of html.matchAll(/<img\b[^>]*?\ssrcset=["']([^"']+)["']/gi)) {
    for (const cand of m[1].split(",")) add(cand.trim().split(/\s+/)[0], "image");
  }
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
const found = new Map();
for (const f of files) {
  const page = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  const parts = [page.prefix, page.bodyPrefix, page.pwOpen, page.mainOpen, page.mainClose, page.pwClose, page.suffix];
  for (const b of page.blocks || []) parts.push(b?.content?.html);
  for (const html of parts) if (typeof html === "string") collect(html, found);
}

/**
 * One entry per actual photo/video, not per file.
 *
 * The same picture reaches the markup several times over: Webflow ships responsive copies next to the
 * original (`feature-image.jpg`, `feature-image-p-500.jpg`, `feature-image-p-800.jpg`) through srcset,
 * and a background video ships as both `hero.mp4` and `hero.webm`. Offering all of them would fill the
 * gallery with the duplicates the client asked us to get rid of, so same-thing files collapse to one
 * choice: the full-size image, and the most widely supported video format.
 */
const VIDEO_RANK = { mp4: 0, webm: 1, m4v: 2, mov: 3, ogv: 4 };
function identity(item) {
  if (item.type === "video") return item.url.replace(/\.[a-z0-9]+(?=(?:\?|#|$))/i, "");
  return item.url.replace(/-p-\d+(?=\.[a-z0-9]+(?:\?|#|$))/i, "");
}
function betterOf(a, b) {
  if (a.type === "video") {
    const rank = (u) => VIDEO_RANK[(u.split("?")[0].split(".").pop() || "").toLowerCase()] ?? 9;
    return rank(a.url) <= rank(b.url) ? a : b;
  }
  return /-p-\d+\./i.test(a.url) ? b : a;      // the un-suffixed file is the full-size original
}
const byIdentity = new Map();
for (const item of found.values()) {
  const key = item.type + "|" + identity(item);
  const prev = byIdentity.get(key);
  if (!prev) { byIdentity.set(key, item); continue; }
  const keep = betterOf(prev, item);
  keep.pages = Math.max(prev.pages, item.pages);
  byIdentity.set(key, keep);
}

const items = [...byIdentity.values()].sort((a, b) => (a.type === b.type ? b.pages - a.pages : a.type < b.type ? -1 : 1));
const manifest = { site, pages: files.length, items };
writeFileSync(join(DIR, "_media.json"), JSON.stringify(manifest), "utf8");

const n = (t) => items.filter((i) => i.type === t).length;
console.log(`[media] ${site}: ${files.length} pages → ${items.length} unique (${n("image")} фото, ${n("video")} видео) → _media.json`);
