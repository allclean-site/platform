/**
 * Чужой язык в тексте собранного сайта — следы шаблона, которые не видит ни regress, ни studio.
 *
 * Вёрстка при этом целая, придраться не к чему: на русской странице «О нас» стояло
 * «We’ve earned loyalty across Manhattan, Brooklyn & Queens», а на странице записи — девять
 * английских отзывов, подписанных «Отзыв в Google», причём один из них хвалил Miss Sparkle,
 * вымышленную компанию из исходного шаблона.
 *
 *   латиница на русской  — слово латиницей в видимом тексте страницы /ru/ (кроме брендов);
 *   английское слово     — служебное английское слово на румынской странице;
 *   имя шаблона          — название и география компании, с которой снят шаблон.
 *
 *   node scripts/build-site.mjs [edits.json] && node scripts/text.mjs
 * Ненулевой код возврата — есть находки.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

// Имена, адреса и сокращения, которые латиницей и должны быть.
const БРЕНДЫ = new RegExp("^(" + [
  "AllClean", "All", "Clean", "Google", "WhatsApp", "Viber", "Telegram", "Facebook", "Instagram",
  "LinkedIn", "YouTube", "TikTok", "Webflow", "Vercel", "Supabase", "Etalbond", "IBAN", "SRL",
  "IDNO", "MDL", "MD", "PDF", "HTML", "CSS", "FAQ", "SEO", "CRM", "GDPR", "www", "com", "md", "ru",
  "ro", "info", "mail", "tel", "http", "https", "svg", "png", "jpg", "webp", "avif",
  // Юридические страницы: названия браузеров, служб и оператора пишутся латиницей и в русском тексте.
  "cookie", "cookies", "Chrome", "Firefox", "Safari", "Edge", "Opera", "Analytics", "Application",
  "LeadGenium", "IVAN", "LACHE", "centru", "datepersonale", "Telegram", "Supabase", "Vercel",
].join("|") + ")$", "i");

// Служебные английские слова: в румынском тексте их быть не может.
// «Slide 3 of 10» сюда не входит: это подпись Webflow к точкам слайдера, которые на этом сайте
// спрятаны классом `hide`, и ставит её собственный скрипт шаблона — в разметке её нет.
const АНГЛИЙСКИЕ = /\b(the|and|with|your|you|they|we|our|from|that|this|have|been|about|every|other|into|after|feels|like|bring|everything|clear|inside|finish|earned|loyalty|invite)\b/i;

const ШАБЛОН = /\b(Miss Sparkle|Manhattan|Brooklyn|Queens|Lorem ipsum|John Doe|Jane Doe|example\.com|Your Company|Company Name)\b/i;

const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === "__canvas") continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n === "index.html") pages.push(p);
  }
})(OUT);
pages.sort();

const находки = [];
for (const p of pages) {
  const rel = relative(OUT, dirname(p)).split("\\").join("/");
  const url = rel ? "/" + rel + "/" : "/";
  const ru = url === "/ru/" || url.startsWith("/ru/");
  const видимый = readFileSync(p, "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<head\b[\s\S]*?<\/head>/i, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ");
  const строки = видимый.split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);

  const было = new Set();
  for (const s of строки) {
    const добавить = (вид, что) => { const k = вид + что; if (было.has(k)) return; было.add(k); находки.push({ url, вид, что }); };
    const ш = s.match(ШАБЛОН);
    if (ш) добавить("имя шаблона", ш[0] + "  «" + s.slice(0, 70) + "»");
    if (ru) {
      const чужие = (s.match(/[A-Za-z][A-Za-z’']{2,}/g) || []).filter((w) => !БРЕНДЫ.test(w));
      if (чужие.length >= 2) добавить("латиница на русской", чужие.slice(0, 5).join(" ") + "  «" + s.slice(0, 70) + "»");
    } else {
      const a = s.match(АНГЛИЙСКИЕ);
      if (a && !/^[A-ZȘȚĂÎÂ\s\d.,!?«»„”-]+$/.test(s)) добавить("английское слово", a[0] + "  «" + s.slice(0, 70) + "»");
    }
  }
}

if (!находки.length) console.log(`[text] чисто: ${pages.length} страниц`);
else {
  const по = {};
  for (const f of находки) (по[f.вид] ||= []).push(f);
  for (const [вид, список] of Object.entries(по)) {
    console.log(`\n${вид}: ${список.length}`);
    for (const f of список.slice(0, 20)) console.log(`  ${f.url}  ${f.что}`);
    if (список.length > 20) console.log("  …");
  }
  process.exitCode = 1;
}
