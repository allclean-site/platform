/**
 * Serve a page of the site — rendered on demand instead of rebuilt and redeployed.
 *
 * Why this exists: publishing a changed word used to run the whole deploy pipeline — clone the repo,
 * build, upload 35 MB, propagate — a minute or more for an edit whose HTML takes 0.7 seconds to
 * produce for the ENTIRE site. Tilda feels instant because publishing there never touches a build: the
 * page is rendered from stored content and served. This is the same idea.
 *
 * A publish now only writes rows to Supabase; this function renders the page from the SAME two inputs
 * the static build uses — the imported mirror and the stored overrides — through the SAME render core,
 * so what visitors get is byte-for-byte what the build would have produced.
 *
 * Failure is designed in: no overrides, no database, no network — the page still renders from the
 * mirror alone, which is exactly what the last deploy would have served. The site cannot go dark
 * because Supabase is having a bad day.
 */

import { exportPageHtml } from "../src/editor/renderCore.js";

const PROJECT = "allclean";
/** Cached per warm instance: the mirror never changes between deploys. */
const cache = { index: null, pages: new Map() };

const baseUrl = (req) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
};

async function loadIndex(origin) {
  if (cache.index) return cache.index;
  const r = await fetch(`${origin}/import/${PROJECT}/_pages.json`);
  if (!r.ok) throw new Error(`index ${r.status}`);
  cache.index = await r.json();
  return cache.index;
}

async function loadPage(origin, file) {
  if (cache.pages.has(file)) return cache.pages.get(file);
  const r = await fetch(`${origin}/import/${PROJECT}/${file}.json`);
  if (!r.ok) throw new Error(`page ${r.status}`);
  const p = await r.json();
  cache.pages.set(file, p);
  return p;
}

/** The published edits for one page. Any problem here means "serve the page without edits". */
async function loadOverrides(pageId) {
  const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON;
  if (!url || !key) return null;
  try {
    const q = `${url}/rest/v1/site_overrides?project=eq.${encodeURIComponent(PROJECT)}&page_id=eq.${encodeURIComponent(pageId)}&select=overrides,breakpoints`;
    const r = await fetch(q, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!r.ok) return null;
    const rows = await r.json();
    return rows && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}

/** "/", "/about", "/ru/pricing" → the page whose slug matches. */
function findEntry(index, path) {
  const want = "/" + String(path || "").replace(/^\/+/, "").replace(/\/+$/, "");
  const norm = want === "/" ? "/" : want;
  return (index.pages || []).find((p) => {
    const slug = p.slug === "/" ? "/" : "/" + String(p.slug).replace(/^\/+/, "").replace(/\/+$/, "");
    return slug === norm;
  });
}

export default async function handler(req, res) {
  const origin = baseUrl(req);
  const raw = (req.query && (req.query.path ?? req.query.p)) ?? "";
  const path = Array.isArray(raw) ? raw[0] : raw;
  try {
    const index = await loadIndex(origin);
    const entry = findEntry(index, path);
    if (!entry) { res.status(404).send("Not found"); return; }
    const page = await loadPage(origin, entry.file);
    const row = await loadOverrides(entry.id);
    const html = exportPageHtml(page, row?.overrides, row?.breakpoints);
    res.setHeader("content-type", "text/html; charset=utf-8");
    // Served from the edge cache immediately; at most one background revalidation per second keeps it
    // current, and a publish warms these URLs itself, so an edit is live in about a second.
    res.setHeader("cache-control", "public, s-maxage=1, stale-while-revalidate=604800");
    res.status(200).send(html);
  } catch (e) {
    // Last resort: the mirror as it shipped. Identical to what the previous deploy served.
    try {
      const index = await loadIndex(origin);
      const entry = findEntry(index, path);
      if (!entry) { res.status(404).send("Not found"); return; }
      const page = await loadPage(origin, entry.file);
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.setHeader("cache-control", "public, s-maxage=1, stale-while-revalidate=604800");
      res.status(200).send(exportPageHtml(page, undefined, undefined));
    } catch {
      res.status(500).send("Temporarily unavailable");
    }
  }
}
