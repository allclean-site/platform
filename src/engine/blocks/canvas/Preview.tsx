import React, { useRef, useState } from "react";
import type { BlockRenderContext } from "../../types";
import { E } from "../Editable";
import type { CanvasContent, CanvasElement, ElKind, Rect } from "./schema";
import { orderedElements } from "./schema";
import { buildCanvasCss, elClass, bpFor, rectFor } from "./css";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const GAP = 10;

/** Element inner content — same markup used editing and read-only (parity-safe via <E>). */
function Content({ el, ctx, i, extra }: { el: CanvasElement; ctx: BlockRenderContext<CanvasContent>; i: number; extra: string }) {
  const t = <E ctx={ctx} path={["elements", i, "text"]} value={el.text ?? ""} />;
  const noNav = ctx.editing ? (e: React.MouseEvent) => e.preventDefault() : undefined;
  switch (el.kind) {
    case "heading": return <h2 className={`cv-heading ${extra}`}>{t}</h2>;
    case "text": return <p className={`cv-text ${extra}`}>{t}</p>;
    case "button": return <a className={`btn btn--primary cv-btn ${extra}`} href={el.href || "#"} onClick={noNav}>{t}</a>;
    case "image":
      return el.image?.src
        ? <img className={`cv-img ${extra}`} src={el.image.src} alt={el.image.alt} loading="lazy" />
        : <div className={`cv-img cv-img--placeholder ${extra}`} aria-hidden="true" />;
  }
}

function EditableEl({
  el, ctx, i, bp, cols, rowH, gridRef, selected, onSelect,
}: {
  el: CanvasElement; ctx: BlockRenderContext<CanvasContent>; i: number; bp: "desktop" | "mobile";
  cols: number; rowH: number; gridRef: React.RefObject<HTMLDivElement>; selected: boolean; onSelect: () => void;
}) {
  const rect = rectFor(el, bp);

  const drag = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    const grid = gridRef.current;
    if (!grid || !ctx.onEdit) return;
    const cellW = (grid.clientWidth - GAP * (cols - 1)) / cols;
    const cellH = rowH + GAP;
    const sx = e.clientX, sy = e.clientY;
    const start: Rect = { ...rect };
    const onMove = (ev: PointerEvent) => {
      const dCol = Math.round((ev.clientX - sx) / cellW);
      const dRow = Math.round((ev.clientY - sy) / cellH);
      const next: Rect =
        mode === "move"
          ? { col: clamp(start.col + dCol, 1, cols - start.w + 1), row: Math.max(1, start.row + dRow), w: start.w, h: start.h }
          : { col: start.col, row: start.row, w: clamp(start.w + dCol, 1, cols - start.col + 1), h: Math.max(1, start.h + dRow) };
      ctx.onEdit!(["elements", i, "layout", bp], next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`cv-el ${elClass(el.id)} cv-slot${selected ? " is-selected" : ""}`}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <Content el={el} ctx={ctx} i={i} extra="cv-inner" />
      {selected && (
        <>
          <span className="cv-move" onPointerDown={(e) => drag(e, "move")} title="Переместить">⠿</span>
          <span className="cv-resize" onPointerDown={(e) => drag(e, "resize")} title="Изменить размер" />
        </>
      )}
    </div>
  );
}

export function CanvasPreview({ ctx }: { ctx: BlockRenderContext<CanvasContent> }) {
  const c = ctx.block.content;
  const id = ctx.block.id;
  const gridRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const css = buildCanvasCss(id, c);
  const bp = bpFor(ctx.device);
  const ordered = orderedElements(c);

  const addEl = (kind: ElKind) => {
    if (!ctx.onEdit) return;
    const nextRow = c.elements.reduce((m, e) => Math.max(m, e.layout.desktop.row + e.layout.desktop.h), 1);
    const rect: Rect = { col: 1, row: nextRow, w: kind === "button" ? 3 : 4, h: kind === "image" ? 3 : 1 };
    const nid = "el" + Math.random().toString(36).slice(2, 6);
    const el: CanvasElement =
      kind === "image"
        ? { id: nid, kind, image: { src: "", alt: "" }, layout: { desktop: rect } }
        : kind === "button"
        ? { id: nid, kind, text: "Кнопка", href: "#", layout: { desktop: rect } }
        : { id: nid, kind, text: kind === "heading" ? "Заголовок" : "Текст", layout: { desktop: rect } };
    ctx.onEdit(["elements"], [...c.elements, el]);
    setSel(nid);
  };
  const delEl = () => {
    if (!ctx.onEdit || !sel) return;
    ctx.onEdit(["elements"], c.elements.filter((e) => e.id !== sel));
    setSel(null);
  };

  return (
    <section className="section cv-block" id={id}>
      {ctx.editing && (
        <div className="cv-toolbar" onClick={(e) => e.stopPropagation()}>
          <span className="cv-toolbar__label">Свободный блок:</span>
          <button className="cv-toolbar__btn" onClick={() => addEl("heading")}>+ Заголовок</button>
          <button className="cv-toolbar__btn" onClick={() => addEl("text")}>+ Текст</button>
          <button className="cv-toolbar__btn" onClick={() => addEl("button")}>+ Кнопка</button>
          <button className="cv-toolbar__btn" onClick={() => addEl("image")}>+ Фото</button>
          <button className="cv-toolbar__btn cv-toolbar__btn--del" onClick={delEl} disabled={!sel}>🗑 Элемент</button>
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="container">
        <div className={"cv" + (ctx.editing ? " cv--editing" : "")} ref={gridRef}>
          {ordered.map((el) => {
            const i = c.elements.findIndex((x) => x.id === el.id);
            return ctx.editing ? (
              <EditableEl
                key={el.id} el={el} ctx={ctx} i={i} bp={bp}
                cols={c.cols} rowH={c.rowH} gridRef={gridRef}
                selected={sel === el.id} onSelect={() => setSel(el.id)}
              />
            ) : (
              <Content key={el.id} el={el} ctx={ctx} i={i} extra={`cv-el ${elClass(el.id)}`} />
            );
          })}
        </div>
      </div>
    </section>
  );
}
