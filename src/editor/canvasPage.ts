/**
 * Страница холста: зеркало + слои правок → блоки, которые видит клиент.
 *
 * Один код на кабинет (SiteEditor.loadPage) и на сверку холста с сайтом
 * (scripts/check-canvas-fidelity.mjs). Раньше сверка строила свой «двойник» и показывала ноль
 * расхождений, пока кабинет рисовал зеркало вместо сайта — проверялся не тот код.
 */

import type { ImportedPage } from "./reassemble";
import { applyOverrides, type PageOverrides } from "./realStore";
import { resolveShared, isPatchValue } from "./sharedBlocks";
import { applyMedia, type MediaRule } from "./renderCore.js";
import { withBlogCards, type BlogCardArticle } from "../../scripts/blog-cards.mjs";

/**
 * A page's overrides with the shared header/footer edits folded in — each resolved against THIS
 * page's own copy of the block, so per-page details (the language-toggle href, image alts, the
 * different footer on article pages) survive an edit made somewhere else.
 */
export function pageOverrides(p: ImportedPage, own: PageOverrides, shared: PageOverrides): PageOverrides {
  const out: PageOverrides = { ...own };
  for (const blockId of Object.keys(shared)) {
    const val = shared[blockId];
    if (val == null) continue;
    const base = p.blocks.find((b) => b.id === blockId)?.content.html;
    if (base == null) continue;
    // Общий слой несёт ПАТЧ (список точечных изменений) — его можно честно наложить на копию блока
    // этой страницы. Если там лежит готовый HTML (так писали раньше), наложить его «на все
    // страницы» — значит разослать по сайту копию чужой страницы: ровно так 18 из 19 румынских
    // страниц получили шапку главной и потеряли ссылку на свою русскую версию. Такие значения
    // пропускаем. Пустая строка — это осознанное «блок удалён», её оставляем.
    if (val !== "" && !isPatchValue(val)) continue;
    // ⚠️ ОБЩАЯ ПРАВКА СИЛЬНЕЕ СЛЕДА ПРОШЛОЙ ПУБЛИКАЦИИ. Своя версия у шапки и подвала появляется
    // ровно одним способом: предыдущая публикация РАЗВЕРНУЛА общую правку в каждую страницу. Если
    // считать её главнее, любая следующая правка шапки или подвала молча перестаёт доходить.
    // Патч применяется всегда, когда его удаётся разместить на этой странице; если нельзя
    // (у страницы другая вёрстка блока) — остаётся то, что у неё есть.
    const r = resolveShared(base, val);
    // Патчи применяются по одному: если один не нашёл своего места, остальные всё равно на месте.
    if (r.html) out[blockId] = r.html;
  }
  return out;
}

/** Blocks as the canvas shows them: overrides, then the site's photo rules, then blog cards. */
export function canvasBlocks(p: ImportedPage, ov: PageOverrides, rules: MediaRule[], cards: BlogCardArticle[]) {
  return applyOverrides(p.blocks, ov).map((b) => {
    let html = b.content.html;
    if (rules.length) html = applyMedia(html, rules);
    if (cards.length) html = withBlogCards(html, cards, p.lang);
    return html === b.content.html ? b : { ...b, content: { ...b.content, html } };
  });
}
