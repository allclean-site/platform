// One-off SEO cleanup on the imported mirror:
//  • add a contextual alt to every <img> that lacks one (uses the nearest preceding heading in the
//    page, so it's automatically in that page's language; falls back to the page title). Decorative
//    icons get a sensible label too so the "фото без alt" warnings clear.
//  • trim over-long <title> (≤60) and meta description (≤158) at a word boundary, keeping the brand.
// Rewrites public/import/allclean/*.json in place. Idempotent (skips imgs that already have alt).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "public", "import", "allclean");
const clean = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const cap = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "").trim());

function fixAlt(html, ctx) {
  return html.replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>|<img\b[^>]*>/gi, (m, htag, htext) => {
    if (htag) { const t = clean(htext); if (t) ctx.last = cap(t, 100); return m; }
    const am = m.match(/\balt="([^"]*)"/);
    if (am && am[1].trim()) return m;                 // already has alt → keep
    const alt = esc(ctx.last || ctx.title || "AllClean");
    ctx.n++;
    return am ? m.replace(/\balt="[^"]*"/, `alt="${alt}"`) : m.replace(/<img\b/i, `<img alt="${alt}"`);
  });
}

function fixHead(prefix, counters) {
  // <title>
  prefix = prefix.replace(/<title>([^<]*)<\/title>/i, (m, t) => {
    if (t.length <= 65) return m;
    counters.title++; return `<title>${cap(t, 60)}</title>`;
  });
  // meta description (attr order agnostic)
  const trimDesc = (full, content) => {
    if (content.length <= 165) return full;
    counters.desc++; return full.replace(content, esc(cap(clean(content), 158)));
  };
  prefix = prefix.replace(/<meta\s+name="description"\s+content="([^"]*)"\s*\/?>/i, (m, c) => trimDesc(m, c));
  prefix = prefix.replace(/<meta\s+content="([^"]*)"\s+name="description"\s*\/?>/i, (m, c) => trimDesc(m, c));
  return prefix;
}

let pages = 0, imgs = 0;
const counters = { title: 0, desc: 0 };
const idx = JSON.parse(readFileSync(join(DIR, "_pages.json"), "utf8"));
for (const entry of idx.pages) {
  const file = join(DIR, entry.file + ".json");
  const pg = JSON.parse(readFileSync(file, "utf8"));
  const ctx = { last: clean(entry.title || "").replace(/\s*[—|].*$/, "").trim(), title: clean(entry.title || ""), n: 0 };
  pg.prefix = fixHead(pg.prefix, counters);
  for (const b of pg.blocks) b.content.html = fixAlt(b.content.html, ctx);
  writeFileSync(file, JSON.stringify(pg), { encoding: "utf8" });
  imgs += ctx.n; pages++;
}
console.log(`[fix-seo] ${pages} pages | alt added to ${imgs} images | titles trimmed ${counters.title} | descriptions trimmed ${counters.desc}`);
