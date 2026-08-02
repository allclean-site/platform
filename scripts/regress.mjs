/**
 * Responsive + editability regression harness.
 *
 * v1 checked only the PUBLISHED pages (no horizontal overflow, no mid-word heading break at
 * 390/768/1280/1920) — and that blind spot is exactly where a month of bugs lived: broad "fixes"
 * passed the sweep while quietly killing EDITING (text that would not resize, a column drag that
 * looked dead, /about blowing up to 48000px only inside the canvas). v2 closes that class:
 *
 *  PUBLISH sweep (unchanged): every page in out/ at 4 widths — overflow + mid-word.
 *  CANVAS twins: every mirror page is ALSO rendered the way the editing canvas renders it — the
 *    same block wrapper, the same relaxed legacy CSS, the same editor-only CSS, the same override
 *    stylesheet, all imported from src/editor/renderCore.js (no re-implementation to drift). Checks:
 *      · canvas-blowup   — the twin must not be dramatically taller than the published page
 *                          (catches the 100vh-hero feedback spiral and friends);
 *      · resize-heading  — injecting the EXACT rule a width-drag writes (overridesCss through
 *                          fitValue) must actually widen a sample heading;
 *      · resize-grid     — moving a column boundary through the same pipeline must move the track,
 *                          EVEN when a child carries a stale pinned width (the dead-подложка bug:
 *                          the pin used to become the column's minimum and veto every drag).
 *
 * Run against the same edits the deploy uses:
 *    node scripts/build-site.mjs [edits.json] && node scripts/regress.mjs [edits.json]
 * then serve out/ and open /__regress.html; the JSON report accumulates on window.__REGRESS.
 */

import { readdirSync, statSync, writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOverrides, relaxLegacyChains, withSiteRuntime, wrapBlockForEdit, overridesCss, EDITOR_ONLY_CSS,
} from "../src/editor/renderCore.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const IMPORT = join(ROOT, "public", "import", "allclean");

/** Every built page → its served path (trailing slash hits index.html without clean-url rewrites). */
function pages(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (name === "__canvas") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) found.push(...pages(p));
    else if (name === "index.html") {
      const rel = relative(OUT, dirname(p)).split("\\").join("/");
      found.push(rel ? "/" + rel + "/" : "/");
    }
  }
  return found;
}

const urls = pages(OUT).sort();

// ---- canvas twins --------------------------------------------------------------------------------
// The same edits the build baked in (published layer), so twin vs published is apples to apples.
const editsPath = process.argv[2];
let edits = { overrides: {}, breakpoints: {} };
if (editsPath && existsSync(editsPath)) edits = JSON.parse(readFileSync(editsPath, "utf8"));

/** reassembleForEdit's structure, built from the shared core pieces (the runtime script is not
 *  included — the harness drives the probes itself, from the outer page). */
function canvasTwin(p, pageOv, pageBp) {
  const blocks = pageOv ? applyOverrides(p.blocks, pageOv) : p.blocks;
  const wrap = (b) => wrapBlockForEdit(b.content.html, b.id);
  const prefix = withSiteRuntime(relaxLegacyChains(p.prefix));
  let body;
  if (!p.wrapped) body = blocks.map(wrap).join("");
  else {
    const header = blocks.find((b) => b.content.region === "header");
    const footer = blocks.find((b) => b.content.region === "footer");
    const mains = blocks.filter((b) => b.content.region === "main").map(wrap).join("");
    body = p.bodyPrefix + p.pwOpen + (header ? wrap(header) : "") + p.mainOpen + mains +
      p.mainClose + (footer ? wrap(footer) : "") + p.pwClose + p.tailScripts;
  }
  // Into the HEAD, exactly where the runtime puts them (renderOverrides appends to document.head).
  // Position matters: the probes append their own later <style> to the head and must outrank these
  // by source order, the same way a live edit outranks the loaded state.
  const styles = '<style id="lgcms-editor-only">' + EDITOR_ONLY_CSS + "</style>" +
    '<style id="lgcms-overrides">' + overridesCss(pageBp) + "</style>";
  const withStyles = prefix.includes("</head>") ? prefix.replace("</head>", styles + "</head>") : styles + prefix;
  return withStyles + body + p.suffix;
}

