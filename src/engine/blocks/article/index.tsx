/**
 * `article` block — renders ONE blog article as a full page body. It is the single
 * content block on an article Page (see blog/toPage.ts). The Markdown body is turned
 * into clean semantic HTML by ONE shared function used by both renderers, so preview
 * and static export stay byte-identical (round-trip safe, non-interactive).
 *
 * E-E-A-T: visible byline (author + date) mirrors the Article JSON-LD in the page head.
 */

import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../../types";
import type { ArticleFaq } from "../../blog/types";
import { esc } from "../../lib/html";
import { markdownToHtml } from "../../blog/markdown";

export interface ArticleContent {
  title: string;
  body: string; // Markdown
  coverUrl?: string;
  coverAlt?: string;
  author?: string;
  datePublished?: string; // ISO
  dateModified?: string; // ISO
  faq?: ArticleFaq[];
  takeaways?: string[];
  backHref?: string;
  readMoreLabel?: string;
}

const defaults = (): ArticleContent => ({
  title: "Как подготовить квартиру к генеральной уборке",
  body:
    "Генеральная уборка отличается от поддерживающей глубиной и охватом. " +
    "Ниже — короткий чек-лист, который сэкономит время бригаде и вам.\n\n" +
    "## Что сделать заранее\n\n" +
    "- Уберите личные вещи с открытых поверхностей\n" +
    "- Освободите доступ к окнам и радиаторам\n" +
    "- Отметьте зоны, которым нужно особое внимание\n\n" +
    "После этого команда работает быстрее, а результат заметнее.",
  coverUrl: "",
  coverAlt: "",
  author: "AllClean",
  datePublished: "2026-07-20",
  dateModified: "2026-07-20",
  faq: [
    { question: "Сколько длится генеральная уборка?", answer: "Обычно от 3 до 6 часов в зависимости от площади и состояния." },
  ],
  takeaways: ["Освободите поверхности заранее", "Обеспечьте доступ к окнам", "Отметьте проблемные зоны"],
  backHref: "/blog",
  readMoreLabel: "Все статьи",
});

/** DD.MM.YYYY — locale-independent so preview == export. */
function fmtDate(iso?: string): { text: string; dt: string } {
  if (!iso) return { text: "", dt: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { text: esc(iso), dt: esc(iso) };
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return { text: `${dd}.${mm}.${yyyy}`, dt: `${yyyy}-${mm}-${dd}` };
}

/** The whole inner HTML of the block — the ONE source both renderers use. */
export function articleInner(c: ArticleContent): string {
  const date = fmtDate(c.datePublished);
  const parts: string[] = ['<div class="container container--narrow"><article class="article">'];

  if (c.backHref) parts.push(`<a class="article__back" href="${esc(c.backHref)}">← ${esc(c.readMoreLabel || "Все статьи")}</a>`);
  if (c.coverUrl) parts.push(`<img class="article__cover" src="${esc(c.coverUrl)}" alt="${esc(c.coverAlt || c.title)}" loading="lazy">`);
  parts.push(`<h1 class="article__title">${esc(c.title)}</h1>`);

  const byline: string[] = [];
  if (c.author) byline.push(`<span class="article__author">${esc(c.author)}</span>`);
  if (date.text) byline.push(`<time class="article__date" datetime="${date.dt}">${date.text}</time>`);
  if (byline.length) parts.push(`<p class="article__byline">${byline.join(" · ")}</p>`);

  if (c.takeaways?.length) {
    parts.push(
      `<aside class="article__takeaways"><b class="article__takeaways-h">Коротко</b><ul>` +
        c.takeaways.map((t) => `<li>${esc(t)}</li>`).join("") +
        `</ul></aside>`
    );
  }

  parts.push(`<div class="article__body">${markdownToHtml(c.body)}</div>`);

  if (c.faq?.length) {
    parts.push(
      `<section class="article__faq"><h2 class="article__faq-h">Частые вопросы</h2>` +
        c.faq
          .map((f) => `<details class="faq__item"><summary class="faq__q">${esc(f.question)}</summary><p class="faq__a">${esc(f.answer)}</p></details>`)
          .join("") +
        `</section>`
    );
  }

  parts.push("</article></div>");
  return parts.join("");
}

const renderStatic = (ctx: BlockRenderContext<ArticleContent>): string =>
  `<section class="section article-block" id="${esc(ctx.block.id)}">${articleInner(ctx.block.content)}</section>`;

const Preview = ({ ctx }: { ctx: BlockRenderContext<ArticleContent> }) => (
  <section
    className="section article-block"
    id={ctx.block.id}
    dangerouslySetInnerHTML={{ __html: articleInner(ctx.block.content) }}
  />
);

export const articleBlock: BlockDefinition<ArticleContent> = {
  type: "article",
  meta: { name: "Статья", icon: "file-text", category: "blog" },
  defaults,
  renderStatic,
  Preview,
};
