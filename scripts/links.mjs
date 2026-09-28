/**
 * Ссылки собранного сайта: ведут ли они туда, куда написано.
 *
 *   чужая локаль        — румынская страница уводит в русскую версию (или наоборот). Так после
 *                         переноса румынского в корень 15 из 19 румынских страниц отправляли
 *                         посетителя на `/ru/…`: кнопка записи, цены, «о нас», все карточки услуг.
 *   битая ссылка        — адреса нет среди собранных страниц.
 *   переключатель мимо  — «RU» на румынской странице ведёт не на её русскую пару, а куда-то ещё.
 *   пустая ссылка       — href="#", пустой или javascript:.
 *   ссылка без текста   — нечего прочитать вслух и не на что нажать осмысленно.
 *
 * Разбор без браузера: ссылки видны в разметке.
 *   node scripts/build-site.mjs [edits.json] && node scripts/links.mjs
 * Ненулевой код возврата — есть находки.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");

const pages = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === "__canvas") continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n === "index.html") pages.push(p);
  }
})(OUT);

const url = (p) => { const r = relative(OUT, dirname(p)).split("\\").join("/"); return r ? "/" + r + "/" : "/"; };
const known = new Set(pages.map(url));
const norm = (h) => { const clean = h.split("#")[0].split("?")[0]; return clean.endsWith("/") ? clean : clean + "/"; };
const ruOf = (u) => (u === "/" ? "/ru/" : "/ru" + u);
const нутро = (tag, html, i) => { const close = html.indexOf("</a>", i); return close < 0 ? "" : html.slice(i + tag.length, close); };
const текст = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
// Имя ссылки для читалки: свой текст, либо подпись, либо alt картинки внутри.
const имя = (attrs, inner) => текст(inner)
  || (attrs.match(/aria-label="([^"]+)"/i) || [])[1]
  || (attrs.match(/title="([^"]+)"/i) || [])[1]
  || (inner.match(/<img[^>]*\balt="([^"]+)"/i) || [])[1]
  || "";

const находки = [];
for (const p of pages) {
  const здесь = url(p), это_ru = здесь === "/ru/" || здесь.startsWith("/ru/");
  // Скрипты и стили выбрасываем: в них `<a.length` и прочий код, который выглядит как тег ссылки.
  const html = readFileSync(p, "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  const re = /<a\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const href = (attrs.match(/href="([^"]*)"/i) || [])[1];
    const переключатель = /\blang-toggle\b/.test(attrs);
    const ярлык = имя(attrs, нутро(m[0], html, m.index));
    const add = (вид, что) => находки.push({ где: здесь, вид, что, ссылка: (href || "") + (ярлык ? " «" + ярлык.slice(0, 34) + "»" : "") });

    if (href === undefined) { if (!/\bname=|\bid=/.test(attrs)) add("якорь без href", m[0].slice(0, 60)); continue; }
    // `href="#"` у кнопки отправки заявки — разметка шаблона: это не ссылка, а кнопка формы,
    // переход отменяется и роль выставляется на загрузке (FORM_FIX). Любой другой «#» — заглушка.
    if (!href.trim() || href === "#" || /^javascript:/i.test(href)) {
      if (!/data-lgcms-submit/.test(attrs)) add("пустая ссылка", href || "(пусто)");
      continue;
    }
    // Ссылку без имени здесь не ищем: карточкам и иконкам соцсетей имя проставляет NAME_FIX уже в
    // браузере, а этот разбор читает статику. Эта проверка живёт в scripts/studio.mjs.
    if (!href.startsWith("/")) continue;                                  // внешние и tel:/mailto: — не здесь

    const цель = norm(href);
    if (!known.has(цель)) { add("битая ссылка", цель); continue; }
    if (переключатель) {
      const ждём = это_ru ? (здесь === "/ru/" ? "/" : здесь.slice(3)) : ruOf(здесь);
      if (цель !== ждём) add("переключатель мимо", цель + " вместо " + ждём);
      continue;
    }
    const цель_ru = цель === "/ru/" || цель.startsWith("/ru/");
    if (цель_ru !== это_ru) add("чужая локаль", цель);
  }
}

const по_видам = {};
for (const f of находки) (по_видам[f.вид] ||= []).push(f);
if (!находки.length) console.log(`[links] чисто: ${pages.length} страниц, ${known.size} адресов`);
else {
  for (const [вид, список] of Object.entries(по_видам)) {
    console.log(`\n${вид}: ${список.length}`);
    const видел = new Set();
    for (const f of список) {
      const k = f.вид + f.ссылка;
      if (видел.has(k)) continue;
      видел.add(k);
      console.log(`  ${f.где}  ${f.ссылка}  ${f.что}`);
      if (видел.size > 24) { console.log("  …"); break; }
    }
  }
  process.exitCode = 1;
}
