// Build the publishable static site from the imported mirror + editor edits.
//   node scripts/build-site.mjs [edits.json]
// Reads public/import/allclean (RO-primary mirror) + optional edits (overrides + breakpoint rules),
// writes out/ (RO at root, RU under /ru), copies assets, and emits sitemap.xml + robots.txt (auto-SEO).
// This is the "build" half of publish; the deploy half (push out/ + trigger rebuild) plugs in on top.
//
// The render logic is IMPORTED from src/editor/renderCore.js — the same module the editor renders
// with — so this stays byte-faithful on unedited blocks (no edits → identical to the crawled live
// pages) and a change to rendering can never reach the site without also reaching the editor.
import { readFile, writeFile, mkdir, rm, readdir, cp, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const IMPORT = join(ROOT, "public", "import", "allclean");
const ASSETS = join(ROOT, "public", "site-assets");
const OUT = join(ROOT, "out");
const SITE = "https://allclean.md";

// ---- render core --------------------------------------------------------------------------------
// The assembly / cleaning / override-CSS logic is NOT re-implemented here any more. It is imported
// from the same module the editor uses, so the published page and the editor canvas cannot drift.
import {
  applyOverrides, cleanHtml, overridesCss, keptIds, reassemble, exportPageHtml, applyMedia,
  MEDIA_KEY,
  decodeMedia,
} from "../src/editor/renderCore.js";

// Правки под Закон № 195/2024 (свой домен вместо чужого CDN, обязательное согласие и его
// запись, закрытые фотографии, реквизиты в подвале). Применяются к готовому HTML, чтобы
// зеркало осталось снимком; см. комментарий в самом модуле.
import { applySitePrivacy, report as privacyReport, assertApplied as assertPrivacy } from "./site-privacy.mjs";
import { localizeCdnFiles } from "./localize-cdn.mjs";
import { LEGAL_PAGES, renderLegalMain } from "./legal-pages.mjs";

// ---- build --------------------------------------------------------------------------------------
const slugToFile = (slug) => (slug === "/" ? "index.html" : slug.replace(/^\//, "") + "/index.html");
const PROJECT = "allclean";

// Instant publish: read the editor's saved edits from Supabase (source of truth). Falls back to a
// local edits.json arg, then to the clean mirror. On Vercel, SUPABASE_URL + a key come from env.
async function supabaseEdits() {
  // Accept both the platform names and the existing Astro/Vercel names (PUBLIC_SUPABASE_*) so the
  // client project's current env works with no new variables.
  const URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON;
  // Нет ключей — это та же катастрофа, что и упавшее чтение: сборка выложит сайт без единой правки
  // клиента. Локальная сборка из файла правок (аргумент) и заведомо чистая первая сборка остаются
  // возможными, но их надо назвать вслух.
  if (!URL || !KEY) {
    if (process.argv[2] || process.env.ALLOW_CLEAN_MIRROR === "1") return null;
    console.error("[build] ОСТАНОВЛЕНО: не заданы SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — сборка вышла бы без правок клиента.");
    console.error("[build] если чистое зеркало действительно нужно: ALLOW_CLEAN_MIRROR=1");
    process.exitCode = 1;
    throw new Error("no supabase credentials");
  }
  try {
    const r = await fetch(`${URL.replace(/\/$/, "")}/rest/v1/site_overrides?select=page_id,overrides,breakpoints&project=eq.${PROJECT}`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    // ⚠️ A FAILED READ IS NOT "NO EDITS". This used to return null, and null means "build the clean
    // mirror" — so one Supabase hiccup during a rebuild republished all 38 pages WITHOUT a single
    // client edit, while the rows sat untouched in the database and the cabinet said «Опубликовано».
    // Every publish triggers a rebuild, so that is a site-wide wipe on a transient network error.
    // Failing the build instead keeps the previous deploy live, which is always the safer state.
    if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
    const rows = await r.json();
    const overrides = {}, breakpoints = {};
    for (const row of rows) {
      if (row.overrides && Object.keys(row.overrides).length) overrides[row.page_id] = row.overrides;
      if (row.breakpoints && Object.keys(row.breakpoints).length) breakpoints[row.page_id] = row.breakpoints;
    }
    console.log(`[build] Supabase edits: ${rows.length} page(s)`);
    return { overrides, breakpoints };
  } catch (e) {
    console.error("[build] ОСТАНОВЛЕНО: не удалось прочитать правки из Supabase —", e.message);
    console.error("[build] сборка без правок затёрла бы живой сайт; предыдущий деплой остаётся на месте.");
    process.exit(1);
  }
}

// ---- blog articles → pages (from Supabase `articles`) -------------------------------------------
const RO_TEMPLATE = "blog__curatenia-generala-si-cea-de-mentinere-care-sunt-diferentele";
const RU_TEMPLATE = "ru__blog__generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya";
const escHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;");

/** Minimal Markdown → HTML (used only when the body is authored as Markdown; passes HTML through). */
function mdToHtml(md) {
  if (/<(p|h[1-6]|ul|ol|div|figure)[ >]/i.test(md)) return md; // already HTML
  const inline = (s) => escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => `<a href="${u.replace(/^javascript:/i, "")}">${t}</a>`);
  let html = "", list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of String(md || "").split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) { close(); continue; }
    let m;
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
      close();
      const u = /^(https?:\/\/|\/|data:image\/)/i.test(m[2]) ? m[2] : "";
      if (u) { const cap = m[1].trim(); html += `<figure class="blog-figure"><img src="${escAttr(u)}" alt="${escAttr(cap)}" loading="lazy">${cap ? `<figcaption>${inline(cap)}</figcaption>` : ""}</figure>`; }
      continue;
    }
    if (/^(---|\*\*\*|___)$/.test(t)) { close(); html += "<hr>"; continue; }
    if ((m = t.match(/^(#{1,6})\s+(.*)/))) { close(); const lv = Math.min(6, m[1].length); html += `<h${lv}>${inline(m[2])}</h${lv}>`; continue; }
    if ((m = t.match(/^[-*]\s+(.*)/))) { if (list !== "ul") { close(); list = "ul"; html += "<ul>"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = t.match(/^\d+\.\s+(.*)/))) { if (list !== "ol") { close(); list = "ol"; html += "<ol>"; } html += `<li>${inline(m[1])}</li>`; continue; }
    close(); html += `<p>${inline(t)}</p>`;
  }
  close();
  return html;
}

const artUrl = (locale, slug) => (locale === "ro" ? `${SITE}/blog/${slug}` : `${SITE}/${locale}/blog/${slug}`);
const artPath = (locale, slug) => (locale === "ro" ? `blog/${slug}/index.html` : `${locale}/blog/${slug}/index.html`);

const D = "data-astro-cid-zcwx364o";
function buildSec0(a, dateStr) {
  const cover = a.cover_url ? `<div class="image-wrap_hero-article" ${D}><img src="${escAttr(a.cover_url)}" loading="eager" alt="${escAttr(a.cover_alt || a.title)}" sizes="100vw" class="image_cover" ${D}></div>` : "";
  const faq = (a.meta && a.meta.faq) || [];
  const faqTitle = a.locale === "ro" ? "Întrebări frecvente" : "Часто задаваемые вопросы";
  const faqHtml = faq.length ? `<div class="wrap_6-center" ${D}><div class="wrap_faq-block" style="opacity:1" ${D}><div class="headline_faq-block" ${D}><h2 class="heading-style-h4 margin-0" ${D}>${escHtml(faqTitle)}</h2></div><div class="faq-block blog-faq" ${D}>${faq.map((f) => `<div class="expandable-single" ${D}><div class="expandable-top" ${D}><h3 class="heading-style-h6 margin-0" ${D}>${escHtml(f.question)}</h3></div><div class="expandable-content" ${D}><p>${escHtml(f.answer)}</p></div></div>`).join("")}</div></div></div>` : "";
  return `<section class="section_hero-article" ${D}><div class="padding-global" ${D}><div class="w-layout-blockcontainer container-large w-container" ${D}><div class="headline_article" ${D}><div class="label-large" ${D}>${escHtml(dateStr)}</div><h1 ${D}>${escHtml(a.title)}</h1></div>${cover}<div class="master_body-article" ${D}><div class="wrap_6-center" ${D}><div class="body_article w-richtext" ${D}>${mdToHtml(a.body || "")}</div></div>${faqHtml}</div></div></div></section>`;
}

/** Rebuild the template <head> for this article (title/desc/canonical/og/hreflang/JSON-LD). */
export function buildHead(prefix, a, roSlug, ruSlug) {
  const url = artUrl(a.locale, a.slug);
  const title = a.seo_title || a.title;
  const desc = a.seo_description || a.excerpt || "";
  const roUrl = roSlug ? `${SITE}/blog/${roSlug}` : url;
  const ruUrl = ruSlug ? `${SITE}/ru/blog/${ruSlug}` : url;
  let h = prefix
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(title)}</title>`)
    .replace(/(name="description"\s+content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
    .replace(/(content=")[^"]*("\s+name="description")/, `$1${escAttr(desc)}$2`)
    .replace(/(rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(og:title"\s+content=")[^"]*(")/, `$1${escAttr(title)}$2`)
    .replace(/(og:description"\s+content=")[^"]*(")/, `$1${escAttr(desc)}$2`)
    .replace(/(og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(hreflang="ru-MD"\s+href=")[^"]*(")/, `$1${ruUrl}$2`)
    .replace(/(hreflang="ro-MD"\s+href=")[^"]*(")/, `$1${roUrl}$2`)
    .replace(/(hreflang="x-default"\s+href=")[^"]*(")/, `$1${roUrl}$2`);

  // Разметка для поиска. В шапке статьи-образца ТРИ блока ld+json: карточка компании, сама статья
  // (@graph с Article и FAQPage) и хлебные крошки. Замена без флага g попадала в первый — то есть
  // затирала карточку компании и оставляла КАЖДОЙ новой статье Article и вопросы от образца.
  // Идём по блокам и меняем каждый по его типу.
  h = h.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (whole, open, json, close) => {
    let тип = "";
    try { const o = JSON.parse(json); тип = o["@graph"] ? "article" : String(o["@type"] || ""); } catch { return whole; }
    if (/LocalBusiness|Organization/i.test(тип)) return whole;                     // карточка компании — общая
    if (/BreadcrumbList/i.test(тип)) {
      try {
        const o = JSON.parse(json);
        const items = o.itemListElement || [];
        const last = items[items.length - 1];
        if (last) { last.name = title; last.item = url; }
        return open + JSON.stringify(o) + close;
      } catch { return whole; }
    }
    return open + JSON.stringify(a.jsonld || {}) + close;                          // Article/@graph — этой статьи
  });

  // og:image и twitter:image — обложка статьи; у образца они указывают на его собственную.
  const img = a.cover_url ? escAttr(a.cover_url) : null;
  if (img) h = h.replace(/(og:image"\s+content=")[^"]*(")/g, `$1${img}$2`)
                .replace(/(twitter:image"\s+content=")[^"]*(")/g, `$1${img}$2`);
  h = h.replace(/(twitter:title"\s+content=")[^"]*(")/, `$1${escAttr(title)}$2`)
       .replace(/(twitter:description"\s+content=")[^"]*(")/, `$1${escAttr(desc)}$2`);
  return h;
}

/** Fetch published articles from Supabase (anon read) grouped, then render new ones to pages. */
async function generateArticles(written, media = []) {
  const URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON;
  const PROJECT_ID = "8878db57-c541-4502-bfa6-ae812dc3aefd";
  let arts = [];
  if (process.env.MOCK_ARTICLES) { arts = JSON.parse(process.env.MOCK_ARTICLES); } // test hook
  else if (!URL || !KEY) { console.log("[build] blog: no Supabase creds — skipping article generation"); return { urls: [], newByLocale: {} }; }
  else try {
    const r = await fetch(`${URL.replace(/\/$/, "")}/rest/v1/articles?select=group_id,locale,slug,title,excerpt,body,cover_url,seo_title,seo_description,meta,jsonld,created_at&project_id=eq.${PROJECT_ID}&status=eq.published`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    // Пропустить статьи нельзя: страницы блога генерируются на каждой сборке, и «пропустили» значит
    // «удалили с сайта все опубликованные из кабинета статьи».
    if (!r.ok) throw new Error(`articles HTTP ${r.status}`);
    arts = await r.json();
  } catch (e) {
    console.error("[build] ОСТАНОВЛЕНО: не удалось прочитать статьи блога —", e.message);
    console.error("[build] сборка без них удалила бы уже опубликованные статьи; предыдущий деплой остаётся.");
    process.exitCode = 1;
    throw e;
  }

  // group_id → { ro?, ru? } for hreflang pairing
  const byGroup = new Map();
  for (const a of arts) { const g = byGroup.get(a.group_id) || {}; g[a.locale] = a; byGroup.set(a.group_id, g); }

  const roTpl = JSON.parse(await readFile(join(IMPORT, RO_TEMPLATE + ".json"), "utf8"));
  const ruTpl = JSON.parse(await readFile(join(IMPORT, RU_TEMPLATE + ".json"), "utf8"));
  const newUrls = [];
  const newByLocale = { ro: [], ru: [] };
  let made = 0, skipped = 0;
  for (const a of arts) {
    const path = artPath(a.locale, a.slug);
    if (written.has(path)) { skipped++; continue; } // keep the original rich mirror page if it exists
    const pair = byGroup.get(a.group_id) || {};
    const tpl = a.locale === "ru" ? ruTpl : roTpl;
    const dateStr = new Date(a.created_at || Date.now()).toLocaleDateString(a.locale === "ru" ? "ru-RU" : "ro-RO", { day: "numeric", month: "long", year: "numeric" });
    const page = {
      ...tpl,
      prefix: buildHead(tpl.prefix, a, pair.ro?.slug, pair.ru?.slug),
      blocks: tpl.blocks.map((b) => (b.content.region === "main" ? { ...b, content: { ...b.content, html: buildSec0(a, dateStr) } } : b)),
    };
    // Страницы статей собираются здесь, мимо exportPageHtml — без applyMedia заменённое фото
    // меняется на 38 страницах зеркала и остаётся старым в шапке и подвале каждой статьи,
    // без applySitePrivacy на них не доезжают правки по закону 195/2024.
    const doc = applySitePrivacy(applyMedia(reassemble(page), media), a.locale);
    const dest = join(OUT, path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, doc);
    written.add(path); newUrls.push(artUrl(a.locale, a.slug));
    (newByLocale[a.locale] || (newByLocale[a.locale] = [])).push(a);
    made++;
  }
  console.log(`[build] blog: ${arts.length} published articles — ${made} pages generated, ${skipped} kept from mirror`);
  return { urls: newUrls, newByLocale };
}

/** A blog-index card matching the mirror's `.grid_blog` card markup. */
function cardHtml(a, locale) {
  const date = new Date(a.created_at || Date.now()).toLocaleDateString(locale === "ru" ? "ru-RU" : "ro-RO", { day: "numeric", month: "long", year: "numeric" });
  const url = locale === "ro" ? `/blog/${a.slug}` : `/${locale}/blog/${a.slug}`;
  const cta = locale === "ru" ? "Читать статью" : "Citește articolul";
  const cover = a.cover_url ? `<div class="image-wrap_article"><img src="${escAttr(a.cover_url)}" loading="lazy" alt="${escAttr(a.cover_alt || a.title)}" class="image_cover"></div>` : "";
  return `<div role="listitem" class="w-dyn-item"><a href="${url}" class="link_article w-inline-block">${cover}<div class="article-card_bottom-tile"><div class="text-wrap_article-card"><div class="text-size-small">${escHtml(date)}</div><div class="heading-style-h4">${escHtml(a.title)}</div></div><div button-tertiary="" class="cta_tertiary"><div>${escHtml(cta)}</div></div></div></a></div>`;
}

/** Inject new-article cards at the top of a blog index page's `.grid_blog` grid. */
async function injectCards(indexRel, cards, locale) {
  const file = join(OUT, indexRel);
  if (!existsSync(file) || !cards.length) return;
  let html = await readFile(file, "utf8");
  const injected = cards.map((a) => cardHtml(a, locale)).join("");
  html = html.replace(/(<div[^>]*class="[^"]*grid_blog[^"]*"[^>]*>)/, `$1${injected}`);
  await writeFile(file, html);
  console.log(`[build] blog: ${cards.length} card(s) added to ${indexRel}`);
}

/**
 * Страница «не найдено».
 *
 * Без неё опечатка в адресе или старая ссылка из поиска приводили на служебный текст хостинга
 * («The page could not be found», 79 байт) — без шапки, без подвала, без единой ссылки обратно.
 * Собираем её из оболочки главной: та же шапка, тот же подвал, те же стили и шрифты, меняется
 * только содержимое <main>. Текст на двух языках, потому что одна страница отвечает и на
 * румынские, и на русские адреса.
 *
 * Оболочка берётся из уже собранной главной, поэтому страница автоматически наследует и правки
 * клиента, и правила замены фото — отдельно поддерживать её не нужно.
 */
async function write404() {
  const shellFile = join(OUT, "index.html");
  if (!existsSync(shellFile)) return;
  const shell = await readFile(shellFile, "utf8");
  const open = shell.indexOf("<main");
  const close = shell.indexOf("</main>");
  if (open < 0 || close < 0) { console.log("[build] 404: в главной нет <main> — пропускаю"); return; }

  const cta = (href, text, extra) =>
    `<a href="${href}" class="cta_primary${extra || ""} w-inline-block">` +
      `<div class="button_text-mask"><div class="text-button">${text}</div></div>` +
      `<div class="btn-bg"></div></a>`;

  const body =
    '<section class="section_hero-article"><div class="padding-global">' +
    '<div class="w-layout-blockcontainer container-large w-container">' +
    '<div style="padding:3.5rem 0 4rem;display:flex;flex-direction:column;gap:1rem;align-items:flex-start;max-width:42rem">' +
      '<div class="label-large">404</div>' +
      '<h1 class="heading-style-h3 margin-0">Pagina nu&nbsp;a&nbsp;fost găsită</h1>' +
      '<div class="heading-style-h5 tone-medium">Страница не&nbsp;найдена</div>' +
      '<p class="text-size-large">Adresa nu&nbsp;există sau pagina a&nbsp;fost mutată. ' +
        'Reveniți la&nbsp;pagina principală sau alegeți un&nbsp;serviciu.<br>' +
        'Такой страницы нет или она переехала. Вернитесь на&nbsp;главную или выберите услугу.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.75rem;margin-top:.5rem">' +
        cta("/", "Prima pagină") + cta("/ru", "На главную", " secondary") +
        cta("/services", "Servicii") + cta("/ru/services", "Услуги", " secondary") +
      "</div>" +
    "</div></div></div></section>";

  let html = shell.slice(0, shell.indexOf(">", open) + 1) + body + shell.slice(close);
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, "<title>404 — All Clean</title>")
    // страница не должна попасть в поиск и не должна объявлять себя копией главной
    .replace(/<link\b[^>]*rel="canonical"[^>]*>/gi, '<meta name="robots" content="noindex">')
    .replace(/<link\b[^>]*rel="alternate"[^>]*>/gi, "")
    .replace(/<meta\b[^>]*property="og:(url|title)"[^>]*>/gi, "");
  await writeFile(join(OUT, "404.html"), html);
  console.log("[build] 404.html из оболочки главной");
}

// ---- юридические страницы -----------------------------------------------------------------------
// Политика конфиденциальности и страница про cookie собираются из scripts/legal-pages.mjs поверх
// вёрстки страницы /privacy из зеркала: у них та же шапка, подвал и стили, меняется содержимое.
// Текст политики обязан описывать реальные процессы (Закон № 195/2024), поэтому он живёт в коде
// рядом с правками, которые описывает, а не в снимке сайта.
function legalHead(prefix, pg) {
  const url = SITE + pg.slug;
  const ro = pg.lang === "ro" ? url : SITE + pg.pair;
  const ru = pg.lang === "ru" ? url : SITE + pg.pair;
  return prefix
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escHtml(pg.metaTitle)}</title>`)
    .replace(/(name="description"\s+content=")[^"]*(")/, `$1${escAttr(pg.metaDesc)}$2`)
    .replace(/(content=")[^"]*("\s+name="description")/, `$1${escAttr(pg.metaDesc)}$2`)
    .replace(/(rel="canonical"\s+href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(og:title"\s+content=")[^"]*(")/, `$1${escAttr(pg.metaTitle)}$2`)
    .replace(/(og:description"\s+content=")[^"]*(")/, `$1${escAttr(pg.metaDesc)}$2`)
    .replace(/(og:url"\s+content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(hreflang="ru-MD"\s+href=")[^"]*(")/, `$1${ru}$2`)
    .replace(/(hreflang="ro-MD"\s+href=")[^"]*(")/, `$1${ro}$2`)
    .replace(/(hreflang="x-default"\s+href=")[^"]*(")/, `$1${ro}$2`);
}

async function writeLegalPages(written, media) {
  const tpl = {
    ro: JSON.parse(await readFile(join(IMPORT, "privacy.json"), "utf8")),
    ru: JSON.parse(await readFile(join(IMPORT, "ru__privacy.json"), "utf8")),
  };
  for (const pg of LEGAL_PAGES) {
    const t = tpl[pg.lang];
    const page = {
      ...t,
      slug: pg.slug,
      prefix: legalHead(t.prefix, pg),
      blocks: t.blocks.map((b) => (b.content.region === "main"
        ? { ...b, content: { ...b.content, html: renderLegalMain(pg) } }
        : b)),
    };
    const rel = slugToFile(pg.slug);
    const dest = join(OUT, rel);
    await mkdir(dirname(dest), { recursive: true });
    // Через exportPageHtml, как и все остальные страницы: иначе юридические страницы остаются без
    // общих починок сайта — без области нажатия у ссылок, без имён у иконок, с подписями в подвале
    // по 8px. А так как они перезаписывают /privacy из зеркала, этих починок лишалась и политика.
    // Переключатель языка достался им от политики, с которой они собраны: на странице про cookie
    // он вёл на политику другого языка. Адрес пары известен здесь — правим его тем же движением.
    const html = applySitePrivacy(exportPageHtml(page, undefined, undefined, { media }), pg.lang)
      .replace(/(<a\b[^>]*class="[^"]*lang-toggle[^"]*"[^>]*href=")[^"]*(")/g, `$1${pg.pair}$2`)
      .replace(/(<a\b[^>]*href=")[^"]*("[^>]*class="[^"]*lang-toggle[^"]*")/g, `$1${pg.pair}$2`);
    await writeFile(dest, html);
    written.add(rel);
  }
  return LEGAL_PAGES.length;
}

async function main() {
  const editsPath = process.argv[2];
  let edits = { overrides: {}, breakpoints: {} };
  const dbEdits = await supabaseEdits();
  if (dbEdits) {
    edits = dbEdits;
  } else if (editsPath && existsSync(editsPath)) {
    edits = JSON.parse(await readFile(editsPath, "utf8"));
    console.log(`[build] edits from ${editsPath}`);
  } else {
    console.log("[build] no edits — clean mirror");
  }

  // The site's photo rules live under a reserved key, once for the whole site — see renderCore.js.
  const media = decodeMedia(edits.overrides?.[MEDIA_KEY]?.[MEDIA_KEY]);
  if (media.length) console.log(`[build] media rules: ${media.length}`);

  const idx = JSON.parse(await readFile(join(IMPORT, "_pages.json"), "utf8"));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  let n = 0;
  const written = new Set();
  for (const entry of idx.pages) {
    const page = JSON.parse(await readFile(join(IMPORT, entry.file + ".json"), "utf8"));
    const html = applySitePrivacy(
      exportPageHtml(page, edits.overrides?.[page.id], edits.breakpoints?.[page.id], { media }),
      entry.lang
    );
    const rel = slugToFile(entry.slug);
    const dest = join(OUT, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, html); // \n line endings, utf-8 — matches the mirror's bytes
    written.add(rel);
    n++;
  }
  console.log(`[build] ${n} pages`);
  // Слепок ТЕХ ЖЕ правок, из которых собран сайт. Без него ворота строили двойник холста из
  // чистого зеркала, а страницу — с правками клиента, и сравнивали разное: правки клиента
  // в холсте просто отсутствовали, а расхождение списывалось на допуск. Теперь источник один.
  await writeFile(join(OUT, "__edits.json"), JSON.stringify(edits));

  // Политика и cookie — своим содержимым поверх вёрстки зеркала (перезаписывают /privacy).
  console.log(`[build] юридические страницы: ${await writeLegalPages(written, media)}`);

  console.log(`[build] правки 195/2024: ${privacyReport()}`);
  assertPrivacy();

  // Blog: generate pages for articles published from the cabinet (new ones; existing mirror pages kept)
  // and add their cards to the /blog and /ru/blog index grids.
  const { urls: articleUrls, newByLocale } = await generateArticles(written, media);
  await injectCards("blog/index.html", newByLocale.ro || [], "ro");
  await injectCards("ru/blog/index.html", newByLocale.ru || [], "ru");

  await write404();

  // assets: site-assets/* → out/ root (mirror references /images, /video, /fonts, /js, /logo.svg)
  for (const name of await readdir(ASSETS)) {
    await cp(join(ASSETS, name), join(OUT, name), { recursive: true });
  }
  console.log("[build] assets copied");

  // После копирования ассетов и генерации блога: всё, что ещё ссылается на чужой CDN
  // (картинки из зеркала и из правок редактора), переносим на свой домен.
  console.log("[build] localize-cdn: " + (await localizeCdnFiles()));

  // auto-SEO: sitemap.xml (all pages + hreflang alternates) + robots.txt
  const byGroup = new Map();
  for (const p of idx.pages) {
    if (!byGroup.has(p.group)) byGroup.set(p.group, {});
    byGroup.get(p.group)[p.lang] = p.slug;
  }
  const urls = idx.pages.map((p) => {
    const alts = byGroup.get(p.group) || {};
    const links = Object.entries(alts).map(([lang, slug]) => `<xhtml:link rel="alternate" hreflang="${lang}-MD" href="${SITE}${slug}"/>`).join("");
    const xdef = alts[idx.defaultLocale] ? `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${alts[idx.defaultLocale]}"/>` : "";
    return `<url><loc>${SITE}${p.slug}</loc>${links}${xdef}</url>`;
  }).join("");
  const artUrlsXml = (articleUrls || []).map((u) => `<url><loc>${u}</loc></url>`).join("");
  // Страницы cookie появились после снятия зеркала, в _pages.json их нет — вносим руками,
  // иначе они не попадут в карту сайта и останутся невидимыми для поиска.
  const cookieXml = LEGAL_PAGES.filter((p) => p.group === "cookies").map((p) => {
    const ro = p.lang === "ro" ? p.slug : p.pair;
    const ru = p.lang === "ru" ? p.slug : p.pair;
    return `<url><loc>${SITE}${p.slug}</loc>` +
      `<xhtml:link rel="alternate" hreflang="ro-MD" href="${SITE}${ro}"/>` +
      `<xhtml:link rel="alternate" hreflang="ru-MD" href="${SITE}${ru}"/>` +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${ro}"/></url>`;
  }).join("");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}${cookieXml}${artUrlsXml}</urlset>\n`;
  await writeFile(join(OUT, "sitemap.xml"), sitemap);
  await writeFile(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`[build] sitemap.xml (${idx.pages.length} urls) + robots.txt`);

  const size = (await stat(join(OUT, "index.html"))).size;
  console.log(`[build] done → ${OUT} (home ${size}b, default locale ${idx.defaultLocale})`);
}

// Сборку запускает запуск файла. Флаг ставит только самопроверка, которой нужна одна функция
// отсюда, а не весь прогон: scripts/check-article-head.mjs.
if (!process.env.BUILD_SITE_NO_RUN) main().catch((e) => { console.error("[build] FAILED", e); process.exit(1); });
