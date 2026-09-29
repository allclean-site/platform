/**
 * Невидимые символы в тексте собранного сайта.
 *
 * Их приносит вставка из Word и Google Docs: разделитель строк U+2028, нулевой пробел U+200B,
 * мягкий перенос U+00AD, BOM. Глазами их не видно, но они ломают поиск по тексту и выравнивание,
 * а U+2028 вдобавок является переводом строки для JavaScript — попав в inline-скрипт, он рвёт его.
 * На главной он стоял прямо в заголовке блока отзывов, из-за чего строка выглядела как «ЛЮДИ
 * ДОВЕРЯЮТ  4,7/5» с лишним отступом, и обычная замена по тексту по ней не срабатывала.
 *
 *   node scripts/build-site.mjs [edits.json] && node scripts/check-invisible.mjs
 * Ненулевой код возврата — есть находки.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === "__canvas" || n === "__cabinet") continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n === "index.html") pages.push(p);
  }
})(OUT);

const ИМЕНА = {
  "\u2028": "разделитель строк U+2028",
  "\u2029": "разделитель абзацев U+2029",
  "\u200b": "нулевой пробел U+200B",
  "\u200c": "несоединитель U+200C",
  "\u200e": "метка направления U+200E",
  "\u200f": "метка направления U+200F",
  "\ufeff": "BOM U+FEFF",
  "\u00ad": "мягкий перенос U+00AD",
  "\u2060": "склейка слов U+2060",
};
const ИСКОМЫЕ = new RegExp("[" + Object.keys(ИМЕНА).join("") + "]", "g");

const свод = {};
for (const p of pages) {
  const url = "/" + relative(OUT, dirname(p)).split("\\").join("/") + "/";
  const h = readFileSync(p, "utf8");
  let m;
  while ((m = ИСКОМЫЕ.exec(h))) {
    const имя = ИМЕНА[m[0]];
    const з = (свод[имя] ||= { n: 0, где: new Set(), пример: "" });
    з.n++; з.где.add(url);
    if (!з.пример) з.пример = h.slice(Math.max(0, m.index - 34), m.index + 34).replace(/\s+/g, " ");
  }
}

const списком = Object.entries(свод);
if (!списком.length) console.log(`[check-invisible] чисто: ${pages.length} страниц`);
else {
  for (const [имя, з] of списком) {
    console.log(`${имя}: ${з.n} шт на ${з.где.size} страницах`);
    console.log(`   «${з.пример.slice(0, 70)}»`);
    console.log(`   ${[...з.где].slice(0, 4).join(" ")}`);
  }
  process.exitCode = 1;
}
