import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import { E } from "./Editable";

export interface FaqItem {
  q: string;
  a: string;
}
export interface FaqContent {
  heading: string;
  items: FaqItem[];
}

const defaults = (): FaqContent => ({
  heading: "Ответы на ваши вопросы",
  items: [
    { q: "Что входит в стандартную уборку?", a: "Кухня, санузел, жилые комнаты, полы, удаление пыли и вынос мусора. Этого достаточно, чтобы поддерживать дом в чистоте." },
    { q: "Сколько стоит уборка?", a: "Цена зависит от площади и частоты. Для еженедельных, раз в две недели и ежемесячных планов действуют автоматические скидки." },
    { q: "Сколько длится уборка?", a: "Обычно 2–3 часа в зависимости от площади и состояния. Генеральная уборка — дольше." },
    { q: "Проверяете ли вы клинеров?", a: "Да. Каждый клинер проходит проверку, собеседование и отбор по нашим стандартам качества." },
    { q: "Используете ли вы эко-средства?", a: "Да — все наши средства нетоксичны и безопасны для детей и животных." },
  ],
});

// Native <details> accordion — works in static export with zero JS.
const item = (f: FaqItem): string =>
  `<details class="faq__item"><summary class="faq__q">${esc(f.q)}</summary><p class="faq__a">${esc(f.a)}</p></details>`;

const renderStatic = (ctx: BlockRenderContext<FaqContent>): string => {
  const c = ctx.block.content;
  return (
    `<section class="section faq"${attrs({ id: ctx.block.id })}><div class="container container--narrow">` +
    `<h2 class="section__heading">${esc(c.heading)}</h2>` +
    `<div class="faq__list">${c.items.map(item).join("")}</div></div></section>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<FaqContent> }) => {
  const c = ctx.block.content;
  return (
    <section className="section faq" id={ctx.block.id}>
      <div className="container container--narrow">
        <h2 className="section__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        <div className="faq__list">
          {c.items.map((f, i) => (
            <details className="faq__item" key={i}>
              <summary className="faq__q"><E ctx={ctx} path={["items", i, "q"]} value={f.q} /></summary>
              <p className="faq__a"><E ctx={ctx} path={["items", i, "a"]} value={f.a} /></p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};

export const faqBlock: BlockDefinition<FaqContent> = {
  type: "faq",
  meta: { name: "FAQ", icon: "help-circle", category: "content" },
  defaults,
  renderStatic,
  Preview,
};
