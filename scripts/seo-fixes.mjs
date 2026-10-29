// SEO и кнопки связи — поверх готового HTML, тем же способом, что правки 195/2024
// (site-privacy.mjs вызывает этот слой последним, поэтому его получают и сайт, и холст
// кабинета, и двойник регресса — расхождений между ними он не создаёт).
//
// Что чинит (разбор allclean-marketing/SEO_AUDIT.md, 15.10.2026):
//  1. canonical, og:url, hreflang и внутренние ссылки со слэшем на конце. Такой адрес
//     отдаёт 308 на адрес без слэша, и на 12 страницах canonical указывал на редирект.
//  2. Телефон без «+» (`tel:37379955044` с мобильного не набирается), нерабочая ссылка
//     Telegram и Viber, открывавший «добавить контакт» вместо чата.
//  3. Ссылки соцсетей из шаблона: facebook.com без страницы → настоящая страница;
//     Instagram у компании нет — иконка убирается.
//  4. Значок сайта: в выдаче вместо него был серый глобус.
//  5. Карточка организации в разметке: адрес главной своего языка, координаты, профили.
//
// Каждая замена считается; assertSeoApplied() роняет сборку, если якорь пропал.

const SITE = "https://allclean.md";
const counts = new Map();
const bump = (key, n) => counts.set(key, (counts.get(key) || 0) + n);

// `to` — строка замены с $1… (как у String.replace); счётчик считает совпадения.
function swapRe(html, key, re, to) {
  const n = re.global ? [...html.matchAll(re)].length : Number(re.test(html));
  if (n) bump(key, n);
  return html.replace(re, to);
}

