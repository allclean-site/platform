/**
 * Layers panel — the DOM tree of the selected block (like Webflow's Navigator / Tilda's layers).
 * Select a node, hide/show it, or reorder it among its siblings.
 *
 * Built as a real ARIA tree, because this panel is the only way to reach an element that cannot hold
 * a text caret — an image, a container, a video. It used to be rows of `<div onClick>` with
 * drag-and-drop as the only way to reorder: with a keyboard you could not select those elements at
 * all, and could not reorder anything (WCAG 2.1.1 Keyboard, 2.5.7 Dragging Movements). Arrow keys
 * move through the tree, Enter selects, and Alt+↑/↓ reorders without dragging.
 */

import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Eye, EyeOff, GripVertical } from "lucide-react";
import type { LayerNode } from "../editor/elemTypes";

interface Drag { id: string; parentId: string }
interface Flat { id: string; parentId: string; hasKids: boolean; isOpen: boolean }

export function LayersTree({ tree, selectedId, onSelect, onToggleHide, onMove }: {
  tree: LayerNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onMove: (id: string, refId: string, before: boolean) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const drag = useRef<Drag | null>(null);
  const [drop, setDrop] = useState<{ id: string; before: boolean } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Keep the selected node visible: expand all its ancestors.
  useEffect(() => {
    if (!selectedId) return;
    const path: string[] = [];
    const walk = (nodes: LayerNode[], trail: string[]): boolean => {
      for (const n of nodes) {
        if (n.id === selectedId) { path.push(...trail); return true; }
        if (n.children.length && walk(n.children, [...trail, n.id])) return true;
      }
      return false;
    };
    walk(tree, []);
    if (path.length) setExpanded((prev) => { const s = new Set(prev); path.forEach((id) => s.add(id)); return s; });
  }, [selectedId, tree]);

  const toggle = (id: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const rows: React.ReactNode[] = [];
  const flat: Flat[] = [];
  const focusRow = (id: string) =>
    boxRef.current?.querySelector<HTMLElement>(`[data-lay-id="${CSS.escape(id)}"]`)?.focus();

  /** Siblings, in view order — what Alt+↑/↓ moves within. */
  const siblingsOf = (parentId: string) => flat.filter((f) => f.parentId === parentId);

  const onKey = (e: React.KeyboardEvent, n: LayerNode, parentId: string, hasKids: boolean, isOpen: boolean) => {
    const i = flat.findIndex((f) => f.id === n.id);
    const moveCombo = e.altKey || ((e.ctrlKey || e.metaKey) && e.shiftKey);
    if (moveCombo && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      // The keyboard alternative to dragging: move within the same parent, like the drag does.
      const sibs = siblingsOf(parentId);
      const at = sibs.findIndex((s) => s.id === n.id);
      const to = e.key === "ArrowUp" ? at - 1 : at + 1;
      if (to < 0 || to >= sibs.length) return;
      e.preventDefault();
      onMove(n.id, sibs[to].id, e.key === "ArrowUp");
      return;
    }
    switch (e.key) {
      case "Enter":
      case " ":
        e.preventDefault(); onSelect(n.id); break;
      case "ArrowDown":
        e.preventDefault(); if (flat[i + 1]) focusRow(flat[i + 1].id); break;
      case "ArrowUp":
        e.preventDefault(); if (flat[i - 1]) focusRow(flat[i - 1].id); break;
      case "ArrowRight":
        e.preventDefault();
        if (hasKids && !isOpen) toggle(n.id);
        else if (hasKids && flat[i + 1]) focusRow(flat[i + 1].id);
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (hasKids && isOpen) toggle(n.id);
        else if (parentId !== "__root__") focusRow(parentId);
        break;
      case "Home":
        e.preventDefault(); if (flat[0]) focusRow(flat[0].id); break;
      case "End":
        e.preventDefault(); if (flat.length) focusRow(flat[flat.length - 1].id); break;
      default:
        break;
    }
  };

  const render = (nodes: LayerNode[], depth: number, parentId: string) => {
    nodes.forEach((n) => {
      const hasKids = n.children.length > 0;
      const isOpen = expanded.has(n.id);
      const dropCls = drop?.id === n.id ? (drop.before ? " drop-before" : " drop-after") : "";
      flat.push({ id: n.id, parentId, hasKids, isOpen });
      rows.push(
        <div
          key={n.id}
          data-lay-id={n.id}
          role="treeitem"
          aria-level={depth + 1}
          aria-selected={n.id === selectedId}
          {...(hasKids ? { "aria-expanded": isOpen } : {})}
          // Roving tabindex: the tree is ONE tab stop, arrows move inside it.
          tabIndex={n.id === selectedId || (!selectedId && flat.length === 1) ? 0 : -1}
          className={"lay__row" + (n.id === selectedId ? " is-sel" : "") + (n.hidden ? " is-hidden" : "") + dropCls}
          style={{ paddingLeft: 6 + depth * 12 }}
          draggable
          onDragStart={(e) => { drag.current = { id: n.id, parentId }; e.dataTransfer.effectAllowed = "move"; }}
          onDragEnd={() => { drag.current = null; setDrop(null); }}
          onDragOver={(e) => {
            const d = drag.current;
            if (!d || d.parentId !== parentId || d.id === n.id) return;
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDrop({ id: n.id, before: e.clientY < r.top + r.height / 2 });
          }}
          onDrop={(e) => {
            const d = drag.current;
            if (!d || d.parentId !== parentId || d.id === n.id) return;
            e.preventDefault();
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            onMove(d.id, n.id, e.clientY < r.top + r.height / 2);
            drag.current = null; setDrop(null);
          }}
          onClick={() => onSelect(n.id)}
          onKeyDown={(e) => onKey(e, n, parentId, hasKids, isOpen)}
          title={n.tag.toLowerCase() + " · Enter — выбрать, Alt+↑/↓ (или Ctrl+Shift+↑/↓) — переместить"}
        >
          <span className="lay__grip" aria-hidden="true"><GripVertical size={12} /></span>
          {hasKids ? (
            <button className={"lay__tw" + (isOpen ? " is-open" : "")} tabIndex={-1}
              aria-label={isOpen ? "Свернуть" : "Развернуть"}
              onClick={(e) => { e.stopPropagation(); toggle(n.id); }}>
              <ChevronRight size={12} />
            </button>
          ) : (
            <span className="lay__tw lay__tw--leaf" />
          )}
          <span className="lay__label">{n.label}{n.more && !hasKids ? " …" : ""}</span>
          <button className="lay__eye" tabIndex={-1} title={n.hidden ? "Показать" : "Скрыть"}
            aria-label={(n.hidden ? "Показать " : "Скрыть ") + n.label}
            onClick={(e) => { e.stopPropagation(); onToggleHide(n.id, !n.hidden); }}>
            {n.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      );
      if (hasKids && isOpen) render(n.children, depth + 1, n.id);
    });
  };
  render(tree, 0, "__root__");

  if (!tree.length) return null;
  return <div className="lay" role="tree" aria-label="Слои внутри блока" ref={boxRef}>{rows}</div>;
}
