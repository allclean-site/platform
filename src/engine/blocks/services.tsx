import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import { E } from "./Editable";
import type { CtaLink, Img } from "./common";

export interface ServiceItem {
  title: string;
  href?: string;
  image?: Img;
}
export interface ServicesContent {
  heading: string;
  items: ServiceItem[];
  cta?: CtaLink;
}

const defaults = (): ServicesContent => ({
  heading: "Что мы убираем",
  items: [
    { title: "Уборка квартир", href: "#" },
    { title: "Генеральная уборка", href: "#" },
    { title: "Уборка офисов", href: "#" },
    { title: "Уборка после ремонта", href: "#" },
    { title: "Мойка окон и фасадов", href: "#" },
    { title: "Чистка ковров", href: "#" },
  ],
  cta: { label: "Все услуги", href: "#services" },
});

const card = (s: ServiceItem): string => {
  const img = s.image
    ? `<img class="service__img"${attrs({ src: s.image.src, alt: s.image.alt, loading: "lazy" })}>`
    : `<div class="service__img service__img--placeholder" aria-hidden="true"></div>`;
  const inner = `${img}<h3 class="service__title">${esc(s.title)}</h3>`;
  return s.href
    ? `<a class="service"${attrs({ href: s.href })}>${inner}</a>`
    : `<div class="service">${inner}</div>`;
};

const renderStatic = (ctx: BlockRenderContext<ServicesContent>): string => {
  const c = ctx.block.content;
  const cards = c.items.map(card).join("");
  const cta = c.cta
    ? `<div class="section__cta"><a class="btn btn--ghost"${attrs({ href: c.cta.href })}>${esc(c.cta.label)}</a></div>`
    : "";
  return (
    `<section class="section services"${attrs({ id: ctx.block.id })}><div class="container">` +
    `<h2 class="section__heading">${esc(c.heading)}</h2>` +
    `<div class="services__grid">${cards}</div>${cta}</div></section>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<ServicesContent> }) => {
  const c = ctx.block.content;
  return (
    <section className="section services" id={ctx.block.id}>
      <div className="container">
        <h2 className="section__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        <div className="services__grid">
          {c.items.map((s, i) => {
            const inner = (
              <>
                {s.image ? (
                  <img className="service__img" src={s.image.src} alt={s.image.alt} loading="lazy" />
                ) : (
                  <div className="service__img service__img--placeholder" aria-hidden="true" />
                )}
                <h3 className="service__title"><E ctx={ctx} path={["items", i, "title"]} value={s.title} /></h3>
              </>
            );
            return s.href ? (
              <a className="service" href={s.href} key={i}>{inner}</a>
            ) : (
              <div className="service" key={i}>{inner}</div>
            );
          })}
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

export const servicesBlock: BlockDefinition<ServicesContent> = {
  type: "services",
  meta: { name: "Услуги (сетка)", icon: "grid", category: "content" },
  defaults,
  renderStatic,
  Preview,
};
