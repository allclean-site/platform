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
function socials(html) {
  html = swapRe(html, "social:facebook", /href="https:\/\/facebook\.com"/g, `href="${FACEBOOK}" rel="noopener"`);
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

// ── 4б. Постер видео первого экрана ───────────────────────────────────────────────────
// Самый крупный элемент первого экрана — фоновое видео; пока оно не пошло, виден постер.
// Браузер узнавал о постере только после 230 КБ встроенных стилей и скриптов Webflow, и на
// телефоне первый экран дорисовывался за 6,9 с (Lighthouse, /ru/services/home-cleaning).
const POSTER = "/video/hero-poster.jpg";
function posterPreload(html) {
  if (!html.includes(`data-poster-url="${POSTER}"`) || html.includes(`rel="preload" as="image" href="${POSTER}"`)) return html;
  return swapRe(html, "poster:preload", /<\/head>/, `<link rel="preload" as="image" href="${POSTER}" fetchpriority="high"></head>`);
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
    "https://www.linkedin.com/company/65692470",
  ],
};
function org(html, lang) {
  return html.replace(/(<script type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (whole, open, json, close) => {
      let o;
      try { o = JSON.parse(json); } catch { return whole; }
      if (![].concat(o["@type"] || []).includes("LocalBusiness")) return whole;
      bump("org:jsonld", 1);
      Object.assign(o, { url: lang === "ru" ? `${SITE}/ru` : `${SITE}/` }, ORG_EXTRA);
      return open + JSON.stringify(o) + close;
    });
}

/** Все правки одной страницы. `lang` — 'ru' или 'ro'. */
export function applySeoFixes(html, lang) {
  let out = trailingSlash(html);
  out = contacts(out);
  out = socials(out);
  out = favicon(out);
  out = posterPreload(out);
  out = org(out, lang);
  return out;
}

export function seoReport() {
  const keys = [...counts.keys()].sort();
  return keys.length ? keys.map((k) => `${k}=${counts.get(k)}`).join(" ") : "ничего не применено";
}

/** Ворота сборки: ноль у правки значит, что шаблон поменялся и якорь больше не совпадает. */
export function assertSeoApplied() {
  const required = ["slash:abs", "tel:plus", "tg:phone", "viber:chat", "social:facebook", "social:instagram", "favicon", "org:jsonld"];
  const missing = required.filter((k) => !(counts.get(k) > 0));
  if (missing.length) {
    throw new Error("seo-fixes: не применились правки — " + missing.join(", ") +
      ". Обновите якоря в scripts/seo-fixes.mjs.");
  }
}
