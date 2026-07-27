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
const EDIT_KEY = process.env.EDIT_KEY;

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

  if (EDIT_KEY && body.editKey !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

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

  let rebuild = false;
  if (DEPLOY_HOOK) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
  return res.status(200).json({ ok: true, pages: rows.length, rebuild });
}
