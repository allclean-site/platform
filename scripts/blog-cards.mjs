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
  const date = new Date(a.created_at || a.createdAt || Date.now())
    .toLocaleDateString(locale === "ru" ? "ru-RU" : "ro-RO", { day: "numeric", month: "long", year: "numeric" });
  const url = artPathOf(locale, a.slug);
  const cta = locale === "ru" ? "Читать статью" : "Citește articolul";
  const cover = (a.cover_url || a.coverUrl)
    ? `<div class="image-wrap_article"><img src="${escAttr(a.cover_url || a.coverUrl)}" loading="lazy" alt="${escAttr(a.cover_alt || a.coverAlt || a.title)}" class="image_cover"></div>`
    : "";
  return `<div role="listitem" class="w-dyn-item"><a href="${url}" class="link_article w-inline-block">${cover}` +
    `<div class="article-card_bottom-tile"><div class="text-wrap_article-card">` +
    `<div class="text-size-small">${escHtml(date)}</div>` +
    `<div class="heading-style-h4">${escHtml(a.title)}</div></div>` +
    `<div button-tertiary="" class="cta_tertiary"><div>${escHtml(cta)}</div></div></div></a></div>`;
}

/** Карточки в начало сетки `.grid_blog`. Возвращает исходный HTML, если сетки или карточек нет. */
export function withBlogCards(html, cards, locale) {
  if (!html || !cards || !cards.length) return html;
  const grid = /(<div[^>]*class="[^"]*grid_blog[^"]*"[^>]*>)/;
  if (!grid.test(html)) return html;
  return html.replace(grid, `$1${cards.map((a) => blogCardHtml(a, locale)).join("")}`);
}
