import type { BlockRenderContext } from "../../types";
import { esc, attrs } from "../../lib/html";
import type { CanvasContent, CanvasElement } from "./schema";
import { orderedElements } from "./schema";
import { buildCanvasCss, elClass } from "./css";

function renderEl(el: CanvasElement): string {
  const cls = `cv-el ${elClass(el.id)}`;
  switch (el.kind) {
    case "heading":
      return `<h2 class="${cls} cv-heading">${esc(el.text)}</h2>`;
    case "text":
      return `<p class="${cls} cv-text">${esc(el.text)}</p>`;
    case "button":
      return `<a class="${cls} btn btn--primary cv-btn"${attrs({ href: el.href || "#" })}>${esc(el.text)}</a>`;
    case "image":
      return el.image?.src
        ? `<img class="${cls} cv-img"${attrs({ src: el.image.src, alt: el.image.alt, loading: "lazy" })}>`
        : `<div class="${cls} cv-img cv-img--placeholder" aria-hidden="true"></div>`;
  }
}

export function renderCanvasStatic(ctx: BlockRenderContext<CanvasContent>): string {
  const c = ctx.block.content;
  const id = ctx.block.id;
  const css = buildCanvasCss(id, c);
  const els = orderedElements(c).map(renderEl).join("");
  return (
    `<section class="section cv-block"${attrs({ id })}>` +
    `<style>${css}</style>` +
    `<div class="container"><div class="cv">${els}</div></div>` +
    `</section>`
  );
}
