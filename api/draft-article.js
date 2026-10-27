// Черновик статьи из очереди тем (Vercel serverless).
//   POST { editKey, queueId?, dryRun? }      — вручную из кабинета или консоли
//   GET  Authorization: Bearer <CRON_SECRET> — по расписанию (vercel.json → crons), только при ARTICLE_CRON=1
//
// Берёт следующую тему из content_queue (или заданную), собирает бриф из паспорта фактов
// (data/allclean-facts.json), пишет статью на языке темы (не переводом), проверяет её
// (src/engine/blog/article-pipeline.js → checkArticle) и сохраняет в articles со статусом review.
// Сайт такие строки не публикует: на сайт статья уходит только после «Одобрить» в кабинете.
// Новый черновик — сообщение в Telegram тем же ботом, что и заявки.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EDIT_KEY, ANTHROPIC_API_KEY, ARTICLE_MODEL (по умолчанию
// claude-opus-5-5), ARTICLE_CRON=1 и CRON_SECRET (расписание), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CABINET_URL.

import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import facts from "../data/allclean-facts.json" with { type: "json" };
import {
  PROJECT_ID, SITE, COST_HEADING, articlePath, checkArticle, supabase, toSlug, SLUG_RE,
} from "../src/engine/blog/article-pipeline.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const MODEL = (process.env.ARTICLE_MODEL || "claude-opus-5-5").trim();
const MAX_ATTEMPTS = 3;

// Вопросы из блока «Похожие вопросы» Google (SEO_GROWTH_PLAN.md, раздел 1) по услуге.
const PAA = {
  "deep-cleaning": ["Сколько примерно стоит генеральная уборка квартиры?", "Что входит в генеральную уборку?", "Что входит в стоимость генеральной уборки?", "Сколько стоит клининг за 1 кв. м?"],
  "post-construction": ["Какова стоимость уборки после ремонта?", "Что входит в уборку квартиры после ремонта?", "Как называется уборка после ремонта?"],
  upholstery: ["Сколько стоит химчистка диванов?", "Сколько нельзя пользоваться диваном после химчистки?", "Что входит в химчистку дивана?", "Сколько будет стоить химчистка матраса?", "Сколько должен сохнуть матрас после химчистки?"],
  windows: ["Сколько стоит помыть окна в Кишиневе?", "Сколько стоит час уборки в Кишиневе?"],
  facades: ["Какова цена мойки фасада?", "Что такое мойка фасадов?"],
  pricing: ["Сколько стоит клининг в Кишиневе?", "Сколько стоит клининг за 1 кв. м?", "Сколько стоит час уборки в Кишиневе?"],
};

const LANG = {
  ru: "русском",
  ro: "румынском (как пишут в Молдове: ș и ț с запятой снизу, ă â î, без русизмов)",
};

