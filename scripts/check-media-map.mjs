/**
 * Self-check for the site-wide media map — the rule that makes ONE photo replacement reach every
 * copy, every screen width and both languages. Run: node scripts/check-media-map.mjs
 *
 * The cases below are the real shapes from the imported mirror: a service card duplicated into a
 * desktop marquee and a phone slider, the same card on the Russian page under a /ru/ link, Webflow's
 * -p-500/-p-800 responsive twins, an icon that must NOT be swapped, and a background video.
 */
import assert from "node:assert";
import { applyMedia, encodeMedia, decodeMedia, mediaIdentity, linkSlot } from "../src/editor/renderCore.js";

const NEW = "https://cdn.example/new-photo.jpg";
const card = (href, src, extra = "") =>
  `<a href="${href}" class="card_scroll-service w-inline-block"><div class="image-wrap_nav-service">` +
  `<img src="${src}" loading="lazy" sizes="100vw" srcset="${src.replace(/\.jpg$/, "-p-500.jpg")} 500w, ${src} 996w" alt="AllClean">` +
  `</div>${extra}<div class="heading-style-h4">Curățenie</div></a>`;

// ---- 1. no rules: byte-identical -----------------------------------------------------------------
const page0 = card("/services/windows", "/images/services/feature-image.jpg");
assert.equal(applyMedia(page0, []), page0);
assert.equal(applyMedia(page0, null), page0);

// ---- 2. one card rule reaches every copy, both locales, and kills the responsive twins ------------
const page = [
  "<section class=\"marquee home-marquee\">",
  card("/services/windows", "/images/services/feature-image.jpg"),          // desktop copy
  card("/services/windows", "/images/services/feature-image.jpg"),          // marquee loop copy
  "</section><div class=\"slider slider-services\">",
  card("/ru/services/windows", "/images/services/feature-image-p-800.jpg"), // phone copy, other locale link
  "</div>",
  card("/services/carpet", "/images/services/feature-image.jpg"),           // SAME file, different service
  "<img src=\"/images/logo.svg\" alt=\"logo\">",                            // furniture
].join("");

