import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import type { NavLink } from "./common";

export interface FooterColumn {
  title: string;
  links: NavLink[];
}
export interface FooterContent {
  brand: string;
  address?: string;
  phone?: string;
  email?: string;
  columns: FooterColumn[];
  copyright?: string;
}

const defaults = (): FooterContent => ({
  brand: "All Clean",
  address: "ул. Месаджер, 7, Кишинёв, MD-2069",
  phone: "+373 79 955 044",
  email: "info@allclean.md",
  columns: [
    {
      title: "Компания",
      links: [
        { label: "О нас", href: "#about" },
        { label: "Цены", href: "#pricing" },
        { label: "Блог", href: "#blog" },
        { label: "Вопросы", href: "#faq" },
      ],
    },
    {
      title: "Услуги",
      links: [
        { label: "Уборка квартир и домов", href: "#" },
        { label: "Уборка офисов", href: "#" },
        { label: "Мойка окон и фасадов", href: "#" },
        { label: "Уборка после ремонта", href: "#" },
      ],
    },
  ],
  copyright: "© All Clean",
});

const col = (c: FooterColumn): string =>
  `<div class="footer__col"><h3 class="footer__title">${esc(c.title)}</h3><ul class="footer__links">` +
  c.links.map((l) => `<li><a${attrs({ href: l.href })}>${esc(l.label)}</a></li>`).join("") +
  `</ul></div>`;

const renderStatic = (ctx: BlockRenderContext<FooterContent>): string => {
  const c = ctx.block.content;
  const contact =
    `<div class="footer__col footer__brand"><p class="footer__logo">${esc(c.brand)}</p>` +
    (c.address ? `<p>${esc(c.address)}</p>` : "") +
    (c.phone ? `<p><a${attrs({ href: `tel:${c.phone}` })}>${esc(c.phone)}</a></p>` : "") +
    (c.email ? `<p><a${attrs({ href: `mailto:${c.email}` })}>${esc(c.email)}</a></p>` : "") +
    `</div>`;
  return (
    `<footer class="footer"${attrs({ id: ctx.block.id })}><div class="container footer__grid">` +
    contact +
    c.columns.map(col).join("") +
    `</div><div class="container footer__bottom">${esc(c.copyright ?? "")}</div></footer>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<FooterContent> }) => {
  const c = ctx.block.content;
  return (
    <footer className="footer" id={ctx.block.id}>
      <div className="container footer__grid">
        <div className="footer__col footer__brand">
          <p className="footer__logo">{c.brand}</p>
          {c.address && <p>{c.address}</p>}
          {c.phone && <p><a href={`tel:${c.phone}`}>{c.phone}</a></p>}
          {c.email && <p><a href={`mailto:${c.email}`}>{c.email}</a></p>}
        </div>
        {c.columns.map((col, i) => (
          <div className="footer__col" key={i}>
            <h3 className="footer__title">{col.title}</h3>
            <ul className="footer__links">
              {col.links.map((l, j) => (
                <li key={j}><a href={l.href}>{l.label}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container footer__bottom">{c.copyright}</div>
    </footer>
  );
};

export const footerBlock: BlockDefinition<FooterContent> = {
  type: "footer",
  meta: { name: "Footer", icon: "panel-bottom", category: "footers" },
  defaults,
  renderStatic,
  Preview,
};
