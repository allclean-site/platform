/** Inline-editable text used inside block Previews.
 *
 * Parity-safe: when not in editing mode (static export, round-trip via renderToStaticMarkup
 * with editing:false, or no onEdit), it renders the raw string — identical DOM to renderStatic.
 * In the editor it becomes a contentEditable span that commits on blur via ctx.onEdit(path). */

import React from "react";
import type { BlockRenderContext } from "../types";

export function E<C>({
  ctx,
  path,
  value,
}: {
  ctx: BlockRenderContext<C>;
  path: (string | number)[];
  value: string;
}) {
  if (!ctx.editing || !ctx.onEdit) return <>{value}</>;
  return (
    <span
      className="ce"
      contentEditable
      suppressContentEditableWarning
      onClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const next = e.currentTarget.textContent ?? "";
        if (next !== value) ctx.onEdit!(path, next);
      }}
    >
      {value}
    </span>
  );
}
