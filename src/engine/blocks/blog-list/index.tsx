/**
 * `blog-list` block — a grid of article cards linking to their pages. Lives on the
 * blog index page (and can be dropped on the homepage as a "latest posts" teaser).
 *
 * Cards are a denormalized snapshot (self-contained JSON, round-trip safe). The editor's
 * blog manager keeps them in sync with the Article collection via `blogListContent()`.
 * Both renderers derive from one shared inner-HTML function → preview == export.
 */

import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../../types";
import { esc } from "../../lib/html";

export interface BlogCard {
  href: string;
  title: string;
  excerpt: string;
  coverUrl?: string;
  coverAlt?: string;
  date?: string; // display string (DD.MM.YYYY)
  tag?: string;
}

export interface BlogListContent {
  heading: string;
  subheading?: string;
  cards: BlogCard[];
  emptyText?: string;
  /** When this block is the blog index's main heading, render it as the page <h1>. */
  asPageTitle?: boolean;
}

const defaults = (): BlogListContent => ({
  heading: "Блог о чистоте",
  subheading: "Советы по уборке, уходу за домом и офисом",
  cards: [
    {
      href: "/blog/kak-podgotovit-kvartiru-k-generalnoj-uborke",
      title: "Как подготовить квартиру к генеральной уборке",
      excerpt: "Короткий чек-лист, который сэкономит время бригаде и вам.",
      coverUrl: "",
      date: "20.07.2026",
      tag: "Советы",
    },
  ],
  emptyText: "Скоро здесь появятся статьи.",
});

function cardHtml(card: BlogCard): string {
  const cover = card.coverUrl
    ? `<img class="post-card__img" src="${esc(card.coverUrl)}" alt="${esc(card.coverAlt || card.title)}" loading="lazy">`
    : `<div class="post-card__img post-card__img--empty" aria-hidden="true"></div>`;
  const meta: string[] = [];
  if (card.tag) meta.push(`<span class="post-card__tag">${esc(card.tag)}</span>`);
  if (card.date) meta.push(`<time class="post-card__date">${esc(card.date)}</time>`);
  return (
    `<a class="post-card" href="${esc(card.href)}">` +
    cover +
    `<div class="post-card__body">` +
    (meta.length ? `<div class="post-card__meta">${meta.join("")}</div>` : "") +
    `<h3 class="post-card__title">${esc(card.title)}</h3>` +
    `<p class="post-card__excerpt">${esc(card.excerpt)}</p>` +
    `</div></a>`
  );
}

/** Shared inner HTML — the ONE source both renderers use. */
export function blogListInner(c: BlogListContent): string {
  const hTag = c.asPageTitle ? "h1" : "h2";
  const head =
    `<div class="section__head"><${hTag} class="section__heading">${esc(c.heading)}</${hTag}>` +
    (c.subheading ? `<p class="section__sub">${esc(c.subheading)}</p>` : "") +
    `</div>`;
  const body = c.cards.length
    ? `<div class="post-grid">${c.cards.map(cardHtml).join("")}</div>`
    : `<p class="post-empty">${esc(c.emptyText || "Скоро здесь появятся статьи.")}</p>`;
  return `<div class="container">${head}${body}</div>`;
}

const renderStatic = (ctx: BlockRenderContext<BlogListContent>): string =>
  `<section class="section blog-list" id="${esc(ctx.block.id)}">${blogListInner(ctx.block.content)}</section>`;

const Preview = ({ ctx }: { ctx: BlockRenderContext<BlogListContent> }) => (
  <section
    className="section blog-list"
    id={ctx.block.id}
    dangerouslySetInnerHTML={{ __html: blogListInner(ctx.block.content) }}
  />
);

export const blogListBlock: BlockDefinition<BlogListContent> = {
  type: "blog-list",
  meta: { name: "Блог-список", icon: "newspaper", category: "blog" },
  defaults,
  renderStatic,
  Preview,
};
