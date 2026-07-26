/** Free-canvas block definition (Phase 2). */

import type { BlockDefinition } from "../../types";
import type { CanvasContent } from "./schema";
import { canvasDefaults } from "./schema";
import { renderCanvasStatic } from "./static";
import { CanvasPreview } from "./Preview";

export const canvasBlock: BlockDefinition<CanvasContent> = {
  type: "canvas",
  meta: { name: "Свободный блок", icon: "move", category: "layout" },
  defaults: canvasDefaults,
  renderStatic: renderCanvasStatic,
  Preview: CanvasPreview,
};

export type { CanvasContent } from "./schema";
