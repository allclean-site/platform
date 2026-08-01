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
  const overrides = body.overrides || {};
  const breakpoints = body.breakpoints || {};
  const pageIds = new Set([...Object.keys(overrides), ...Object.keys(breakpoints)]);
  const rows = [...pageIds].map((id) => ({
    project, page_id: id,
    overrides: overrides[id] || {},
    breakpoints: breakpoints[id] || {},
    updated_at: new Date().toISOString(),
  }));

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
  try {
    const edits = Object.values(overrides).reduce((n, o) => n + Object.keys(o || {}).length, 0);
    await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_versions`, {
      method: "POST",
      headers: {
        apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json", Prefer: "return=minimal",
      },
      body: JSON.stringify([{
        project,
        created_by: String(body.by || "").slice(0, 80),
        note: `${rows.length} стр., ${edits} правок`,
        pages: rows.length,
        snapshot: { overrides, breakpoints },
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
  if (DEPLOY_HOOK && body.rebuild !== false) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
  return res.status(200).json({ ok: true, pages: rows.length, rebuild, warmed });
}

/** page_id ("ru/pricing/index.html") → the URL it is served at ("/ru/pricing"). */
function slugOf(pageId) {
  if (!pageId || typeof pageId !== "string") return "";
  const path = pageId.replace(/index\.html$/, "").replace(/\.html$/, "").replace(/\/+$/, "");
  return "/" + path.replace(/^\/+/, "");
}
