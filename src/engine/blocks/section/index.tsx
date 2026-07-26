/**
 * `section` block — holds a chunk of REAL (imported Webflow) markup verbatim.
 *
 * This is how the mirrored allclean.md pages live inside editor-v2's block model: each page
 * is split into section blocks (header / each top-level <section> / footer), so the client can
 * edit them independently while the exported HTML stays byte-identical to the live site.
 *
 * Content is a raw HTML string. Both renderers emit it verbatim → preview == export. Inline
 * editing (contentEditable) is driven from the iframe canvas, which posts the edited innerHTML
 * back as `content.html` — no per-field schema needed for arbitrary Webflow markup.
 */

import React from "react";
import type { BlockDefinition, BlockRenderContext } from "../../types";

export interface SectionContent {
  /** Verbatim HTML for this section (real Webflow markup). */
  html: string;
  /** Human label shown in the editor outline (e.g. "Hero", "Услуги", "Footer"). */
  label?: string;
  /** Optional wrapper: emit inside <main class="main-wrapper"> vs bare (header/footer are bare). */
  region?: "header" | "main" | "footer";
}

const defaults = (): SectionContent => ({ html: "<section><div class=\"container\">Секция</div></section>", label: "Секция", region: "main" });

const renderStatic = (ctx: BlockRenderContext<SectionContent>): string => ctx.block.content.html;

const Preview = ({ ctx }: { ctx: BlockRenderContext<SectionContent> }) => (
  <div className="section-block" data-region={ctx.block.content.region} dangerouslySetInnerHTML={{ __html: ctx.block.content.html }} />
);

export const sectionBlock: BlockDefinition<SectionContent> = {
  type: "section",
  meta: { name: "Секция (импорт)", icon: "code", category: "imported" },
  // Imported sections carry their own inline scripts (e.g. the calculators); the round-trip
  // parity check treats renderStatic as the source of truth (Preview injects the same html).
  interactive: true,
  defaults,
  renderStatic,
  Preview,
};
