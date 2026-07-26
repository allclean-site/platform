/**
 * AllClean represented in OUR editable block model (Zero-Block). First pass: the Hero and a
 * services strip as free-canvas blocks — every element is movable/resizable/restyleable on the
 * 12-col grid (grid under the hood → clean export). Visually approximates the real site; fidelity
 * is refined per section. This supersedes the raw-HTML text-only editor for full editing.
 */

import type { Page, Block } from "./types";
import type { CanvasContent } from "./blocks/canvas/schema";

const IMG = "/site-assets/images/services/feature-image.jpg";

const heroCanvas: CanvasContent = {
  cols: 12,
  rowH: 46,
  rows: 8,
  elements: [
    { id: "badge", kind: "text", text: "4 свободных слота на этой неделе", layout: { desktop: { col: 1, row: 1, w: 5, h: 1 } } },
    { id: "h1", kind: "heading", text: "Уборка для занятых людей в Кишинёве", layout: { desktop: { col: 1, row: 2, w: 6, h: 3 } } },
    { id: "sub", kind: "text", text: "Профессиональная уборка квартир, домов и офисов — с гарантией.", layout: { desktop: { col: 1, row: 5, w: 5, h: 1 } } },
    { id: "cta1", kind: "button", text: "Записаться на уборку", href: "#book", layout: { desktop: { col: 1, row: 6, w: 3, h: 1 } } },
    { id: "cta2", kind: "button", text: "Смотреть цены", href: "#pricing", layout: { desktop: { col: 4, row: 6, w: 3, h: 1 } } },
    { id: "img", kind: "image", image: { src: IMG, alt: "Клининг AllClean в Кишинёве" }, layout: { desktop: { col: 8, row: 1, w: 5, h: 6 } } },
  ],
};

const servicesCanvas: CanvasContent = {
  cols: 12,
  rowH: 46,
  rows: 6,
  elements: [
    { id: "sh", kind: "heading", text: "Что мы убираем", layout: { desktop: { col: 1, row: 1, w: 6, h: 1 } } },
    { id: "s1", kind: "text", text: "Уборка квартир", layout: { desktop: { col: 1, row: 2, w: 3, h: 1 } } },
    { id: "s2", kind: "text", text: "Генеральная уборка", layout: { desktop: { col: 4, row: 2, w: 3, h: 1 } } },
    { id: "s3", kind: "text", text: "После ремонта", layout: { desktop: { col: 7, row: 2, w: 3, h: 1 } } },
    { id: "s4", kind: "text", text: "Мойка окон и фасадов", layout: { desktop: { col: 1, row: 3, w: 3, h: 1 } } },
    { id: "s5", kind: "text", text: "Чистка ковров", layout: { desktop: { col: 4, row: 3, w: 3, h: 1 } } },
    { id: "s6", kind: "text", text: "Уборка офисов", layout: { desktop: { col: 7, row: 3, w: 3, h: 1 } } },
  ],
};

const b = <C,>(id: string, type: string, content: C): Block<C> => ({ id, type, content });

export function allcleanBlocksPage(): Page {
  return {
    id: "home",
    slug: "/",
    lang: "ru",
    meta: { title: "AllClean — уборка в Кишинёве", description: "Профессиональная уборка квартир и офисов." },
    blocks: [
      b("hero", "canvas", heroCanvas),
      b("services", "canvas", servicesCanvas),
    ],
  };
}
