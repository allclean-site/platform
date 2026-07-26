/**
 * Layers panel — the DOM tree of the selected block (like Webflow's Navigator / Tilda's layers).
 * Click a node = select that element, eye = hide/show, drag = reorder among same-parent siblings.
 * The tree comes from the iframe runtime (SelectedEl.tree); actions post messages back to it.
 */

import React, { useEffect, useRef, useState } from "react";
import { ChevronRight, Eye, EyeOff, GripVertical } from "lucide-react";
import type { LayerNode } from "../editor/elemTypes";

interface Drag { id: string; parentId: string }

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
  const render = (nodes: LayerNode[], depth: number, parentId: string) => {
    nodes.forEach((n) => {
      const hasKids = n.children.length > 0;
      const isOpen = expanded.has(n.id);
      const dropCls = drop?.id === n.id ? (drop.before ? " drop-before" : " drop-after") : "";
      rows.push(
        <div
          key={n.id}
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
          title={n.tag.toLowerCase()}
        >
          <span className="lay__grip"><GripVertical size={12} /></span>
          {hasKids ? (
            <button className={"lay__tw" + (isOpen ? " is-open" : "")} onClick={(e) => { e.stopPropagation(); toggle(n.id); }}>
              <ChevronRight size={12} />
            </button>
          ) : (
            <span className="lay__tw lay__tw--leaf" />
          )}
          <span className="lay__label">{n.label}{n.more && !hasKids ? " …" : ""}</span>
          <button className="lay__eye" title={n.hidden ? "Показать" : "Скрыть"} onClick={(e) => { e.stopPropagation(); onToggleHide(n.id, !n.hidden); }}>
            {n.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      );
      if (hasKids && isOpen) render(n.children, depth + 1, n.id);
    });
  };
  render(tree, 0, "__root__");

  if (!tree.length) return null;
  return <div className="lay">{rows}</div>;
}
