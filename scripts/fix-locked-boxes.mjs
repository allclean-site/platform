// Un-break published pages WITHOUT discarding the client's content edits.
//
// Why: a client can resize a text box in the editor, which used to bake a manual box into the saved
// HTML — `height:506px; width:795px; max-width:none; min-width:0; flex-shrink:0` plus a flat
// `font-size:124px`. That box is correct only at the width it was dragged at; on a narrower screen the
// heading overflows its section (the live allclean.md hero bug).
//
// The editor no longer produces this (text now hugs its height, and desktop font-size is emitted as a
// fluid clamp()). This script heals the rows that were published BEFORE that fix.
//
// It is surgical: only the layout-lock declarations are dropped, and only from TEXT elements. The
// client's TEXT, their alignment, colours, and their chosen font size (which lives in the breakpoint
// `base` layer and is rendered as a responsive clamp()) are all preserved.
//
// Usage (from platform/):
//   node scripts/fix-locked-boxes.mjs --self-test        # no network: prove the surgery on a sample
//   node scripts/fix-locked-boxes.mjs                    # dry run: show what WOULD change
//   node scripts/fix-locked-boxes.mjs --apply            # write back to Supabase
//   node scripts/fix-locked-boxes.mjs --apply --deploy   # ...and trigger a rebuild
// Options: --project <name> (default allclean), --page <page_id> (default: all pages)
// Creds: read from platform/.env.local (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEPLOY_HOOK).

import fs from "node:fs";
import path from "node:path";

/** Inline declarations that pin a manual box / flat size. Everything else is the client's design. */
const LOCK = /^(width|height|max-width|min-width|flex-shrink|font-size)$/i;
/** Only text elements are healed — an image or a spacer div may legitimately need a fixed size. */
const TEXT_TAG = "h1|h2|h3|h4|h5|h6|p|li|blockquote|figcaption|dt|dd";

function cleanStyle(style) {
  const kept = [], dropped = [];
  for (const decl of style.split(";")) {
    const d = decl.trim();
    if (!d) continue;
    const prop = d.slice(0, d.indexOf(":")).trim().toLowerCase();
    (LOCK.test(prop) ? dropped : kept).push(d);
  }
  return { style: kept.join("; "), dropped };
}

/** Strip layout-locks from inline styles on text elements. Returns the new html + what was removed. */
export function healHtml(html) {
  const removed = [];
  const out = html.replace(new RegExp(`<(${TEXT_TAG})\\b([^>]*)>`, "gi"), (tag) =>
    tag.replace(/\sstyle="([^"]*)"/i, (_m, val) => {
      const { style, dropped } = cleanStyle(val);
      if (dropped.length) removed.push(...dropped);
      return style ? ` style="${style}"` : "";
    })
  );
  return { html: out, removed };
}

/** Same for a breakpoint layer: a stale fixed `height` there pins the box at that device too. */
function healBp(bp) {
  const removed = [];
  if (!bp) return { bp, removed };
  const copy = JSON.parse(JSON.stringify(bp));
  for (const layer of Object.keys(copy)) {
    for (const id of Object.keys(copy[layer] || {})) {
      if (copy[layer][id].height) {
        removed.push(`${layer}/${id}: height:${copy[layer][id].height}`);
        delete copy[layer][id].height;
      }
      if (!Object.keys(copy[layer][id]).length) delete copy[layer][id];
    }
  }
  return { bp: copy, removed };
}

// ---------------------------------------------------------------- self-test (no network)

