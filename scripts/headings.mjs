/**
 * Логика заголовков на собранном сайте — то, чего не видят regress и studio.
 *
 * Обе прошлые проверки смотрят на ПИКСЕЛИ: вылезло, наехало, мелко. Заголовки ломаются иначе —
 * визуально всё в порядке, а структура страницы для читалки с экрана и для поисковика рассыпана:
 *
 *   нет h1 / несколько h1 — у страницы должен быть ровно один главный заголовок;
 *   перескок уровней      — после h2 сразу h4: в оглавлении появляется дыра;
 *   секция без заголовка  — большой блок текста, к которому нечего отнести;
 *   пустой заголовок      — тег есть, текста нет.
 *
 * Считаем только ВИДИМЫЕ заголовки: в шаблоне лежат запасные варианты с display:none, и для
 * читалки с экрана их нет. Поэтому проверка живёт в браузере, а не в регулярках.
 *
 *   node scripts/build-site.mjs [edits.json] && node scripts/headings.mjs
 * затем открыть /__headings.html — итог копится в window.__HEADINGS.
 * Сборка чистит out/, поэтому страницу надо пересоздавать после каждой сборки.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const u = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    if (n === "__canvas" || n === "__cabinet") continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n === "index.html") { const r = relative(OUT, dirname(p)).split("\\").join("/"); u.push(r ? "/" + r + "/" : "/"); }
  }
})(OUT);
u.sort();

const PAGE = `<!doctype html><meta charset="utf-8"><title>заголовки</title>
<style>body{font:13px/1.45 ui-monospace,monospace;margin:0;background:#111;color:#ddd}
iframe{border:0;position:fixed;left:0;top:0;visibility:hidden}#log{padding:8px;white-space:pre-wrap}</style>
<div id="log">проверяю…</div><iframe id="f"></iframe>
<script>window.__URLS=${JSON.stringify(u)};</script>
<script>
const URLS = window.__URLS, out = [], outline = {};
const vis = (w, el) => { const s = w.getComputedStyle(el);
  return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.01 && el.getBoundingClientRect().height > 1; };
const txt = (el) => (el.textContent || "").replace(/\\s+/g, " ").trim();
const sel = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim()
  ? "." + el.className.trim().split(" ").filter(Boolean).slice(0, 2).join(".") : "");

function audit(w, d, url) {
  const push = (вид, что, где) => out.push({ url, вид, что, где: String(где || "").slice(0, 90) });
  const все = [...d.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  const видимые = [];
  for (const h of все) {
    const t = txt(h);
    if (!vis(w, h)) continue;
    if (!t) { push("пустой заголовок", sel(h), h.parentElement ? sel(h.parentElement) : ""); continue; }
    видимые.push({ lvl: +h.tagName[1], t, el: h });
  }
  outline[url] = видимые.map((h) => "h" + h.lvl + " " + h.t.slice(0, 64));

  const h1 = видимые.filter((h) => h.lvl === 1);
  if (h1.length === 0) push("нет h1", "заголовков всего: " + видимые.length, видимые[0] ? "первый — h" + видимые[0].lvl + " «" + видимые[0].t.slice(0, 40) + "»" : "");
  if (h1.length > 1) push("несколько h1", h1.length, h1.map((h) => "«" + h.t.slice(0, 26) + "»").join(" + "));

  let prev = 0;
  for (const h of видимые) {
    if (prev && h.lvl > prev + 1) push("перескок уровней", "h" + prev + " → h" + h.lvl, "«" + h.t.slice(0, 50) + "»");
    prev = h.lvl;
  }

  for (const s of d.querySelectorAll("section")) {
    if (!vis(w, s)) continue;
    if (s.querySelector("section")) continue;                       // считаем самую внутреннюю секцию
    if ([...s.querySelectorAll("h1,h2,h3,h4,h5,h6")].some((h) => vis(w, h) && txt(h))) continue;
    const t = txt(s);
    if (t.length < 90) continue;                                    // полоска, подвал-мелочь — не в счёт
    push("секция без заголовка", t.length + " знаков", sel(s) + " «" + t.slice(0, 46) + "»");
  }
  return видимые.length;
}

(async function () {
  const f = document.getElementById("f"), log = document.getElementById("log");
  f.style.width = "1440px"; f.style.height = "900px";
  for (const url of URLS) {
    log.textContent = url + " … найдено " + out.length;
    await new Promise((res) => { f.onload = res; f.src = url; });
    await new Promise((r) => setTimeout(r, 260));
    try { audit(f.contentWindow, f.contentDocument, url); }
    catch (e) { out.push({ url, вид: "ошибка замера", что: String(e).slice(0, 90), где: "" }); }
  }
  window.__HEADINGS = out; window.__OUTLINE = outline;
  const by = {}; for (const r of out) (by[r.вид] ||= []).push(r);
  log.textContent = "ГОТОВО. " + (Object.keys(by).length
    ? Object.entries(by).map(([k, v]) => k + ": " + v.length).join(" | ") + "\\n\\n" +
      out.map((r) => r.url + "  " + r.вид + "  " + r.что + "  " + r.где).join("\\n")
    : "чисто");
})();
</script>`;

writeFileSync(join(OUT, "__headings.html"), PAGE);
console.log("проверка заголовков готова:", u.length, "страниц → out/__headings.html");
