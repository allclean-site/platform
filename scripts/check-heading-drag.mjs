/**
 * Тянется ли КАЖДЫЙ заголовок.
 *
 * В регрессе такая проба уже есть, но она берёт по три заголовка со страницы — и именно поэтому
 * мимо неё прошёл заголовок калькулятора, который клиент тянул, а он не двигался: обёртка у
 * шаблона ограничена шестью колонками, и ширина в неё не помещалась. Здесь проба идёт по ВСЕМ
 * заголовкам всех двойников холста: ставим тот же слой правок, что пишет редактор, и смотрим,
 * выросла ли коробка. Не выросла — клиент потянет и ничего не произойдёт.
 *
 *   node scripts/build-site.mjs && node scripts/regress.mjs && node scripts/check-heading-drag.mjs
 * затем открыть /__heading-drag.html — итог в window.__DRAG.
 */
import { readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";


const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
// Правила должны генерироваться РОВНО так, как их пишет редактор, поэтому страница получает
// сам рендер-кор (без export) — тот же приём, что в регрессе.
const CORE_INLINE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "editor", "renderCore.js"), "utf8").replace(/^export\s+/gm, "");
const twins = readdirSync(join(OUT, "__canvas")).filter((n) => n.endsWith(".html")).map((n) => "/__canvas/" + n);

const PAGE = `<!doctype html><meta charset="utf-8"><title>heading drag</title>
<style>body{font:13px/1.4 ui-monospace,monospace;margin:0;background:#111;color:#ddd}
iframe{border:0;display:block}#log{padding:8px;white-space:pre-wrap}</style>
<div id="log">готовлю…</div><iframe id="f"></iframe>
<script>
${CORE_INLINE}
const НОВАЯ_СТРОКА = String.fromCharCode(10);
let проверено = 0;
const TWINS = ${JSON.stringify(twins)}, out = [], log = document.getElementById("log"), f = document.getElementById("f");
// Идентификаторы элементам проставляет РУНТАЙМ редактора, в двойнике их ещё нет — ставим той же
// функцией ядра, иначе проба молча не найдёт ни одного кандидата и отрапортует «чисто».
function stampAll(doc) {
  for (const w of doc.querySelectorAll("[data-lg-block]")) stampIds(w, w.getAttribute("data-lg-block"));
}
function probe(doc, twin) {
  const bad = [];
  const cands = [...doc.querySelectorAll("h1,h2,h3")].filter((e) => {
    if (e.querySelector("h1,h2,h3")) return false;
    if (!e.getAttribute("data-lg-id")) return false;
    const cs = doc.defaultView.getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = e.getBoundingClientRect();
    // Заголовок, который и так занимает почти всю полосу, тянуть некуда — это не поломка.
    return r.width > 120 && r.height > 10 && r.width < doc.documentElement.clientWidth - 200;
  });
  проверено += cands.length;
  for (const el of cands) {
    const id = el.getAttribute("data-lg-id");
    const w0 = el.getBoundingClientRect().width;
    const base = {}; base[id] = { width: Math.round(w0 + 150) + "px", "max-width": "100%", "min-width": "0", "flex-shrink": "0" };
    // Редактор пишет правку В ДВА МЕСТА сразу: правилом по идентификатору И inline-стилем
    // (setStyleProp). Проба без inline врёт: правила сайта, которые смотрят на inline-пин,
    // просто не срабатывают, и половина заголовков ложно числится «не тянется».
    const был = el.getAttribute("style") || "";
    el.style.setProperty("width", Math.round(w0 + 150) + "px");
    el.style.setProperty("min-width", "0", "important");
    el.style.setProperty("flex-shrink", "0", "important");
    const st = doc.createElement("style");
    st.textContent = overridesCss({ base, tablet: {}, mobile: {}, hover: {}, active: {} });
    doc.head.appendChild(st);
    const w1 = el.getBoundingClientRect().width;
    st.remove();
    if (был) el.setAttribute("style", был); else el.removeAttribute("style");
    if (w1 - w0 < 100) bad.push({ twin, id, тег: el.tagName, w0: Math.round(w0), w1: Math.round(w1),
      текст: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 34) });
  }
  return bad;
}
(async () => {
  f.style.width = "1280px"; f.style.height = "900px";
  for (let i = 0; i < TWINS.length; i++) {
    log.textContent = (i + 1) + "/" + TWINS.length + "  " + TWINS[i] + "  не тянется: " + out.length;
    await new Promise((r) => { f.onload = r; f.src = TWINS[i] + "?r=" + Date.now(); });
    const doc = f.contentDocument;
    try { if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 500))]); } catch (e) {}
    stampAll(doc);
    try { out.push(...probe(doc, TWINS[i])); } catch (e) { out.push({ twin: TWINS[i], ошибка: String(e).slice(0, 70) }); }
  }
  window.__DRAG = out; window.__ПРОВЕРЕНО = проверено;
  log.textContent = "ГОТОВО. проверено заголовков: " + проверено + ", не тянется: " + out.length + (out.length ? НОВАЯ_СТРОКА + out.map((b) => b.twin + "  " + b.тег + " " + b.id + "  " + b.w0 + "→" + b.w1 + "  «" + b.текст + "»").join(НОВАЯ_СТРОКА) : "");
})();
</script>`;
writeFileSync(join(OUT, "__heading-drag.html"), PAGE);
console.log("проба готова:", twins.length, "двойников → out/__heading-drag.html");
