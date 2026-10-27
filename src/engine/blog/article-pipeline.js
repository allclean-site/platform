/**
 * Конвейер статей: очередь тем, проверка черновика, автор в разметке, слоты публикации.
 *
 * Общий модуль для api/_draft-article.js, api/_articles-review.js, api/_publish-scheduled.js,
 * api/publish-article.js, сборки сайта и самопроверок. Чистый JS без зависимостей.
 */

export const SITE = "https://allclean.md";
export const PROJECT_ID = "8878db57-c541-4502-bfa6-ae812dc3aefd";
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---- очередь тем из content-plan.csv ------------------------------------------------------------

/** CSV с кавычками и переводами строк внутри полей → массив объектов по заголовку. */
export function parseCsv(text) {
  const t = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f.replace(/\r$/, "")); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || "").trim()])));
}

/** Неделя 1 плана (SEO_GROWTH_PLAN.md, раздел 8: «старт 02.11.2026»). */
export const PLAN_START = "2026-11-02";

/** Темы одного вопроса на двух языках: одна пара hreflang (общий group_id). Пишутся отдельно. */
export const PAIRS = {
  R01: "O01", R02: "O04", R03: "O08", R04: "O03", R08: "O12", R11: "O13", R12: "O17", R14: "O05",
  R15: "O02", R17: "O09", R18: "O29", R20: "O07", R21: "O23", R23: "O21", R27: "O25",
};
const PAIR_OF = { ...PAIRS, ...Object.fromEntries(Object.entries(PAIRS).map(([a, b]) => [b, a])) };

const day = (iso, plus = 0) => new Date(Date.parse(iso + "T00:00:00Z") + plus * 864e5).toISOString().slice(0, 10);
const dmy = (s) => { const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

/** «нед. 1, до 15.11.2026» → окно публикации. «до DATE» без недели — за 6 недель до даты. */
export function planWindow(label) {
  const week = /нед\.\s*(\d+)/.exec(label || "");
  const until = dmy(label || "");
  let from = week ? day(PLAN_START, (Number(week[1]) - 1) * 7) : null;
  let to = week ? day(PLAN_START, (Number(week[1]) - 1) * 7 + 6) : null;
  if (until) { to = until; if (!from) from = day(until, -42); }
  return { from, to };
}

export const pathOf = (url) => String(url || "").replace(/^https?:\/\/(www\.)?allclean\.md/, "").replace(/\/$/, "") || "/";

/** Строка плана → строка content_queue (без status: повторный посев не сбрасывает прогресс). */
export function queueRowFromPlan(r, projectId = PROJECT_ID) {
  const w = planWindow(r.publish_window);
  return {
    id: r.id, project_id: projectId, locale: r.lang, priority: r.priority || "P2",
    cluster: r.cluster || null, intent: r.intent || null, query: r.target_query, title_hint: r.title || null,
    service_page: r.service_page ? pathOf(r.service_page) : null, question: r.aeo_question || null,
    facts_needed: r.facts_from_owner || null, window_label: r.publish_window || null,
    window_from: w.from, window_to: w.to, pair_id: PAIR_OF[r.id] || null,
  };
}

// ---- паспорт фактов -----------------------------------------------------------------------------

/** Числа текста: время «8:00» целиком, остальное по отдельности; «4,7» = «4.7». Без адресов и телефонов. */
export function numbersIn(text) {
  const s = String(text || "")
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, (m) => m.replace(/\]\([^)]*\)$/, "]"))  // [текст](адрес) → текст
    .replace(/https?:\/\/\S+|\/[a-z0-9/_.-]+\.(webp|jpe?g|png|svg)/gi, " ")
    .replace(/\+?373[\s\d]{8,12}|0\d{2}\s?\d{2}\s?\d{3}/g, " ")              // телефон
    .replace(/^\s*\d+\.\s/gm, " ");                                           // номер пункта списка
  const out = [];
  for (const m of s.matchAll(/\d{1,2}:\d{2}|\d+(?:[.,]\d+)?/g)) out.push(m[0].replace(",", "."));
  return out;
}