const SYSTEM = `Ты пишешь статьи для блога All Clean — клининговой компании в Кишинёве (allclean.md). Читатель собирается заказать уборку и ищет ответ на конкретный вопрос. Статью проверит владелец компании, потом она выйдет на сайте и должна годиться для цитаты в ответе Google и Perplexity.

Факты
- Все цены, сроки, часы, гарантии и условия берёшь только из паспорта фактов в брифе. Каждое число в тексте (включая FAQ, title и description) должно дословно встречаться в паспорте вне todo_owner, banned_claims, photos и pages.
- Чего нет в паспорте, того не утверждаешь. Пункты TODO_owner — это пробелы: обходи их без цифр («точную сумму назовёт менеджер после осмотра»). Не придумывай примеры заказов, площади квартир, расчёты, проценты скидок, число людей в бригаде, даты, годы.
- Запрещено: «лучший», «№1», «24/7», «лицензия», «1200+», «cel mai bun», «nr. 1», «licență», любые превосходные оценки компании, упоминания ИИ, нейросетей, моделей и того, как написан текст.

Структура (Markdown, только эти элементы: ## и ### заголовки, абзацы, списки «- » и «1. », таблицы с «|», **жирный**, ссылки [текст](/путь))
1. Без заголовка в начале. Первый абзац — прямой ответ на вопрос статьи, 40–60 слов, с ценой «от» и единицей из паспорта, если она есть для этой услуги.
2. Таблица (строка заголовка, строка «|---|---|», строки данных) — сравнение, состав работ или цены.
3. Пошаговый нумерованный список «1. …» — как подготовиться, как проходит работа или порядок действий.
4. Раздел «## {COST}»: цена из паспорта, от чего она зависит, ровно одна ссылка на страницу услуги (адрес дан в брифе) с обычным текстом ссылки, например «генеральная уборка». Больше нигде на эту услугу не ссылайся.
5. Ещё не меньше двух ссылок на другие статьи блога или страницу цен — только из списка в брифе, на языке статьи.
6. Никакого H1 («# »), картинок, HTML, эмодзи. Объём 600–1000 слов.

FAQ: 3–5 вопросов так, как их задают в поиске (русские вопросы из выдачи даны в брифе; для румынской статьи сформулируй естественные румынские). Ответ начинается с прямого ответа, 1–3 предложения, только факты из паспорта. Вопросы FAQ не повторяют подзаголовки тела дословно.

Стиль
- Пиши сам смысл: «Окна снаружи моют от 45 лей за м²», а не «в этом разделе расскажем о цене».
- Без вступлений и выводов ради объёма, без «в этой статье», «давайте разберёмся», «по сути», «фактически», «проще говоря», «важно отметить», без конструкции «не X, а Y», без перечислений тройками ради ритма, без одинаковых зачинов абзацев, без длинных тире там, где хватает запятой. Без разговорных вставок. Нейтрально и конкретно.
- Пиши на {LANG} языке сразу, как носитель. Это не перевод с другого языка.

Метаданные
- title (это H1): вопрос со знаком «?» в конце, до 90 знаков, естественный для поиска.
- seo_title: до 60 знаков вместе с пробелами, с городом (Кишинёв / Chișinău), если помещается.
- seo_description: 120–160 знаков, с ценой «от», если она есть.
- slug: латиница, транслит, слова через дефис, до 60 знаков.
- excerpt: 1–2 предложения для карточки блога.
- takeaways: 3–4 коротких тезиса для блока «Коротко», только факты.
- tags: 2–4 метки.
- sources: адреса страниц allclean.md из паспорта, на которых стоят использованные факты.`;

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" }, slug: { type: "string" }, seo_title: { type: "string" }, seo_description: { type: "string" },
    excerpt: { type: "string" }, body: { type: "string" },
    faq: { type: "array", items: { type: "object", properties: { question: { type: "string" }, answer: { type: "string" } }, required: ["question", "answer"], additionalProperties: false } },
    takeaways: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["title", "slug", "seo_title", "seo_description", "excerpt", "body", "faq", "takeaways", "tags", "sources"],
  additionalProperties: false,
};

const isCron = (req) => Boolean(CRON_SECRET) && String(req.headers?.authorization || "") === `Bearer ${CRON_SECRET}`;

async function notify(text) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim(), chat = (process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    return r.ok;
  } catch { return false; }
}

/** Бриф одной темы: что писать, на что ссылаться, какие факты можно. */
export function buildBrief(item, arts) {
  const loc = item.locale;
  const pages = facts.pages[loc];
  const svc = String(item.service_page || "").split("/").pop();
  const linkable = arts.filter((a) => a.status === "published" && a.locale === loc)
    .map((a) => ({ path: articlePath(a.locale, a.slug), title: a.title }));
  return {
    today: new Date().toISOString().slice(0, 10),
    language: loc,
    topic: { id: item.id, query: item.query, working_title: item.title_hint, question: item.question, cluster: item.cluster, intent: item.intent },
    service_page: { path: item.service_page, title: pages[item.service_page] || "" },
    cost_heading: COST_HEADING[loc],
    links_allowed: { articles: linkable, pricing: loc === "ro" ? "/pricing" : "/ru/pricing", pages },
    people_also_ask_ru: PAA[svc] || PAA.pricing,
    owner_note: item.last_note || null,
    facts,
  };
}

