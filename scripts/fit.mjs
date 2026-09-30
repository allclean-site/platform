/**
 * Заголовки на планшете и телефоне: не «сплющены» ли они.
 *
 * Сплющенный заголовок — одно-два слова в строке при свободной колонке рядом, или слово,
 * разорванное переносом: коробка заголовка уже своей колонки (чья-то ширина в пикселях), или
 * кегль великоват для экрана. Плюс пустота: заголовок героя далеко от своих кнопок.
 *
 *   node scripts/build-site.mjs && node scripts/fit.mjs → открыть /__fit.html (итог в window.__FIT)
 */
import { writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const IMPORT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "import", "allclean");
const idx = JSON.parse(readFileSync(join(IMPORT, "_pages.json"), "utf8"));
const URLS = idx.pages.map((e) => (e.slug === "/" ? "/" : "/" + e.slug.replace(/^\/|\/$/g, "") + "/"));

const PAGE = `<!doctype html><meta charset="utf-8"><title>fit</title>
<style>body{font:13px/1.4 ui-monospace,monospace;margin:0;background:#111;color:#ddd}
iframe{border:0;display:block;position:absolute;left:-10000px;top:0}#log{padding:8px;white-space:pre-wrap}</style>
<div id="log">готовлю…</div><iframe id="f"></iframe>
<script>
const URLS = ${JSON.stringify(URLS)};
const WIDTHS = [[390, 844], [600, 960], [700, 1000], [768, 1024], [834, 1112], [990, 1200]];
const SEL = "h1,h2,h3,[class*=heading-style-h1],[class*=heading-style-h2],[class*=heading-style-h3]";
const out = []; window.__FIT = out;
const log = document.getElementById("log"), f = document.getElementById("f");

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
function колонка(doc, el) {
  // Граница — колонка рядом с соседом или контейнер страницы; поля обёрток до неё — не место.
  let поля = 0;
  for (let n = el.parentElement, k = 0; n && n !== doc.body && k < 12; n = n.parentElement, k++) {
    const кл = typeof n.className === "string" ? n.className : "";
    const cs = doc.defaultView.getComputedStyle(n);
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    if (рядом(doc, n) || /^(SECTION|MAIN|HEADER|FOOTER|NAV|ARTICLE)$/.test(n.tagName) ||
        /(^|\s)(w-container|container-[a-z0-9-]+|padding-global)(\s|$)/.test(кл))
      return n.getBoundingClientRect().width - pad - поля;
    поля += pad;
  }
  return doc.documentElement.clientWidth;
}
/** Строки текста: сколько их, суммарная ширина слов, самое длинное слово, разорванные слова. */
function строки(doc, el) {
  const tops = new Set(), walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let words = 0, total = 0, longest = 0, broken = 0, n;
  while ((n = walker.nextNode())) {
    const t = n.nodeValue; if (!t.trim()) continue;
    const pe = n.parentElement; if (pe && doc.defaultView.getComputedStyle(pe).display === "none") continue;
    const re = /\\S+/g; let m;
    while ((m = re.exec(t))) {
      words++;
      const rg = doc.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length);
      const rs = [...rg.getClientRects()].filter((q) => q.width > 0);
      let ww = 0; for (const q of rs) { tops.add(Math.round(q.top / 4)); ww += q.width; }
      if (rs.length > 1 && !/[-‐–]/.test(m[0])) broken++;          // «Programați-vă» ломается по своему дефису
      total += ww; if (ww > longest) longest = ww;
    }
  }
  return { lines: tops.size, words, total, longest, broken };
}

(async () => {
  for (let i = 0; i < URLS.length; i++) {
    for (const [W, H] of WIDTHS) {
      log.textContent = (i + 1) + "/" + URLS.length + " @" + W + "  " + URLS[i] + "  находок: " + out.length;
      f.style.width = W + "px"; f.style.height = H + "px";
      await new Promise((r) => { f.onload = r; f.src = URLS[i] + "?r=" + Date.now(); });
      const doc = f.contentDocument, w = f.contentWindow;
      try { if (doc.fonts && doc.fonts.ready) await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 800))]); } catch (e) {}
      await new Promise((r) => setTimeout(r, 200));
      const seen = new Set();
      for (const el of doc.querySelectorAll(SEL)) {
        if (el.querySelector(SEL)) continue;                                     // меряем самый внутренний
        const host = el.closest("h1,h2,h3") || el; if (seen.has(host)) continue;
        const cs = w.getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;   // скрытая строка — не заголовок
        seen.add(host);
        const r = host.getBoundingClientRect(); if (r.width < 20 || r.height < 10) continue;
        const s = строки(doc, el); if (s.words < 3) continue;
        if (parseFloat(cs.fontSize) < 24) continue;                              // подпись, не заголовок
        const col = колонка(doc, host), fs = parseFloat(cs.fontSize);
        // Сколько строк этому тексту нужно в своей колонке: суммарная ширина слов с пробелами.
        // Строки, которые автор разбил сам (<br>, отдельный блок на строку), — замысел, а не сплющивание.
        // Пустые блоки (мусор прежних правок) строки не начинают — считаем только блоки с текстом.
        const блоки = [...el.querySelectorAll("*")].filter((c) => c.tagName !== "BR" && (c.textContent || "").trim() &&
          /^(block|flex|grid|flow-root)$/.test(w.getComputedStyle(c).display) && !c.querySelector("div,p"));
        const явных = Math.max(1, блоки.length) + el.querySelectorAll("br").length;
        const нужно = Math.max(явных, Math.ceil((s.total + fs * 0.28 * (s.words - 1)) / col));
        const лишних = s.lines - нужно, узко = r.width < col * 0.85;
        const why = [];
        if (s.broken) why.push("перенос внутри слова ×" + s.broken);
        if (s.longest > col + 1) why.push("слово шире колонки (" + Math.round(s.longest) + " > " + Math.round(col) + ")");
        if (s.lines >= 3 && (лишних >= 2 || (s.lines >= 4 && лишних >= 1 && узко))) why.push(s.lines + " строк вместо " + нужно + (узко ? ", коробка " + Math.round(r.width) + " из " + Math.round(col) + "px" : ""));
        if (why.length) out.push({ url: URLS[i], W, tag: host.tagName, id: host.getAttribute("data-lg-id") || "",
          fs, box: Math.round(r.width), col: Math.round(col), lines: s.lines, words: s.words,
          text: (el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40), why: why.join("; ") });
      }
      // Герой: заголовок далеко от своих кнопок.
      // Только колонка героя, где кнопки идут следом за заголовком: на других страницах между ними
      // стоят подзаголовок и рейтинги, а ниже — кнопка формы, и это не пустота.
      const h1 = doc.querySelector(".left_hero-home h1"), btn = h1 && h1.closest(".left_hero-home").querySelector("[class*=button-group_left]");
      if (h1 && btn) {
        // От ближайшего видимого блока над кнопками: подзаголовок между ними — не пустота.
        let над = btn.previousElementSibling;
        while (над && (w.getComputedStyle(над).display === "none" || над.getBoundingClientRect().height < 1)) над = над.previousElementSibling;
        const gap = Math.round(btn.getBoundingClientRect().top - (над || h1).getBoundingClientRect().bottom);
        if (gap > 120) out.push({ url: URLS[i], W, tag: "H1", why: "до кнопок " + gap + "px пустоты", text: h1.textContent.replace(/\\s+/g, " ").trim().slice(0, 40) });
      }
    }
  }
  window.__FIT_DONE = true;
  log.textContent = "ГОТОВО. находок: " + out.length + String.fromCharCode(10) +
    out.map((b) => b.url + " @" + b.W + "  " + b.tag + " " + (b.id || "") + "  " + b.why + "  «" + b.text + "»").join(String.fromCharCode(10));
})();
</script>`;
writeFileSync(join(OUT, "__fit.html"), PAGE);
console.log("замер готов:", URLS.length, "страниц × 4 ширины → out/__fit.html");