if (process.argv.includes("--self-test")) {
  // The exact H1 as published on allclean.md (captured from the live page).
  const sample =
    `<h1 id="" class="heading_hero-home" style="width: 795px; flex-shrink: 0 !important; max-width: none !important;` +
    ` min-width: 0px !important; height: 506px; font-size: 124px; justify-content: center;" data-lg-id="sec-0~29">` +
    ` <div class="heading-style-h1">Curațenie profesională în Chișinău și în toată&nbsp; Moldova</div> </h1>`;
  const { html, removed } = healHtml(sample);
  const checks = [
    ["client TEXT preserved", html.includes("Curațenie profesională în Chișinău și în toată&nbsp; Moldova")],
    ["centering preserved", html.includes("justify-content: center")],
    ["data-lg-id preserved", html.includes('data-lg-id="sec-0~29"')],
    ["class preserved", html.includes('class="heading_hero-home"')],
    ["height lock removed", !/height:\s*506px/.test(html)],
    ["width lock removed", !/width:\s*795px/.test(html)],
    ["flat font-size removed", !/font-size:\s*124px/.test(html)],
    ["max-width lock removed", !/max-width/.test(html)],
    ["min-width lock removed", !/min-width/.test(html)],
  ];
  // An image with a deliberate size must NOT be touched.
  const img = `<img src="/a.jpg" style="width: 300px; height: 200px;">`;
  checks.push(["non-text element untouched", healHtml(img).html === img]);
  // A plain paragraph keeps its colour while losing the lock.
  const p = `<p style="color: red; height: 90px;">hi</p>`;
  const ph = healHtml(p).html;
  checks.push(["other props kept on text", ph.includes("color: red") && !ph.includes("height")]);

  let ok = true;
  for (const [name, pass] of checks) { if (!pass) ok = false; console.log(`${pass ? "PASS" : "FAIL"} | ${name}`); }
  console.log(`\nremoved: ${removed.join(" | ")}`);
  console.log(`\nresult:\n${html}`);
  console.log(ok ? "\nSELF-TEST PASSED" : "\nSELF-TEST FAILED");
  process.exit(ok ? 0 : 1);
}

// ---------------------------------------------------------------- live run

function loadEnv() {
  const f = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

async function main() {
  loadEnv();
  const URL_ = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const APPLY = process.argv.includes("--apply");
  const PROJECT = arg("--project", "allclean");
  const PAGE = arg("--page", "");

  if (!URL_ || !KEY) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (put them in platform/.env.local).");
    process.exit(1);
  }
  const base = URL_.replace(/\/$/, "");
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

  let q = `${base}/rest/v1/site_overrides?select=page_id,overrides,breakpoints&project=eq.${PROJECT}`;
  if (PAGE) q += `&page_id=eq.${encodeURIComponent(PAGE)}`;
  const res = await fetch(q, { headers: h });
  if (!res.ok) { console.error(`Fetch failed: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
  const rows = await res.json();
  console.log(`Found ${rows.length} published page override(s) for project "${PROJECT}".\n`);

  let changed = 0;
  for (const row of rows) {
    const newOv = {};
    const report = [];
    for (const [blockId, html] of Object.entries(row.overrides || {})) {
      if (typeof html !== "string") { newOv[blockId] = html; continue; }
      const r = healHtml(html);
      newOv[blockId] = r.html;
      if (r.removed.length) report.push(`    ${blockId}: removed ${r.removed.join("; ")}`);
    }
    const bpRes = healBp(row.breakpoints);
    for (const r of bpRes.removed) report.push(`    breakpoints ${r}`);

    if (!report.length) { console.log(`  ${row.page_id}: nothing to heal`); continue; }
    changed++;
    console.log(`  ${row.page_id}:`);
    report.forEach((l) => console.log(l));

    if (APPLY) {
      const up = await fetch(
        `${base}/rest/v1/site_overrides?project=eq.${PROJECT}&page_id=eq.${encodeURIComponent(row.page_id)}`,
        { method: "PATCH", headers: { ...h, Prefer: "return=minimal" },
          body: JSON.stringify({ overrides: newOv, breakpoints: bpRes.bp }) }
      );
      console.log(up.ok ? "    → saved" : `    → SAVE FAILED HTTP ${up.status} ${await up.text()}`);
    }
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing written. ${changed} page(s) would change. Re-run with --apply to save.`);
    return;
  }
  console.log(`\nDone. ${changed} page(s) healed.`);

  if (process.argv.includes("--deploy") && process.env.DEPLOY_HOOK) {
    const d = await fetch(process.env.DEPLOY_HOOK, { method: "POST" });
    console.log(d.ok ? "Deploy hook fired — the site is rebuilding." : `Deploy hook failed: HTTP ${d.status}`);
  } else if (process.argv.includes("--deploy")) {
    console.log("No DEPLOY_HOOK in env — trigger a redeploy from the Vercel dashboard.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
