// Shared DRAFT endpoint — the live-editing layer.
//
// Edits used to sit in one browser's localStorage until publish, so the agency and the client saw
// different things. The editor now mirrors every edit here (debounced) and reads it back on open /
// on window focus, so both cabinets show the same work-in-progress. Publishing still goes through
// /api/publish, which writes the PUBLISHED layer (site_overrides) that the build reads.
//
//   POST /api/draft { editKey, project, action:"read" }
//        -> { ok, overrides:{pageId:{blockId:html}}, breakpoints:{pageId:PageBp}, meta:{pageId:{updatedAt,updatedBy}} }
//   POST /api/draft { editKey, project, action:"save", pageId, overrides, breakpoints, by }
//        -> { ok, updatedAt }
//   POST /api/draft { editKey, project, action:"clear", pageId? }   // pageId omitted = whole project
//        -> { ok }
//
// service_role (server only), gated by EDIT_KEY, CORS * (the cabinet is a different origin).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();

const REST = () => `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_drafts`;
const auth = () => ({ apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" });

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
  const action = body.action || "read";

  try {
    if (action === "read") {
      const url = `${REST()}?project=eq.${encodeURIComponent(project)}&select=page_id,overrides,breakpoints,updated_at,updated_by`;
      const r = await fetch(url, { headers: auth() });
      if (!r.ok) return res.status(502).json({ error: "read failed: " + (await r.text()) });
      const rows = await r.json();
      const overrides = {}, breakpoints = {}, meta = {};
      for (const row of rows || []) {
        if (row.overrides && Object.keys(row.overrides).length) overrides[row.page_id] = row.overrides;
        if (row.breakpoints && Object.keys(row.breakpoints).length) breakpoints[row.page_id] = row.breakpoints;
        meta[row.page_id] = { updatedAt: row.updated_at, updatedBy: row.updated_by || "" };
      }
      return res.status(200).json({ ok: true, overrides, breakpoints, meta });
    }

    if (action === "save") {
      const pageId = body.pageId;
      if (!pageId) return res.status(400).json({ error: "pageId required" });

      // Optimistic concurrency. The same person really does open the editor twice (laptop and phone,
      // or two tabs), and each save replaces the whole page — so without this the tab that saves last
      // silently destroys the other one's work. The client sends the timestamp it last saw; if the
      // stored row has moved on since, we refuse and hand back who changed it and when.
      if (body.expectedAt) {
        const c = await fetch(
          `${REST()}?project=eq.${encodeURIComponent(project)}&page_id=eq.${encodeURIComponent(pageId)}&select=updated_at,updated_by`,
          { headers: auth() });
        if (c.ok) {
          const cur = (await c.json())[0];
          if (cur && cur.updated_at && cur.updated_at !== body.expectedAt) {
            return res.status(409).json({
              error: "conflict", conflict: true,
              updatedAt: cur.updated_at, updatedBy: cur.updated_by || "",
            });
          }
        }
      }

      const updatedAt = new Date().toISOString();
      const row = {
        project, page_id: pageId,
        overrides: body.overrides || {},
        breakpoints: body.breakpoints || {},
        updated_at: updatedAt,
        updated_by: String(body.by || "").slice(0, 80),
      };
      const r = await fetch(`${REST()}?on_conflict=project,page_id`, {
        method: "POST",
        headers: { ...auth(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([row]),
      });
      if (!r.ok) return res.status(502).json({ error: "save failed: " + (await r.text()) });
      return res.status(200).json({ ok: true, updatedAt });
    }

    if (action === "clear") {
      let url = `${REST()}?project=eq.${encodeURIComponent(project)}`;
      if (body.pageId) url += `&page_id=eq.${encodeURIComponent(body.pageId)}`;
      const r = await fetch(url, { method: "DELETE", headers: { ...auth(), Prefer: "return=minimal" } });
      if (!r.ok) return res.status(502).json({ error: "clear failed: " + (await r.text()) });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}