const out = applyMedia(page, [{ scope: "link:/services/windows", to: NEW }]);
assert.equal((out.match(/new-photo\.jpg/g) || []).length, 3, "all three copies of that card, both locales");
assert.ok(!/feature-image(-p-\d+)?\.jpg"[^>]*>\s*<\/div>(?=.*windows)/.test(out), "no old photo left in the windows card");
assert.ok(out.includes(card("/services/carpet", "/images/services/feature-image.jpg")), "another service that happens to share the file is untouched");
assert.ok(out.includes("/images/logo.svg"), "an icon inside the card is not a photo");
assert.ok(!/srcset=/.test(out.slice(0, out.indexOf("carpet"))), "srcset removed where the photo was replaced");
assert.ok(!/sizes=/.test(out.slice(0, out.indexOf("carpet"))), "sizes removed with it");

// ---- 3. idempotent -------------------------------------------------------------------------------
assert.equal(applyMedia(out, [{ scope: "link:/services/windows", to: NEW }]), out, "applying twice changes nothing");

// ---- 4. url rules: src, responsive twin, background, poster, video list ---------------------------
const loose =
  '<img src="/images/content/book-about-p-500.avif" srcset="/images/content/book-about-p-500.avif 500w" alt="">' +
  '<div style="background-image: url(&quot;/video/hero-poster.jpg&quot;)" data-poster-url="/video/hero-poster.jpg" data-video-urls="/video/hero.mp4,/video/hero.webm">' +
  '<video poster="/video/hero-poster.jpg"><source src="/video/hero.mp4"></video></div>';
const POSTER = "https://cdn.example/poster.jpg";
const MP4 = "https://cdn.example/clip.mp4";
const r2 = applyMedia(loose, [
  { scope: "url:/images/content/book-about.avif", to: NEW },
  { scope: "url:/video/hero-poster.jpg", to: POSTER },
  { scope: "url:/video/hero.mp4", to: MP4 },
]);
assert.ok(r2.includes(`src="${NEW}"`), "responsive twin matched by identity");
assert.ok(!r2.includes("book-about"), "old photo gone, srcset with it");
assert.ok(r2.includes(`url(&quot;${POSTER}&quot;)`), "inline background rewritten, quoting kept");
assert.ok(r2.includes(`data-poster-url="${POSTER}"`), "Webflow poster attribute rewritten");
assert.ok(r2.includes(`data-video-urls="${MP4},/video/hero.webm"`), "video list rewritten per entry");
assert.ok(r2.includes(`poster="${POSTER}"`) && r2.includes(`<source src="${MP4}">`), "video poster and source rewritten");

// ---- 5. identity + slot helpers ------------------------------------------------------------------
assert.equal(mediaIdentity("https://allclean.md/site-assets/images/x-p-800.jpg"), "/images/x.jpg");
assert.equal(mediaIdentity("/site-assets/site-assets/images/x.jpg"), "/images/x.jpg");
assert.equal(linkSlot("https://allclean.md/ru/services/windows/"), "/services/windows");
assert.equal(linkSlot("/services/windows?utm=1"), "/services/windows");
assert.equal(linkSlot("/"), "/");

// ---- 6. encode / decode round-trip, and garbage in → nothing out ----------------------------------
const rules = [{ scope: "link:/services/windows", to: NEW, from: "/images/services/feature-image-2.jpg" }];
assert.deepEqual(decodeMedia(encodeMedia(rules)), rules);
assert.deepEqual(decodeMedia("not a map"), []);
assert.deepEqual(decodeMedia(null), []);
assert.deepEqual(decodeMedia("lgmedia:1:{broken"), []);
assert.deepEqual(decodeMedia(encodeMedia([{ scope: "link:/x" }])), [], "a rule without a target is dropped");

// ---- 7. НАСТОЯЩИЕ формы разметки зеркала ----------------------------------------------------------
// (а) карточка каталога: фото и ссылка — СОСЕДИ внутри карточки, ссылка пустая и идёт ПОСЛЕ фото
const catalogue = (href, src) =>
  `<div cms-item="" role="listitem" class="collection-item_services w-dyn-item">` +
  `<div class="image-wrap_service-item"><img src="${src}" loading="lazy" class="image_cover"></div>` +
  `<div class="content_service-item"><h2>Curățenie</h2></div>` +
  `<a cms-item="" href="${href}" class="link_service w-inline-block"></a></div>`;

const grid = "<section class=\"grid\">" +
  catalogue("/ru/services/office", "/images/services/feature-image.jpg") +       // тот же файл…
  catalogue("/ru/services/warehouse", "/images/services/feature-image.jpg") +    // …у другой услуги
  "</section>";
const OFFICE = "https://cdn.example/office.jpg";
const g1 = applyMedia(grid, [{ scope: "link:/services/office", from: "/images/services/feature-image.jpg", to: OFFICE }]);
assert.equal((g1.match(/office\.jpg/g) || []).length, 1, "карточка каталога (ссылка-сосед) обязана попасть под правило");
assert.ok(g1.includes(catalogue("/ru/services/warehouse", "/images/services/feature-image.jpg")), "чужая услуга с тем же файлом не тронута");

// (б) две РАЗНЫЕ карточки с одной ссылкой и разными исходниками — меняется только своя
const twin = card("/services/home-cleaning", "/images/services/feature-image.jpg") +
             card("/services/home-cleaning", "/images/services/feature-image-1.jpg");
const t1 = applyMedia(twin, [{ scope: "link:/services/home-cleaning", from: "/images/services/feature-image-1.jpg", to: OFFICE }]);
assert.equal((t1.match(/office\.jpg/g) || []).length, 1, "меняется только карточка со своим исходником");
assert.ok(t1.includes("/images/services/feature-image.jpg"), "соседняя карточка с тем же href осталась своей");

// (в) другая локаль: исходника из правила на странице нет — правило всё равно применяется к слоту
const other = card("/ru/services/home-cleaning", "/images/other-original.jpg");
const t2 = applyMedia(other, [{ scope: "link:/services/home-cleaning", from: "/images/services/feature-image-1.jpg", to: OFFICE }]);
assert.ok(t2.includes(OFFICE), "в другой языковой версии слот меняется, даже если исходник там другой");

// ---- 8. замена дважды: адрес ведёт на последнее фото ----------------------------------------------
const chain = applyMedia('<img src="/images/a.jpg">', [
  { scope: "url:/images/a.jpg", to: "https://cdn.example/b.jpg" },
  { scope: "url:https://cdn.example/b.jpg", to: "https://cdn.example/c.jpg" },
]);
assert.ok(chain.includes("c.jpg") && !chain.includes("b.jpg"), "цепочка замен ведёт к последнему фото");

// ---- 9. секция с НЕСКОЛЬКИМИ ссылками — не карточка ----------------------------------------------
const section = '<section><a href="/services/office">Услуги</a><a href="/pricing">Цены</a>' +
  '<img src="/images/hero.jpg"></section>';
assert.equal(applyMedia(section, [{ scope: "link:/services/office", to: OFFICE }]), section,
  "фото в секции с несколькими ссылками не приписывается ни одной");

// ---- 10. постер фонового видео живёт в трёх местах — переписать надо все три ---------------------
const hero = '<div data-poster-url="/video/hero-poster.jpg" data-video-urls="/video/hero.mp4,/video/hero.webm">' +
  '<video poster="/video/hero-poster.jpg" style="background-image: url(&quot;/video/hero-poster.jpg&quot;)">' +
  '<source src="/video/hero.mp4"></video></div>';
const h1 = applyMedia(hero, [{ scope: "url:/video/hero-poster.jpg", to: POSTER }]);
assert.equal((h1.match(/hero-poster\.jpg/g) || []).length, 0, "старый постер не остаётся ни в одном из трёх мест");
assert.equal((h1.match(/poster\.jpg/g) || []).length, 3, "переписаны и атрибут, и фон, и data-poster-url");

console.log("media-map: PASS");

