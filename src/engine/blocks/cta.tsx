import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import { E } from "./Editable";
import type { CtaLink } from "./common";

export interface CtaBandContent {
  heading: string;
  subheading?: string;
  primaryCta: CtaLink;
  secondaryCta?: CtaLink;
}

const defaults = (): CtaBandContent => ({
  heading: "Вы готовы к полной чистоте?",
  subheading: "Закажите клинеров, которые действительно приезжают, заботятся и оставляют дом идеально чистым.",
  primaryCta: { label: "Запишитесь на уборку", href: "#book" },
  secondaryCta: { label: "Рассчитать стоимость", href: "#pricing" },
});

const renderStatic = (ctx: BlockRenderContext<CtaBandContent>): string => {
  const c = ctx.block.content;
  const sub = c.subheading ? `<p class="ctaband__sub">${esc(c.subheading)}</p>` : "";
  const sec = c.secondaryCta
    ? `<a class="btn btn--ghost btn--on-accent"${attrs({ href: c.secondaryCta.href })}>${esc(c.secondaryCta.label)}</a>`
    : "";
  return (
    `<section class="section ctaband"${attrs({ id: ctx.block.id })}><div class="container ctaband__inner">` +
    `<h2 class="ctaband__heading">${esc(c.heading)}</h2>${sub}` +
    `<div class="hero__actions">` +
    `<a class="btn btn--light"${attrs({ href: c.primaryCta.href })}>${esc(c.primaryCta.label)}</a>${sec}` +
    `</div></div></section>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<CtaBandContent> }) => {
  const c = ctx.block.content;
  return (
    <section className="section ctaband" id={ctx.block.id}>
      <div className="container ctaband__inner">
        <h2 className="ctaband__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        {c.subheading && <p className="ctaband__sub"><E ctx={ctx} path={["subheading"]} value={c.subheading} /></p>}
        <div className="hero__actions">
          <a className="btn btn--light" href={c.primaryCta.href}>{c.primaryCta.label}</a>
          {c.secondaryCta && (
            <a className="btn btn--ghost btn--on-accent" href={c.secondaryCta.href}>{c.secondaryCta.label}</a>
          )}
        </div>
      </div>
    </section>
  );
};

export const ctaBlock: BlockDefinition<CtaBandContent> = {
  type: "cta",
  meta: { name: "CTA-баннер", icon: "megaphone", category: "content" },
  defaults,
  renderStatic,
  Preview,
};
