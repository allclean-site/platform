// Published version history — list what was published, and put an earlier version back.
//
// Publishing replaces what visitors see and nothing recorded the previous state, so a mistake could
// only be fixed by rebuilding it from memory. Every publish now writes a snapshot (see api/publish.js)
// and this endpoint reads and restores them.
//
//   POST /api/versions { editKey, project, action:"list" }
//        -> { ok, versions:[{ id, createdAt, createdBy, note, pages }] }   (newest first, max 30)
//   POST /api/versions { editKey, project, action:"restore", id }
//        -> { ok, pages }   restores that snapshot into site_overrides and triggers a rebuild
//
// service_role (server only), gated by EDIT_KEY, CORS * (the cabinet is a different origin).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOY_HOOK = process.env.DEPLOY_HOOK;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();

const REST = (t) => `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${t}`;
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

  try {
    if ((body.action || "list") === "list") {
      // Deliberately without `snapshot` — the list is metadata only, the payloads are large.
      const url = `${REST("site_versions")}?project=eq.${encodeURIComponent(project)}` +
        `&select=id,created_at,created_by,note,pages&order=created_at.desc&limit=30`;
      const r = await fetch(url, { headers: auth() });
      if (!r.ok) return res.status(502).json({ error: "read failed: " + (await r.text()) });
      const rows = await r.json();
      return res.status(200).json({
        ok: true,
        versions: (rows || []).map((v) => ({
          id: v.id, createdAt: v.created_at, createdBy: v.created_by || "", note: v.note || "", pages: v.pages || 0,
        })),
      });
    }

    if (body.action === "restore") {
      if (!body.id) return res.status(400).json({ error: "id required" });
      const g = await fetch(`${REST("site_versions")}?id=eq.${encodeURIComponent(body.id)}&select=snapshot`, { headers: auth() });
      if (!g.ok) return res.status(502).json({ error: "read failed: " + (await g.text()) });
      const found = await g.json();
      if (!found || !found.length) return res.status(404).json({ error: "version not found" });

      const snap = found[0].snapshot || {};
      const overrides = snap.overrides || {};
      const breakpoints = snap.breakpoints || {};

      // Replace the published state with the snapshot. Pages that existed then but not now would
      // otherwise keep their current edits, so clear the project first and write the snapshot back.
      const del = await fetch(`${REST("site_overrides")}?project=eq.${encodeURIComponent(project)}`,
        { method: "DELETE", headers: { ...auth(), Prefer: "return=minimal" } });
      if (!del.ok) return res.status(502).json({ error: "clear failed: " + (await del.text()) });

      const ids = new Set([...Object.keys(overrides), ...Object.keys(breakpoints)]);
      const rows = [...ids].map((id) => ({
        project, page_id: id,
        overrides: overrides[id] || {},
        breakpoints: breakpoints[id] || {},
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) {
        const w = await fetch(`${REST("site_overrides")}?on_conflict=project,page_id`, {
          method: "POST",
          headers: { ...auth(), Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        });
        if (!w.ok) return res.status(502).json({ error: "restore failed: " + (await w.text()) });
      }

      let rebuild = false;
      if (DEPLOY_HOOK) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
      return res.status(200).json({ ok: true, pages: rows.length, rebuild });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}
