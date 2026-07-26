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
  for (const entry of idx.pages) {
    const page = JSON.parse(await readFile(join(IMPORT, entry.file + ".json"), "utf8"));
    const html = exportPageHtml(page, edits.overrides?.[page.id], edits.breakpoints?.[page.id]);
    const dest = join(OUT, slugToFile(entry.slug));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, html); // \n line endings, utf-8 — matches the mirror's bytes
    n++;
  }
  console.log(`[build] ${n} pages`);

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
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>\n`;
  await writeFile(join(OUT, "sitemap.xml"), sitemap);
  await writeFile(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`[build] sitemap.xml (${idx.pages.length} urls) + robots.txt`);

  const size = (await stat(join(OUT, "index.html"))).size;
  console.log(`[build] done → ${OUT} (home ${size}b, default locale ${idx.defaultLocale})`);
}

main().catch((e) => { console.error("[build] FAILED", e); process.exit(1); });
