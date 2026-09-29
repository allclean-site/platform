/**
 * Шапка страницы статьи, которую клиент опубликует из кабинета.
 *
 * Статьи собираются из статьи-образца, а в её шапке ТРИ блока разметки: карточка компании, сама
 * статья и хлебные крошки. Замена без флага g попадала в первый — то есть каждая новая статья
 * теряла карточку компании и получала Article и вопросы от образца. Эта проверка держит их врозь.
 *
 *   node scripts/check-article-head.mjs
 */
process.env.BUILD_SITE_NO_RUN = "1";
const { buildHead } = await import("./build-site.mjs");
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const ОБРАЗЕЦ = JSON.parse(readFileSync(
  "public/import/allclean/ru__blog__generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya.json", "utf8")).prefix;

const статья = {
  locale: "ru", slug: "kak-myt-okna", title: "Как мыть окна без разводов",
  seo_title: "Как мыть окна без разводов — All Clean", seo_description: "Короткое описание статьи.",
  cover_url: "https://example.com/cover.jpg",
  jsonld: { "@context": "https://schema.org", "@graph": [{ "@type": "Article", headline: "Как мыть окна без разводов" }] },
};

const h = buildHead(ОБРАЗЕЦ, статья, "cum-speli-geamurile", "kak-myt-okna");

const блоки = [...h.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const типы = блоки.map((o) => (o["@graph"] ? "graph:" + o["@graph"].map((x) => x["@type"]).join("+") : String(o["@type"])));

assert.equal(блоки.length, 3, "блоков разметки должно остаться три");
assert.ok(типы.some((t) => /LocalBusiness/.test(t)), "карточка компании потеряна: " + типы.join(" | "));
assert.ok(типы.some((t) => t === "graph:Article"), "разметка статьи не подставлена: " + типы.join(" | "));
assert.ok(!JSON.stringify(блоки).includes("FAQPage"), "от образца остались его вопросы");
assert.ok(!JSON.stringify(блоки).includes("поддерживающая"), "от образца остался его текст");

const крошки = блоки.find((o) => o["@type"] === "BreadcrumbList");
const последняя = крошки.itemListElement[крошки.itemListElement.length - 1];
assert.equal(последняя.name, статья.seo_title, "в хлебных крошках чужая статья");
assert.ok(String(последняя.item).endsWith("/ru/blog/kak-myt-okna"), "в хлебных крошках чужой адрес");

// Open Graph: ни одного дубля и обложка этой статьи, а не образца.
for (const prop of ["og:type", "og:image", "og:title", "og:description"]) {
  const n = (h.match(new RegExp(`property="${prop}"`, "g")) || []).length;
  assert.equal(n, 1, `${prop} встречается ${n} раз`);
}
assert.match(h, /property="og:image" content="https:\/\/example\.com\/cover\.jpg"/, "обложка не подставлена");
assert.match(h, /name="twitter:image" content="https:\/\/example\.com\/cover\.jpg"/, "картинка твиттер-карточки не подставлена");
assert.match(h, /<title>Как мыть окна без разводов — All Clean<\/title>/);
assert.match(h, /rel="canonical" href="https:\/\/allclean\.md\/ru\/blog\/kak-myt-okna"/);
assert.match(h, /hreflang="ro-MD" href="https:\/\/allclean\.md\/blog\/cum-speli-geamurile"/);

console.log("[check-article-head] ок: три блока разметки на местах, og без дублей, адреса этой статьи");
