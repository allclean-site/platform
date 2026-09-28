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

console.log("media-map: PASS");
