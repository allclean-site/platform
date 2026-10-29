// Статьи на проверке у владельца (Vercel serverless). Кабинет → «Блог» → «На проверке».
//   POST { editKey, op:"list" }                         → { articles:[…review/approved/rejected], suggested:{id:iso} }
//   POST { editKey, op:"approve", id, publishAt? }      → approved + дата выхода (без даты — ближайший свободный слот)
//   POST { editKey, op:"unapprove", id }                → снова на проверку, дата снимается
//   POST { editKey, op:"reject", id, note }             → rejected + замечание (тему черновик больше не берёт сам)
//   POST { editKey, op:"save", id, article:{…} }        → правка из редактора, снова review, проверка заново
// Публикует не этот обработчик, а api/publish-scheduled.js в назначенный день. Без «Одобрить»
// статья на сайт не попадает: сборка берёт только status=published.

import facts from "../data/allclean-facts.json" with { type: "json" };
import { PROJECT_ID, checkArticle, nextSlot, supabase, articlePath, SLUG_RE, toSlug } from "../src/engine/blog/article-pipeline.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();
const P = `project_id=eq.${PROJECT_ID}`;

function ctxFor(row, all) {
  const known = new Set([...Object.keys(facts.pages.ru), ...Object.keys(facts.pages.ro)]);
  for (const a of all) if (a.status === "published") known.add(articlePath(a.locale, a.slug));
  return { facts, servicePath: (row.meta && row.meta.service_page) || null, knownPaths: known, existing: all };
}

