// Overrides READ endpoint — returns the PUBLISHED edits from Supabase `site_overrides` so the editor
// shows the shared state (what was published / what other people edited), matching the live site.
//   POST /api/overrides  { editKey, project }  ->  { overrides:{pageId:{blockId:html}}, breakpoints:{pageId:PageBp} }
// Read side of the same store /api/publish writes. service_role (server only), gated by EDIT_KEY, CORS *.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();

export default async function handler(req, res) {
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
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_overrides?project=eq.${encodeURIComponent(project)}&select=page_id,overrides,breakpoints`;
  let rows;
  try {
    const r = await fetch(url, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    if (!r.ok) return res.status(502).json({ error: "read failed: " + (await r.text()) });
    rows = await r.json();
  } catch (e) {
    return res.status(502).json({ error: "read failed: " + String(e) });
  }

  const overrides = {};
  const breakpoints = {};
  for (const row of rows || []) {
    if (row.overrides && Object.keys(row.overrides).length) overrides[row.page_id] = row.overrides;
    if (row.breakpoints && Object.keys(row.breakpoints).length) breakpoints[row.page_id] = row.breakpoints;
  }
  return res.status(200).json({ ok: true, overrides, breakpoints });
}
