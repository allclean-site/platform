/**
 * Build the iframe document for a page. AllClean's markup uses root asset paths (/images, /fonts,
 * /video, /js, /logo.svg) which would collide with the platform's own root assets — so for the
 * PREVIEW only we rewrite them to /site-assets/*. Stored blocks and the static export keep the real
 * paths (the deployed site serves them from its own root); see ./assetPaths for that boundary.
 */

import { type ImportedPage } from "./reassemble";
import { reassembleForEdit } from "./editRuntime";
import { exportPageHtml } from "./exportSite";
import { toPreview } from "./assetPaths";
import type { PageBp } from "./bpStore";
// Тот же файл, которым сборка накладывает правки закона 195/2024 на выходе. Один источник:
// разойдись они — холст снова показывал бы не ту страницу, что уедет к посетителю.
import { applySitePrivacy } from "../../scripts/site-privacy.mjs";
import { LEGAL_PAGES, renderLegalMain } from "../../scripts/legal-pages.mjs";

/**
 * Политика конфиденциальности и страница про cookie собираются из кода: их текст обязан описывать
 * реальные процессы (Закон № 195/2024), поэтому он живёт рядом с правками, которые описывает, а не
 * в снимке сайта. Сборка подменяет им содержимое, а холст показывал старую редакцию из зеркала —
 * на политике это 5645px живого текста против 1602px в редакторе. Подменяем тем же генератором.
 */
function withLegalText(page: ImportedPage): ImportedPage {
  const pg = LEGAL_PAGES.find((p) => p.slug === page.slug);
  if (!pg) return page;
  const main = renderLegalMain(pg);
  return { ...page, blocks: page.blocks.map((b) => (b.content.region === "main"
    ? { ...b, content: { ...b.content, html: main } } : b)) };
}

export function previewDoc(page: ImportedPage, edit: boolean, pageBp?: PageBp): string {
  // Edit mode = live runtime (breakpoint rules come in via lg-bp-init). Preview mode = the CLEAN
  // published output: editor attrs stripped + breakpoint @media inlined. page.blocks already carry
  // content overrides (applied on load), so we don't re-apply them here.
  page = withLegalText(page);
  const html = edit ? reassembleForEdit(page) : exportPageHtml(page, undefined, pageBp);
  // Реквизиты в подвале, галочки согласия и локальный CDN сборка добавляет ПОВЕРХ страницы.
  // Без этого шага подвал в холсте был на 62px короче живого, а галочек клиент не видел вовсе.
  return toPreview(applySitePrivacy(html, page.lang));
}