/** Ответ модели → строка articles (без статуса). */
export function articleFromDraft(out, item, group) {
  const loc = item.locale;
  const svc = String(item.service_page || "").split("/").pop();
  const photo = facts.photos.find((p) => p.services.includes(svc)) || facts.photos[0];
  const sources = (out.sources || []).filter((u) => String(u).startsWith(SITE));
  return {
    project_id: PROJECT_ID, group_id: group, locale: loc,
    slug: SLUG_RE.test(out.slug || "") ? out.slug : toSlug(out.slug || out.title),
    title: String(out.title || "").trim(), excerpt: out.excerpt || null, body: out.body || "",
    cover_url: SITE + photo.url, seo_title: out.seo_title || null, seo_description: out.seo_description || null,
    auto_translated: false, source_locale: loc,
    meta: {
      faq: out.faq || [], takeaways: out.takeaways || [], tags: out.tags || [], coverAlt: photo[loc] || "",
      sources, service_page: item.service_page,
      queue: { id: item.id, query: item.query, question: item.question, service_page: item.service_page },
    },
  };
}

export function knownPaths(arts) {
  const set = new Set([...Object.keys(facts.pages.ru), ...Object.keys(facts.pages.ro)]);
  for (const a of arts) if (a.status === "published") set.add(articlePath(a.locale, a.slug));
  return set;
}

