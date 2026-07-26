import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import { E } from "./Editable";
import type { CtaLink } from "./common";

export interface StepItem {
  title: string;
  text: string;
}
export interface StepsContent {
  heading: string;
  items: StepItem[];
  cta?: CtaLink;
}

const defaults = (): StepsContent => ({
  heading: "Как это работает?",
  items: [
    { title: "Записаться на уборку", text: "Выберите дату и время меньше чем за 60 секунд." },
    { title: "Приезжаем со всем необходимым", text: "Клинер привозит весь инвентарь и эко-средства." },
    { title: "Наслаждайтесь чистым домом", text: "Всё убрано и разложено по местам — именно так, как вы хотите." },
    { title: "Регулярно? Ещё проще", text: "Обозначим даты и время, один и тот же клинер. Планы поменялись — перенесём выезд." },
  ],
  cta: { label: "Запишитесь на уборку", href: "#book" },
});

const step = (s: StepItem, i: number): string =>
  `<li class="step"><span class="step__num">${i + 1}</span><div><h3 class="step__title">${esc(s.title)}</h3><p class="step__text">${esc(s.text)}</p></div></li>`;

const renderStatic = (ctx: BlockRenderContext<StepsContent>): string => {
  const c = ctx.block.content;
  const cta = c.cta
    ? `<div class="section__cta"><a class="btn btn--primary"${attrs({ href: c.cta.href })}>${esc(c.cta.label)}</a></div>`
    : "";
  return (
    `<section class="section steps"${attrs({ id: ctx.block.id })}><div class="container">` +
    `<h2 class="section__heading">${esc(c.heading)}</h2>` +
    `<ol class="steps__list">${c.items.map(step).join("")}</ol>${cta}</div></section>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<StepsContent> }) => {
  const c = ctx.block.content;
  return (
    <section className="section steps" id={ctx.block.id}>
      <div className="container">
        <h2 className="section__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        <ol className="steps__list">
          {c.items.map((s, i) => (
            <li className="step" key={i}>
              <span className="step__num">{i + 1}</span>
              <div>
                <h3 className="step__title"><E ctx={ctx} path={["items", i, "title"]} value={s.title} /></h3>
                <p className="step__text"><E ctx={ctx} path={["items", i, "text"]} value={s.text} /></p>
              </div>
            </li>
          ))}
        </ol>
        {c.cta && (
          <div className="section__cta">
            <a className="btn btn--primary" href={c.cta.href}>{c.cta.label}</a>
          </div>
        )}
      </div>
    </section>
  );
};

export const stepsBlock: BlockDefinition<StepsContent> = {
  type: "steps",
  meta: { name: "Как это работает", icon: "list-ordered", category: "content" },
  defaults,
  renderStatic,
  Preview,
};
