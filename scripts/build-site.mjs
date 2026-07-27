// Build the publishable static site from the imported mirror + editor edits.
//   node scripts/build-site.mjs [edits.json]
// Reads public/import/allclean (RO-primary mirror) + optional edits (overrides + breakpoint rules),
// writes out/ (RO at root, RU under /ru), copies assets, and emits sitemap.xml + robots.txt (auto-SEO).
// This is the "build" half of publish; the deploy half (push out/ + trigger rebuild) plugs in on top.
//
// Pure logic below is a Node port of src/editor/{reassemble,realStore,exportSite}.ts — kept byte-faithful
// on unedited blocks so the mirror invariant holds (no edits → identical to the crawled live pages).
import { readFile, writeFile, mkdir, rm, readdir, cp, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";

const ROOT = process.cwd();
const IMPORT = join(ROOT, "public", "import", "allclean");
const ASSETS = join(ROOT, "public", "site-assets");
const OUT = join(ROOT, "out");
const SITE = "https://allclean.md";

// ---- pure ports ---------------------------------------------------------------------------------
const MQ = { tablet: "(max-width: 991px)", mobile: "(max-width: 479px)" };
const CASCADE = { "color":1,"font-size":1,"font-weight":1,"line-height":1,"letter-spacing":1,"text-align":1,"font-style":1,"text-transform":1,"text-decoration":1,"font-family":1 };

function applyOverrides(blocks, ov) {
  if (!ov) return blocks;
  return blocks.map((b) => (ov[b.id] != null ? { ...b, content: { ...b.content, html: ov[b.id] } } : b));
}

function cleanHtml(html, keepIds) {
  return html
    .replace(/\s+contenteditable="true"/g, "")
    .replace(/\s+spellcheck="false"/g, "")
    .replace(/\s+data-lg-el="[^"]*"/g, "")
    .replace(/\s+data-lg-id="([^"]*)"/g, (m, id) => (keepIds && keepIds.has(id) ? m : ""))
    .replace(/\sclass="([^"]*lg-selected[^"]*)"/g, (_m, val) => {
      const cls = val.split(/\s+/).filter((c) => c && c !== "lg-selected");
      return cls.length ? ` class="${cls.join(" ")}"` : "";
    });
}

function overridesCss(bp) {
  if (!bp) return "";
  let css = "";
  for (const [layer, sel] of [["hover", ":hover"], ["active", ":active"]]) {
    const els = bp[layer] || {};
    for (const id of Object.keys(els)) {
      let decl = "";
      for (const p of Object.keys(els[id])) if (els[id][p] !== "") decl += `${p}:${els[id][p]} !important;`;
      if (decl) css += `[data-lg-id="${id}"]${sel}{${decl}}`;
    }
  }
  for (const dev of ["tablet", "mobile"]) {
    const els = bp[dev] || {};
    let body = "";
    for (const id of Object.keys(els)) {
      let decl = "", cdecl = "";
      for (const p of Object.keys(els[id])) {
        if (els[id][p] === "") continue;
        decl += `${p}:${els[id][p]} !important;`;
        if (CASCADE[p]) cdecl += `${p}:${els[id][p]} !important;`;
      }
      if (decl) body += `[data-lg-id="${id}"]{${decl}}`;
      if (cdecl) body += `[data-lg-id="${id}"] *{${cdecl}}`;
    }
    if (body) css += `@media ${MQ[dev]}{${body}}`;
  }
  return css;
}

function keptIds(bp) {
  const s = new Set();
  if (bp) for (const d of ["tablet", "mobile", "hover", "active"]) Object.keys(bp[d] || {}).forEach((id) => s.add(id));
  return s;
}

function reassemble(p) {
  if (!p.wrapped) return p.prefix + p.blocks.map((b) => b.content.html).join("") + p.suffix;
  const header = p.blocks.find((b) => b.content.region === "header")?.content.html ?? "";
  const footer = p.blocks.find((b) => b.content.region === "footer")?.content.html ?? "";
  const mains = p.blocks.filter((b) => b.content.region === "main").map((b) => b.content.html).join("");
  return p.prefix + p.bodyPrefix + p.pwOpen + header + p.mainOpen + mains + p.mainClose + footer + p.pwClose + p.tailScripts + p.suffix;
}

