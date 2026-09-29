/**
 * Холст против сайта: где редактор показывает НЕ то, что увидит посетитель.
 *
 * Страница холста строится ТЕМ ЖЕ кодом, что в кабинете: canvasPage (слои правок, общая шапка
 * и подвал, правила фото, карточки блога) → previewDoc в режиме правки, со скриптом холста.
 * Правки — опубликованные, ровно те, из которых собран сайт (out/__edits.json кладёт сборка).
 * Раньше сверка брала «двойник» из regress.mjs, который собирал страницу сам и без скрипта холста:
 * 0 расхождений на 4040 узлах, пока кабинет показывал зеркало вместо сайта.
 *
 * Сравниваются размеры, кегль, картинка и ТЕКСТ каждого узла. Холст, чей скрипт не прислал
 * lg-ready, — отдельная находка: без него правки не доезжают и редактировать нечего.
 *
 * Обе страницы открываются на ОДНОЙ ширине. В холсте каждый блок обёрнут маркером
 * `div[data-lg-block]` с `display:contents` — коробки у него нет, на вёрстку он не влияет,
 * но в дереве он есть и ломает сопоставление. Поэтому перед замером обёртки РАЗВОРАЧИВАЕМ:
 * после этого деревья совпадают узел в узел и элементы сравниваются по одному пути.
 *
 *   node scripts/build-site.mjs && node scripts/check-canvas-fidelity.mjs
 * затем открыть /__fidelity.html — итог в window.__FIDELITY, `window.__FIDELITY_OK` = true/false.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCabinet } from "./cabinet-bundle.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const IMPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "import", "allclean");

const editsPath = process.argv[2] || join(OUT, "__edits.json");
if (!existsSync(editsPath)) { console.error("нет " + editsPath + " — сначала node scripts/build-site.mjs"); process.exit(1); }
const C = await loadCabinet();
const edits = JSON.parse(readFileSync(editsPath, "utf8"));
const pub = C.canonicalizeOverrides(edits.overrides || {});
const cardsPath = join(OUT, "__blog-cards.json");
const cards = existsSync(cardsPath) ? JSON.parse(readFileSync(cardsPath, "utf8")) : {};
const rules = C.decodeMedia(C.mergeOverrideLayers(pub[C.MEDIA_KEY])[C.MEDIA_KEY]);

const idx = JSON.parse(readFileSync(join(IMPORT, "_pages.json"), "utf8"));
mkdirSync(join(OUT, "__cabinet"), { recursive: true });
const работа = [];
for (const e of idx.pages) {
  const p = JSON.parse(readFileSync(join(IMPORT, e.file + ".json"), "utf8"));
  // Как SiteEditor.loadPage: опубликованный слой (черновика и локального слоя у проверки нет).
  const ov = C.pageOverrides(p, C.mergeOverrideLayers(pub[p.id]), C.mergeOverrideLayers(pub[C.sharedKey(p.lang)]));
  const карточки = (p.slug === "/blog" && cards.ro) || (p.slug === "/ru/blog" && cards.ru) || [];
  const doc = C.previewDoc({ ...p, blocks: C.canvasBlocks(p, ov, rules, карточки) }, true);
  // Холст берёт файлы сайта из /site-assets/ кабинета; здесь их отдаёт сама сборка из корня.
  const name = e.file.replace(/\//g, "__") + ".html";
  writeFileSync(join(OUT, "__cabinet", name), C.toCanonical(doc), "utf8");
  работа.push({
    url: e.slug === "/" ? "/" : "/" + e.slug.replace(/^\/|\/$/g, "") + "/",
    twin: "/__cabinet/" + name,
    bp: edits.breakpoints?.[p.id] || null,
  });
}

const PAGE = `<!doctype html><meta charset="utf-8"><title>canvas fidelity</title>
<style>body{font:13px/1.45 ui-monospace,monospace;margin:0;background:#111;color:#ddd}
iframe{border:0;display:block;position:absolute;left:-10000px;top:0}#log{padding:8px;white-space:pre-wrap}</style>
<div id="log">готовлю…</div><iframe id="a"></iframe><iframe id="b"></iframe>
<script>window.__PAIRS=${JSON.stringify(работа)};</script>
<script>
const PAIRS = window.__PAIRS, out = [], log = document.getElementById("log");
const a = document.getElementById("a"), b = document.getElementById("b");
const WIDTH = 1440;

/** Маркер блока коробки не имеет — разворачиваем, чтобы деревья совпали узел в узел. */
function развернуть(doc) {
  let n = 0;
  for (const w of [...doc.querySelectorAll("[data-lg-block]")]) {
    const p = w.parentNode; if (!p) continue;
    while (w.firstChild) p.insertBefore(w.firstChild, w);
    p.removeChild(w); n++;
  }
  return n;
}

/** Путь узла от body: на каждом уровне номер среди братьев того же тега. */
function путь(el, root) {
  const части = [];
  for (let n = el; n && n !== root && n.parentElement; n = n.parentElement) {
    const свои = [...n.parentElement.children].filter((c) => c.tagName === n.tagName);
    части.unshift(n.tagName + (свои.length > 1 ? "[" + свои.indexOf(n) + "]" : ""));
  }
  return части.join(">");
}

