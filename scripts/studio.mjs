/**
 * Обход собранного сайта глазами студии — то, чего не видит scripts/regress.mjs.
 *
 * regress проверяет вёрстку и редактируемость: вылет за экран, разрыв слова, работает ли
 * перетаскивание. Этот обход проверяет то, что видит ПОСЕТИТЕЛЬ и что regress пропускал:
 *
 *   не проявилось      — блок за всю прокрутку страницы ни разу не стал видимым. Так на живом
 *                        сайте месяцами стояли прозрачными 19 из 23 вопросов в FAQ и все восемь
 *                        карточек команды: интерактивы Webflow ставят opacity:0 и не снимают его.
 *   мелкий текст       — кегль ниже 11,5px. Подписи в подвале доходили до 8px на телефоне.
 *   мелкая цель        — ссылка или кнопка меньше 24×24 на узком экране (WCAG 2.2), с учётом
 *                        невидимого слоя нажатия, если он есть.
 *   вылет / наезд      — горизонтальный вылет и наложение соседних блоков.
 *   картинка не загрузилась, пустая карточка.
 *
 * Запускать после сборки, стенд поднять на out/:
 *   node scripts/build-site.mjs [edits.json] && node scripts/studio.mjs
 * затем открыть /__studio.html — итог копится в window.__STUDIO.
 * Сборка чистит out/, поэтому страницу надо пересоздавать после каждой сборки.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const u = [];
(function walk(d) { for (const n of readdirSync(d)) { if (n === "__canvas") continue; const p = join(d, n);
  if (statSync(p).isDirectory()) walk(p); else if (n === "index.html") {
    const r = relative(OUT, dirname(p)).split("\\").join("/"); u.push(r ? "/" + r + "/" : "/"); } } })(OUT);
u.sort();
const PAGE = `<!doctype html><meta charset="utf-8"><title>studio sweep</title>
<style>body{font:13px/1.4 ui-monospace,monospace;margin:0;background:#111;color:#ddd}
iframe{border:0;display:block}#log{padding:8px;white-space:pre-wrap}</style>
<div id="log">готовлю…</div><iframe id="f"></iframe>
<script>window.__URLS=${JSON.stringify(u)};</script>
<script>
const URLS = window.__URLS, WIDTHS = [390, 768, 1440], out = [];
const box = (el) => el.getBoundingClientRect();
const vis = (w, el) => { const s = w.getComputedStyle(el); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05; };
function audit(w, d, url, width) {
  const R = [], push = (вид, что, где) => R.push({ url, width, вид, что, где: String(где || "").slice(0, 70) });
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(" ").filter(Boolean).slice(0, 2).join(".") : "");
  const docW = d.documentElement.scrollWidth;
  if (docW > width + 1) {
    push("страница шире экрана", docW - width + "px", "");
    for (const el of d.querySelectorAll("body *")) { if (!vis(w, el)) continue; const r = box(el);
      if (r.width > 0 && r.right > width + 1 && r.width <= width * 1.6) { push("вылет элемента", Math.round(r.right - width) + "px", sel(el)); if (R.length > 14) break; } }
  }
  for (const img of d.images) if (img.complete && img.naturalWidth === 0) push("картинка не загрузилась", (img.currentSrc || img.src).split("/").pop(), sel(img));
  // Ссылка ВНУТРИ предложения под правило о размере цели не подпадает: WCAG 2.2 (2.5.8) делает
  // для неё исключение, и раздуть её нельзя, не разорвав строку. Отличаем по родителю: если в его
  // тексте есть что-то ещё кроме самой ссылки — значит, она стоит в тексте, а не отдельной кнопкой.
  // Без этого юридические страницы, где таких ссылок десятки, засыпали обход шумом.
  const вПредложении = (el) => {
    const p = el.parentElement;
    if (!p) return false;
    const свой = (el.textContent || "").trim().length;
    const весь = (p.textContent || "").trim().length;
    return свой > 0 && весь > свой + 12;
  };
  for (const el of d.querySelectorAll("a[href], button, input[type=submit], [role=button]")) {
    if (!vis(w, el)) continue; const r = box(el); if (!r.width || !r.height) continue;
    if (el.tagName === "A" && вПредложении(el)) continue;
    const a2 = w.getComputedStyle(el, "::after"), слой = a2.content !== "none" && a2.position === "absolute";
    const h = слой ? Math.max(r.height, parseFloat(a2.height) || 0) : r.height;
    const wd = слой ? Math.max(r.width, parseFloat(a2.minWidth) || 0, parseFloat(a2.width) || 0) : r.width;
    if (width <= 768 && (h < 24 || wd < 24)) push("мелкая цель", Math.round(wd) + "×" + Math.round(h), sel(el) + " «" + (el.textContent || "").trim().slice(0, 18) + "»");
  }
  for (const el of d.querySelectorAll("p,span,a,li,div,h1,h2,h3,h4,h5,h6,small,label,button")) {
    if (!el.childNodes.length || !vis(w, el)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3)) continue;
    const fs = parseFloat(w.getComputedStyle(el).fontSize);
    if (fs && fs < 11.5) push("мелкий текст", fs.toFixed(1) + "px", sel(el) + " «" + el.textContent.trim().slice(0, 22) + "»");
  }
  for (const [el, max] of (w.__видимость || new Map())) {
    const r = box(el), s = w.getComputedStyle(el);
    if (max > 0.05 || r.width < 40 || r.height < 20 || s.display === "none" || s.visibility === "hidden") continue;
    push("не проявилось", "макс. opacity " + max.toFixed(2) + " за всю прокрутку", sel(el) + " «" + (el.textContent || "").trim().slice(0, 22) + "»");
  }
  for (const el of d.querySelectorAll("[class*=card],[class*=tile],[class*=item]")) {
    if (!vis(w, el)) continue; const r = box(el); if (r.width < 60 || r.height < 40) continue;
    if ((el.textContent || "").trim()) continue;
    if (el.querySelector("img,svg,video,picture,iframe")) continue;
    if (w.getComputedStyle(el).backgroundImage !== "none") continue;
    if (w.getComputedStyle(el, "::before").content !== "none" || w.getComputedStyle(el, "::after").content !== "none") continue;
    push("пустая карточка", Math.round(r.width) + "×" + Math.round(r.height), sel(el));
  }
  // Кнопку видно, но нажать нельзя — её накрыл сосед. Прошлая проверка наездов сравнивала только
  // детей ОДНОГО родителя и пропускала элементы в ячейках сетки, поэтому не увидела главный баг
  // русской главной: плитки контактов лежали на кнопках героя (ряд героя прибит к 88vh, колонка —
  // к 784px, в невысоком окне содержимое выливалось вниз). Спрашиваем у браузера напрямую: кто
  // окажется под пальцем в середине ссылки. Чужой элемент — значит, накрыли.
  for (const el of d.querySelectorAll("a[href], button, input[type=submit], [role=button]")) {
    if (!vis(w, el)) continue;
    const r = box(el);
    if (r.width < 8 || r.height < 8) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > width || y > w.innerHeight) continue;
    const top = d.elementFromPoint(x, y);
    if (!top || top === el || el.contains(top) || top.contains(el)) continue;
    push("перекрыт", sel(top) + " «" + (top.textContent || "").trim().slice(0, 18) + "»",
      sel(el) + " «" + (el.textContent || "").trim().slice(0, 18) + "»");
  }
  // Разрядка разошлась с кеглем. Старый редактор писал заголовку абсолютные font-size и
  // line-height парой; потом кегль ужимали, а пиксели межстрочного оставались. На русской
  // главной это дало 64px текста при 88px строки — между строками воздуха больше, чем высота
  // буквы, и герой перестал помещаться в экран.
  for (const el of d.querySelectorAll("h1,h2,h3,h4,[class*=heading-style],[class*=heading_],p")) {
    if (!vis(w, el)) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)) continue;
    const s = w.getComputedStyle(el);
    const fs = parseFloat(s.fontSize), lh = parseFloat(s.lineHeight);
    if (!fs || !lh || fs < 28) continue;
    if (lh / fs > 1.35) push("разрядка разошлась с кеглем", (lh / fs).toFixed(2) + " (кегль " + Math.round(fs) + "px, строка " + Math.round(lh) + "px)",
      sel(el) + " «" + (el.textContent || "").trim().slice(0, 22) + "»");
  }
  // Заголовок, зажатый в узкую колонку. Клиент тянет заголовок мышью, а обёртка у шаблона
  // ограничена шестью колонками — ширина не применяется, и длинная строка разваливается на
  // четыре. Так «РАССЧИТАЙТЕ СТОИМОСТЬ ПОД ВАШ СЛУЧАЙ» стояло в 680px из доступных 1297.
  // Ловим по двум признакам сразу: строк три и больше И рядом есть незанятое место.
  for (const el of d.querySelectorAll("h1,h2")) {
    if (!vis(w, el)) continue;
    const r = box(el), par = el.parentElement;
    if (!par || r.width < 2) continue;
    const s2 = w.getComputedStyle(el);
    const lh = parseFloat(s2.lineHeight), fs = parseFloat(s2.fontSize);
    if (!lh || !fs || fs < 28) continue;
    const строк = Math.round(r.height / lh), место = box(par).width;
    if (строк >= 3 && место > r.width * 1.25)
      push("заголовок ужат", строк + " строк в " + Math.round(r.width) + "px, места " + Math.round(место) + "px",
        sel(el) + " «" + (el.textContent || "").trim().slice(0, 22) + "»");
  }
  // Великанский разрыв между соседями. justify-content:space-between в коробке, которую по
  // высоте задаёт сосед (фотография), сваливает весь остаток в ОДИН разрыв: в карточке услуги
  // между описанием и «Подробнее» стояло 252px при заданных 48px.
  const грузится = (el) => [...el.querySelectorAll("img")].some((i) => !i.complete || !i.naturalWidth);
  for (const p of d.querySelectorAll("section *")) {
    // Внутренности SVG меряются по своей системе координат и дают разрывы в тысячи пикселей.
    if (p.closest("svg")) continue;
    const s = w.getComputedStyle(p);
    if (!/flex|grid|block/.test(s.display)) continue;
    // Незагруженная картинка схлопывается в ноль, выпадает из списка детей и превращается в
    // разрыв на своём месте. Коробку с такой картинкой не меряем вовсе.
    if ([...p.children].some((k) => [...k.querySelectorAll("img")].some((i) => !i.complete || !i.naturalWidth))) continue;
    // Колонка героя — исключение: кнопки там прижаты к низу плашки НАМЕРЕННО, а плашка ростом
    // с фотографию рядом. Это не дыра, а заказанная раскладка.
    if (p.classList && p.classList.contains("left_hero-home")) continue;
    const kids = [...p.children].filter((k) => vis(w, k) && !/absolute|fixed/.test(w.getComputedStyle(k).position)
      && box(k).height > 1);   // схлопнувшийся в ноль сосед — не сосед, а его место читается как разрыв
    if (kids.length < 2 || kids.length > 12) continue;
    if ([...p.children].some((k) => box(k).height <= 1)) continue;
    const свой = parseFloat(s.rowGap) || parseFloat(s.gap) || 0;
    const порог = Math.max(120, свой * 2.5);
    const пары = kids.map((k) => ({ k, r: box(k) })).sort((a, b) => a.r.top - b.r.top);
    for (let i = 0; i < пары.length - 1; i++) {
      const щель = Math.round(пары[i + 1].r.top - пары[i].r.bottom);
      // Незагруженная картинка схлопывается в ноль и притворяется разрывом — это не он.
      if (щель <= порог || грузится(пары[i].k) || грузится(пары[i + 1].k)) continue;
      push("великанский разрыв", щель + "px при заданных " + Math.round(свой) + "px", sel(p));
    }
  }
  // Ссылка, которую нечего прочитать вслух: пустая ссылка поверх карточки, иконка без подписи.
  // Смотрим уже в браузере — имена проставляет NAME_FIX на загрузке, в статике их ещё нет.
  for (const el of d.querySelectorAll("a[href]")) {
    if (!vis(w, el)) continue;
    if ((el.textContent || "").trim()) continue;
    if ((el.getAttribute("aria-label") || el.getAttribute("title") || "").trim()) continue;
    const img = el.querySelector("img[alt]");
    if (img && (img.getAttribute("alt") || "").trim()) continue;
    push("ссылка без имени", el.getAttribute("href").slice(0, 40), sel(el));
  }
  // Пустое поле: провал между соседними блоками внутри секции. Так на русской главной после
  // заголовка стояла синяя полоса в 452px — следствие высоты, снятой на десктопе.
  // Содержимым считается и фон: половина фотографий на «О нас» — это background-image на обёртке,
  // а не <img>, и проверка «между двумя подписями ничего нет» ловила их как пустоту. Прозрачность
  // тут тоже не считается: блоки ниже первого экрана проявляются по прокрутке, а замер идёт от
  // начала страницы — иначе каждая такая секция выглядела бы пустой.
  const есть = (k) => { const c = w.getComputedStyle(k); return c.display !== "none" && c.visibility !== "hidden"; };
  for (const s of d.querySelectorAll("section")) {
    if (!есть(s)) continue;
    const kids = [...s.querySelectorAll("*")].filter((k) => есть(k) && !/absolute|fixed/.test(w.getComputedStyle(k).position) &&
      (k.matches("img,svg,video,picture,iframe") || w.getComputedStyle(k).backgroundImage !== "none" ||
        [...k.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())));
    const rs = kids.map(box).filter((r) => r.height > 4).sort((a, b) => a.top - b.top);
    const рост = box(s).height;
    for (let i = 0; i < rs.length - 1; i++) {
      const низ = Math.max(...rs.slice(0, i + 1).map((r) => r.bottom));
      const разрыв = Math.round(rs[i + 1].top - низ);
      // Не просто «много пикселей», а «много по меркам самой секции»: отбивка между статьёй и
      // блоком вопросов — это 209px из 3599, то есть воздух, а 500px из 956 на странице услуги —
      // это дыра на месте скрытого заголовка. Порог в треть высоты разделяет одно и другое.
      if (разрыв > 200 && разрыв > рост * 0.35) { push("пустое поле", разрыв + "px из " + Math.round(рост), sel(s)); break; }
    }
  }
  const seen = new Set();
  for (const p of d.querySelectorAll("body *")) {
    const kids = [...p.children].filter((k) => vis(w, k) && box(k).height > 8 && (k.textContent || "").trim());
    if (kids.length < 2 || kids.length > 24) continue;
    for (let i = 0; i < kids.length - 1; i++) {
      const a = box(kids[i]), b = box(kids[i + 1]), sa = w.getComputedStyle(kids[i]), sb = w.getComputedStyle(kids[i + 1]);
      if (/absolute|fixed/.test(sa.position) || /absolute|fixed/.test(sb.position)) continue;
      if (sa.gridArea !== "auto / auto / auto / auto" || sb.gridArea !== "auto / auto / auto / auto") continue;
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top), ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (oy > 6 && ox > 6) { const k = sel(kids[i]) + "|" + sel(kids[i + 1]); if (seen.has(k)) continue; seen.add(k); push("наезд", Math.round(oy) + "px", k); }
    }
  }
  return R;
}
async function run() {
  const f = document.getElementById("f"), log = document.getElementById("log");
  for (const width of WIDTHS) { f.style.width = width + "px"; f.style.height = "900px";
    for (const url of URLS) {
      log.textContent = width + "px " + url + " … найдено " + out.length;
      await new Promise((res) => { f.onload = res; f.src = url; });
      const w = f.contentWindow, d = f.contentDocument;
      await new Promise((r) => setTimeout(r, 420));
      const H = d.documentElement.scrollHeight;
      // Появление по прокрутке — это НЕ поломка: скрытая карточка ниже экрана обязана быть скрытой.
      // Поломка — это «ни разу не появилась за всю страницу», поэтому копим максимум по пути.
      const кандидаты = [...d.querySelectorAll("[data-w-id], [style*='opacity'], [class*=card_]")];
      w.__видимость = new Map(кандидаты.map((e) => [e, 0]));
      for (let y = 0; y < H; y += 500) { w.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30));
        for (const e of кандидаты) { const o = +w.getComputedStyle(e).opacity;
          if (o > w.__видимость.get(e)) w.__видимость.set(e, o); } }
      w.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 320));
      try { out.push(...audit(w, d, url, width)); } catch (e) { out.push({ url, width, вид: "ошибка замера", что: String(e).slice(0, 80) }); }
    } }
  window.__STUDIO = out;
  const by = {}; for (const r of out) (by[r.вид] ||= []).push(r);
  log.textContent = "ГОТОВО. " + (Object.keys(by).length ? Object.entries(by).map(([k, v]) => k + ": " + v.length).join(" | ") : "чисто");
}
run();
</script>`;
writeFileSync(join(OUT, "__studio.html"), PAGE);
console.log("обход готов:", u.length, "страниц → out/__studio.html");