const queueId = (row) => row.meta && row.meta.queue && row.meta.queue.id;

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
  if (!EDIT_KEY) return res.status(500).json({ error: "server not configured (EDIT_KEY)" });
  if (String(body.editKey || "").trim() !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  const db = supabase(SUPABASE_URL, SERVICE);
  const now = new Date();
  const setQueue = (row, patch) => (queueId(row)
    ? db(`content_queue?id=eq.${encodeURIComponent(queueId(row))}`, { method: "PATCH", body: JSON.stringify({ ...patch, updated_at: now.toISOString() }) }).catch(() => null)
    : null);

  try {
    const all = await db(`articles?${P}&select=id,group_id,locale,slug,title,status,meta,publish_at`);

    if (body.op === "list") {
      const rows = await db(`articles?${P}&status=in.(review,approved,rejected)&select=*&order=created_at.desc&limit=60`);
      const ids = [...new Set(rows.map(queueId).filter(Boolean))];
      const windows = ids.length ? await db(`content_queue?id=in.(${ids.map(encodeURIComponent).join(",")})&select=id,window_from,window_to`).catch(() => []) : [];
      const win = Object.fromEntries(windows.map((w) => [w.id, w]));
      // Предложенная дата: ближайший день без статьи этого языка, не раньше окна темы.
      const taken = all.filter((a) => a.status === "approved" || a.status === "published");
      const suggested = {};
      for (const r of rows.filter((x) => x.status === "review")) {
        // Дата, заложенная при посеве (publish_at у строки review), — если она ещё впереди и свободна.
        const own = r.publish_at && Date.parse(r.publish_at) > now.getTime() &&
          !taken.some((t) => t.locale === r.locale && String(t.publish_at || "").slice(0, 10) === String(r.publish_at).slice(0, 10));
        const w = win[queueId(r)];
        const from = w && w.window_from && Date.parse(w.window_from) > now.getTime() ? new Date(w.window_from + "T00:00:00Z") : now;
        suggested[r.id] = own ? r.publish_at : nextSlot(r.locale, taken, from);
        taken.push({ locale: r.locale, publish_at: suggested[r.id] });
      }
      return res.status(200).json({ ok: true, articles: rows, suggested, windows: win });
    }

    const id = String(body.id || "");
    const [row] = id ? await db(`articles?${P}&id=eq.${encodeURIComponent(id)}&select=*`) : [];
    if (!row) return res.status(404).json({ error: "статья не найдена" });

    if (body.op === "approve") {
      if (row.status !== "review") return res.status(409).json({ error: `статья уже не на проверке (${row.status})` });
      const checks = checkArticle(row, ctxFor(row, all));
      if (checks.errors.length) return res.status(422).json({ error: "Сначала поправьте статью: " + checks.errors.join("; "), checks });
      let at = body.publishAt ? new Date(body.publishAt) : null;
      if (at && isNaN(at.getTime())) return res.status(400).json({ error: "непонятная дата выхода" });
      if (at && at.getTime() < now.getTime() - 60e3) return res.status(400).json({ error: "дата выхода уже прошла" });
      const busy = all.filter((a) => a.id !== row.id && a.locale === row.locale && (a.status === "approved" || a.status === "published"));
      if (at && busy.some((a) => String(a.publish_at || "").slice(0, 10) === at.toISOString().slice(0, 10))) {
        return res.status(409).json({ error: `на ${at.toISOString().slice(0, 10)} уже стоит статья на этом языке — выберите другой день` });
      }
      if (!at) at = new Date(nextSlot(row.locale, busy, now));
      await db(`articles?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "approved", publish_at: at.toISOString(), review_note: null, updated_at: now.toISOString() }) });
      await setQueue(row, { status: "approved" });
      return res.status(200).json({ ok: true, status: "approved", publish_at: at.toISOString() });
    }

    if (body.op === "unapprove") {
      if (row.status !== "approved") return res.status(409).json({ error: `статья не в графике (${row.status})` });
      await db(`articles?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "review", publish_at: null, updated_at: now.toISOString() }) });
      await setQueue(row, { status: "review" });
      return res.status(200).json({ ok: true, status: "review" });
    }

    if (body.op === "reject") {
      if (row.status === "published") return res.status(409).json({ error: "статья уже на сайте — снимите её в списке блога" });
      const note = String(body.note || "").trim().slice(0, 2000);
      await db(`articles?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify({ status: "rejected", review_note: note || null, publish_at: null, updated_at: now.toISOString() }) });
      await setQueue(row, { status: "rejected", last_note: note || null });
      return res.status(200).json({ ok: true, status: "rejected" });
    }

    if (body.op === "save") {
      if (row.status === "published") return res.status(409).json({ error: "статья уже на сайте — правьте её как опубликованную" });
      const a = body.article || {};
      const s = (v, max) => (v == null ? undefined : String(v).slice(0, max));
      const meta = { ...(row.meta || {}) };
      for (const k of ["faq", "takeaways", "tags"]) if (Array.isArray(a.meta?.[k])) meta[k] = a.meta[k];
      for (const k of ["coverAlt", "author"]) if (a.meta?.[k] !== undefined) meta[k] = s(a.meta[k], 300);
      const next = {
        ...row,
        title: s(a.title, 300) ?? row.title, body: s(a.body, 200000) ?? row.body, excerpt: s(a.excerpt, 600) ?? row.excerpt,
        seo_title: s(a.seo_title, 200) ?? row.seo_title, seo_description: s(a.seo_description, 400) ?? row.seo_description,
        cover_url: s(a.cover_url, 1000) ?? row.cover_url,
        slug: a.slug ? (SLUG_RE.test(a.slug) ? a.slug : toSlug(a.slug)) : row.slug,
        meta,
      };
      const checks = checkArticle(next, ctxFor(next, all));
      next.meta = { ...meta, checks: { errors: checks.errors, warnings: checks.warnings, at: now.toISOString() } };
      const patch = { title: next.title, body: next.body, excerpt: next.excerpt, seo_title: next.seo_title, seo_description: next.seo_description,
        cover_url: next.cover_url, slug: next.slug, meta: next.meta, status: "review", updated_at: now.toISOString() };
      await db(`articles?id=eq.${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      await setQueue(row, { status: "review" });
      return res.status(200).json({ ok: true, status: "review", checks });
    }

    return res.status(400).json({ error: "unknown op" });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