async function draftWithModel(brief, item, group, arts) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = SYSTEM.replace("{COST}", COST_HEADING[item.locale]).replace("{LANG}", LANG[item.locale]);
  const messages = [{ role: "user", content: "Бриф статьи (JSON):\n" + JSON.stringify(brief) }];
  const ctx = { facts, servicePath: item.service_page, knownPaths: knownPaths(arts), existing: arts };
  let art = null, checks = null, usage = { input: 0, output: 0 };
  for (let round = 0; round < 2; round++) {
    const stream = client.beta.messages.stream({
      model: MODEL, max_tokens: 32000, system, messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    });
    const msg = await stream.finalMessage();
    usage.input += msg.usage?.input_tokens || 0; usage.output += msg.usage?.output_tokens || 0;
    if (msg.stop_reason === "refusal") throw new Error("модель отказалась писать эту тему");
    if (msg.stop_reason === "max_tokens") throw new Error("ответ модели оборвался (max_tokens)");
    const text = (msg.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let out;
    try { out = JSON.parse(text); } catch { throw new Error("модель вернула не JSON"); }
    art = articleFromDraft(out, item, group);
    checks = checkArticle(art, ctx);
    if (!checks.errors.length) break;
    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: "Проверка нашла ошибки:\n- " + checks.errors.join("\n- ") +
      "\nИсправь их и верни статью целиком в том же формате. Числа — только из паспорта фактов." });
  }
  return { art, checks, usage };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!SUPABASE_URL || !SERVICE) return res.status(500).json({ error: "server not configured (SUPABASE_SERVICE_ROLE_KEY)" });

  let body = {};
  const cron = isCron(req);
  if (cron) {
    // vercel.json общий для сайта и кабинета: расписание стоит в обоих проектах, работает в одном.
    if (process.env.ARTICLE_CRON !== "1") return res.status(200).json({ ok: true, skipped: "ARTICLE_CRON не включён в этом проекте" });
  } else {
    if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
    try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
    catch { return res.status(400).json({ error: "invalid JSON" }); }
    if (!EDIT_KEY) return res.status(500).json({ error: "server not configured (EDIT_KEY)" });
    if (String(body.editKey || "").trim() !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });

  const db = supabase(SUPABASE_URL, SERVICE);
  const P = `project_id=eq.${PROJECT_ID}`;
  let item;
  try {
    if (body.queueId) {
      [item] = await db(`content_queue?${P}&id=eq.${encodeURIComponent(body.queueId)}&status=in.(queued,rejected,refresh)&limit=1`);
      if (!item) return res.status(404).json({ error: `тема ${body.queueId} не найдена или уже в работе` });
    } else {
      // Сезонные темы раньше срока не пишем: окно начинается не позже чем через две недели.
      const horizon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      [item] = await db(`content_queue?${P}&status=eq.queued&attempts=lt.${MAX_ATTEMPTS}` +
        `&or=(window_from.is.null,window_from.lte.${horizon})&order=priority.asc,window_from.asc.nullslast,id.asc&limit=1`);
      if (!item) return res.status(200).json({ ok: true, idle: true, message: "Очередь пуста: свободных тем нет." });
    }
    // Тему забираем атомарно: два запуска подряд не напишут её дважды.
    const claimed = await db(`content_queue?id=eq.${encodeURIComponent(item.id)}&status=eq.${item.status}`, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "draft", attempts: (item.attempts || 0) + 1, updated_at: new Date().toISOString() }),
    });
    if (!claimed.length) return res.status(409).json({ error: `тему ${item.id} уже взял другой запуск` });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }

  try {
    const arts = await db(`articles?${P}&select=id,group_id,locale,slug,title,status,meta,publish_at`);
    // Пара на другом языке уже написана — та же группа, чтобы сайт связал версии через hreflang.
    let group = item.article_group_id || null;
    if (!group && item.pair_id) {
      const [pair] = await db(`content_queue?id=eq.${encodeURIComponent(item.pair_id)}&select=article_group_id`);
      const g = pair && pair.article_group_id;
      if (g && !arts.some((a) => a.group_id === g && a.locale === item.locale)) group = g;
    }
    group = group || randomUUID();

    const { art, checks, usage } = await draftWithModel(buildBrief(item, arts), item, group, arts);
    art.meta.checks = { errors: checks.errors, warnings: checks.warnings, at: new Date().toISOString() };
    art.meta.model = { name: MODEL, input_tokens: usage.input, output_tokens: usage.output };
    if (body.dryRun) {
      await db(`content_queue?id=eq.${encodeURIComponent(item.id)}`, { method: "PATCH", body: JSON.stringify({ status: item.status, updated_at: new Date().toISOString() }) });
      return res.status(200).json({ ok: true, dryRun: true, article: art, checks });
    }

    const [row] = await db(`articles?on_conflict=group_id,locale`, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ ...art, status: "review", review_note: null, publish_at: null, updated_at: new Date().toISOString() }]),
    });
    await db(`content_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "review", article_group_id: group, article_id: row && row.id, last_error: checks.errors.join("; ") || null, updated_at: new Date().toISOString() }),
    });
    const cab = (process.env.CABINET_URL || "").replace(/\/$/, "");
    const told = await notify(`Статья ждёт проверки (${item.locale.toUpperCase()}): ${art.title}\nТема ${item.id}: ${item.query}` +
      (checks.errors.length ? `\nЕсть замечания проверки: ${checks.errors.length}` : "") + (cab ? `\n${cab}/#/app/blog` : ""));
    return res.status(200).json({ ok: true, id: row && row.id, group, locale: item.locale, title: art.title, checks, notified: told });
  } catch (e) {
    await db(`content_queue?id=eq.${encodeURIComponent(item.id)}`, {
      method: "PATCH", body: JSON.stringify({ status: item.status, last_error: String(e.message || e).slice(0, 500), updated_at: new Date().toISOString() }),
    }).catch(() => {});
    return res.status(502).json({ error: "черновик не получился: " + String(e.message || e) });
  }
}
