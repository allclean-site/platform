// Translate + SEO/GEO/AEO for a blog article (Vercel serverless). Ported from cms-leadgenium.
//   POST { editKey, title, body, sourceLocale, targetLocale, brand?, city? }
//   → { source:{slug,excerpt,seo_title,seo_description,faq,takeaways,tags},
//       target:{title,body,slug,excerpt,seo_title,seo_description,faq,takeaways,tags} }
// Uses Claude via the REST API (no SDK dependency). Key ANTHROPIC_API_KEY stays server-side; the
// EDIT_KEY gate stops strangers from spending on the endpoint. CORS * (cabinet is a different origin).

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const EDIT_KEY = process.env.EDIT_KEY;

const LOCALE_NAMES = { ru: "Russian (русский)", ro: "Romanian (română, as spoken in Moldova)" };

const faqSchema = { type: "array", description: "2–4 real customer questions with concise, directly-quotable answers (AEO).", items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string", description: "Self-contained answer, 1–3 sentences." } }, required: ["question", "answer"], additionalProperties: false } };
const takeawaysSchema = { type: "array", description: "3–5 short factual key takeaways (one sentence each), citable by AI engines.", items: { type: "string" } };
const tagsSchema = { type: "array", description: "3–6 topical tags for this article.", items: { type: "string" } };

const TOOL = {
  name: "emit_article",
  description: "Return SEO/GEO/AEO metadata for the source article and a complete optimized translation into the target language.",
  input_schema: {
    type: "object",
    properties: {
      source_slug: { type: "string", description: "URL slug: lowercase ASCII, hyphen-separated, transliterated." },
      source_excerpt: { type: "string", description: "Lead/summary, 1–2 sentences, source language." },
      source_seo_title: { type: "string", description: "SEO <title>, ≤60 chars, includes the city." },
      source_seo_description: { type: "string", description: "Meta description, 120–160 chars, includes the city." },
      source_faq: faqSchema, source_takeaways: takeawaysSchema, source_tags: tagsSchema,
      target_title: { type: "string", description: "Title translated into the target language." },
      target_excerpt: { type: "string", description: "Lead/summary translated into the target language." },
      target_body: { type: "string", description: "Full body translated into the target language. Preserve the exact Markdown structure; translate only human-readable text." },
      target_slug: { type: "string", description: "URL slug for the target: lowercase ASCII, hyphen-separated, transliterated." },
      target_seo_title: { type: "string", description: "SEO <title> for the target, ≤60 chars, includes the city." },
      target_seo_description: { type: "string", description: "Meta description for the target, 120–160 chars, includes the city." },
      target_faq: faqSchema, target_takeaways: takeawaysSchema, target_tags: tagsSchema,
    },
    required: ["source_slug", "source_excerpt", "source_seo_title", "source_seo_description", "source_faq", "source_takeaways", "source_tags", "target_title", "target_excerpt", "target_body", "target_slug", "target_seo_title", "target_seo_description", "target_faq", "target_takeaways", "target_tags"],
    additionalProperties: false,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "invalid JSON" }); }
  if (EDIT_KEY && body.editKey !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  const { title, body: articleBody, sourceLocale, targetLocale } = body;
  const brand = body.brand || "All Clean";
  const city = body.city || "Chișinău";
  if (!title || !articleBody || !sourceLocale || !targetLocale) return res.status(400).json({ error: "missing title/body/sourceLocale/targetLocale" });

  const src = LOCALE_NAMES[sourceLocale] || sourceLocale;
  const tgt = LOCALE_NAMES[targetLocale] || targetLocale;

  const system = `You are a senior content editor and SEO/GEO/AEO specialist for "${brand}", a cleaning-services company in ${city}, Moldova. You optimize and translate blog articles between ${LOCALE_NAMES.ru} and ${LOCALE_NAMES.ro}.

Optimize for three layers:
- SEO: keyword-aware titles (≤60 chars), meta descriptions (120–160 chars), clean transliterated slugs; include the city naturally.
- GEO: entity-rich, factual, locally grounded (${city}); concise key takeaways an AI can cite verbatim.
- AEO: a FAQ of real customer questions with self-contained, directly-quotable answers.

Rules:
- Do NOT rewrite or restructure the author's body. For the SOURCE language, derive metadata/FAQ/takeaways from the body as written.
- For the TARGET language, translate naturally and idiomatically (never word-for-word) and preserve the exact Markdown structure — translate only human-readable text, never URLs/code.
- Keep the brand name "${brand}" unchanged. Write FAQ/takeaways in the matching language for each side.
- Always respond by calling the emit_article tool; output nothing else.`;

  const userMsg = `Source language: ${src}\nTarget language: ${tgt}\n\nArticle title:\n${title}\n\nArticle body (${src}):\n${articleBody}`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5", max_tokens: 12000, system,
        tools: [TOOL], tool_choice: { type: "tool", name: "emit_article" },
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!r.ok) return res.status(r.status).json({ error: "translation failed: " + (await r.text()).slice(0, 300) });
    const data = await r.json();
    const toolUse = (data.content || []).find((b) => b.type === "tool_use");
    if (!toolUse) return res.status(502).json({ error: "model did not return article data" });
    const o = toolUse.input;
    return res.status(200).json({
      source: { slug: o.source_slug, excerpt: o.source_excerpt, seo_title: o.source_seo_title, seo_description: o.source_seo_description, faq: o.source_faq, takeaways: o.source_takeaways, tags: o.source_tags },
      target: { title: o.target_title, excerpt: o.target_excerpt, body: o.target_body, slug: o.target_slug, seo_title: o.target_seo_title, seo_description: o.target_seo_description, faq: o.target_faq, takeaways: o.target_takeaways, tags: o.target_tags },
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "translation error" });
  }
}
