import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../types";
import { esc, attrs } from "../lib/html";
import type { CtaLink, NavLink } from "./common";

export interface NavbarContent {
  logo: string;
  links: NavLink[];
  cta: CtaLink;
}

const defaults = (): NavbarContent => ({
  logo: "AllClean",
  links: [
    { label: "Услуги", href: "#services" },
    { label: "О нас", href: "#about" },
    { label: "Цены", href: "#pricing" },
    { label: "Вопросы", href: "#faq" },
  ],
  cta: { label: "Записаться", href: "#book" },
});

const renderStatic = (ctx: BlockRenderContext<NavbarContent>): string => {
  const c = ctx.block.content;
  const links = c.links
    .map((l) => `<a class="nav__link"${attrs({ href: l.href })}>${esc(l.label)}</a>`)
    .join("");
  return (
    `<header class="nav"${attrs({ id: ctx.block.id })}><div class="nav__inner">` +
    `<a class="nav__logo" href="#top">${esc(c.logo)}</a>` +
    `<nav class="nav__links">${links}</nav>` +
    `<a class="nav__cta"${attrs({ href: c.cta.href })}>${esc(c.cta.label)}</a>` +
    `</div></header>`
  );
};

const Preview = ({ ctx }: { ctx: BlockRenderContext<NavbarContent> }) => {
  const c = ctx.block.content;
  return (
    <header className="nav" id={ctx.block.id}>
      <div className="nav__inner">
        <a className="nav__logo" href="#top">{c.logo}</a>
        <nav className="nav__links">
          {c.links.map((l, i) => (
            <a className="nav__link" href={l.href} key={i}>{l.label}</a>
          ))}
        </nav>
        <a className="nav__cta" href={c.cta.href}>{c.cta.label}</a>
      </div>
    </header>
  );
};

export const navbarBlock: BlockDefinition<NavbarContent> = {
  type: "navbar",
  meta: { name: "Шапка / Navbar", icon: "menu", category: "headers" },
  defaults,
  renderStatic,
  Preview,
};
