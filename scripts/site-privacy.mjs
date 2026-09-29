// Правки, которых требует Закон № 195/2024, — поверх зеркала, на выходе сборки.
//
// Почему здесь, а не в самом зеркале. `public/import/allclean` — это снимок сайта,
// каким его выдал исходный Astro-проект; он должен оставаться снимком, иначе теряется
// смысл сверки «отредактированная страница совпадает с живой». Поэтому исправления
// живут одним файлом и применяются к готовому HTML: их видно целиком, их можно
// пересмотреть, и повторный импорт зеркала их не сотрёт.
//
// Каждая замена привязана к точной строке и считается. Если зеркало пересняли и якорь
// пропал, сборка не молчит: `report()` печатает нули, а `assertApplied()` роняет сборку.
// Молча выкатить сайт без обязательной галочки согласия — ровно то, чего допускать нельзя.

// Редакция политики конфиденциальности. Уходит в базу вместе с каждой заявкой: по ней
// видно, на какой текст соглашался человек. Меняете политику — меняете и её.
export const POLICY_VERSION = "2026-08-31";

const counts = new Map();
const bump = (key, n) => counts.set(key, (counts.get(key) || 0) + n);

/** Замена по точной строке с подсчётом. */
function swap(html, key, from, to) {
  const parts = html.split(from);
  if (parts.length > 1) bump(key, parts.length - 1);
  return parts.join(to);
}

/** Замена по выражению с подсчётом. */
function swapRe(html, key, re, to) {
  let n = 0;
  const out = html.replace(re, (...a) => { n++; return typeof to === "function" ? to(...a) : to; });
  if (n) bump(key, n);
  return out;
}

// ── 1. Чужой CDN ─────────────────────────────────────────────────────────────────────
// Скрипты Webflow, GSAP и один шрифт грузились с cdn.prod.website-files.com. Это значит,
// что IP каждого посетителя уходил третьей стороне ещё до того, как он что-то нажал, —
// без основания и без согласия. Файлы лежат в public/site-assets, сборщик копирует их
// в корень сайта, поэтому здесь достаточно переписать адреса.
function localizeCdn(html) {
  html = swap(html, "cdn:webflow-js", "https://cdn.prod.website-files.com/692f17afc3743c9cd4b7cac6/js/", "/js/webflow/");
  html = swap(html, "cdn:gsap", "https://cdn.prod.website-files.com/gsap/3.15.0/", "/js/webflow/");
  html = swap(html, "cdn:font",
    "https://cdn.prod.website-files.com/692f17afc3743c9cd4b7cac6/692f17afc3743c9cd4b7cbdd_Raveo%20Display%20Medium.woff2",
    "/fonts/webflow/RaveoDisplay-Medium.woff2");
  // preconnect/dns-prefetch к тому же хосту: соединение открывается заранее, то есть
  // обращение к чужому серверу происходит, даже если файл оттуда больше не нужен.
  html = swapRe(html, "cdn:preconnect", /\s*<link[^>]+cdn\.prod\.website-files\.com[^>]*>/g, "");
  return html;
}

// ── 2. Согласие ──────────────────────────────────────────────────────────────────────
// Галочка была необязательной, а её значение никуда не сохранялось. По ст. 7 ч. 1 доказать
// согласие обязан оператор, и галочка, проверенная только в браузере, не доказывает ничего.
// Поэтому: поле обязательное, а вместе с заявкой в базу уходят факт, момент и редакция
// политики. Столбцы добавляет scripts/supabase-consent.sql — его нужно выполнить ДО выката.
function consent(html) {
  html = swapRe(html, "consent:required", /<input([^>]*id="[a-z0-9-]*consent"[^>]*)>/g,
    (m, attrs) => (/\srequired/.test(attrs) ? m : `<input${attrs} required>`));

  // Форма записи: собранный (минифицированный) код Astro, объект заявки заканчивается на
  // source_url. Встречается ровно один раз на странице.
  html = swap(html, "consent:book",
    "source_url:location.href}",
    `source_url:location.href,consent:!0,consent_at:new Date().toISOString(),policy_version:"${POLICY_VERSION}"}`);

  // Калькуляторы: обычный, нечитаемый код инлайном, по одному на каждый калькулятор.
  html = swap(html, "consent:calc",
    "source_url: location.href }),",
    `source_url: location.href, consent: true, consent_at: new Date().toISOString(), policy_version: '${POLICY_VERSION}' }),`);
  return html;
}

// ── 3. Фотографии помещений ──────────────────────────────────────────────────────────
// Снимки чужого жилья лежали в открытом хранилище, а имя файла складывалось из времени
// отправки и пяти символов Math.random() — то есть адрес чужой фотографии подбирался.
// Теперь имя случайное, в заявку пишется путь, а не адрес, и предпросмотр берётся из
// самого файла: посетителю право на чтение хранилища больше не нужно.
// Само хранилище закрывает scripts/supabase-photos-private.sql — после выката.
function photos(html) {
  html = swap(html, "photo:name",
    "var path = 'apartments/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + (f.name.split('.').pop() || 'jpg').toLowerCase();",
    "var rnd = new Uint8Array(16); crypto.getRandomValues(rnd); " +
    "var nm_ = Array.prototype.map.call(rnd, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); " +
    "var path = 'apartments/' + nm_ + '.' + (f.name.split('.').pop() || 'jpg').toLowerCase();");

  html = swap(html, "photo:store",
    "var url = SUPABASE_URL + '/storage/v1/object/public/calc-uploads/' + path; photos.push(url);",
    "var url = URL.createObjectURL(f); photos.push(path);");

  // Кнопка «убрать фото» удаляла запись по адресу — теперь в списке лежит путь.
  html = swap(html, "photo:remove",
    "photos = photos.filter(function (u) { return u !== url; })",
    "photos = photos.filter(function (u) { return u !== path; })");
  return html;
}

