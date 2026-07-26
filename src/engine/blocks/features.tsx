import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import { E } from "./Editable";

export interface FeatureItem {
  title: string;
  text: string;
}
export interface FeaturesContent {
  heading: string;
  lead?: string;
  items: FeatureItem[];
}

const defaults = (): FeaturesContent => ({
  heading: "Чем мы отличаемся",
  lead: "Мы специализируемся не только на квартирах.",
  items: [
    { title: "Прозрачные цены", text: "Никаких скрытых платежей. Вы узнаете точную цену до начала работы." },
    { title: "Собственная команда", text: "Каждый клинер проверен, с подтверждённой репутацией и застрахован." },
    { title: "Натуральные средства", text: "Экологичны и безопасны для детей и животных." },
    { title: "Полная экипировка", text: "Привозим все средства и инвентарь — вам не нужно ничего готовить." },
  ],
});

const item = (f: FeatureItem): string =>
  `<div class="feature"><h3 class="feature__title">${esc(f.title)}</h3><p class="feature__text">${esc(f.text)}</p></div>`;

const renderStatic = (ctx: BlockRenderContext<FeaturesContent>): string => {
  const c = ctx.block.content;
  const lead = c.lead ? `<p class="section__lead">${esc(c.lead)}</p>` : "";
  return (
    `<section class="section features"${attrs({ id: ctx.block.id })}><div class="container">` +
    `<h2 class="section__heading">${esc(c.heading)}</h2>${lead}` +
    `<div class="features__grid">${c.items.map(item).join("")}</div></div></section>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<FeaturesContent> }) => {
  const c = ctx.block.content;
  return (
    <section className="section features" id={ctx.block.id}>
      <div className="container">
        <h2 className="section__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        {c.lead && <p className="section__lead"><E ctx={ctx} path={["lead"]} value={c.lead} /></p>}
        <div className="features__grid">
          {c.items.map((f, i) => (
            <div className="feature" key={i}>
              <h3 className="feature__title"><E ctx={ctx} path={["items", i, "title"]} value={f.title} /></h3>
              <p className="feature__text"><E ctx={ctx} path={["items", i, "text"]} value={f.text} /></p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const featuresBlock: BlockDefinition<FeaturesContent> = {
  type: "features",
  meta: { name: "Преимущества", icon: "sparkles", category: "content" },
  defaults,
  renderStatic,
  Preview,
};
