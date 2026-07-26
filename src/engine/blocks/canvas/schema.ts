/** Free-canvas block ("свободный блок") — Phase 2.
 *
 * "Свобода по ощущению, сетка под капотом": elements are placed freely but snap to a
 * 12-column grid. Positions are stored in GRID units (col/row/span), never pixels, so
 * the export is clean CSS grid — no absolute positioning, no runtime JS. Responsiveness
 * uses container-queries so the editor's device preview and the published page behave
 * identically (the container width drives the layout, not the viewport). */

export type ElKind = "heading" | "text" | "button" | "image";

/** A rectangle on the grid: 1-based column/row start + column/row span. */
export interface Rect {
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface CanvasElement {
  id: string;
  kind: ElKind;
  text?: string;
  href?: string;
  image?: { src: string; alt: string };
  /** Authored on desktop; `mobile` is an optional override (absent → auto-stack). */
  layout: { desktop: Rect; mobile?: Rect };
}

export interface CanvasContent {
  cols: number;
  rowH: number;
  rows: number;
  elements: CanvasElement[];
}

export function canvasDefaults(): CanvasContent {
  return {
    cols: 12,
    rowH: 48,
    rows: 6,
    elements: [
      { id: "h", kind: "heading", text: "Свободный блок", layout: { desktop: { col: 1, row: 1, w: 6, h: 1 } } },
      { id: "p", kind: "text", text: "Перетаскивайте элементы — они примагничиваются к сетке.", layout: { desktop: { col: 1, row: 2, w: 5, h: 1 } } },
      { id: "b", kind: "button", text: "Кнопка", href: "#", layout: { desktop: { col: 1, row: 4, w: 3, h: 1 } } },
      { id: "img", kind: "image", image: { src: "", alt: "" }, layout: { desktop: { col: 8, row: 1, w: 5, h: 5 } } },
    ],
  };
}

/** Elements sorted top-to-bottom, left-to-right by their desktop position —
 *  gives a sensible DOM order for mobile auto-stacking and accessibility. */
export function orderedElements(c: CanvasContent): CanvasElement[] {
  return [...c.elements].sort(
    (a, b) => a.layout.desktop.row - b.layout.desktop.row || a.layout.desktop.col - b.layout.desktop.col
  );
}