/** Все числа паспорта (без адресов источников и пунктов TODO_owner). */
export function factNumbers(facts) {
  const set = new Set();
  const walk = (v, key) => {
    if (v == null || /^(source|sources|url|todo_owner|banned_claims|photos|photos_note|pages|about|checked|legal)$/i.test(key || "")) return;
    if (typeof v === "string") { if (!v.includes("TODO_owner")) numbersIn(v).forEach((n) => set.add(n)); return; }
    if (typeof v === "number") { set.add(String(v)); return; }
    if (Array.isArray(v)) { v.forEach((x) => walk(x, key)); return; }
    if (typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(facts, "");
  return set;
}

// ---- проверка черновика -------------------------------------------------------------------------

export const BANNED = [
  [/лучш(ий|ая|ее|ие|его|ей|ему|им|их|ую|ими|ем)(?![а-яё])/i, "«лучший»"], [/№\s*1(?!\d)/, "«№1»"], [/24\s*\/\s*7/, "«24/7»"], [/лицензи/i, "«лицензия»"],
  [/1\s?200\s*\+/, "«1200+»"], [/\bcel(e|ui)?\s+mai\s+bun/i, "«cel mai bun»"], [/\bnr\.?\s*1(?!\d)/i, "«nr. 1»"],
  [/licen[țţt][aăe]/i, "«licență»"],
];
const AI = /claude|anthropic|chatgpt|openai|\bgpt\b|нейросет|искусственн\w*\s+интеллект|inteligen[țţ][aă]\s+artificial|\bAI\b|(^|[^а-яёa-z])ИИ([^а-яёa-z]|$)/i;

export const COST_HEADING = { ru: "Сколько это стоит у нас", ro: "Cât costă la noi" };

const links = (md) => [...String(md || "").matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => m[2]);
const internal = (href) => (/^\//.test(href) || /^https?:\/\/(www\.)?allclean\.md/.test(href)) ? pathOf(href.split("#")[0]) : null;
const normTitle = (s) => String(s || "").toLowerCase().replace(/[^a-zа-яёăâîșşțţ0-9]+/gi, " ").trim();
const words = (s) => String(s || "").replace(/\*\*|\*|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").split(/\s+/).filter((w) => /[\p{L}\d]/u.test(w));

export const articlePath = (locale, slug) => (locale === "ro" ? `/blog/${slug}` : `/${locale}/blog/${slug}`);

/**
 * Проверка черновика перед показом владельцу и перед одобрением.
 *   a   — { locale, title, slug, seo_title, seo_description, excerpt, body, meta:{faq} , group_id }
 *   ctx — { facts, servicePath, knownPaths:Set<string>, existing:[{group_id,locale,slug,title,status,meta}] }
 * → { errors:[], warnings:[] }. Ошибки блокируют одобрение.
 */
export function checkArticle(a, ctx) {
  const errors = [], warnings = [];
  const loc = a.locale === "ro" ? "ro" : "ru";
  const body = String(a.body || "");
  const seoTitle = a.seo_title || a.title || "";
  const desc = a.seo_description || "";
  const faq = (a.meta && a.meta.faq) || [];

  if (!SLUG_RE.test(a.slug || "") || String(a.slug).length > 100) errors.push(`адрес «${a.slug}»: только латиница, цифры и дефис`);
  if (seoTitle.length > 60) errors.push(`title ${seoTitle.length} знаков (нужно до 60)`);
  if (desc.length < 120 || desc.length > 160) errors.push(`description ${desc.length} знаков (нужно 120–160)`);
  if (!/\?\s*$/.test(a.title || "")) errors.push("заголовок H1 должен быть вопросом");
  if (/^#\s/m.test(body)) errors.push("в тексте второй H1 («# …»)");

  // Ответ первым абзацем: первый блок текста до первого заголовка, списка или таблицы.
  const first = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|>|\||[-*]\s|\d+\.\s|!\[)/.test(p)) || "";
  const n = words(first).length;
  if (n < 40 || n > 60) errors.push(`первый абзац ${n} слов (нужно 40–60)`);
  if (!/^\|.+\|\s*$/m.test(body)) errors.push("нет таблицы");
  if (!/^\d+\.\s/m.test(body)) errors.push("нет пошагового списка");
  const costAt = body.search(new RegExp(`^##\\s+${COST_HEADING[loc]}`, "m"));
  if (costAt < 0) errors.push(`нет раздела «${COST_HEADING[loc]}»`);

  // Ссылки: ровно одна на свою услугу, не меньше двух на статьи или цены, все — на существующие страницы.
  const hrefs = links(body).concat(faq.flatMap((f) => links(f.answer)));
  const own = ctx.servicePath ? hrefs.filter((h) => internal(h) === ctx.servicePath).length : 0;
  if (ctx.servicePath && own !== 1) errors.push(`ссылок на свою услугу ${ctx.servicePath}: ${own} (нужна ровно одна)`);
  if (ctx.servicePath && costAt >= 0) {
    const tail = body.slice(costAt).split(/\n##\s/)[0];
    if (!links(tail).some((h) => internal(h) === ctx.servicePath)) warnings.push("ссылка на услугу стоит не в разделе о цене");
  }
  const self = articlePath(loc, a.slug);
  const related = hrefs.map(internal).filter((p) => p && p !== self && (/^(\/ru)?\/blog\/[a-z0-9-]+$/.test(p) || /^(\/ru)?\/pricing$/.test(p)));
  if (new Set(related).size < 2) errors.push(`ссылок на другие статьи и цены: ${new Set(related).size} (нужно не меньше двух)`);
  for (const h of hrefs) {
    const p = internal(h);
    if (p === null) { if (!/^(https:\/\/|mailto:|tel:)/.test(h)) errors.push(`ссылка «${h}»: только свои страницы, https, tel, mailto`); continue; }
    if (ctx.knownPaths && !ctx.knownPaths.has(p)) errors.push(`ссылка на несуществующую страницу ${p}`);
    if (loc === "ru" && p !== "/" && !p.startsWith("/ru")) warnings.push(`русская статья ссылается на румынскую страницу ${p}`);
    if (loc === "ro" && p.startsWith("/ru")) warnings.push(`румынская статья ссылается на русскую страницу ${p}`);
  }

  // Цифры — только из паспорта фактов.
  const text = [a.title, seoTitle, desc, a.excerpt, body, ...faq.flatMap((f) => [f.question, f.answer]),
    ...((a.meta && a.meta.takeaways) || [])].join("\n");
  if (ctx.facts) {
    const allowed = factNumbers(ctx.facts);
    const extra = [...new Set(numbersIn(text).filter((x) => !allowed.has(x)))];
    if (extra.length) errors.push(`числа не из паспорта фактов: ${extra.join(", ")}`);
  }
  for (const [re, name] of BANNED) if (re.test(text)) errors.push(`запрещённое слово ${name}`);
  if (AI.test(text)) errors.push("упоминание ИИ или модели в тексте");
  if (faq.length < 3 || faq.length > 5) errors.push(`вопросов в FAQ ${faq.length} (нужно 3–5)`);
  if (faq.some((f) => !String(f.question || "").trim() || !String(f.answer || "").trim())) errors.push("пустой вопрос или ответ в FAQ");
  if (!String(a.excerpt || "").trim()) warnings.push("нет краткого описания (excerpt)");

  // Повтор темы: чужая статья с тем же адресом, заголовком или темой очереди.
  const qid = a.meta && a.meta.queue && a.meta.queue.id;
  for (const o of ctx.existing || []) {
    if (o.group_id === a.group_id && o.locale === a.locale) continue;
    if (o.status === "rejected") continue;
    if (o.locale === a.locale && o.slug === a.slug) errors.push(`адрес «${a.slug}» уже занят`);
    if (o.locale === a.locale && normTitle(o.title) === normTitle(a.title)) errors.push(`статья с таким же заголовком уже есть: «${o.title}»`);
    if (qid && o.meta && o.meta.queue && o.meta.queue.id === qid && o.group_id !== a.group_id) errors.push(`тема ${qid} уже написана`);
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
};
/** Адрес статьи: транслит, латиница, цифры, дефис (как src/engine/blog/slug.ts в кабинете). */
export const toSlug = (s) => String(s || "").toLowerCase().split("").map((c) => TRANSLIT[c] ?? c).join("")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "");

// ---- разметка: автор ----------------------------------------------------------------------------

/** Автор статьи для Article: человек, если в meta.author имя, иначе компания. */
export function authorNode(meta) {
  const raw = meta && meta.author;
  const name = typeof raw === "object" && raw ? raw.name : raw;
  // «Echipa All Clean» и «Команда All Clean» — подпись компании, а не человека.
  if (!name || /all\s*clean|echipa|команда|team/i.test(String(name))) {
    return { "@type": "Organization", "@id": `${SITE}/#org`, name: "All Clean", url: SITE };
  }
  const p = typeof raw === "object" && raw ? raw : {};
  const job = p.jobTitle || (meta && meta.authorJobTitle);
  const url = p.url || (meta && meta.authorUrl);
  return { "@type": "Person", name: String(name).slice(0, 120), ...(job ? { jobTitle: String(job) } : {}),
    ...(url && /^https:\/\//.test(url) ? { url } : {}), worksFor: { "@id": `${SITE}/#org` } };
}

/** Разметка статьи из базы с автором по meta: старые строки несут Organization даже при имени в подписи. */
export function withAuthor(jsonld, meta) {
  if (!jsonld || typeof jsonld !== "object") return jsonld;
  const fix = (n) => (n && n["@type"] === "Article" ? { ...n, author: authorNode(meta) } : n);
  return jsonld["@graph"] ? { ...jsonld, "@graph": jsonld["@graph"].map(fix) } : fix(jsonld);
}

/** Подпись под заголовком: имя из meta.author (строка или { name }). */
export const authorName = (meta) => {
  const raw = meta && meta.author;
  return String((typeof raw === "object" && raw ? raw.name : raw) || "");
};

// ---- график публикации --------------------------------------------------------------------------

/** Дни выхода: вторник и пятница, 08:00 по Кишинёву зимой (05:00 UTC). Расписание сборки — 06:00 UTC. */
export const SLOT_WEEKDAYS = [2, 5];
export const SLOT_HOUR_UTC = 5;

/**
 * Ближайший свободный слот для языка: день выхода не раньше `from`, на который у этого языка ещё
 * ничего не стоит (одобренное или опубликованное).
 */
export function nextSlot(locale, taken, from = new Date()) {
  const busy = new Set((taken || []).filter((x) => x.locale === locale && x.publish_at).map((x) => String(x.publish_at).slice(0, 10)));
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), SLOT_HOUR_UTC));
  if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < 400; i++, d.setUTCDate(d.getUTCDate() + 1)) {
    if (SLOT_WEEKDAYS.includes(d.getUTCDay()) && !busy.has(d.toISOString().slice(0, 10))) return d.toISOString();
  }
  return null;
}

/** Что публиковать сейчас: одобренные с наступившей датой, не больше одной на язык в день. */
export function duePicks(rows, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const doneToday = new Set(rows.filter((r) => r.status === "published" && String(r.publish_at || "").slice(0, 10) === today).map((r) => r.locale));
  const picks = [];
  for (const r of rows.filter((x) => x.status === "approved" && x.publish_at && Date.parse(x.publish_at) <= now.getTime())
    .sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at))) {
    if (doneToday.has(r.locale)) continue;
    doneToday.add(r.locale);
    picks.push(r);
  }
  return picks;
}

// ---- Supabase REST (сервер) ---------------------------------------------------------------------

export function supabase(url, key) {
  const base = String(url || "").replace(/\/$/, "") + "/rest/v1/";
  return async (path, init = {}) => {
    const r = await fetch(base + path, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers || {}) },
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${init.method || "GET"} ${path.split("?")[0]}: HTTP ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}
