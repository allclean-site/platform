/**
 * Block-model editor (Zero-Block) — AllClean in OUR editable block model, inside the cabinet.
 * Blocks render as React (engine Previews) with editing on: free-canvas elements are movable/
 * resizable/addable on a grid, inline text edit, inspector for content+style. Styled with platform
 * tokens; the site's own styles are scoped to `.site-root` so they can't touch cabinet chrome.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Monitor, Tablet, Smartphone, ArrowLeft, ZoomIn, ZoomOut, Scan, Plus, Check } from "lucide-react";
import type { Page, Block, Theme } from "../engine/types";
import { getBlockDef, listBlockDefs } from "../engine/blocks/registry";
import { ContentEditor, StylePanel } from "../engine/editor/Inspector";
import { allcleanBlocksPage } from "../engine/allcleanBlocks";
import "../engine/site.css";
import "../engine/canvas-edit.css";
import "./site-editor.css";

const DEVICE_W = { desktop: 1200, tablet: 834, mobile: 390 } as const;
type Device = keyof typeof DEVICE_W;
const clampZoom = (z: number) => Math.min(2, Math.max(0.2, z));
const theme: Theme = { tokens: { colors: {}, fonts: {}, space: {} } };
const uid = (t: string) => `${t}-${Math.random().toString(36).slice(2, 6)}`;

/** Immutable set at a content path (supports whole-array replace at ["elements"]). */
function setByPath<T>(obj: T, path: (string | number)[], value: unknown): T {
  if (path.length === 0) return value as T;
  const root: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  let cur = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    cur[k] = Array.isArray(cur[k]) ? [...cur[k]] : { ...cur[k] };
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
  return root;
}

export function BlockEditor() {
  const { siteId = "allclean" } = useParams();
  const [page, setPage] = useState<Page>(() => allcleanBlocksPage());
  const [selected, setSelected] = useState<string | null>(page.blocks[0]?.id ?? null);
  const [device, setDevice] = useState<Device>("desktop");
  const [tab, setTab] = useState<"content" | "style">("content");
  const [zoom, setZoom] = useState(1); // 1 by default so free-canvas drag maps 1:1
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const canvasRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageH, setStageH] = useState(700);

  // Measure the block stack height so the scaled stage scrolls correctly.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageH(el.scrollHeight));
    ro.observe(el);
    setStageH(el.scrollHeight);
    return () => ro.disconnect();
  }, [page, device]);

  const selBlock = useMemo(() => page.blocks.find((b) => b.id === selected) ?? null, [page, selected]);
  const frameW = DEVICE_W[device];

  const editBlock = (id: string, fn: (b: Block) => Block) =>
    setPage((p) => {
      setSaveState("saved");
      return { ...p, blocks: p.blocks.map((b) => (b.id === id ? fn(b) : b)) };
    });
  const editPath = (id: string, path: (string | number)[], value: unknown) =>
    editBlock(id, (b) => ({ ...b, content: setByPath(b.content, path, value) }));
  const setContent = (id: string, content: any) => editBlock(id, (b) => ({ ...b, content }));
  const setStyle = (id: string, style: any) => editBlock(id, (b) => ({ ...b, style }));
  const addBlock = (type: string) =>
    setPage((p) => {
      const nb: Block = { id: uid(type), type, content: getBlockDef(type).defaults() };
      setSelected(nb.id);
      return { ...p, blocks: [...p.blocks, nb] };
    });
  const removeBlock = (id: string) =>
    setPage((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) }));

  const fit = () => setZoom(clampZoom(Math.min(1, ((canvasRef.current?.clientWidth ?? 1100) - 40) / frameW)));

  return (
    <div className="se se--blocks">
      <div className="se__bar glass">
        <Link to="/app/sites" className="se__back"><ArrowLeft size={16} /> Сайты</Link>
        <span className="se__name">AllClean · блоки</span>
        <div className="se__devices">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} className={"se__icon" + (device === d ? " is-active" : "")} onClick={() => setDevice(d)} title={d}><Icon size={17} /></button>
          ))}
        </div>
        <div className="se__zoom">
          <button className="se__icon" onClick={() => setZoom((z) => clampZoom(z - 0.1))}><ZoomOut size={16} /></button>
          <button className="se__zoomval" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button className="se__icon" onClick={() => setZoom((z) => clampZoom(z + 0.1))}><ZoomIn size={16} /></button>
          <button className="se__icon" onClick={fit}><Scan size={16} /></button>
        </div>
        <Link to={`/app/sites/${siteId}`} className="se__toggle">Контент-режим</Link>
        <span className="se__save">{saveState === "saved" ? <><Check size={14} /> черновик</> : ""}</span>
      </div>

      <div className="se__body">
        <aside className="se__panel glass">
          <div className="se__section">Блоки страницы</div>
          <ul className="se__outline">
            {page.blocks.map((b) => (
              <li key={b.id} className={"se__block" + (selected === b.id ? " is-selected" : "")} onClick={() => setSelected(b.id)}>
                <span>{getBlockDef(b.type).meta.name}</span>
                <button className="se__blk-del" title="Удалить" onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }}>✕</button>
              </li>
            ))}
          </ul>
          <div className="se__section">Добавить блок</div>
          <div className="se__palette">
            {listBlockDefs().filter((d) => !d.interactive || d.type === "canvas").map((d) => (
              <button key={d.type} className="se__pal-btn" onClick={() => addBlock(d.type)}>
                <Plus size={13} /> {d.meta.name}
              </button>
            ))}
          </div>
        </aside>

        <main className="se__canvas" ref={canvasRef}>
          <div className="se__sizer" style={{ width: frameW * zoom, height: stageH * zoom }}>
            <div className="se__stage" ref={stageRef} style={{ width: frameW, transform: `scale(${zoom})` }}>
              <div className="site-root">
                {page.blocks.map((b) => {
                  const Def = getBlockDef(b.type);
                  return (
                    <div
                      key={b.id}
                      className={"blockwrap blk-select" + (selected === b.id ? " is-selected" : "")}
                      onClick={() => setSelected(b.id)}
                    >
                      <Def.Preview ctx={{ block: b, theme, editing: true, device, onEdit: (path, v) => editPath(b.id, path, v) }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        <aside className="se__panel glass se__inspector">
          {selBlock ? (
            <>
              <div className="se__section">{getBlockDef(selBlock.type).meta.name}</div>
              <div className="se__tabs">
                <button className={"se__tab" + (tab === "content" ? " is-active" : "")} onClick={() => setTab("content")}>Контент</button>
                <button className={"se__tab" + (tab === "style" ? " is-active" : "")} onClick={() => setTab("style")}>Оформление</button>
              </div>
              {tab === "content"
                ? <ContentEditor content={selBlock.content} onChange={(c) => setContent(selBlock.id, c)} />
                : <StylePanel style={selBlock.style as any} onChange={(s) => setStyle(selBlock.id, s)} />}
            </>
          ) : <div className="se__empty">Выберите блок.</div>}
        </aside>
      </div>
    </div>
  );
}
