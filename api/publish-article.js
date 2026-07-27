// Publish a bilingual article to the client's Supabase `articles` table (Vercel serverless).
//   POST { editKey, articles:[{group,locale,slug,title,body,excerpt,seoTitle,seoDescription,
//                              coverUrl,image2Url,coverAlt,author,meta,autoTranslated,sourceLocale,datePublished}] }
// Writes with the service_role key (server only), then fires the Deploy Hook so build-site.mjs
// regenerates the blog pages from these rows. Gated by EDIT_KEY. CORS *.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEPLOY_HOOK = process.env.DEPLOY_HOOK;
const EDIT_KEY = process.env.EDIT_KEY;
const PROJECT_ID = "8878db57-c541-4502-bfa6-ae812dc3aefd"; // allclean project in the client Supabase

const SITE = "https://allclean.md";
const artUrl = (locale, slug) => (locale === "ro" ? `${SITE}/blog/${slug}` : `${SITE}/${locale}/blog/${slug}`);

function jsonLd(a) {
  const graph = [{
    "@type": "Article", headline: a.title, description: a.seoDescription || a.excerpt || "",
    inLanguage: a.locale, image: a.coverUrl || undefined, datePublished: a.datePublished, dateModified: new Date().toISOString(),
    author: { "@type": "Organization", name: a.author || "All Clean", url: SITE },
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
  if (EDIT_KEY && body.editKey !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  const arts = (body.articles || []).filter((a) => a && a.slug && a.title);
  if (!arts.length) return res.status(400).json({ error: "no articles with slug+title" });

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
    meta: a.meta || {},
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

  let rebuild = false;
  if (DEPLOY_HOOK) { await fetch(DEPLOY_HOOK, { method: "POST" }).catch(() => {}); rebuild = true; }
  return res.status(200).json({ ok: true, published: rows.length, urls: rows.map((x) => artUrl(x.locale, x.slug)), rebuild });
}
