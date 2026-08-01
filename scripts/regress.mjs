/**
 * Responsive regression harness for the PUBLISHED site.
 *
 * This is the gate that was missing: every bug this month ("fits in the editor, overflows on the
 * site", the pinned heading, the frozen grid, the tablet feature cards) was a page that looked right
 * at one width and broke at another, found by the client on production because nothing checked the
 * other widths first. This renders every built page at 390 / 768 / 1280 / 1920 and asserts, at each:
 *
 *   · no horizontal overflow of the document (the page never grows wider than its own viewport);
 *   · no mid-word break inside a heading (a word split where a whole-word wrap had room is a defect).
 *
 * It runs against out/ — the exact bytes that deploy — so a pass means the deployed page is sound at
 * those widths regardless of what the editor canvas happened to show. Run it before every "done".
 *
 * Mechanism: it writes out/__regress.html, a page that loads each built page into one reused iframe,
 * resizes the iframe to each width (an iframe is its own viewport, so media queries and vw respond),
 * measures in-frame, and accumulates a JSON report on window.__REGRESS. A headless driver then serves
 * out/ and reads that report. No Playwright needed.
 *
 *   node scripts/regress.mjs        # (re)generate out/__regress.html from what is in out/
 */

import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

/** Every built page → its served path (trailing slash hits index.html without clean-url rewrites). */
function pages(dir) {
  const found = [];
  for (const name of readdirSync(dir)) {
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

const RUNNER = `
const URLS = ${JSON.stringify(urls)};
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
        if (prevTop !== null && r.top > prevTop + 2 && !/\\s/.test(t[i - 1])) {
          hits.push((el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40)); broke = true; break;
        }
        prevTop = r.top;
      }
    }
  }
  return hits;
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

(async () => {
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
    for (const W of WIDTHS) {
      frame.style.width = W + "px";
      await sleep(220);                                  // let the reflow settle at the new width
      const of = overflowPx(doc);
      const mid = midWordBreaks(doc);
      if (of > 2 || mid.length) {
        out.fail++;
        out.failures.push({ url, W, overflow: of > 2 ? of : 0, midWord: mid });
      } else out.pass++;
      log(\`\${u + 1}/\${URLS.length}  \${url} @\${W}  pass=\${out.pass} fail=\${out.fail}\`);
    }
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
console.log(`[regress] ${urls.length} pages × 4 widths → out/__regress.html`);
