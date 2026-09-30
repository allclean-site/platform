/**
 * Тянется ли КАЖДЫЙ текст — настоящей ручкой, в настоящем холсте, на каждом устройстве.
 *
 * Прежняя проба ставила ширину сама, мимо логики редактора, и на одном десктопе. Поэтому она
 * не видела, что ручка упирается в предел, который считает сам редактор: заголовок героя на
 * планшете «упирался» в 336px при колонке 691px — клиент тянул, и ничего не происходило.
 *
 * Здесь страницы кабинета (out/__cabinet, их строит check-canvas-fidelity.mjs тем же кодом,
 * что кабинет, со скриптом холста). Для каждого текстового элемента: выбрать щелчком, потянуть
 * правую ручку на 80px, замерить, вернуть. Не вырос — находка, если справа есть место:
 * до края экрана и до края ближайшей коробки, чья ширина от этого элемента не зависит.
 *
 *   node scripts/build-site.mjs && node scripts/check-canvas-fidelity.mjs && node scripts/check-heading-drag.mjs
 * затем открыть /__heading-drag.html — итог в window.__DRAG, `window.__DRAG_OK`.
 */
import { readdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const IMPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "import", "allclean");
if (!existsSync(join(OUT, "__cabinet"))) { console.error("нет out/__cabinet — сначала node scripts/check-canvas-fidelity.mjs"); process.exit(1); }
const edits = JSON.parse(readFileSync(join(OUT, "__edits.json"), "utf8"));
const idx = JSON.parse(readFileSync(join(IMPORT, "_pages.json"), "utf8"));
const есть = new Set(readdirSync(join(OUT, "__cabinet")));
const PAGES = idx.pages
  .map((e) => ({ src: "/__cabinet/" + e.file.replace(/\//g, "__") + ".html", bp: edits.breakpoints?.[e.id] || null }))
  .filter((p) => есть.has(p.src.slice("/__cabinet/".length)));

const PAGE = `<!doctype html><meta charset="utf-8"><title>heading drag</title>
<style>body{font:13px/1.4 ui-monospace,monospace;margin:0;background:#111;color:#ddd}
iframe{border:0;display:block;position:absolute;left:-10000px;top:0;height:1000px}#log{padding:8px;white-space:pre-wrap}</style>
<div id="log">готовлю…</div><iframe id="f"></iframe>
<script>
const PAGES = ${JSON.stringify(PAGES)};
const DEVICES = [["desktop", 1440], ["tablet", 834], ["mobile", 390]];
const DX = 80, SEL = "h1,h2,h3,h4,h5,h6,p,[class*=heading-style]";
const out = [], log = document.getElementById("log"), f = document.getElementById("f");
window.__DRAG = out;   // видно по ходу прогона
let проверено = 0, готов = null;
window.addEventListener("message", (e) => { if (e.source === f.contentWindow && e.data && e.data.type === "lg-ready" && готов) готов(true); });

function ev(w, type, x, y) {
  const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: w, pointerId: 1, isPrimary: true, button: 0 };
  return new (type.startsWith("pointer") ? w.PointerEvent : w.MouseEvent)(type, o);
}
function tap(w, el) {
  const r = el.getBoundingClientRect(), x = r.left + Math.min(12, r.width / 2), y = r.top + Math.min(10, r.height / 2);
  for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) el.dispatchEvent(ev(w, t, x, y));
}
function drag(w, handle, dx) {
  const r = handle.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  handle.dispatchEvent(ev(w, "pointerdown", x, y));
  for (let i = 1; i <= 8; i++) w.dispatchEvent(ev(w, "pointermove", x + dx * i / 8, y));
  w.dispatchEvent(ev(w, "pointerup", x + dx, y));
}
/** На сколько человек вправе ждать роста: до ширины КОЛОНКИ (ближайший предок, рядом с которым в
 *  строке стоит сосед; сам текст рядом с соседом — сколько соседи оставили) и до края экрана.
 *  Это правило жеста, записанное независимо: проверка ловит, что ручка им не пользуется. */
function рядом(doc, n) {
  const w = doc.defaultView, p = n.parentElement; if (!p) return false;
  const r = n.getBoundingClientRect();
  return [...p.children].some((c) => {
    if (c === n) return false;
    const cs = w.getComputedStyle(c);
    if (cs.display === "none" || cs.position === "absolute" || cs.position === "fixed") return false;
    const q = c.getBoundingClientRect();
    return q.width >= 2 && q.height >= 2 && q.top < r.bottom - 1 && r.top < q.bottom - 1 && (q.right <= r.left + 1 || q.left >= r.right - 1);
  });
}
function внутри(doc, n) {
  const cs = doc.defaultView.getComputedStyle(n);
  return n.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
    - (parseFloat(cs.borderLeftWidth) || 0) - (parseFloat(cs.borderRightWidth) || 0);
}
function место(doc, el) {
  const r = el.getBoundingClientRect(), vw = doc.documentElement.clientWidth;
  let предел = vw - Math.max(0, r.left) - 6;
  if (рядом(doc, el)) {
    const p = el.parentElement;
    const занято = [...p.children].filter((c) => c !== el).map((c) => c.getBoundingClientRect())
      .filter((q) => q.width > 1 && q.top < r.bottom - 1 && r.top < q.bottom - 1).reduce((s, q) => s + q.width, 0);
    предел = Math.min(предел, внутри(doc, p) - занято - (parseFloat(doc.defaultView.getComputedStyle(p).columnGap) || 0));
  } else {
    // Граница: колонка рядом с соседом или контейнер страницы; поля обёрток до неё — не место.
    let поля = 0;
    for (let n = el.parentElement, k = 0; n && n !== doc.body && k < 12; n = n.parentElement, k++) {
      const кл = typeof n.className === "string" ? n.className : "";
      if (рядом(doc, n) || /^(SECTION|MAIN|HEADER|FOOTER|NAV|ARTICLE)$/.test(n.tagName) ||
          /(^|\\s)(w-container|container-[a-z0-9-]+|padding-global)(\\s|$)/.test(кл)) {
        предел = Math.min(предел, внутри(doc, n) - поля); break;
      }
      const cs = doc.defaultView.getComputedStyle(n);
      поля += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    }
  }
  return Math.round(предел - r.width);
}
function кандидаты(doc) {
  const w = doc.defaultView;
  return [...doc.querySelectorAll(SEL)].filter((e) => {
    if (!e.getAttribute("data-lg-id") || !e.isContentEditable) return false;
    if (e.parentElement && e.parentElement.closest(SEL) && e.parentElement.closest(SEL).isContentEditable) return false;
    const cs = w.getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") return false;
    const r = e.getBoundingClientRect();
    return r.width > 40 && r.height > 8 && r.left >= 0 && r.right <= doc.documentElement.clientWidth;
  });
}

(async () => {
  for (let i = 0; i < PAGES.length; i++) {
    for (const [dev, width] of DEVICES) {
      log.textContent = (i + 1) + "/" + PAGES.length + " " + dev + "  " + PAGES[i].src + "  не тянется: " + out.length;
      f.style.width = width + "px";
      const сигнал = new Promise((res) => { готов = res; setTimeout(() => res(false), 8000); });
      await new Promise((r) => { f.onload = r; f.src = PAGES[i].src + "?r=" + Date.now(); });
      if (!(await сигнал)) { out.push({ page: PAGES[i].src, dev, ошибка: "скрипт холста не запустился" }); continue; }
      const w = f.contentWindow, doc = f.contentDocument;
      w.postMessage({ type: "lg-bp-init", rules: PAGES[i].bp || { base: {}, tablet: {}, mobile: {}, hover: {}, active: {} } }, "*");
      w.postMessage({ type: "lg-device", breakpoint: dev }, "*");
      await new Promise((r) => setTimeout(r, 150));
      for (const el of кандидаты(doc)) {
        const w0 = el.getBoundingClientRect().width, space = место(doc, el);
        tap(w, el);
        const h = doc.querySelector(".lg-rh--e");
        if (!el.classList.contains("lg-selected") || !h) continue;          // не выбирается — не про ширину
        проверено++;
        const снимок = []; for (let n = el; n && n !== doc.documentElement; n = n.parentElement) снимок.push([n, n.getAttribute("style")]);
        const sec = el.closest("section,header,footer") || doc.body, s0 = sec.getBoundingClientRect().width;
        drag(w, h, DX);
        const w1 = el.getBoundingClientRect().width, s1 = sec.getBoundingClientRect().width;
        if (Math.abs(s1 - s0) > 1) out.push({ page: PAGES[i].src, dev, id: el.getAttribute("data-lg-id"), тег: el.tagName,
          w0: Math.round(w0), w1: Math.round(w1), место: space, секция: Math.round(s0) + "→" + Math.round(s1),
          текст: "СЕКЦИЯ ИЗМЕНИЛА ШИРИНУ: " + (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 20) });
        const ждали = Math.min(DX, Math.max(0, space));
        if (ждали >= 20 && w1 - w0 < ждали / 2) out.push({ page: PAGES[i].src, dev, id: el.getAttribute("data-lg-id"),
          тег: el.tagName, w0: Math.round(w0), w1: Math.round(w1), место: space,
          текст: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 34) });
        // Вернуть как было — целиком: встроенные стили текста и всех его предков и правила устройств
        // (lg-bp-init — тем же сообщением откат делает сам редактор). Иначе прошлые жесты меняют
        // раскладку для следующих, и проба ловит собственный след.
        for (const [n, st] of снимок) { if (st == null) n.removeAttribute("style"); else n.setAttribute("style", st); }
        w.postMessage({ type: "lg-bp-init", rules: PAGES[i].bp || { base: {}, tablet: {}, mobile: {}, hover: {}, active: {} } }, "*");
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }
  window.__DRAG = out; window.__ПРОВЕРЕНО = проверено; window.__DRAG_OK = out.length === 0;
  log.textContent = (out.length ? "НЕ ТЯНЕТСЯ: " + out.length : "ЧИСТО") + ". проверено элементов: " + проверено +
    (out.length ? String.fromCharCode(10) + out.map((b) => b.page + " " + b.dev + "  " + (b.ошибка || (b.тег + " " + b.id + "  " + b.w0 + "→" + b.w1 + " (место " + b.место + ")  «" + b.текст + "»"))).join(String.fromCharCode(10)) : "");
})();
</script>`;
writeFileSync(join(OUT, "__heading-drag.html"), PAGE);
console.log("проба готова:", PAGES.length, "страниц кабинета × 3 устройства → out/__heading-drag.html");