const idx = JSON.parse(readFileSync(join(IMPORT, "_pages.json"), "utf8"));
mkdirSync(join(OUT, "__canvas"), { recursive: true });
const twins = []; // { url: published path, twin: /__canvas/<file>.html }
for (const entry of idx.pages) {
  const p = JSON.parse(readFileSync(join(IMPORT, entry.file + ".json"), "utf8"));
  const html = canvasTwin(p, edits.overrides?.[p.id], edits.breakpoints?.[p.id]);
  const name = entry.file + ".html";
  writeFileSync(join(OUT, "__canvas", name), html, "utf8");
  const pub = entry.slug === "/" ? "/" : entry.slug.replace(/^\//, "") ? "/" + entry.slug.replace(/^\//, "") + "/" : "/";
  twins.push({ url: pub, twin: "/__canvas/" + name });
}

// The probes must generate override CSS EXACTLY the way the editor does — so the runner page gets
// the render core itself (exports stripped), same trick the editor runtime uses.
const CORE_INLINE = readFileSync(join(ROOT, "src", "editor", "renderCore.js"), "utf8").replace(/^export\s+/gm, "");

const RUNNER = `
${CORE_INLINE}
const URLS = ${JSON.stringify(urls)};
const TWINS = ${JSON.stringify(twins)};
const WIDTHS = [390, 768, 1280, 1920];
const out = { done: false, progress: "", pass: 0, fail: 0, failures: [] };
window.__REGRESS = out;
const log = (m) => { out.progress = m; document.getElementById("s").textContent = m; };

const frame = document.getElementById("f");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function overflowPx(doc) {
  const de = doc.documentElement;
  return Math.round(de.scrollWidth - de.clientWidth);
}
function midWordBreaks(doc) {
  const SEL = "h1,h2,h3,h4,h5,h6,[class*=heading-style],[class*=heading_]";
  const els = doc.querySelectorAll(SEL), hits = [];
  for (const el of els) {
    if (el.querySelector(SEL)) continue;               // measured through its innermost heading box
    const w = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let n, broke = false;
    while ((n = w.nextNode()) && !broke) {
      const t = n.nodeValue; if (!t || !t.trim()) continue;
      const rng = doc.createRange(); let prevTop = null;
      for (let i = 0; i < t.length; i++) {
        rng.setStart(n, i); rng.setEnd(n, i + 1);
        const r = rng.getBoundingClientRect(); if (!r.height) continue;
        // A real mid-word break has a LETTER on both sides of the wrap. A break after a hyphen
        // ("Programați-|vă", "rent-|free") or before punctuation ("СПОКОЙСТВИЕ|.") is correct wrapping,
        // not a defect — those are not counted.
        if (prevTop !== null && r.top > prevTop + 2 && /[\\p{L}\\p{N}]/u.test(t[i - 1]) && /[\\p{L}\\p{N}]/u.test(t[i])) {
          const around = t.slice(Math.max(0, i - 14), i) + "|" + t.slice(i, i + 8);
          hits.push(around.replace(/\\s+/g, " ").trim()); broke = true; break;
        }
        prevTop = r.top;
      }
    }
  }
  return hits;
}

/** The testimonials block, gated: columns roughly equal where the marquee shows (>=768), and the
 *  phone layout showing its five ranked cards. These are the exact regressions the client reported —
 *  "одна колонка почти пустая" and "на мобильной вообще нет отзывов" — so they stay guarded. */
function checkTestimonials(doc, W) {
  const grid = doc.querySelector(".marquee-thirds");
  if (!grid) return [];
  const fails = [];
  const win = doc.defaultView;
  if (win.getComputedStyle(grid).display === "none") return [{ kind: "reviews-hidden", W }];
  // The card UNIT is .card_testimonial-marquee (sometimes wrapped in .single-marquee-testimonials).
  const cards = (col) => [...col.querySelectorAll(".card_testimonial-marquee")]
    .filter((c) => c.getBoundingClientRect().height > 40);
  if (W >= 768) {
    const cols = [...grid.children].filter((c) => c.getBoundingClientRect().width > 50);
    if (cols.length >= 3) {
      const heights = cols.map((c) => cards(c).reduce((s, x) => s + x.getBoundingClientRect().height, 0));
      const mx = Math.max(...heights), mn = Math.min(...heights);
      if (mn <= 0 || mx / mn > 2.2) fails.push({ kind: "reviews-unbalanced", W, heights: heights.map(Math.round) });
    }
    // A visitor must never see the same review twice — the export's seam copies get deduplicated.
    const texts = cards(grid).map((c) => c.textContent.replace(/\s+/g, " ").trim());
    if (new Set(texts).size !== texts.length) fails.push({ kind: "reviews-duplicates", W });
  } else {
    const visible = cards(grid).length;
    if (visible < 3 || visible > 5) fails.push({ kind: "reviews-mobile", W, visible });
  }
  return fails;
}

/** The phone services slider must carry EVERY unique service card the section knows — the template
 *  shipped only four slides, so most services were invisible on phones (client report). */
function checkServicesSlider(doc, W) {
  if (W >= 768) return [];
  const sl = doc.querySelector(".w-slider");
  if (!sl) return [];
  const sec = sl.closest("section") || sl.parentElement;
  // a service IS its link — the template's own slides carry shortened titles for the same services
  const key = (c) => c.getAttribute("href") || c.textContent.replace(/\s+/g, " ").trim();
  const uniq = new Set([...sec.querySelectorAll(".card_scroll-service")].map(key));
  const cards = [...sl.querySelectorAll(".w-slider-mask .card_scroll-service")].map(key);
  const inSlider = new Set(cards);
  if (inSlider.size < uniq.size) return [{ kind: "slider-incomplete", W, inSlider: inSlider.size, unique: uniq.size }];
  if (cards.length > inSlider.size) return [{ kind: "slider-duplicates", W, slides: cards.length, unique: inSlider.size }];
  return [];
}

async function loadFrame(url) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => { if (settled) return; settled = true; resolve(); };
    frame.onload = () => setTimeout(done, 600);           // let webflow/gsap/fonts settle
    frame.src = url;
    setTimeout(done, 6000);                               // hard cap for a slow page
  });
}

/** Measurements need a page that holds still — the marquee columns drift by design. */
function holdStill(doc) {
  if (doc.getElementById("__rg-still")) return;
  const st = doc.createElement("style"); st.id = "__rg-still";
  st.textContent = "*:not(video){animation-play-state:paused !important;}";
  doc.head.appendChild(st);
}

// ---- canvas probes -------------------------------------------------------------------------------
function stampAll(doc) {
  const ws = doc.querySelectorAll("[data-lg-block]");
  for (const w of ws) stampIds(w, w.getAttribute("data-lg-block"));
}
/** The rule set a horizontal width-drag produces, injected verbatim — the heading must follow. */
function probeHeadings(doc) {
  const de = doc.documentElement, fails = [];
  const cands = [...doc.querySelectorAll("h1,h2,[class*=heading-style]")].filter((e) => {
    if (e.querySelector("h1,h2,[class*=heading-style]")) return false;
    const cs = doc.defaultView.getComputedStyle(e);
    if (!/^(block|flex|grid|inline-block)$/.test(cs.display)) return false;
    const r = e.getBoundingClientRect();
    return r.width > 120 && r.height > 10 && r.width < de.clientWidth - 200 && r.top < 20000;
  }).slice(0, 3);
  for (const el of cands) {
    const id = el.getAttribute("data-lg-id"); if (!id) continue;
    const w0 = el.getBoundingClientRect().width;
    const base = {}; base[id] = { width: Math.round(w0 + 150) + "px", "max-width": "none", "min-width": "0", "flex-shrink": "0" };
    const st = doc.createElement("style");
    st.textContent = overridesCss({ base, tablet: {}, mobile: {}, hover: {}, active: {} });
    doc.head.appendChild(st);
    void el.getBoundingClientRect();
    const w1 = el.getBoundingClientRect().width;
    st.remove();
    if (w1 - w0 < 100) fails.push({ kind: "resize-heading", id, w0: Math.round(w0), w1: Math.round(w1) });
  }
  return fails;
}
/** A column drag through the same pipeline — WITH a stale width pinned onto the first column's box,
 *  which is the exact saved state that used to make the boundary refuse to move. */
function probeGrids(doc) {
  const fails = [];
  const win = doc.defaultView;
  const cands = [...doc.querySelectorAll("[class*=grid],[class*=master],[class*=thirds]")].filter((g) => {
    if (win.getComputedStyle(g).display !== "grid") return false;
    const kids = [...g.children].filter((c) => c.getBoundingClientRect().width > 60);
    if (kids.length < 2) return false;
    const a = kids[0].getBoundingClientRect(), b = kids[1].getBoundingClientRect();
    return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 30;   // same row
  }).slice(0, 2);
  for (const g of cands) {
    const id = g.getAttribute("data-lg-id"); if (!id) continue;
    const tpl = win.getComputedStyle(g).gridTemplateColumns.split(" ").map(parseFloat);
    if (tpl.length < 2 || !tpl.every((x) => isFinite(x) && x > 100)) continue;
    const kids = [...g.children].filter((c) => c.getBoundingClientRect().width > 60);
    const c0 = kids[0], c1 = kids[1];
    const left0 = c1.getBoundingClientRect().left;
    c0.style.setProperty("width", Math.round(c0.getBoundingClientRect().width) + "px");   // stale pin
    const t = tpl.slice(); t[0] = Math.round(t[0] + 120); t[1] = Math.round(Math.max(40, t[1] - 120));
    const base = {}; base[id] = { "grid-template-columns": t.map((x) => x + "px").join(" ") };
    const st = doc.createElement("style");
    st.textContent = overridesCss({ base, tablet: {}, mobile: {}, hover: {}, active: {} });
    doc.head.appendChild(st);
    void g.getBoundingClientRect();
    const moved = c1.getBoundingClientRect().left - left0;
    st.remove(); c0.style.removeProperty("width");
    if (Math.abs(moved - 120) > 45) fails.push({ kind: "resize-grid", id, moved: Math.round(moved) });
  }
  return fails;
}

(async () => {
  const pubH = {};   // published page height @1280 — the twin's yardstick
  for (let u = 0; u < URLS.length; u++) {
    const url = URLS[u];
    // Load the page ONCE, then resize the iframe to each width — an iframe reflows to its new size
    // like a viewport, so media queries and vw respond without a reload. Four reloads per page turned
    // a 3-minute sweep into a 12-minute one for nothing.
    frame.style.width = WIDTHS[0] + "px";
    await loadFrame(url);
    let doc;
    try { doc = frame.contentDocument; } catch (e) { doc = null; }
    if (!doc) { for (const W of WIDTHS) { out.fail++; out.failures.push({ url, W, err: "no document" }); } continue; }
    try { if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, sleep(800)]); } catch (e) {}
    holdStill(doc);
    for (const W of WIDTHS) {
      frame.style.width = W + "px";
      await sleep(220);                                  // let the reflow settle at the new width
      const of = overflowPx(doc);
      const mid = midWordBreaks(doc);
      const rev = (url === "/" || url === "/ru/")
        ? [...checkTestimonials(doc, W), ...checkServicesSlider(doc, W)]
        : [];
      if (W === 1280) pubH[url] = doc.documentElement.scrollHeight;
      if (of > 2 || mid.length || rev.length) {
        out.fail++;
        out.failures.push({ url, W, overflow: of > 2 ? of : 0, midWord: mid, ...(rev.length ? { reviews: rev } : {}) });
      } else out.pass++;
      log(\`\${u + 1}/\${URLS.length}  \${url} @\${W}  pass=\${out.pass} fail=\${out.fail}\`);
    }
  }
  // ---- canvas twins: blow-up + the two resize probes, at the canvas's own width -------------------
  for (let t = 0; t < TWINS.length; t++) {
    const { url, twin } = TWINS[t];
    frame.style.width = "1280px";
    await loadFrame(twin);
    let doc;
    try { doc = frame.contentDocument; } catch (e) { doc = null; }
    if (!doc) { out.fail++; out.failures.push({ url, twin, err: "no twin document" }); continue; }
    try { if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, sleep(800)]); } catch (e) {}
    holdStill(doc);
    await sleep(150);
    stampAll(doc);
    const problems = [];
    const th = doc.documentElement.scrollHeight, ph = pubH[url] || 0;
    if (ph && th > ph * 1.35 + 400) problems.push({ kind: "canvas-blowup", twinH: th, pubH: ph });
    problems.push(...probeHeadings(doc));
    problems.push(...probeGrids(doc));
    if (problems.length) { out.fail++; out.failures.push({ url, twin, W: 1280, canvas: problems }); }
    else out.pass++;
    log(\`twin \${t + 1}/\${TWINS.length}  \${url}  pass=\${out.pass} fail=\${out.fail}\`);
  }
  out.done = true;
  log(\`DONE  pass=\${out.pass}  fail=\${out.fail}\`);
  document.getElementById("r").textContent = JSON.stringify({ pass: out.pass, fail: out.fail, failures: out.failures }, null, 1);
})();
`;

const html = `<!doctype html><meta charset="utf-8"><title>regress</title>
<body style="margin:0;font:13px monospace">
<div id="s" style="position:fixed;top:0;left:0;right:0;background:#111;color:#0f0;padding:6px;z-index:9">starting…</div>
<pre id="r" style="margin:34px 8px 8px"></pre>
<iframe id="f" style="position:fixed;bottom:0;left:0;width:1280px;height:2200px;border:0;visibility:hidden"></iframe>
<script>${RUNNER}</script>`;

writeFileSync(join(OUT, "__regress.html"), html, "utf8");
console.log(`[regress] ${urls.length} pages × 4 widths + ${twins.length} canvas twins → out/__regress.html`);