function exportPageHtml(page, overrides, bp) {
  const keep = keptIds(bp);
  const withOv = overrides ? applyOverrides(page.blocks, overrides) : page.blocks;
  const blocks = withOv.map((b) => ({ ...b, content: { ...b.content, html: cleanHtml(b.content.html, keep) } }));
  let doc = reassemble({ ...page, blocks });
  const css = overridesCss(bp);
  if (css) {
    const tag = `<style id="lgcms-overrides">${css}</style>`;
    doc = doc.includes("</head>") ? doc.replace("</head>", `${tag}</head>`) : doc.replace(/<body/, `${tag}<body`);
  }
  return doc;
}

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
  if (!URL || !KEY) return null;
  try {
    const r = await fetch(`${URL.replace(/\/$/, "")}/rest/v1/site_overrides?select=page_id,overrides,breakpoints&project=eq.${PROJECT}`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.log(`[build] Supabase edits skipped (HTTP ${r.status})`); return null; }
    const rows = await r.json();
    const overrides = {}, breakpoints = {};
    for (const row of rows) {
      if (row.overrides && Object.keys(row.overrides).length) overrides[row.page_id] = row.overrides;
      if (row.breakpoints && Object.keys(row.breakpoints).length) breakpoints[row.page_id] = row.breakpoints;
    }
    console.log(`[build] Supabase edits: ${rows.length} page(s)`);
    return { overrides, breakpoints };
  } catch (e) {
    console.log("[build] Supabase edits skipped:", e.message);
    return null;
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
function buildHead(prefix, a, roSlug, ruSlug) {
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
    .replace(/(hreflang="x-default"\s+href=")[^"]*(")/, `$1${roUrl}$2`)
    .replace(/(<script type="application\/ld\+json"[^>]*>)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(a.jsonld || {})}$2`);
  if (a.cover_url) h = h.replace(/(og:image"\s+content=")[^"]*(")/, `$1${escAttr(a.cover_url)}$2`);
  return h;
}

/** Fetch published articles from Supabase (anon read) grouped, then render new ones to pages. */
async function generateArticles(written) {
  const URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.PUBLIC_SUPABASE_ANON;
  const PROJECT_ID = "8878db57-c541-4502-bfa6-ae812dc3aefd";
  let arts = [];
  if (process.env.MOCK_ARTICLES) { arts = JSON.parse(process.env.MOCK_ARTICLES); } // test hook
  else if (!URL || !KEY) { console.log("[build] blog: no Supabase creds — skipping article generation"); return []; }
  else try {
    const r = await fetch(`${URL.replace(/\/$/, "")}/rest/v1/articles?select=group_id,locale,slug,title,excerpt,body,cover_url,seo_title,seo_description,meta,jsonld,created_at&project_id=eq.${PROJECT_ID}&status=eq.published`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.log(`[build] blog: articles fetch HTTP ${r.status} — skipping`); return []; }
    arts = await r.json();
  } catch (e) { console.log("[build] blog: articles fetch failed:", e.message); return []; }

  // group_id → { ro?, ru? } for hreflang pairing
  const byGroup = new Map();
  for (const a of arts) { const g = byGroup.get(a.group_id) || {}; g[a.locale] = a; byGroup.set(a.group_id, g); }

  const roTpl = JSON.parse(await readFile(join(IMPORT, RO_TEMPLATE + ".json"), "utf8"));
  const ruTpl = JSON.parse(await readFile(join(IMPORT, RU_TEMPLATE + ".json"), "utf8"));
  const newUrls = [];
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
    const doc = reassemble(page);
    const dest = join(OUT, path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, doc);
    written.add(path); newUrls.push(artUrl(a.locale, a.slug)); made++;
  }
  console.log(`[build] blog: ${arts.length} published articles — ${made} pages generated, ${skipped} kept from mirror`);
  return newUrls;
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

  const idx = JSON.parse(await readFile(join(IMPORT, "_pages.json"), "utf8"));
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  let n = 0;
  const written = new Set();
  for (const entry of idx.pages) {
    const page = JSON.parse(await readFile(join(IMPORT, entry.file + ".json"), "utf8"));
    const html = exportPageHtml(page, edits.overrides?.[page.id], edits.breakpoints?.[page.id]);
    const rel = slugToFile(entry.slug);
    const dest = join(OUT, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, html); // \n line endings, utf-8 — matches the mirror's bytes
    written.add(rel);
    n++;
  }
  console.log(`[build] ${n} pages`);

  // Blog: generate pages for articles published from the cabinet (new ones; existing mirror pages kept).
  const articleUrls = await generateArticles(written);

  // assets: site-assets/* → out/ root (mirror references /images, /video, /fonts, /js, /logo.svg)
  for (const name of await readdir(ASSETS)) {
    await cp(join(ASSETS, name), join(OUT, name), { recursive: true });
  }
  console.log("[build] assets copied");

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
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}${artUrlsXml}</urlset>\n`;
  await writeFile(join(OUT, "sitemap.xml"), sitemap);
  await writeFile(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`[build] sitemap.xml (${idx.pages.length} urls) + robots.txt`);

  const size = (await stat(join(OUT, "index.html"))).size;
  console.log(`[build] done → ${OUT} (home ${size}b, default locale ${idx.defaultLocale})`);
}

main().catch((e) => { console.error("[build] FAILED", e); process.exit(1); });
