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
  'var done=false,go=function(){if(done)return;done=true;location.href=(/^\\/ru(\\/|$)/.test(location.pathname)?"/ru":"")+"/thank-you";};' +
  'setTimeout(go,2500);r.then(go,go);}return r;};})();</script>';
function thanks(html) {
  if (html.includes(THANKS_MARK)) return html;
  return swapRe(html, "thanks:redirect", /<\/body>/, THANKS + "</body>");
}

// ── 7. Окно согласия и тег Google Ads ────────────────────────────────────────────────
// Закон 195/2024 и обещание страницы /cookies: до «Принять» ни скрипта Google, ни cookie —
// IP посетителя не уходит третьей стороне без согласия (как и с чужими CDN в site-privacy).
// Кнопки равные. Выбор — lg_consent в localStorage на 12 месяцев; «Отклонить» после «Принять»
// стирает _gcl_* и перезагружает страницу. Только на allclean.md (в холсте кабинета окна нет);
// на localhost окно включается параметром ?lgconsent для проверки.
// Конверсия = просмотр /thank-you (правило «URL содержит thank-you» в Google Ads).
export const ADS_ID = "AW-18495907060";
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
  'window.lgConsentOpen=show;var c=get();if(c==="granted")load();else if(c!=="denied"){' +
  'if(document.body)show();else document.addEventListener("DOMContentLoaded",show);}' +
  '})();</script>';
function consentBanner(html) {
  if (html.includes(CONSENT_MARK)) return html;
  return swapRe(html, "consent:banner", /<\/body>/, CONSENT_JS + "</body>");
}

/** Все правки одной страницы. `lang` — 'ru' или 'ro'. */
export function applySeoFixes(html, lang) {
  let out = trailingSlash(html);
  out = contacts(out);
  out = socials(out);
  out = favicon(out);
  out = posterPreload(out);
  out = org(out, lang);
  out = thanks(out);
  out = consentBanner(out);
  return out;
}

export function seoReport() {
  const keys = [...counts.keys()].sort();
  return keys.length ? keys.map((k) => `${k}=${counts.get(k)}`).join(" ") : "ничего не применено";
}

/** Ворота сборки: ноль у правки значит, что шаблон поменялся и якорь больше не совпадает. */
export function assertSeoApplied() {
  const required = ["slash:abs", "tel:plus", "tg:phone", "viber:chat", "social:facebook", "social:instagram", "favicon", "org:jsonld", "thanks:redirect", "consent:banner"];
  const missing = required.filter((k) => !(counts.get(k) > 0));
  if (missing.length) {
    throw new Error("seo-fixes: не применились правки — " + missing.join(", ") +
      ". Обновите якоря в scripts/seo-fixes.mjs.");
  }
}
