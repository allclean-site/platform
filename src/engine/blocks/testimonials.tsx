import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import { E } from "./Editable";
import type { CtaLink } from "./common";

export interface Testimonial {
  quote: string;
  author?: string;
  source?: string;
}
export interface TestimonialsContent {
  heading: string;
  ratingText?: string;
  items: Testimonial[];
  cta?: CtaLink;
}

const defaults = (): TestimonialsContent => ({
  heading: "Люди доверяют",
  ratingText: "4,9 / 5 рейтинг",
  items: [
    { quote: "Пробовала разные службы — делали по минимуму. С All Clean наконец-то не нужно ничего перепроверять.", author: "Клиент", source: "Google" },
    { quote: "Возвращаться домой и не думать об уборке — прекрасно. Спасибо.", author: "Клиент", source: "Google" },
    { quote: "Прихожу домой после уборки как будто заехала в новую квартиру. Чисто, свежо и всё на своих местах.", author: "Клиент", source: "Google" },
  ],
  cta: { label: "Все отзывы", href: "#reviews" },
});

const card = (t: Testimonial): string => {
  const meta = [t.author, t.source].filter(Boolean).map(esc).join(" · ");
  const foot = meta ? `<p class="testimonial__meta">${meta}</p>` : "";
  return `<figure class="testimonial"><blockquote class="testimonial__quote">${esc(t.quote)}</blockquote>${foot}</figure>`;
};

const renderStatic = (ctx: BlockRenderContext<TestimonialsContent>): string => {
  const c = ctx.block.content;
  const rating = c.ratingText ? `<p class="section__lead">${esc(c.ratingText)}</p>` : "";
  const cta = c.cta
    ? `<div class="section__cta"><a class="btn btn--ghost"${attrs({ href: c.cta.href })}>${esc(c.cta.label)}</a></div>`
    : "";
  return (
    `<section class="section testimonials"${attrs({ id: ctx.block.id })}><div class="container">` +
    `<h2 class="section__heading">${esc(c.heading)}</h2>${rating}` +
    `<div class="testimonials__grid">${c.items.map(card).join("")}</div>${cta}</div></section>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<TestimonialsContent> }) => {
  const c = ctx.block.content;
  return (
    <section className="section testimonials" id={ctx.block.id}>
      <div className="container">
        <h2 className="section__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        {c.ratingText && <p className="section__lead"><E ctx={ctx} path={["ratingText"]} value={c.ratingText} /></p>}
        <div className="testimonials__grid">
          {c.items.map((t, i) => (
            <figure className="testimonial" key={i}>
              <blockquote className="testimonial__quote"><E ctx={ctx} path={["items", i, "quote"]} value={t.quote} /></blockquote>
              {(t.author || t.source) && (
                <p className="testimonial__meta">{[t.author, t.source].filter(Boolean).join(" · ")}</p>
              )}
            </figure>
          ))}
        </div>
        {c.cta && (
          <div className="section__cta">
            <a className="btn btn--ghost" href={c.cta.href}>{c.cta.label}</a>
          </div>
        )}
      </div>
    </section>
  );
};

export const testimonialsBlock: BlockDefinition<TestimonialsContent> = {
  type: "testimonials",
  meta: { name: "Отзывы", icon: "quote", category: "content" },
  defaults,
  renderStatic,
  Preview,
};
