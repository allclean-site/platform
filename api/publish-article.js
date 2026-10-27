// Publish a bilingual article to the client's Supabase `articles` table (Vercel serverless).
//   POST { editKey, articles:[{group,locale,slug,title,body,excerpt,seoTitle,seoDescription,
//                              coverUrl,image2Url,coverAlt,author,meta,autoTranslated,sourceLocale,datePublished}] }
// Writes with the service_role key (server only), then fires the Deploy Hook so build-site.mjs
// regenerates the blog pages from these rows. Gated by EDIT_KEY. CORS *.

import { authorNode } from "../src/engine/blog/article-pipeline.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOY_HOOK = process.env.DEPLOY_HOOK;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();
const PROJECT_ID = "8878db57-c541-4502-bfa6-ae812dc3aefd"; // allclean project in the client Supabase

const SITE = "https://allclean.md";
const INDEXNOW_KEY = "5a7bbce9d63a74005f4e33ec5e31389a"; // key file served at /<key>.txt (public/site-assets)
const artUrl = (locale, slug) => (locale === "ro" ? `${SITE}/blog/${slug}` : `${SITE}/${locale}/blog/${slug}`);

/** Ping IndexNow so Bing/Yandex re-crawl the new/updated article URLs immediately. */
export async function pingIndexNow(urls) {
  if (!urls.length) return;
  try {
    await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ host: "allclean.md", key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: urls }),
    });
  } catch { /* best-effort */ }
}

export function jsonLd(a) {
  const graph = [{
    "@type": "Article", headline: a.title, description: a.seoDescription || a.excerpt || "",
    inLanguage: a.locale, image: a.coverUrl || undefined, datePublished: a.datePublished, dateModified: new Date().toISOString(),
    // Человек, если в подписи имя; «Echipa All Clean» и пустая подпись — компания.
    author: authorNode({ ...(a.meta || {}), author: a.author || (a.meta && a.meta.author) }),
    publisher: { "@type": "Organization", name: "All Clean", url: SITE },
    mainEntityOfPage: { "@type": "WebPage", "@id": artUrl(a.locale, a.slug) },
  }];
  const faq = a.meta && a.meta.faq;
  if (Array.isArray(faq) && faq.length) graph.push({ "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) });
  return { "@context": "https://schema.org", "@graph": graph };
}

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
  // Незаданный EDIT_KEY означал ОТКРЫТУЮ дверь: проверка стояла под условием «если ключ настроен»,
  // и стоило переменной пропасть при переносе проекта, как этот обработчик начинал отдавать данные
  // кому угодно — service_role-ключом. Теперь без ключа он не работает вовсе.
  if (!EDIT_KEY) return res.status(500).json({ error: "server not configured (EDIT_KEY)" });
  if (String(body.editKey || "").trim() !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  // Чтение опубликованных статей. Нужно кабинету: список блога на сайте содержит карточки
  // статей из базы, и без этого списка холст редактора показывал на одну статью меньше живого.
  // Отдаём только поля карточки — тело статьи здесь никому не нужно.
  if (body.op === "list") {
    const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/articles` +
      `?select=group_id,locale,slug,title,cover_url,created_at,publish_at,meta&project_id=eq.${PROJECT_ID}&status=eq.published`;
    try {
      const r = await fetch(url, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
      if (!r.ok) return res.status(502).json({ error: "read failed: " + (await r.text()) });
      return res.status(200).json({ ok: true, articles: await r.json() });
    } catch (e) {
      return res.status(502).json({ error: "read failed: " + String(e) });
    }
  }

  // Снять статью с сайта (обе языковые версии). Удаление в кабинете раньше стирало её только из
  // браузера: страница оставалась на сайте, а убрать её из кабинета было уже нечем.
  if (body.op === "unpublish") {
    if (!body.group) return res.status(400).json({ error: "group required" });
    const r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/articles?project_id=eq.${PROJECT_ID}&group_id=eq.${encodeURIComponent(body.group)}`, {
      method: "PATCH",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ status: "draft", updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(502).json({ error: "unpublish failed: " + (await r.text()).slice(0, 200) });
    let rebuild = false;
    if (DEPLOY_HOOK) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
    return res.status(200).json({ ok: true, rebuild });
  }

  const arts = (body.articles || []).filter((a) => a && a.slug && a.title);
  if (!arts.length) return res.status(400).json({ error: "Нет статьи с заголовком и адресом (slug)." });

  // Адрес статьи становится путём файла в сборке (out/blog/<slug>/index.html) и адресом на сайте.
  // Кабинет его транслитерирует, но граница доверия здесь: пробел, кириллица или «../» в адресе
  // ломали canonical и карту сайта или выводили файл сборки за её пределы.
  const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const bad = arts.find((a) => !SLUG.test(String(a.slug)) || String(a.slug).length > 100 || !["ro", "ru"].includes(a.locale));
  if (bad) return res.status(400).json({ error: `Недопустимый адрес статьи «${String(bad.slug).slice(0, 80)}»: только латиница, цифры и дефис.` });
  // Один адрес — одна статья. Две статьи с одним адресом сборка не различает: вторая молча не
  // выходила на сайт, а кабинет показывал «Опубликовано».
  for (const a of arts) {
    const q = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/articles?select=group_id&project_id=eq.${PROJECT_ID}` +
      `&locale=eq.${encodeURIComponent(a.locale)}&slug=eq.${encodeURIComponent(a.slug)}&group_id=neq.${encodeURIComponent(a.group)}`;
    const r = await fetch(q, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    if (!r.ok) return res.status(502).json({ error: "read failed: " + (await r.text()).slice(0, 200) });
    if ((await r.json()).length) return res.status(409).json({ error: `Адрес «${a.slug}» уже занят другой статьёй — измените URL (slug) во вкладке SEO.` });
  }

  const rows = arts.map((a) => ({
    project_id: PROJECT_ID,
    group_id: a.group,
    locale: a.locale,
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt || null,
    body: a.body || null,
    cover_url: a.coverUrl || null,
    image2_url: a.image2Url || null,
    seo_title: a.seoTitle || null,
    seo_description: a.seoDescription || null,
    // Alt обложки — в meta: отдельного столбца нет, и подпись, набранная клиентом, терялась
    // (на сайте alt = заголовок).
    // Автор — туда же: на сайте он стоит рядом с датой, как в превью кабинета.
    meta: { ...(a.meta || {}), ...(a.coverAlt ? { coverAlt: String(a.coverAlt).slice(0, 300) } : {}),
      ...(a.author ? { author: String(a.author).slice(0, 120) } : {}) },
    jsonld: jsonLd(a),
    status: "published",
    auto_translated: !!a.autoTranslated,
    source_locale: a.sourceLocale || null,
    updated_at: new Date().toISOString(),
  }));

  const r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/articles?on_conflict=group_id,locale`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) return res.status(502).json({ error: "save failed: " + (await r.text()).slice(0, 300) });

  const urls = rows.map((x) => artUrl(x.locale, x.slug));
  await pingIndexNow(urls);

  let rebuild = false;
  if (DEPLOY_HOOK) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
  return res.status(200).json({ ok: true, published: rows.length, urls, rebuild });
}
