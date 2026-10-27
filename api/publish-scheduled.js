// Публикация одобренных статей по графику (Vercel serverless).
//   GET  Authorization: Bearer <CRON_SECRET> — раз в день по расписанию (vercel.json → crons), только при ARTICLE_CRON=1
//   POST { editKey }                         — то же вручную
//
// Берёт статьи со статусом approved и наступившей датой publish_at, не больше одной на язык в день,
// и публикует их тем же путём, что кнопка «Опубликовать» в кабинете (api/publish-article.js:
// проверка адреса, разметка Article/FAQPage, IndexNow, пересборка сайта). Статьи review и rejected
// здесь не трогаются никогда.

import publishArticle from "./publish-article.js";
import { PROJECT_ID, duePicks, supabase, authorName } from "../src/engine/blog/article-pipeline.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();

/** Строка базы → статья в том виде, в каком её шлёт кабинет. */
const toPayload = (r) => ({
  group: r.group_id, locale: r.locale, slug: r.slug, title: r.title, body: r.body, excerpt: r.excerpt,
  seoTitle: r.seo_title, seoDescription: r.seo_description, coverUrl: r.cover_url, image2Url: r.image2_url,
  coverAlt: r.meta && r.meta.coverAlt, author: authorName(r.meta) || undefined, meta: r.meta || {},
  autoTranslated: !!r.auto_translated, sourceLocale: r.source_locale, datePublished: r.publish_at,
});

async function viaPublishPath(articles) {
  const out = { code: 0, body: null };
  const res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, end() { return res; } };
  await publishArticle({ method: "POST", body: { editKey: EDIT_KEY, articles } }, res);
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!SUPABASE_URL || !SERVICE) return res.status(500).json({ error: "server not configured (SUPABASE_SERVICE_ROLE_KEY)" });

  const cron = Boolean(CRON_SECRET) && String(req.headers?.authorization || "") === `Bearer ${CRON_SECRET}`;
  if (cron) {
    // vercel.json общий для сайта и кабинета: расписание стоит в обоих проектах, работает в одном.
    if (process.env.ARTICLE_CRON !== "1") return res.status(200).json({ ok: true, skipped: "ARTICLE_CRON не включён в этом проекте" });
    if (!EDIT_KEY) return res.status(500).json({ error: "server not configured (EDIT_KEY)" });
  } else {
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
    let body;
    try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
    catch { return res.status(400).json({ error: "invalid JSON" }); }
    if (!EDIT_KEY) return res.status(500).json({ error: "server not configured (EDIT_KEY)" });
    if (String(body.editKey || "").trim() !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });
  }

  const db = supabase(SUPABASE_URL, SERVICE);
  try {
    const rows = await db(`articles?project_id=eq.${PROJECT_ID}&status=in.(approved,published)&select=*`);
    const picks = duePicks(rows, new Date());
    if (!picks.length) return res.status(200).json({ ok: true, published: 0 });

    const r = await viaPublishPath(picks.map(toPayload));
    if (r.code !== 200) return res.status(502).json({ error: "публикация не прошла: " + (r.body && r.body.error), ids: picks.map((p) => p.id) });

    for (const p of picks) {
      const q = p.meta && p.meta.queue && p.meta.queue.id;
      if (q) await db(`content_queue?id=eq.${encodeURIComponent(q)}`, { method: "PATCH", body: JSON.stringify({ status: "published", updated_at: new Date().toISOString() }) }).catch(() => {});
    }
    return res.status(200).json({ ok: true, published: picks.length, urls: r.body.urls, rebuild: r.body.rebuild });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e).slice(0, 300) });
  }
}
