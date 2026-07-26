/** Scoped CSS for a free-canvas block — shared by the static export and the editor preview,
 *  so both position elements identically. Responsive via @container (see schema.ts note). */

import type { CanvasContent, CanvasElement, Rect } from "./schema";

export const elClass = (elId: string) => `e-${elId}`;

const rectCss = (sel: string, r: Rect) =>
  `${sel}{grid-column:${r.col}/span ${r.w};grid-row:${r.row}/span ${r.h};}`;

/** Build the block-scoped stylesheet. `id` is the block's HTML id (unique per instance). */
export function buildCanvasCss(id: string, c: CanvasContent): string {
  const root = `#${id} .cv`;
  const out: string[] = [
    `${root}{display:grid;grid-template-columns:repeat(${c.cols},1fr);grid-auto-rows:${c.rowH}px;gap:10px;}`,
    `#${id} .cv-el{min-width:0;}`,
  ];

  // Desktop positions.
  for (const el of c.elements) out.push(rectCss(`#${id} .${elClass(el.id)}`, el.layout.desktop));

  // Mobile (container ≤ 600px): single column auto-stack, with per-element overrides where set.
  const mobile: string[] = [
    `${root}{grid-template-columns:1fr;grid-auto-rows:minmax(${c.rowH}px,auto);}`,
    `#${id} .cv-el{grid-column:1/-1;grid-row:auto;}`,
  ];
  for (const el of c.elements) {
    if (el.layout.mobile) mobile.push(rectCss(`#${id} .${elClass(el.id)}`, el.layout.mobile));
  }
  out.push(`@container (max-width:600px){${mobile.join("")}}`);

  return out.join("");
}

/** Which breakpoint layer the editor writes to for the current device. */
export const bpFor = (device?: string): "desktop" | "mobile" => (device === "mobile" ? "mobile" : "desktop");

/** Effective rect for a breakpoint (mobile falls back to desktop). */
export const rectFor = (el: CanvasElement, bp: "desktop" | "mobile"): Rect =>
  (bp === "mobile" ? el.layout.mobile : el.layout.desktop) ?? el.layout.desktop;
