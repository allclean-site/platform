/**
 * Карточка статьи в списке блога — одна на сборку и на холст редактора.
 *
 * Статьи, опубликованные из кабинета, хранятся в базе, а их карточки сборка вставляла в готовый
 * HTML списка блога. Холст этого не делал, и клиент видел в редакторе на одну статью меньше, чем
 * на сайте. Теперь разметка карточки и место вставки описаны здесь, и обе стороны зовут это.
 *
 * Модуль намеренно без зависимостей: его подключают и сборка (node), и кабинет (браузер).
 */

const escHtml = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escHtml(s).replace(/"/g, "&quot;");

/** Адрес статьи: румынская лежит в корне, остальные под своим языком. */
export const artPathOf = (locale, slug) => (locale === "ro" ? `/blog/${slug}` : `/${locale}/blog/${slug}`);

/** Карточка по разметке `.grid_blog` из зеркала. */
export function blogCardHtml(a, locale) {
  const date = new Date(a.publish_at || a.created_at || a.createdAt || Date.now())
    .toLocaleDateString(locale === "ru" ? "ru-RU" : "ro-RO", { day: "numeric", month: "long", year: "numeric" });
  const url = artPathOf(locale, a.slug);
  const cta = locale === "ru" ? "Читать статью" : "Citește articolul";
  const cover = (a.cover_url || a.coverUrl)
    ? `<div class="image-wrap_article"><img src="${escAttr(a.cover_url || a.coverUrl)}" loading="lazy" alt="${escAttr(a.cover_alt || a.coverAlt || (a.meta && a.meta.coverAlt) || a.title)}" class="image_cover"></div>`
    : "";
  return `<div role="listitem" class="w-dyn-item"><a href="${url}" class="link_article w-inline-block">${cover}` +
    `<div class="article-card_bottom-tile"><div class="text-wrap_article-card">` +
    `<div class="text-size-small">${escHtml(date)}</div>` +
    `<div class="heading-style-h4">${escHtml(a.title)}</div></div>` +
    `<div button-tertiary="" class="cta_tertiary"><div>${escHtml(cta)}</div></div></div></a></div>`;
}

// ---- «Полезные статьи» на странице услуги ----------------------------------------------------------
// Статья знает свою услугу (meta.service_page, путь вида /ru/services/deep-cleaning). Сборка, холст
// кабинета и ворота зовут одни и те же функции, иначе холст расходился бы с сайтом на этот блок.

const SERVICE_PAGE = /^(\/ru)?\/services\/[a-z0-9-]+$/;
const RELATED = /<section\b[^>]*\bdata-lg-related\b[^>]*>[\s\S]*?<\/section>/g;

export const serviceOfArticle = (a) => {
  const m = (a && a.meta) || {};
  return String(m.service_page || (m.queue && m.queue.service_page) || "")
    .replace(/^https?:\/\/(www\.)?allclean\.md/, "").replace(/\/$/, "");
};

/** До трёх свежих опубликованных статей этой услуги на языке страницы. */
export function relatedArticles(pagePath, locale, arts) {
  const p = String(pagePath || "").replace(/\/$/, "");
  if (!SERVICE_PAGE.test(p)) return [];
  const t = (a) => Date.parse(a.publish_at || a.created_at || 0) || 0;
  return (arts || []).filter((a) => a.locale === locale && serviceOfArticle(a) === p && (!a.status || a.status === "published"))
    .sort((x, y) => t(y) - t(x)).slice(0, 3);
}

/** Блок «Полезные статьи» перед разделом вопросов. Старый блок снимается: повторный вызов не дублирует. */
export function withRelatedArticles(html, arts, locale) {
  if (!html) return html;
  const clean = html.replace(RELATED, "");
  if (!arts || !arts.length) return clean;
  const at = clean.indexOf('class="faq-block');
  const pos = at >= 0 ? clean.lastIndexOf("<section", at) : -1;
  if (pos < 0) return clean;
  const t = locale === "ru" ? { label: "Блог", h2: "Полезные статьи" } : { label: "Blog", h2: "Articole utile" };
  const block = `<section class="section_related-articles" data-lg-related="" style="padding:0 0 4rem"><div class="padding-global">` +
    `<div class="w-layout-blockcontainer container-large w-container"><div class="master_label"><div class="label-large">${t.label}</div></div>` +
    `<h2 class="heading-style-h4" style="margin:1rem 0 2rem">${t.h2}</h2>` +
    `<div role="list" class="grid_blog w-dyn-items">${arts.map((a) => blogCardHtml(a, locale)).join("")}</div></div></div></section>`;
  return clean.slice(0, pos) + block + clean.slice(pos);
}

/** Карточки в начало сетки `.grid_blog`. Возвращает исходный HTML, если сетки или карточек нет. */
export function withBlogCards(html, cards, locale) {
  if (!html || !cards || !cards.length) return html;
  const grid = /(<div[^>]*class="[^"]*grid_blog[^"]*"[^>]*>)/;
  if (!grid.test(html)) return html;
  return html.replace(grid, `$1${cards.map((a) => blogCardHtml(a, locale)).join("")}`);
}
