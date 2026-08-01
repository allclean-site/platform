/**
 * Generate the page routes in vercel.json.
 *
 * Vercel reads vercel.json from the REPOSITORY, before any build runs, so the list of pages that are
 * served by the on-demand renderer cannot be produced during the build — it is generated here and
 * committed. Run after importing or renaming pages:
 *
 *     node scripts/gen-routes.mjs
 *
 * Only real page slugs are listed. Assets (/images, /video, /fonts, /js, /import), the API and the
 * files at the root keep serving straight from the static build, which is also the fallback if these
 * rewrites are ever removed: delete them and the site is exactly what it was before.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const idx = JSON.parse(readFileSync(resolve("public/import/allclean/_pages.json"), "utf8"));
const cfgPath = resolve("vercel.json");
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));

const slugs = [...new Set((idx.pages || []).map((p) => (p.slug === "/" ? "/" : "/" + String(p.slug).replace(/^\/+|\/+$/g, ""))))]
  .sort((a, b) => b.length - a.length);   // longest first: /ru/pricing before /ru

/**
 * ⚠️ This vercel.json is shared by BOTH projects built from this repo — the site and the cabinet.
 * Without a host condition, "/" would send the cabinet's own root to the site renderer and the panel
 * would disappear. Every rewrite is therefore scoped to the site's domains.
 */
const HOSTS = ["allclean.md", "www.allclean.md"];
const rewrites = slugs.flatMap((slug) => {
  const dest = `/api/page?path=${encodeURIComponent(slug)}`;
  // Both forms, because the site links to pages with and without a trailing slash.
  const sources = slug === "/" ? ["/"] : [slug, `${slug}/`];
  return sources.flatMap((source) =>
    HOSTS.map((host) => ({ source, has: [{ type: "host", value: host }], destination: dest }))
  );
});

cfg.rewrites = rewrites;
// The renderer sets its own caching, but a blanket header rule in this file could overwrite it.
// State it again for the page routes so the CDN is allowed to serve them while revalidating.
const PAGE_SOURCE = "/((?!api/|import/|images/|video/|fonts/|js/|assets/|site-assets/).*)";
cfg.headers = (cfg.headers || []).filter((h) => h.source !== PAGE_SOURCE);
cfg.headers.push({
  source: PAGE_SOURCE,
  has: [{ type: "host", value: HOSTS[0] }],
  headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate, s-maxage=1, stale-while-revalidate=604800" }],
});
writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
console.log(`vercel.json: ${rewrites.length} маршрутов на ${slugs.length} страниц`);