// ── 4. Реквизиты оператора в подвале ─────────────────────────────────────────────────
// Человек должен видеть, КОМУ он оставляет данные, не открывая политику.
const OPERATOR_RU = "«ALL CLEAN COMPANY» SRL · IDNO 1020600014361 · мун. Кишинёв, ул. Месаджер, 7, MD-2069";
const OPERATOR_RO = "„ALL CLEAN COMPANY” SRL · IDNO 1020600014361 · mun. Chișinău, str. Mesager 7, MD-2069";

// Подвал — <section class="footer">, а сразу за ним пустой <div class="ultra-master">.
// Это единственная точка на странице, где секция подвала закрывается, поэтому вставляем
// строку реквизитов перед ней.
const FOOTER_END = '</section> <div class="ultra-master">';

function footer(html, lang) {
  if (html.includes("ac-requisites")) return html;
  const text = lang === "ru" ? OPERATOR_RU : OPERATOR_RO;
  const cookies = lang === "ru"
    ? '<a href="/ru/cookies" style="color:inherit">Cookie</a>'
    : '<a href="/cookies" style="color:inherit">Cookie</a>';
  const block =
    '<div class="ac-requisites" style="max-width:1280px;margin:0 auto;padding:14px 5% 26px;border-top:1px solid rgba(255,255,255,.14);' +
    'font-size:.78rem;line-height:1.7;color:rgba(255,255,255,.55)">' +
    text + " · " + cookies +
    ' · <a href="mailto:info@allclean.md" style="color:inherit">info@allclean.md</a></div>';
  return swap(html, "footer:requisites", FOOTER_END, block + FOOTER_END);
}

// ── 5. Страховка на время миграции ───────────────────────────────────────────────────
// Поля согласия появляются в заявке раньше, чем столбцы в базе: сборку выкатывают одним
// движением, а SQL выполняют руками. Если порядок перепутать, PostgREST ответит 400
// «column ... does not exist» — и обращение человека потеряется. Потерять заявку хуже,
// чем на несколько минут остаться без отметки о согласии, поэтому одна отправка
// повторяется без этих трёх полей. Когда миграция применена, код не срабатывает ни разу;
// после неё его можно снять.
const GUARD_MARK = "lg-consent-guard";
const CONSENT_GUARD =
  '<script>/*lg-consent-guard*/(function(){var f=window.fetch;window.fetch=function(u,o){' +
  'var r=f.apply(this,arguments);' +
  'if(!o||String(o.method).toUpperCase()!=="POST"||String(u).indexOf("/rest/v1/site_leads")<0)return r;' +
  'return r.then(function(res){if(res.status!==400)return res;' +
  'return res.clone().text().then(function(t){' +
  'if(!/consent|policy_version|PGRST204/i.test(t))return res;' +
  'try{var b=JSON.parse(o.body);delete b.consent;delete b.consent_at;delete b.policy_version;' +
  'return f(u,Object.assign({},o,{body:JSON.stringify(b)}));}catch(e){return res;}});});};})();</script>';

function consentGuard(html) {
  // Единственная из правок, чей якорь (`</body>`) переживает первое применение. Слой теперь
  // накладывается не только на выходе сборки, но и в холсте кабинета, поэтому страховка от
  // второго прохода нужна явная — иначе в документе оказалось бы две копии обёртки fetch.
  if (html.includes(GUARD_MARK)) return html;
  return swap(html, "consent:guard", "</body>", CONSENT_GUARD + "</body>");
}

/** Все правки одной страницы. `lang` — 'ru' или 'ro'. */
export function applySitePrivacy(html, lang) {
  let out = html;
  out = localizeCdn(out);
  out = consent(out);
  out = photos(out);
  out = footer(out, lang);
  out = consentGuard(out);
  return out;
}

/** Строка для лога сборки. */
export function report() {
  const keys = [...counts.keys()].sort();
  return keys.length ? keys.map((k) => `${k}=${counts.get(k)}`).join(" ") : "ничего не применено";
}

/**
 * Ворота: правки, без которых сайт выкатывать нельзя. Ноль означает, что зеркало
 * изменилось и якорь больше не совпадает, — сборка должна упасть, а не выпустить
 * страницу без обязательной галочки или с чужим CDN.
 */
export function assertApplied() {
  const required = ["cdn:webflow-js", "cdn:gsap", "cdn:font", "consent:required", "consent:book", "consent:calc", "photo:name", "photo:store", "photo:remove", "footer:requisites", "consent:guard"];
  const missing = required.filter((k) => !counts.get(k));
  if (missing.length) {
    throw new Error(
      "site-privacy: не применились обязательные правки — " + missing.join(", ") +
      ". Зеркало изменилось: обновите якоря в scripts/site-privacy.mjs, иначе сайт уедет без них."
    );
  }
}
