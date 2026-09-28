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

    // Read one snapshot WITHOUT restoring it. Comparing "what was live then" against "what is live
    // now" is how a client's "мои правки пропали" gets answered with the actual missing blocks
    // instead of a guess — and restoring blind, just to look, would overwrite the current state.
    if (body.action === "get") {
      if (!body.id) return res.status(400).json({ error: "id required" });
      const g = await fetch(`${REST("site_versions")}?id=eq.${encodeURIComponent(body.id)}&select=snapshot,created_at,created_by,note`, { headers: auth() });
      if (!g.ok) return res.status(502).json({ error: "read failed: " + (await g.text()) });
      const found = await g.json();
      if (!found || !found.length) return res.status(404).json({ error: "version not found" });
      return res.status(200).json({ ok: true, createdAt: found[0].created_at, createdBy: found[0].created_by || "",
        note: found[0].note || "", snapshot: found[0].snapshot || {} });
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
      const pageIds = [...new Set([...Object.keys(overrides), ...Object.keys(breakpoints)])];

      // Пустой снимок восстанавливать нельзя: это не "вернуть как было", это "стереть сайт".
      // Такие снимки существуют — их записывал publish в те моменты, когда чтение состояния падало.
      if (!pageIds.length && body.force !== true) {
        return res.status(409).json({ error: "в этой точке отката нет ни одной страницы — восстановление отменено" });
      }

      // ⚠️ ПОРЯДОК ВАЖЕН: СНАЧАЛА ПИШЕМ, ПОТОМ УБИРАЕМ ЛИШНЕЕ. Раньше здесь сначала удалялись все
      // строки проекта, и сбой записи (таймаут, слишком большой payload) оставлял сайт вообще без
      // правок — с одним 502 в ответ. Теперь неудачная запись не меняет ничего.
      const rows = pageIds.map((id) => ({
        project, page_id: id,
        overrides: overrides[id] || {},
        breakpoints: breakpoints[id] || {},
        updated_at: new Date().toISOString(),
      }));
      const up = await fetch(`${REST("site_overrides")}?on_conflict=project,page_id`, {
        method: "POST",
        headers: { ...auth(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!up.ok) return res.status(502).json({ error: "restore failed: " + (await up.text()) });

      // Страницы, которых в снимке нет, гасим по одной — по имени, а не "всё, что есть в проекте".
      const cur = await fetch(`${REST("site_overrides")}?project=eq.${encodeURIComponent(project)}&select=page_id`, { headers: auth() })
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
      const extra = (cur || []).map((r) => r.page_id).filter((id) => !pageIds.includes(id));
      for (const id of extra) {
        await fetch(`${REST("site_overrides")}?project=eq.${encodeURIComponent(project)}&page_id=eq.${encodeURIComponent(id)}`,
          { method: "DELETE", headers: { ...auth(), Prefer: "return=minimal" } }).catch(() => {});
      }

      // Общий черновик лежит ПОВЕРХ опубликованного слоя: если его не тронуть, кабинет продолжит
      // показывать состояние до восстановления, а следующая публикация вернёт его на сайт — то есть
      // откат молча отменится. Чистим ровно те страницы, которые восстановили.
      for (const id of pageIds) {
        await fetch(`${REST("site_drafts")}?project=eq.${encodeURIComponent(project)}&page_id=eq.${encodeURIComponent(id)}`,
          { method: "DELETE", headers: { ...auth(), Prefer: "return=minimal" } }).catch(() => {});
      }
      // Общая правка шапки/подвала живёт ТОЛЬКО в черновике (`__shared:<язык>`) и при рендере
      // сильнее того, что записано на странице. Не убрать её здесь — значит откатить сайт и тут же
      // получить ту же правку обратно на каждой странице.
      await fetch(`${REST("site_drafts")}?project=eq.${encodeURIComponent(project)}&page_id=like.__shared*`,
        { method: "DELETE", headers: { ...auth(), Prefer: "return=minimal" } }).catch(() => {});

      let rebuild = false;
      if (DEPLOY_HOOK) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
      return res.status(200).json({ ok: true, pages: rows.length, removed: extra.length, rebuild });
    }

    return res.status(400).json({ error: "unknown action" });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
}