const ИНТЕРЕС = "h1,h2,h3,p,img,video,section,[class*=card_],a";

function снять(doc) {
  const карта = new Map(), root = doc.body;
  for (const el of doc.querySelectorAll(ИНТЕРЕС)) {
    const s = doc.defaultView.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden") continue;
    // Размер вёрстки, а не кадра анимации: Webflow держит карточки в scale(0.9), пока они не
    // въедут в экран, а кадры сверки стоят за экраном — getBoundingClientRect мерил бы этот кадр.
    const r = { width: el.offsetWidth, height: el.offsetHeight };
    if (r.width < 2 && r.height < 2) continue;
    карта.set(путь(el, root), {
      тег: el.tagName, кл: (el.className || "").toString().split(" ").slice(0, 2).join("."),
      w: Math.round(r.width), h: Math.round(r.height),
      fs: Math.round(parseFloat(s.fontSize) || 0),
      src: (el.currentSrc || el.src || "").split("/").pop().slice(0, 40),
      текст: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 28),
    });
  }
  return карта;
}

const загрузить = (frame, src) => new Promise((res) => { frame.onload = res; frame.src = src; });

/** Скрипт холста сообщает о готовности так же, как в кабинете. Нет сигнала — он не запустился. */
let готов = null;
window.addEventListener("message", (e) => { if (e.source === b.contentWindow && e.data && e.data.type === "lg-ready" && готов) готов(true); });
const ждатьХолст = () => new Promise((res) => { готов = res; setTimeout(() => res(false), 8000); });

(async () => {
  for (const f of [a, b]) { f.style.width = WIDTH + "px"; f.style.height = "900px"; }
  for (let i = 0; i < PAIRS.length; i++) {
    const { url, twin } = PAIRS[i];
    log.textContent = (i + 1) + "/" + PAIRS.length + "  " + url + "  расхождений: " + out.filter((r) => r.вид !== "сверено").length;
    const { bp } = PAIRS[i];
    await загрузить(a, url + "?f=" + Date.now());
    const сигнал = ждатьХолст();
    await загрузить(b, twin + "?f=" + Date.now());
    if (!(await сигнал)) { out.push({ url, вид: "скрипт холста не запустился" }); continue; }
    // Как SiteEditor на lg-ready: правила размеров страницы и текущее устройство.
    b.contentWindow.postMessage({ type: "lg-bp-init", rules: bp || { base: {}, tablet: {}, mobile: {}, hover: {}, active: {} } }, "*");
    b.contentWindow.postMessage({ type: "lg-device", breakpoint: "desktop" }, "*");
    const da = a.contentDocument, db = b.contentDocument;
    for (const d of [da, db]) { try { if (d.fonts && d.fonts.ready) await Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 700))]); } catch (e) {} }
    await new Promise((r) => setTimeout(r, 250));
    const развёрнуто = развернуть(db);
    await new Promise((r) => setTimeout(r, 60));
    const сайт = снять(da), холст = снять(db);
    let общих = 0;
    for (const [k, s] of сайт) {
      const c = холст.get(k);
      if (!c) { if (s.w > 40 && s.h > 20) out.push({ url, вид: "нет в холсте", k, сайт: s }); continue; }
      общих++;
      const dw = Math.abs(s.w - c.w), dh = Math.abs(s.h - c.h), dfs = Math.abs(s.fs - c.fs);
      if (dw > Math.max(2, s.w * 0.02) || dh > Math.max(4, s.h * 0.04) || dfs > 0)
        out.push({ url, вид: "разошлось", k, тег: s.тег, кл: s.кл, текст: s.текст,
          сайт: { w: s.w, h: s.h, fs: s.fs }, холст: { w: c.w, h: c.h, fs: c.fs } });
      else if (s.текст !== c.текст)
        out.push({ url, вид: "другой текст", k, сайт: s.текст, холст: c.текст });
      else if (s.src && c.src && s.src !== c.src)
        out.push({ url, вид: "другая картинка", k, сайт: s.src, холст: c.src });
    }
    for (const [k, c] of холст) if (!сайт.has(k) && c.w > 40 && c.h > 20) out.push({ url, вид: "лишнее в холсте", k, холст: c });
    out.push({ url, вид: "сверено", общих, развёрнуто });
  }
  window.__FIDELITY = out;
  window.__FIDELITY_OK = out.every((r) => r.вид === "сверено");
  const по = {};
  for (const r of out) (по[r.вид] ||= []).push(r);
  log.textContent = (window.__FIDELITY_OK ? "ЧИСТО. " : "РАСХОЖДЕНИЯ. ") + "сверено узлов: " + (по["сверено"] || []).reduce((n, r) => n + r.общих, 0) +
    " | " + Object.entries(по).filter(([k]) => k !== "сверено").map(([k, v]) => k + ": " + v.length).join(" | ");
})();
</script>`;
writeFileSync(join(OUT, "__fidelity.html"), PAGE);
console.log("сверка готова:", работа.length, "страниц кабинета → out/__fidelity.html");
