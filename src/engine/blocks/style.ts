/** Per-block presentation overrides (background / padding / alignment / width).
 *
 * Applied via a NON-INVASIVE wrapper (`.blockwrap` + data-attributes) so no block
 * internals change. The same wrapper is emitted in the static export (renderBlocks)
 * and in the editor canvas, and site.css keys off the data-attributes — so preview
 * and published output style identically. This is also the seam Phase 2 layout grows on. */

export interface BlockStyle {
  bg?: "soft" | "accent" | "dark";
  pad?: "s" | "m" | "l";
  align?: "center";
  width?: "narrow" | "wide";
}

/** { "data-bg": "soft", ... } — for React spread on the canvas wrapper. */
export function styleData(style?: BlockStyle): Record<string, string> {
  const d: Record<string, string> = {};
  if (style?.bg) d["data-bg"] = style.bg;
  if (style?.pad) d["data-pad"] = style.pad;
  if (style?.align) d["data-align"] = style.align;
  if (style?.width) d["data-width"] = style.width;
  return d;
}

/** ` data-bg="soft" ...` — for the static HTML string. */
export function styleAttrStr(style?: BlockStyle): string {
  return Object.entries(styleData(style))
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
}