// ── 1. Слэш на конце ──────────────────────────────────────────────────────────────────
// Только свои адреса и только путь из букв, цифр, «-» и «/»: файлы с точкой и корень не трогаем.
function trailingSlash(html) {
  html = swapRe(html, "slash:abs", /(https:\/\/allclean\.md\/[a-z0-9\/-]*[a-z0-9-])\/(?=")/g, "$1");
  html = swapRe(html, "slash:href", /(href=")(\/[a-z0-9\/-]*[a-z0-9-])\/(?=")/g, "$1$2");
  return html;
}

// ── 2. Связь ──────────────────────────────────────────────────────────────────────────
function contacts(html) {
  html = swapRe(html, "tel:plus", /href="tel:(?!\+)(373\d{8})"/g, 'href="tel:+$1"');
  html = swapRe(html, "tg:phone", /href="https:\/\/t\.me\/(373\d{8})"/g, 'href="https://t.me/+$1"');
  html = swapRe(html, "viber:chat", /href="viber:\/\/add\?number=(373\d{8})"/g, 'href="viber://chat?number=%2B$1"');
  return html;
}

// ── 3. Соцсети ────────────────────────────────────────────────────────────────────────
const FACEBOOK = "https://www.facebook.com/allclean.md";
const LINKEDIN = "https://www.linkedin.com/company/65692470";
function socials(html) {
  html = swapRe(html, "social:facebook", /href="https:\/\/facebook\.com"/g, `href="${FACEBOOK}" rel="noopener"`);
  // LinkedIn вёл на главную linkedin.com; страница компании та же, что в sameAs разметки.
  html = swapRe(html, "social:linkedin", /href="https:\/\/linkedin\.com"/g, `href="${LINKEDIN}" rel="noopener"`);
  // Иконка Instagram — пустой <a> с одной svg внутри, вложенных ссылок нет.
  html = swapRe(html, "social:instagram", /<a href="https:\/\/instagram\.com"[^>]*>[\s\S]*?<\/a>/g, "");
  return html;
}

// ── 4. Значок сайта ───────────────────────────────────────────────────────────────────
// Файлы лежат в public/site-assets (favicon.ico 48 px — Google берёт кратный 48).
const ICONS =
  '<link rel="icon" href="/favicon.ico" sizes="48x48">' +
  '<link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">' +
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">';
function favicon(html) {
  if (html.includes('rel="icon"')) return html;
  return swapRe(html, "favicon", /<\/head>/, ICONS + "</head>");
}

// ── 4а. Адрес в подвале → профиль в Google Картах ──────────────────────────────────────
const MAPS = "https://www.google.com/maps?cid=12753551464754354058";
// Подвал, сохранённый из кабинета, уже несёт ссылку: её не пропускаем, а ставим текущий адрес
// (та же заморозка, что у реквизитов в site-privacy.mjs).
function footerMap(html) {
  html = swapRe(html, "footer:maps",
    /(<div class="label-small tone-medium"[^>]*>(?:Adresă|Адрес)<\/div>\s*<div class="text-size-large text_body-bold"[^>]*>\s*<a href=")https:\/\/www\.google\.com\/maps[^"]*(")/g,
    `$1${MAPS}$2`);
  return swapRe(html, "footer:maps",
    /(<div class="label-small tone-medium"[^>]*>(?:Adresă|Адрес)<\/div>\s*<div class="text-size-large text_body-bold"[^>]*>)(?!\s*<a\b)([\s\S]*?)(<\/div>)/g,
    `$1<a href="${MAPS}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-underline-offset:3px">$2</a>$3`);
}

// ── 4а′. Услуги в подвале ─────────────────────────────────────────────────────────────
// Фасады, затопление, паркет и линолеум (12 страниц от 15.10) не стояли ни в меню, ни в подвале,
// ни в каталоге — только на «Ценах». Google их нашёл, но так и не обошёл (GSC 28.10: «обнаружена,
// не проиндексирована»). Дописываем в КОНЕЦ списка «Услуги»: пути правок клиента к прежним пунктам
// (nth-of-type) не сдвигаются. Пункт, который клиент уже поставил сам, не дублируем.
const FOOTER_MORE = {
  ro: [["/services/facades", "Spălare fațade și&nbsp;vitrine"], ["/services/flood-cleanup", "Curățenie după inundație"],
       ["/services/parquet", "Rașchetare parchet"], ["/services/linoleum", "Curățare linoleum"]],
  ru: [["/ru/services/facades", "Мойка фасадов и&nbsp;витрин"], ["/ru/services/flood-cleanup", "Уборка после затопления"],
       ["/ru/services/parquet", "Циклевка паркета"], ["/ru/services/linoleum", "Чистка линолеума"]],
};
function footerServices(html, lang) {
  const at = html.search(/<div class="services-footer w-dyn-list">\s*<div role="list"/);
  if (at < 0) return html;
  const list = html.indexOf('<div role="list"', at), end = closeOf(html, list, "div");
  if (!end) return html;
  const items = FOOTER_MORE[lang].filter(([href]) => !html.slice(list, end[0]).includes(`href="${href}"`))
    .map(([href, text]) => `<div role="listitem" class="w-dyn-item"> <a href="${href}" class="link_underline-animated w-inline-block">` +
      `<div href="#" class="link-footer"> ${text} </div> <div class="link-underline_bottom-line small"> <div class="link-underline_fill-line"></div></div></a> </div>`);
  if (!items.length) return html;
  bump("footer:services", items.length);
  return html.slice(0, end[0]) + items.join(" ") + html.slice(end[0]);
}

// ── 4б. Постер видео первого экрана ───────────────────────────────────────────────────
// Самый крупный элемент первого экрана — фоновое видео; пока оно не пошло, виден постер.
// Браузер узнавал о постере только после 230 КБ встроенных стилей и скриптов Webflow, и на
// телефоне первый экран дорисовывался за 6,9 с (Lighthouse, /ru/services/home-cleaning).
const POSTER = "/video/hero-poster.jpg";
function posterPreload(html) {
  if (!html.includes(`data-poster-url="${POSTER}"`) || html.includes(`rel="preload" as="image" href="${POSTER}"`)) return html;
  // В самое начало <head>: после него идут 220 КБ встроенных стилей, и ссылка в конце шапки
  // доходила до браузера слишком поздно (замер: LCP не изменился).
  return swapRe(html, "poster:preload", /(<meta name="viewport"[^>]*>)/, `$1<link rel="preload" as="image" href="${POSTER}" fetchpriority="high">`);
}

// ── 5. Карточка организации ───────────────────────────────────────────────────────────
// Координаты — из кода места профиля в Google Картах (2RV3+W3, Кишинёв).
const ORG_EXTRA = {
  geo: { "@type": "GeoCoordinates", latitude: 47.0448, longitude: 28.8027 },
  logo: `${SITE}/logo.svg`,
  image: `${SITE}/video/hero-poster.jpg`,
  sameAs: [
    "https://www.google.com/maps?cid=12753551464754354058",
    FACEBOOK,
    "https://999.md/ru/profile/ACCMD",
    LINKEDIN,
  ],
};
// @id — одна организация на все страницы и языки: на неё ссылаются услуги и статьи.
// Юрлицо — как в политике (legal-pages.mjs). Пригороды сайт называет только словом
// «пригороды», поэтому область — муниципий Кишинёв (пригороды входят в него).
const ORG_ID = `${SITE}/#org`;
const ORG_LANG = {
  ro: { legalName: "„ALL CLEAN COMPANY” SRL", alternateName: "All Clean Company",
        areaServed: [{ "@type": "City", name: "Chișinău" }, { "@type": "AdministrativeArea", name: "Municipiul Chișinău" }] },
  ru: { legalName: "«ALL CLEAN COMPANY» SRL", alternateName: "All Clean Company",
        areaServed: [{ "@type": "City", name: "Кишинёв" }, { "@type": "AdministrativeArea", name: "Муниципий Кишинёв" }] },
};
function org(html, lang) {
  return html.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (whole, open, json, close) => {
      let o;
      try { o = JSON.parse(json); } catch { return whole; }
      if (![].concat(o["@type"] || []).includes("LocalBusiness")) return whole;
      bump("org:jsonld", 1);
      Object.assign(o, { "@id": ORG_ID, url: lang === "ru" ? `${SITE}/ru` : `${SITE}/` }, ORG_EXTRA, ORG_LANG[lang === "ru" ? "ru" : "ro"]);
      return open + JSON.stringify(o) + close;
    });
}

// ── 4в. Скрытое внутри H1 ─────────────────────────────────────────────────────────────
// Правка клиента на /ru оставила в H1 прежние строки под `display:none !important`
// («…С ГАРАНТИЕЙ ДЛЯ ЗАНЯТЫХ»). Глазу не видно, а поиск читает скрытый текст заголовка.
// Трогаем только скрытое инлайном с !important (его не перебьёт ни одно правило).
// ⚠️ Узел не удаляем, а заменяем ПУСТЫМ того же тега: размеры строки из правок клиента
// адресуются путём `div.heading-style-h1:nth-of-type(4) > span:nth-of-type(1) > …`, и
// удаление соседей или разворот вложенных <span> сдвигает номера — заголовок меняет кегль
// и межстрочный. Пустой узел с display:contents коробки не создаёт (и зазора во flex тоже),
// а счёт сохраняет.
export function closeOf(html, start, tag) {
  const re = new RegExp(`<(\\/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) { depth += m[1] ? -1 : 1; if (!depth) return [m.index, re.lastIndex]; }
  return null;
}
const HIDDEN = /<(div|span|p|strong|em|b|i)\b[^>]*\sstyle="[^"]*display:\s*none\s*!important[^"]*"[^>]*>/i;
function h1Clean(html) {
  return html.replace(/(<h1\b[^>]*>)([\s\S]*?)(<\/h1>)/gi, (whole, open, inner, close) => {
    let m;
    while ((m = inner.match(HIDDEN))) {
      const end = closeOf(inner, m.index, m[1]);
      if (!end) break;
      inner = inner.slice(0, m.index) + `<${m[1]} style="display:contents"></${m[1]}>` + inner.slice(end[1]);
      bump("h1:hidden", 1);
    }
    return open + inner + close;
  });
}

// ── 5б. Цены ──────────────────────────────────────────────────────────────────────────
// Только цены, которые уже написаны на страницах услуг (FAQ и первый экран). Без цены —
// «по осмотру» и калькулятор. Отсюда берут таблица на /pricing (scripts/service-pages.mjs)
// и offers в разметке услуги. Меняется цена на странице — меняется и здесь, и в llms.txt.
// min — для разметки; unit: m2 (за м²), item (за предмет), иначе — за объект.
export const PRICES = [
  { slug: "home-cleaning", ru: "Уборка квартир и домов", ro: "Curățenie apartamente și case" },
  { slug: "deep-cleaning", min: 45, unit: "m2", ru: "Генеральная уборка", ro: "Curățenie generală",
    pru: ["45 лей/м²"], pro: ["45 lei/m²"] },
  // Прайс клиента 29.10.2026: за м², окна после ремонта — вдвое дороже обычных.
  { slug: "post-construction", min: 65, unit: "m2", ru: "Уборка после ремонта", ro: "Curățenie după renovare",
    pru: ["без мебели — 65 лей/м²", "с мебелью — 100 лей/м²"],
    pro: ["fără mobilă — 65 lei/m²", "cu mobilă — 100 lei/m²"] },
  { slug: "office", ru: "Уборка офисов", ro: "Curățenie birouri" },
  // Окно — за штуку (прайс 29.10.2026): изнутри / изнутри и снаружи.
  { slug: "windows", min: 100, unit: "window", ru: "Мойка окон", ro: "Spălarea geamurilor",
    pru: ["стандартное окно — 100 лей изнутри / 250 лей с двух сторон", "полупанорамное — 150 / 350 лей", "панорамное — 300 / 600 лей", "витражи — 40 лей/м²"],
    pro: ["geam standard — 100 lei la interior / 250 lei pe ambele părți", "semipanoramic — 150 / 350 lei", "panoramic — 300 / 600 lei", "vitralii — 40 lei/m²"] },
  { slug: "facades", min: 35, unit: "m2", ru: "Мойка фасадов и витрин", ro: "Spălare fațade și vitrine",
    pru: ["стеклянные фасады — 35 лей/м²", "витражи — 40 лей/м²"],
    pro: ["fațade din sticlă — 35 lei/m²", "vitralii — 40 lei/m²"] },
  { slug: "carpet", min: 45, unit: "m2", ru: "Чистка ковров и ковролина", ro: "Curățare covoare și mochetă",
    pru: ["ковролин — 45 лей/м²", "ковры — 55 лей/м²"], pro: ["mochetă — 45 lei/m²", "covoare — 55 lei/m²"] },
  { slug: "upholstery", min: 50, max: 450, unit: "item", ru: "Чистка мягкой мебели", ro: "Curățare mobilă tapițată",
    pru: ["50–450 лей за предмет"], pro: ["50–450 lei per obiect"] },
  { slug: "parquet", min: 250, unit: "m2", ru: "Циклевка паркета", ro: "Restaurare parchet",
    pru: ["250 лей/м² (1 слой лака)"], pro: ["250 lei/m² (1 strat de lac)"] },
  { slug: "marble", min: 180, unit: "m2", ru: "Полировка мрамора", ro: "Polizare marmură", pru: ["180 лей/м²"], pro: ["180 lei/m²"] },
  { slug: "linoleum", min: 60, unit: "m2", ru: "Чистка линолеума", ro: "Curățare linoleum", pru: ["60 лей/м²"], pro: ["60 lei/m²"] },
  { slug: "retail", ru: "Уборка магазинов", ro: "Curățenie magazine" },
  { slug: "warehouse", ru: "Уборка складов", ro: "Curățenie depozite" },
  { slug: "disinfection", ru: "Дезинфекция пищевых производств", ro: "Dezinfecție producție alimentară" },
  { slug: "flood-cleanup", ru: "Уборка после затопления", ro: "Curățenie după inundație" },
];

// ── 5в. Разметка: вопросы, цены, связи ────────────────────────────────────────────────
// FAQPage — из ВИДИМЫХ вопросов страницы (с правками клиента): на страницах услуг разметка
// отставала на два вопроса, на /pricing и главных её не было вовсе. Блог вёрстан иначе
// (h3), его вопросы здесь не находятся, и его разметка остаётся своей.
// Текст вопросов приходит из правок клиента: «<» экранируем, чтобы </script> не закрыл блок.
const ldJson = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const plainText = (s) => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/\s+/g, " ").trim();
function visibleFaq(html) {
  const out = [];
  // Вопрос и ответ ищем внутри одного пункта: кусок от «expandable-single» до следующего.
  for (const item of html.split('class="expandable-single').slice(1)) {
    const m = item.match(/class="text-size-large text_body-bold"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<p class="faq-paragraph"[^>]*>([\s\S]*?)<\/p>/);
    if (!m) continue;
    const q = plainText(m[1]), a = plainText(m[2]);
    if (q && a) out.push({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } });
  }
  return out;
}
const pageUrl = (html) => (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "";
// Цена «от» — из ВИДИМОГО текста самой страницы: подзаголовок первого экрана и ответы FAQ.
// Раньше offers брались из таблицы PRICES, и правка цены клиентом на странице расходилась с
// разметкой. Берётся единица первой найденной цены (м², предмет или за объект) и наименьшая
// цена в этой единице. Нет цены в тексте — PRICES (счётчик ld:offers-fallback).
const PRICE_RE = /(?:от|de la)\s+(\d[\d\s]*?)(?:\s+(?:до|la|și)\s+(\d[\d\s]*?))?\s+(?:лей|lei)(?:\s*(?:\/|за|pe|per)\s*(м²|m²|m2|предмет|obiect|окно|geam))?/gi;
export function pagePrice(html) {
  const texts = [];
  const sub = html.match(/<[a-z0-9]+\b[^>]*class="[^"]*hero-home_sub[^"]*"[^>]*>([\s\S]*?)<\/(?:h2|p|div)>/);
  if (sub) texts.push(plainText(sub[1]));
  for (const m of html.matchAll(/<p class="faq-paragraph"[^>]*>([\s\S]*?)<\/p>/g)) texts.push(plainText(m[1]));
  const all = [];
  for (const t of texts) for (const m of t.matchAll(PRICE_RE)) {
    const u = (m[3] || "").toLowerCase();
    all.push({ min: +m[1].replace(/\s/g, ""), max: m[2] ? +m[2].replace(/\s/g, "") : null, unit: /м²|m²|m2/.test(u) ? "m2" : u ? "item" : "" });
  }
  if (!all.length) return null;
  const same = all.filter((x) => x.unit === all[0].unit);
  const min = Math.min(...same.map((x) => x.min));
  const max = Math.max(0, ...same.map((x) => x.max || 0));
  return { min, max: max > min ? max : null, unit: all[0].unit };
}
// Найденные цены страниц — для сверки с llms.txt при сборке (checkLlms).
export const derivedPrices = new Map();
/** Цена страницы должна встречаться в llms.txt в строке со ссылкой на эту страницу. */
export function checkLlms(llms) {
  const miss = [];
  for (const [url, p] of derivedPrices) {
    const line = llms.split("\n").find((l) => l.includes("(" + url + ")"));
    if (line && !new RegExp("\\b" + p.min + "\\b").test(line)) miss.push(url.replace(SITE, "") + " " + p.min);
  }
  return miss;
}
function offerFor(url, html) {
  const slug = (url.match(/\/services\/([a-z-]+)$/) || [])[1];
  if (!slug) return null;
  let p = pagePrice(html);
  if (p) derivedPrices.set(url, p);
  else {
    const q = PRICES.find((x) => x.slug === slug && x.min);
    if (!q) return null;
    p = { min: q.min, max: q.max || null, unit: q.unit || "" };
    bump("ld:offers-fallback", 1);
  }
  const spec = { "@type": p.unit ? "UnitPriceSpecification" : "PriceSpecification", minPrice: p.min, priceCurrency: "MDL" };
  if (p.max) spec.maxPrice = p.max;
  if (p.unit) spec.unitCode = p.unit === "m2" ? "MTK" : "C62";
  return { "@type": "Offer", priceCurrency: "MDL", price: p.min, priceSpecification: spec, url };
}
function jsonld(html) {
  const faq = visibleFaq(html);
  const url = pageUrl(html);
  let hasFaq = false;
  html = html.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (whole, open, json, close) => {
    let o;
    try { o = JSON.parse(json); } catch { return whole; }
    const nodes = o["@graph"] || [o];
    let touched = false;
    for (const n of nodes) {
      if (n["@type"] === "FAQPage") {
        hasFaq = true;
        if (faq.length) { n.mainEntity = faq; touched = true; bump("ld:faq-sync", 1); }
      }
      if (n["@type"] === "Service") {
        const offer = offerFor(n.url || url, html);
        if (offer) { n.offers = offer; bump("ld:offers", 1); }
        n.provider = { "@id": ORG_ID };
        touched = true; bump("ld:provider", 1);
      }
      if (n["@type"] === "Article" && n.publisher) {
        n.publisher = { ...n.publisher, "@id": ORG_ID, logo: { "@type": "ImageObject", url: `${SITE}/logo.svg` } };
        touched = true; bump("ld:article", 1);
      }
    }
    return touched ? open + ldJson(o) + close : whole;
  });
  if (!hasFaq && faq.length) {
    html = swapRe(html, "ld:faq-add", /<\/head>/,
      `<script type="application/ld+json">${ldJson({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq })}</script></head>`);
  }
  return html;
}

// ── 6. Страница «спасибо» после заявки ───────────────────────────────────────────────
// Все формы (калькуляторы, запись) после того, как база приняла заявку, вызывают
// /api/notify-lead — это единственная общая точка успеха. Ждём, пока уведомление уйдёт
// (не дольше 2,5 с), и переводим на /thank-you своего языка: человек видит, что заявка
// дошла, а реклама и аналитика получают одну страницу-конверсию. Только на самом сайте:
// в холсте кабинета форму пробуют при правке, там переход не нужен.
const THANKS_MARK = "lg-thanks";
const THANKS =
  '<script>/*lg-thanks*/(function(){if(!/^(www\\.)?allclean\\.md$|^localhost$|^127\\.0\\.0\\.1$/.test(location.hostname))return;' +
  'var f=window.fetch;window.fetch=function(u,o){var r=f.apply(this,arguments);' +
  'if(o&&String(o.method).toUpperCase()==="POST"&&String(u).indexOf("/api/notify-lead")>=0){' +
  // При проверке в Tag Assistant метка gtm_debug переходит на «спасибо», иначе связь рвётся.
  'var dbg=(location.search.match(/[?&](gtm_debug=[^&]*)/)||[])[1];' +
  'var done=false,go=function(){if(done)return;done=true;location.href=(/^\\/ru(\\/|$)/.test(location.pathname)?"/ru":"")+"/thank-you"+(dbg?"?"+dbg:"");};' +
  'setTimeout(go,2500);r.then(go,go);}return r;};})();</script>';
function thanks(html) {
  if (html.includes(THANKS_MARK)) return html;
  return swapRe(html, "thanks:redirect", /<\/body>/, THANKS + "</body>");
}

// ── 6а. Антиспам форм ────────────────────────────────────────────────────────────────
// Скрытое поле-ловушка в форме записи и в каждом калькуляторе и минимум 3 с от загрузки до
// отправки. Робот, заполнивший ловушку или отправивший мгновенно, получает отказ (400) без
// единого запроса: заявка, фото и уведомление не уходят. Человеку отказ показывает ту же ошибку
// с телефоном. Обёртка fetch ставится последней, то есть решает раньше «спасибо» и страховки.
// Только на самом сайте: в холсте поле ушло бы в правку блока.
const ANTISPAM_MARK = "lg-antispam";
const ANTISPAM =
  '<script>/*lg-antispam*/(function(){if(window.top!==window)return;var T0=Date.now();' +
  'function hp(){var a=document.querySelectorAll(\'form[name="wf-form-Contact-Form"],.calc-wizard\');for(var i=0;i<a.length;i++){' +
  'if(a[i].querySelector(".lg-hp"))continue;var x=document.createElement("input");x.type="text";x.name="company_site";x.className="lg-hp";' +
  'x.tabIndex=-1;x.autocomplete="off";x.setAttribute("aria-hidden","true");x.style.cssText="position:absolute;left:-9999px;width:1px;height:1px;opacity:0";a[i].appendChild(x);}}' +
  'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hp);else hp();' +
  'var f=window.fetch;window.fetch=function(u,o){var s=String(u);' +
  'if(o&&String(o.method).toUpperCase()==="POST"&&/\\/rest\\/v1\\/site_leads|\\/storage\\/v1\\/object\\/calc-uploads\\/|\\/api\\/notify-lead/.test(s)){' +
  'var bad=Date.now()-T0<3000,h=document.querySelectorAll(".lg-hp");for(var i=0;i<h.length;i++)if(h[i].value)bad=true;' +
  'if(bad)return Promise.resolve(new Response("{}",{status:400,headers:{"content-type":"application/json"}}));}' +
  'return f.apply(this,arguments);};})();</script>';
function antispam(html) {
  if (html.includes(ANTISPAM_MARK) || !/calc-wizard|wf-form-Contact-Form/.test(html)) return html;
  return swapRe(html, "forms:antispam", /<\/body>/, ANTISPAM + "</body>");
}

// ── 7. Окно согласия и тег Google Ads ────────────────────────────────────────────────
// Закон 195/2024 и обещание страницы /cookies: до «Принять» ни скрипта Google, ни cookie —
// IP посетителя не уходит третьей стороне без согласия (как и с чужими CDN в site-privacy).
// Кнопки равные. Выбор — lg_consent в localStorage на 12 месяцев; «Отклонить» после «Принять»
// стирает _gcl_* и перезагружает страницу. Только на allclean.md (в холсте кабинета окна нет);
// на localhost окно включается параметром ?lgconsent для проверки.
// Конверсия = просмотр /thank-you (правило «URL содержит thank-you» в Google Ads).
export const ADS_ID = "AW-18495907060";
// Вторичная конверсия «нажатие на телефон или мессенджер».
export const CONTACT_CONVERSION = "AW-18495907060/CGjbCMvNhaAdEPTJxPNE";
// Окно в привычном виде: короткая фраза, «Принять все» и «Отклонить» одинаковые, «Настроить»
// открывает категории. Категорий две, потому что других cookie на сайте нет: «Необходимые»
// (только сам выбор) и «Реклама» (тег Google Ads).
const CONSENT_UI = `var T=ru?{t:"Мы используем cookie, чтобы сайт работал и чтобы оценивать эффективность рекламы.",m:"Подробнее",u:"/ru/cookies",y:"Принять все",n:"Отклонить",s:"Настроить",h:"Настройки cookie",c1:"Необходимые",d1:"Всегда включены. Хранят ваш выбор о cookie.",c2:"Реклама",d2:"Google Ads: показывает, какая реклама приводит заявки.",sv:"Сохранить выбор"}` +
  `:{t:"Folosim cookie-uri pentru funcționarea site-ului și pentru a măsura eficiența reclamei.",m:"Detalii",u:"/cookies",y:"Accept toate",n:"Refuz",s:"Setări",h:"Setări cookie",c1:"Necesare",d1:"Mereu active. Păstrează alegerea dvs. privind cookie-urile.",c2:"Publicitate",d2:"Google Ads: ne arată ce reclame aduc cereri.",sv:"Salvează alegerea"};` +
  `var box=null;function hide(){if(box){box.remove();box=null;}}` +
  `var B="flex:1;min-width:130px;padding:12px 16px;border:0;border-radius:12px;background:#0c2959;color:#fff;font-weight:700;font-size:15px;cursor:pointer";` +
  `var L="padding:6px 0;border:0;background:none;color:#0c2959;text-decoration:underline;font-size:14px;cursor:pointer";` +
  `function main(){return "<p style='margin:0 0 14px'>"+T.t+" <a href='"+T.u+"' style='color:inherit;text-decoration:underline'>"+T.m+"</a></p>"+` +
  `"<div style='display:flex;gap:10px;flex-wrap:wrap'><button type='button' data-v='granted' style='"+B+"'>"+T.y+"</button><button type='button' data-v='denied' style='"+B+"'>"+T.n+"</button></div>"+` +
  `"<button type='button' data-a='settings' style='"+L+";margin-top:8px'>"+T.s+"</button>";}` +
  `function row(id,title,desc,on,lock){return "<label style='display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid #e3e9f5;cursor:"+(lock?"default":"pointer")+"'>"+` +
  `"<input type='checkbox' id='"+id+"' "+(on?"checked ":"")+(lock?"disabled ":"")+"style='width:20px;height:20px;margin-top:2px;flex:none;accent-color:#0c2959'>"+` +
  `"<span><b>"+title+"</b><br><span style='font-size:14px;opacity:.8'>"+desc+"</span></span></label>";}` +
  `function settings(){return "<p style='margin:0 0 6px;font-weight:700'>"+T.h+"</p>"+row("lgc-nec",T.c1,T.d1,true,true)+row("lgc-ads",T.c2,T.d2,get()==="granted",false)+` +
  `"<div style='display:flex;gap:10px;flex-wrap:wrap;margin-top:12px'><button type='button' data-a='save' style='"+B+"'>"+T.sv+"</button><button type='button' data-v='granted' style='"+B+"'>"+T.y+"</button></div>";}` +
  `function apply(v){var was=get();set(v);hide();if(v==="granted")load();else if(was==="granted"){wipe();location.reload();}}` +
  `function show(){if(box)return;box=document.createElement("div");box.id="lg-consent";box.setAttribute("role","dialog");box.setAttribute("aria-label","Cookie");` +
  `box.style.cssText="position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:440px;margin:0;background:#fff;color:#0c2959;border-radius:18px;box-shadow:0 18px 50px rgba(12,41,89,.25);padding:18px 20px;font-size:15px;line-height:1.5";` +
  `box.innerHTML=main();box.addEventListener("click",function(e){var t=e.target,v=t.getAttribute&&t.getAttribute("data-v"),a=t.getAttribute&&t.getAttribute("data-a");` +
  `if(v)apply(v);else if(a==="settings")box.innerHTML=settings();else if(a==="save")apply(box.querySelector("#lgc-ads").checked?"granted":"denied");});document.body.appendChild(box);}`;
const CONSENT_MARK = "lg-consent-banner";
const CONSENT_JS =
  '<script>/*lg-consent-banner*/(function(){' +
  'var H=location.hostname;if(!(/^(www\\.)?allclean\\.md$/.test(H)||/[?&]lgconsent/.test(location.search)))return;' +
  'var K="lg_consent",ID="' + ADS_ID + '",ru=/^\\/ru(\\/|$)/.test(location.pathname);' +
  'function get(){try{var v=JSON.parse(localStorage.getItem(K)||"null");if(v&&Date.now()-v.t<31536e6)return v.v;}catch(e){}return null;}' +
  'function set(v){try{localStorage.setItem(K,JSON.stringify({v:v,t:Date.now()}));}catch(e){}}' +
  'var loaded=false;function load(){if(loaded)return;loaded=true;window.dataLayer=window.dataLayer||[];' +
  'window.gtag=function(){dataLayer.push(arguments);};' +
  'gtag("consent","default",{ad_storage:"granted",ad_user_data:"granted",ad_personalization:"denied",analytics_storage:"denied"});' +
  'gtag("js",new Date());gtag("config",ID);' +
  'var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id="+ID;document.head.appendChild(s);}' +
  'function wipe(){document.cookie.split(";").forEach(function(c){var n=c.split("=")[0].trim();if(/^_gcl_/.test(n)){' +
  'document.cookie=n+"=;Max-Age=0;path=/";document.cookie=n+"=;Max-Age=0;path=/;domain=."+H.replace(/^www\\./,"");}});}' +
  CONSENT_UI +
  // Вторичная конверсия «нажатие на связь»: телефон, WhatsApp, Viber, Telegram. Считается, только
  // когда тег уже загружен (после согласия или в проверке ?gtm_debug); ради неё тег не грузится.
  // Переход не задерживается: событие уходит маяком.
  'document.addEventListener("click",function(e){if(!loaded)return;var a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;' +
  'var h=a.getAttribute("href")||"";if(/^(tel|viber|whatsapp|tg):/i.test(h)||/^(https?:)?\\/\\/(wa\\.me|api\\.whatsapp\\.com|t\\.me|telegram\\.me)\\//i.test(h))' +
  'window.gtag("event","conversion",{send_to:"' + CONTACT_CONVERSION + '",transport_type:"beacon"});},true);' +
  // Проверка тега в Tag Assistant открывает сайт с ?gtm_debug — это владелец проверяет свой тег:
  // тег грузится сразу, окно не показывается (обычных посетителей не касается).
  'window.lgConsentOpen=show;var c=get();if(c==="granted"||/[?&]gtm_debug=/.test(location.search))load();else if(c!=="denied"){' +
  'if(document.body)show();else document.addEventListener("DOMContentLoaded",show);}' +
  '})();</script>';
function consentBanner(html) {
  if (html.includes(CONSENT_MARK)) return html;
  const out = swapRe(html, "consent:banner", /<\/body>/, CONSENT_JS + "</body>");
  if (out.includes(CONTACT_CONVERSION)) bump("ads:contact-click", 1);
  return out;
}

// ── 8. Денежные страницы (allclean-marketing/SEO_GROWTH_PLAN.md, разделы 4–5) ──────────
// Только факты, которые уже есть на сайте: цены — со страницы (pagePrice) или из PRICES,
// часы, гарантия и район — если страница сама их называет.
// Вставленное здесь помечено data-lg-gen: холст не даёт его править и снимает перед сохранением
// блока (SiteEditor), иначе копия текста застыла бы в правке клиента.

// /pricing: H1 под запрос, вид прежний (тот же тег и капс).
const PRICING_H1 = [
  [/(<h1\b[^>]*>)\s*PREȚURI SIMPLE PENTRU FIECARE CASĂ\s*(<\/h1>)/, "$1PREȚURI PENTRU CURĂȚENIE ÎN&nbsp;CHIȘINĂU$2"],
  [/(<h1\b[^>]*>)\s*ПРОСТЫЕ ЦЕНЫ ДЛЯ(?:&nbsp;|\s)КАЖДОГО ДОМА\s*(<\/h1>)/, "$1ЦЕНЫ НА&nbsp;УБОРКУ В&nbsp;КИШИНЁВЕ$2"],
];
function pricingH1(html) {
  for (const [re, to] of PRICING_H1) html = swapRe(html, "seo:pricing-h1", re, to);
  return html;
}

// Главная: description с ценами — только вместо описания из шаблона (своё описание клиента сильнее).
const HOME_DESC = [
  ["Serviciu profesional de curățenie în Chișinău: apartamente, case și birouri. Prețuri transparente, programare online.",
    "Curățenie în Chișinău: generală de la 45 lei/m², după renovare de la 65 lei/m², spălarea geamurilor de la 100 lei per geam. Zilnic 8:00–21:00, calcul online."],
  ["Профессиональная клининговая служба в Кишинёве: уборка квартир, домов и офисов. Прозрачные цены, онлайн-запись.",
    "Клининг в Кишинёве: генеральная уборка от 45 лей/м², после ремонта от 65 лей/м², мойка окон от 100 лей за окно. Ежедневно 8:00–21:00, расчёт онлайн."],
];
function homeDesc(html) {
  for (const [was, now] of HOME_DESC) {
    const parts = html.split(`content="${was}"`);   // description, og: и twitter:
    if (parts.length > 1) { bump("seo:home-desc", 1); html = parts.join(`content="${now}"`); }
  }
  return html;
}

// Десять калькуляторов в переключателе несли по своему H2, хотя видно их по одному и заголовки
// спрятаны (.cp-panel .calc-head{display:none}). Один H2 — у переключателя, остальные — div.
function calcHeadings(html) {
  if (!html.includes("calc-picker")) return html;
  return swapRe(html, "seo:calc-h2", /(<div class="calc-head"[^>]*>)\s*<h2\b([^>]*)>([\s\S]*?)<\/h2>/g, '$1<div class="calc-title"$2>$3</div>');
}

// Ответ первым абзацем — сразу под карточкой первого экрана, внутри той же секции.
const ANSWER_HOME = {
  ru: "All Clean — клининг в Кишинёве и пригородах: квартиры, дома, офисы, окна. " +
    "Генеральная уборка — от 45 лей за м², после ремонта — от 65 лей за м², мойка окон — от 100 лей за окно. " +
    "Работаем ежедневно с 8:00 до 21:00. Если качество не устроит, сообщите в течение 24 часов — клинер приедет повторно бесплатно.",
  ro: "All Clean face curățenie în Chișinău și suburbii: apartamente, case, birouri, geamuri. " +
    "Curățenia generală — de la 45 lei/m², după renovare — de la 65 lei/m², spălarea geamurilor — de la 100 lei per geam. " +
    "Lucrăm zilnic între 8:00 și 21:00. Dacă nu sunteți mulțumit, anunțați-ne în 24 de ore și trimitem gratuit un curățător din nou.",
};
const NAMES = { "floor-restoration": { ru: "Реставрация полов", ro: "Restaurare pardoseli" } };
const T = {
  ru: { in: "в Кишинёве", sub: " и пригородах", m2: "м²", item: "за предмет", hours: "Работаем ежедневно с 8:00 до 21:00.",
    guar: "Если качество не устроит, сообщите в течение 24 часов — клинер приедет повторно бесплатно.",
    calc: "Точную сумму покажет калькулятор на этой странице.", visit: "Стоимость — после осмотра.", from: "от", to: "до", cur: "лей", inc: "Что входит:" },
  ro: { in: "în Chișinău", sub: " și suburbii", m2: "m²", item: "per obiect", hours: "Lucrăm zilnic între 8:00 și 21:00.",
    guar: "Dacă nu sunteți mulțumit de calitate, anunțați-ne în 24 de ore și trimitem gratuit un curățător din nou.",
    calc: "Prețul exact îl arată calculatorul de pe această pagină.", visit: "Prețul — după evaluare.", from: "de la", to: "la", cur: "lei", inc: "Ce include:" },
};
const firstSentence = (s) => (s.match(/^.*?[.!?](?=\s|$)/) || [s])[0];
function serviceAnswer(html, lang, slug) {
  const t = T[lang];
  const p = PRICES.find((x) => x.slug === slug) || (NAMES[slug] && { slug, ...NAMES[slug] });
  if (!p) return "";
  const text = plainText(html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, ""));
  const price = pagePrice(html);
  let priceText = "";
  if (price && p.min === price.min && (lang === "ru" ? p.pru : p.pro) && price.unit === (p.unit === "m2" ? "m2" : p.unit ? "item" : "")) {
    priceText = (lang === "ru" ? p.pru : p.pro).map((s) => (/— \d/.test(s) ? s.replace(/— (\d)/, `— ${t.from} $1`)
      : /^\d+–\d+/.test(s) ? s.replace(/^(\d+)–(\d+)/, `${t.from} $1 ${t.to} $2`) : `${t.from} ${s}`)).join(", ") + ".";
  } else if (price) {
    priceText = `${t.from} ${price.min}${price.max ? ` ${t.to} ${price.max}` : ""} ${t.cur}${price.unit === "m2" ? "/" + t.m2 : price.unit ? " " + t.item : ""}.`;
  }
  // «Что входит» — первая фраза ответа на такой вопрос в FAQ самой страницы.
  let inc = "";
  for (const item of html.split('class="expandable-single').slice(1)) {
    const m = item.match(/class="text-size-large text_body-bold"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<p class="faq-paragraph"[^>]*>([\s\S]*?)<\/p>/);
    if (m && /Что входит|Ce include|Ce intră/i.test(plainText(m[1]))) { inc = firstSentence(plainText(m[2])); break; }
  }
  // Длинный перечень — первые четыре пункта: абзац-ответ должен остаться в 40–60 слов.
  if (inc.split(/\s+/).length > 18) inc = inc.replace(/[.!?]$/, "").split(", ").slice(0, 4).join(", ") + ".";
  const parts = [
    `${p[lang]} ${t.in}${/пригород|suburbi/i.test(text) ? t.sub : ""}${priceText ? ": " + priceText : "."}`,
    inc,
    /ежедневно с 8:00 до 21:00|zilnic între 8:00 și 21:00/.test(text) ? t.hours : "",
    /в течение 24 часов — бесплатно|în 24 de ore — trimitem gratuit/.test(text) ? t.guar : "",
    priceText ? t.calc : (/после осмотра|după evaluare|după inspecție/i.test(html) ? t.visit : t.calc),
  ];
  // Не длиннее 60 слов: сначала уходит фраза про калькулятор, потом «что входит».
  const words = () => parts.join(" ").split(/\s+/).filter((w) => w && !/^[—–]$/.test(w)).length;
  if (words() > 60 && priceText) parts[4] = "";
  if (words() > 60) parts[1] = "";
  return parts.filter(Boolean).join(" ");
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function answerFirst(html, lang) {
  if (html.includes('data-lg-gen="answer"')) return html;
  const url = pageUrl(html);
  const slug = (url.match(/\/services\/([a-z-]+)$/) || [])[1];
  const home = /^https:\/\/allclean\.md\/(?:ru)?$/.test(url);
  if (!home && !slug) return html;
  const text = home ? ANSWER_HOME[lang] : serviceAnswer(html, lang, slug);
  if (!text) return html;
  const m = html.match(/<div\b[^>]*class="master_hero-home[^"]*"[^>]*>/);
  const end = m && closeOf(html, m.index, "div");
  if (!end) return html;
  // Короткие предлоги и тире не остаются в конце строки — как в заголовках.
  const typo = esc(text).replace(/ (—|–) /g, "&nbsp;$1 ")
    .replace(/(^|\s)(в|и|с|к|о|у|а|на|по|за|из|до|не|от|для|în|la|de|cu|pe|și|a|o|un|din|nu) /giu, "$1$2&nbsp;");
  const block = '<div class="lg-answer" data-lg-gen="answer" style="max-width:56rem;padding:2rem 0 1.5rem">' +
    `<p class="text-size-large margin-0">${typo}</p></div>`;
  bump("seo:answer", 1);
  return html.slice(0, end[1]) + block + html.slice(end[1]);
}

// Уборка после ремонта: цены пакетов были только в FAQ — теперь и в первом экране, под подзаголовком.
function packagePrices(html, lang) {
  if (html.includes('data-lg-gen="prices"') || !/\/services\/post-construction"/.test(html.match(/<link rel="canonical" href="[^"]+"/)?.[0] || "")) return html;
  const p = PRICES.find((x) => x.slug === "post-construction");
  const price = pagePrice(html);
  if (!price || price.min !== p.min) return html;   // клиент поменял цены — старые не показываем
  const list = (lang === "ru" ? p.pru : p.pro).slice(0, 3).map((s) => s.replace(/— (\d)/, (lang === "ru" ? "— от " : "— de la ") + "$1")).join(" · ");
  return swapRe(html, "seo:package-prices", /(<[a-z0-9]+\b[^>]*class="[^"]*hero-home_sub[^"]*"[^>]*>[\s\S]*?<\/(?:h2|p|div)>)/,
    `$1<p class="text-size-large text_body-bold margin-0" data-lg-gen="prices">${esc(list)}</p>`);
}

/** Все правки одной страницы. `lang` — 'ru' или 'ro'. */
export function applySeoFixes(html, lang) {
  let out = trailingSlash(html);
  out = contacts(out);
  out = socials(out);
  out = favicon(out);
  out = posterPreload(out);
  out = org(out, lang);
  out = h1Clean(out);
  out = jsonld(out);
  out = footerMap(out);
  out = footerServices(out, lang === "ru" ? "ru" : "ro");
  out = pricingH1(out);
  out = homeDesc(out);
  out = calcHeadings(out);
  out = packagePrices(out, lang === "ru" ? "ru" : "ro");
  out = answerFirst(out, lang === "ru" ? "ru" : "ro");
  out = thanks(out);
  out = antispam(out);
  out = consentBanner(out);
  return out;
}

export function seoReport() {
  const keys = [...counts.keys()].sort();
  return keys.length ? keys.map((k) => `${k}=${counts.get(k)}`).join(" ") : "ничего не применено";
}

/** Ворота сборки: ноль у правки значит, что шаблон поменялся и якорь больше не совпадает. */
// ⚠️ Сюда не входят починки, которым ПРАВКА КЛИЕНТА законно даёт ноль: «h1:hidden» чистит скрытые
// строки, оставшиеся от одной старой правки заголовка на /ru, — клиент перепечатал заголовок, и
// чистить нечего; «ld:faq-add» нужна четырём страницам, где FAQ есть, а разметки нет, — клиент
// убрал эти вопросы, и добавлять нечего. Ноль у них падал сборкой: публикация сообщала
// «сайт пересобирается», а сайт навсегда оставался на прошлом деплое.
export function assertSeoApplied() {
  const required = ["slash:abs", "tel:plus", "tg:phone", "viber:chat", "social:facebook", "social:linkedin", "social:instagram", "favicon", "org:jsonld", "thanks:redirect", "forms:antispam", "consent:banner",
    "ld:faq-sync", "ld:offers",
    "ld:provider", "ld:article", "footer:maps", "ads:contact-click"];
  const missing = required.filter((k) => !(counts.get(k) > 0));
  if (missing.length) {
    throw new Error("seo-fixes: не применились правки — " + missing.join(", ") +
      ". Обновите якоря в scripts/seo-fixes.mjs.");
  }
}
