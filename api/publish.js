// Publish endpoint (Vercel serverless function) — the WRITE side of instant publish.
//   POST /api/publish  { editKey, project, overrides, breakpoints }
// Saves the editor's per-page edits to Supabase `site_overrides` using the service_role key (server
// only — never the browser), then fires the Vercel Deploy Hook so the site rebuilds with them baked in.
// Mirrors the proven Astro /api/overrides flow, in the platform's format.
//
// Env (set on the Vercel project): SUPABASE_URL (or PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY,
// DEPLOY_HOOK, EDIT_KEY. Missing DEPLOY_HOOK → saves but doesn't rebuild. Missing EDIT_KEY → no gate.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOY_HOOK = process.env.DEPLOY_HOOK;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim(); // trim: pasted env vars often carry a trailing newline

export default async function handler(req, res) {
  // CORS — the cabinet lives on a different origin than the site.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!SUPABASE_URL || !SERVICE) return res.status(500).json({ error: "server not configured (SUPABASE_SERVICE_ROLE_KEY)" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "invalid JSON" }); }

  if (EDIT_KEY && String(body.editKey || "").trim() !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  const project = body.project || "allclean";
  // The cabinet sends big sites in several calls (Vercel rejects a >4.5MB body at the edge, without
  // CORS headers, so the browser only ever sees "Failed to fetch"). Every call saves its own pages;
  // the restore point and the deploy fire once, on the one marked `finish`.
  const finish = body.finish !== false;
  const overrides = body.overrides || {};
  const breakpoints = body.breakpoints || {};
  // Pages the client means to have NO edits at all. Everything else that arrives empty is treated as
  // "this call knows nothing about that page", never as "delete what is published there".
  const clearPages = new Set(Array.isArray(body.clearPages) ? body.clearPages : []);
  const pageIds = new Set([...Object.keys(overrides), ...Object.keys(breakpoints)]);

  /**
   * ⚠️ WHY THIS READS THE LIVE ROWS FIRST — a client lost three days of work here.
   *
   * A publish used to write `overrides[id] || {}` for every page id it saw, including pages that only
   * appeared in `breakpoints`. So a cabinet whose published layer had not finished loading, or that
   * carried sizes for 38 pages and edits for 3, did not publish 3 edits — it ERASED the other 58 and
   * the live site lost a calculator, a reviews block and every deleted English leftover came back.
   * The client saw it as "мои правки пропали", and nothing in the flow said otherwise.
   *
   * Publishing states what a page contains; it cannot state anything about a page it did not send.
   * An empty (or absent) map therefore PRESERVES what is stored, unless the page is named in
   * `clearPages` — which is how the editor says "this page really has no edits now".
   */
  let stored = {};
  {
    const q = [...pageIds].map((id) => `"${id.replace(/"/g, '\\"')}"`).join(",");
    const r = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_overrides?project=eq.${encodeURIComponent(project)}` +
      `&page_id=in.(${encodeURIComponent(q)})&select=page_id,overrides,breakpoints`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    ).catch(() => null);
    if (r && r.ok) for (const row of await r.json()) stored[row.page_id] = row;
  }

  const has = (m) => m && typeof m === "object" && Object.keys(m).length > 0;
  const rows = [...pageIds].map((id) => {
    const keepOv = !clearPages.has(id) && !has(overrides[id]) && has(stored[id]?.overrides);
    const keepBp = !clearPages.has(id) && !has(breakpoints[id]) && has(stored[id]?.breakpoints);
    return {
      project, page_id: id,
      overrides: keepOv ? stored[id].overrides : (overrides[id] || {}),
      breakpoints: keepBp ? stored[id].breakpoints : (breakpoints[id] || {}),
      updated_at: new Date().toISOString(),
    };
  });
  const preserved = rows.filter((r, i) => {
    const id = r.page_id;
    return !clearPages.has(id) && !has(overrides[id]) && has(stored[id]?.overrides);
  }).length;

  if (rows.length) {
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_overrides?on_conflict=project,page_id`, {
      method: "POST",
      headers: {
        apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return res.status(502).json({ error: "save failed: " + (await r.text()) });
  }

  // Record what we just shipped, so this publish becomes a point the client can come back to.
  // Publishing is the only irreversible action in the product; without a snapshot a regretted change
  // could only be undone by rebuilding it from memory. Failing to record must never fail the publish.
  if (finish) try {
    // Read the whole project back rather than snapshotting this call's slice: with a chunked publish
    // the last call knows only its own pages, and a restore point missing the rest is worse than none.
    const all = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_overrides?project=eq.${encodeURIComponent(project)}&select=page_id,overrides,breakpoints`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
    ).then((r) => (r.ok ? r.json() : []));
    const snapOv = {}, snapBp = {};
    for (const row of all) { snapOv[row.page_id] = row.overrides || {}; snapBp[row.page_id] = row.breakpoints || {}; }
    const edits = Object.values(snapOv).reduce((n, o) => n + Object.keys(o || {}).length, 0);
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_versions`, {
      method: "POST",
      headers: {
        apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify([{
        project,
        created_by: String(body.by || "").slice(0, 80),
        note: `${Object.keys(snapOv).length} стр., ${edits} правок`,
        pages: Object.keys(snapOv).length,
        snapshot: { overrides: snapOv, breakpoints: snapBp },
      }]),
    });
  } catch { /* history is a convenience — never block the publish on it */ }

  // ---- make it live ------------------------------------------------------------------------------
  // Pages are rendered on demand by /api/page from these very rows, so an edit is live the moment it
  // is stored. All that is left is to warm the edge cache for the pages that changed, which is a
  // second of work instead of a full rebuild-and-redeploy of the whole site.
  const h = req.headers || {};
  const host = h["x-forwarded-host"] || h.host;
  const origin = host ? `https://${host}` : "";
  let warmed = 0;
  if (origin) {
    const slugs = rows.map((r) => slugOf(r.page_id)).filter(Boolean);
    await Promise.all(slugs.slice(0, 20).map(async (slug) => {
      try {
        const r = await fetch(`${origin}${slug}`, { headers: { "cache-control": "no-cache" } });
        if (r.ok) warmed++;
      } catch { /* warming is best effort — the page is already live either way */ }
    }));
  }

  // ⚠️ The rebuild stays ON. Taking it out was wrong twice over: Vercel only applies a rewrite when no
  // static file matches, and the build writes HTML for every page — so the on-demand renderer was never
  // reached — while the renderer itself could not read the mirror from the site's own output. The
  // result was a publish that stored the edits and changed nothing anyone could see.
  // Pass rebuild:false explicitly once serving is genuinely on-demand.
  let rebuild = false;
  if (finish && DEPLOY_HOOK && body.rebuild !== false) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
  return res.status(200).json({ ok: true, pages: rows.length, rebuild, warmed, preserved });
}

/** page_id ("ru/pricing/index.html") → the URL it is served at ("/ru/pricing"). */
function slugOf(pageId) {
  if (!pageId || typeof pageId !== "string") return "";
  const path = pageId.replace(/index\.html$/, "").replace(/\.html$/, "").replace(/\/+$/, "");
  return "/" + path.replace(/^\/+/, "");
}
