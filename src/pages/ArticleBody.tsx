/**
 * Block-based article body editor (Dzen / vc.ru feel). Edits a list of blocks — paragraphs, H2/H3
 * subheadings, lists, quotes, inline images (uploaded), and dividers — and serializes to the Markdown
 * `body` on every change, so translate + publish + the static build keep working unchanged.
 *
 * Text blocks are uncontrolled contentEditable (innerHTML set once per block id) to keep the caret
 * stable while typing; a floating toolbar formats the current selection (bold / italic / link).
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Plus, Type, Heading2, Heading3, List, ListOrdered, Quote, Image as ImageIcon, Minus,
  ArrowUp, ArrowDown, Trash2, MoreVertical, Bold, Italic, Link2, Upload, Loader2, X,
} from "lucide-react";
import {
  type Block, type BlockType, newBlock, mdToBlocks, blocksToMd, inlineMdToHtml, htmlToInlineMd,
} from "../blog/blocks";
import { pickAndUploadImage } from "../blog/uploadClient";

const ADD_MENU: { type: BlockType; icon: React.ElementType; label: string }[] = [
  { type: "p", icon: Type, label: "Текст" },
  { type: "h2", icon: Heading2, label: "Заголовок" },
  { type: "h3", icon: Heading3, label: "Подзаголовок" },
  { type: "img", icon: ImageIcon, label: "Фото" },
  { type: "ul", icon: List, label: "Список" },
  { type: "ol", icon: ListOrdered, label: "Нумерованный" },
  { type: "quote", icon: Quote, label: "Цитата" },
  { type: "hr", icon: Minus, label: "Разделитель" },
];

const TURN_INTO: { type: BlockType; label: string }[] = [
  { type: "p", label: "Текст" }, { type: "h2", label: "Заголовок" }, { type: "h3", label: "Подзаголовок" }, { type: "quote", label: "Цитата" },
];

interface Props { value: string; onChange: (md: string) => void; }

export function ArticleBody({ value, onChange }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() => mdToBlocks(value));
  const lastMd = useRef(value);
  const editors = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<{ id: string; atStart?: boolean } | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);   // add-menu open under this block id ("top" = leading)
  const [actionsFor, setActionsFor] = useState<string | null>(null);

  // External body changes (locale switch / translate) come with a component remount via key={locale};
  // this guard only re-syncs if a different value arrives without a remount.
  useEffect(() => {
    if (value !== lastMd.current) { setBlocks(mdToBlocks(value)); lastMd.current = value; }
  }, [value]);

  const commit = useCallback((next: Block[]) => {
    setBlocks(next);
    const md = blocksToMd(next);
    lastMd.current = md;
    onChange(md);
  }, [onChange]);

  const registerEditor = (id: string) => (el: HTMLElement | null) => {
    if (el) editors.current.set(id, el); else editors.current.delete(id);
  };

  // Focus (and place caret) after a structural change.
  useLayoutEffect(() => {
    const pf = pendingFocus.current;
    if (!pf) return;
    const el = editors.current.get(pf.id);
    if (el) { el.focus(); placeCaret(el, pf.atStart); }
    pendingFocus.current = null;
  });

  const idx = (id: string) => blocks.findIndex((b) => b.id === id);

  const updateText = (id: string, text: string) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, text } : b));
    setBlocks(next); const md = blocksToMd(next); lastMd.current = md; onChange(md);
  };
  const updateItems = (id: string, items: string[]) => {
    const next = blocks.map((b) => (b.id === id ? { ...b, items } : b));
    setBlocks(next); const md = blocksToMd(next); lastMd.current = md; onChange(md);
  };
  const patch = (id: string, p: Partial<Block>) => commit(blocks.map((b) => (b.id === id ? { ...b, ...p } : b)));

  const insertAt = async (at: number, type: BlockType) => {
    const b = newBlock(type);
    const next = [...blocks.slice(0, at), b, ...blocks.slice(at)];
    setMenuFor(null);
    if (type === "img") {
      commit(next);
      const { url } = await pickAndUploadImage();
      if (url) commit([...next.slice(0, at), { ...b, url }, ...next.slice(at + 1)]);
    } else if (type === "hr") {
      commit(next);
    } else {
      commit(next);
      pendingFocus.current = { id: b.id, atStart: true };
    }
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = idx(id); const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks]; [next[i], next[j]] = [next[j], next[i]];
    commit(next); setActionsFor(null);
  };
  const remove = (id: string) => {
    const next = blocks.filter((b) => b.id !== id);
    commit(next.length ? next : [newBlock("p")]); setActionsFor(null);
  };
  const turnInto = (id: string, type: BlockType) => {
    patch(id, { type }); setActionsFor(null);
  };

  // Enter in a text block → split at caret into a new paragraph below.
  const onTextKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, block: Block) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const el = e.currentTarget;
      const { before, after } = splitAtCaret(el);
      const i = idx(block.id);
      const nb = newBlock("p"); nb.text = after;
      const kept: Block = { ...block, text: before };
      const next = [...blocks.slice(0, i), kept, nb, ...blocks.slice(i + 1)];
      el.innerHTML = inlineMdToHtml(before);
      pendingFocus.current = { id: nb.id, atStart: true };
      commit(next);
    } else if (e.key === "Backspace") {
      const el = e.currentTarget;
      if (caretAtStart(el) && htmlToInlineMd(el.innerHTML) === "" ) {
        e.preventDefault();
        const i = idx(block.id);
        if (i > 0) {
          const prev = blocks[i - 1];
          const next = blocks.filter((b) => b.id !== block.id);
          if (prev.type !== "img" && prev.type !== "hr") pendingFocus.current = { id: prev.id, atStart: false };
          commit(next);
        }
      }
    }
  };

  return (
    <div className="abody" onClick={() => { setMenuFor(null); setActionsFor(null); }}>
      {blocks.map((b, i) => (
        <div key={b.id} className="ablk" data-type={b.type}>
          <div className="ablk__gutter">
            <button type="button" className="ablk__add" title="Добавить блок"
              onClick={(e) => { e.stopPropagation(); setActionsFor(null); setMenuFor(menuFor === b.id ? null : b.id); }}>
              <Plus size={15} />
            </button>
            <button type="button" className="ablk__more" title="Действия"
              onClick={(e) => { e.stopPropagation(); setMenuFor(null); setActionsFor(actionsFor === b.id ? null : b.id); }}>
              <MoreVertical size={15} />
            </button>
            {menuFor === b.id && (
              <div className="ablk__menu card" onClick={(e) => e.stopPropagation()}>
                {ADD_MENU.map((m) => (
                  <button key={m.type} type="button" onClick={() => insertAt(i + 1, m.type)}>
                    <m.icon size={15} /> {m.label}
                  </button>
                ))}
              </div>
            )}
            {actionsFor === b.id && (
              <div className="ablk__menu ablk__menu--act card" onClick={(e) => e.stopPropagation()}>
                {(b.type === "p" || b.type === "h2" || b.type === "h3" || b.type === "quote") && (
                  <div className="ablk__turn">
                    <span className="ablk__turn-h">Сделать</span>
                    {TURN_INTO.filter((tt) => tt.type !== b.type).map((tt) => (
                      <button key={tt.type} type="button" onClick={() => turnInto(b.id, tt.type)}>{tt.label}</button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={() => move(b.id, -1)} disabled={i === 0}><ArrowUp size={15} /> Вверх</button>
                <button type="button" onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1}><ArrowDown size={15} /> Вниз</button>
                <button type="button" className="is-danger" onClick={() => remove(b.id)}><Trash2 size={15} /> Удалить</button>
              </div>
            )}
          </div>

          <div className="ablk__content">
            <BlockContent
              block={b}
              register={registerEditor(b.id)}
              onText={(t) => updateText(b.id, t)}
              onItems={(items) => updateItems(b.id, items)}
              onTextKeyDown={(e) => onTextKeyDown(e, b)}
              onImg={(p) => patch(b.id, p)}
              onExitList={(afterMd) => {
                const iCur = idx(b.id); const nb = newBlock("p"); nb.text = afterMd;
                pendingFocus.current = { id: nb.id, atStart: true };
                commit([...blocks.slice(0, iCur + 1), nb, ...blocks.slice(iCur + 1)]);
              }}
            />
          </div>
        </div>
      ))}
      <SelectionToolbar containerSel=".abody" />
    </div>
  );
}

/* ---------------- per-block content ---------------- */

function BlockContent({
  block, register, onText, onItems, onTextKeyDown, onImg, onExitList,
}: {
  block: Block;
  register: (el: HTMLElement | null) => void;
  onText: (t: string) => void;
  onItems: (items: string[]) => void;
  onTextKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onImg: (p: Partial<Block>) => void;
  onExitList: (afterMd: string) => void;
}) {
  if (block.type === "hr") return <hr className="abody__hr" />;

  if (block.type === "img") return <ImageBlock block={block} onImg={onImg} />;

  if (block.type === "ul" || block.type === "ol") {
    return <ListBlock block={block} register={register} onItems={onItems} onExitList={onExitList} />;
  }

  const cls =
    block.type === "h2" ? "abody__h2" :
    block.type === "h3" ? "abody__h3" :
    block.type === "quote" ? "abody__quote" : "abody__p";
  const ph =
    block.type === "h2" ? "Заголовок" :
    block.type === "h3" ? "Подзаголовок" :
    block.type === "quote" ? "Цитата" : "Текст абзаца…";

  return (
    <Editable
      className={"abody__edit " + cls}
      html={inlineMdToHtml(block.text || "")}
      placeholder={ph}
      register={register}
      onInput={(html) => onText(htmlToInlineMd(html))}
      onKeyDown={onTextKeyDown}
    />
  );
}

/** Uncontrolled contentEditable — innerHTML set once on mount so the caret never jumps while typing. */
function Editable({
  html, className, placeholder, register, onInput, onKeyDown,
}: {
  html: string; className: string; placeholder: string;
  register?: (el: HTMLElement | null) => void;
  onInput: (html: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={(el) => { ref.current = el; register?.(el); }}
      className={className}
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder}
      onInput={() => ref.current && onInput(ref.current.innerHTML)}
      onKeyDown={onKeyDown}
    />
  );
}

function ListBlock({
  block, register, onItems, onExitList,
}: {
  block: Block; register: (el: HTMLElement | null) => void;
  onItems: (items: string[]) => void; onExitList: (afterMd: string) => void;
}) {
  const items = block.items && block.items.length ? block.items : [""];
  const Tag = block.type === "ol" ? "ol" : "ul";
  const setItem = (i: number, md: string) => { const next = items.slice(); next[i] = md; onItems(next); };
  const key = (e: React.KeyboardEvent<HTMLDivElement>, i: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const cur = htmlToInlineMd(e.currentTarget.innerHTML);
      if (!cur.trim()) { // empty item → leave the list
        const next = items.slice(); next.splice(i, 1);
        onItems(next.length ? next : [""]);
        onExitList("");
        return;
      }
      const next = [...items.slice(0, i + 1), "", ...items.slice(i + 1)];
      onItems(next);
    }
  };
  return (
    <Tag className={"abody__list " + (block.type === "ol" ? "abody__ol" : "abody__ul")}>
      {items.map((it, i) => (
        <li key={i}>
          <Editable
            className="abody__edit abody__li"
            html={inlineMdToHtml(it)}
            placeholder="Пункт списка"
            register={i === 0 ? register : undefined}
            onInput={(html) => setItem(i, htmlToInlineMd(html))}
            onKeyDown={(e) => key(e, i)}
          />
        </li>
      ))}
    </Tag>
  );
}

function ImageBlock({ block, onImg }: { block: Block; onImg: (p: Partial<Block>) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async () => { setBusy(true); const { url } = await pickAndUploadImage(); if (url) onImg({ url }); setBusy(false); };
  if (!block.url) {
    return (
      <button type="button" className="abody__imgph" onClick={upload} disabled={busy}>
        {busy ? <><Loader2 size={18} className="art-spin" /> Загрузка…</> : <><ImageIcon size={20} /> Загрузить фото</>}
      </button>
    );
  }
  return (
    <figure className="abody__fig">
      <div className="abody__fig-imgwrap">
        <img src={block.url} alt={block.alt || ""} />
        <div className="abody__fig-acts">
          <button type="button" className="btn-ghost" onClick={upload} disabled={busy}>
            {busy ? <Loader2 size={13} className="art-spin" /> : <Upload size={13} />} Заменить
          </button>
          <button type="button" className="btn-ghost" onClick={() => onImg({ url: "" })}>Убрать</button>
        </div>
      </div>
      <input className="abody__fig-cap" value={block.alt || ""} placeholder="Подпись к фото (используется и как alt для SEO)"
        onChange={(e) => onImg({ alt: e.target.value })} />
    </figure>
  );
}

/* ---------------- floating format toolbar ---------------- */

function SelectionToolbar({ containerSel }: { containerSel: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const savedRange = useRef<Range | null>(null);

  useEffect(() => {
    const onSel = () => {
      if (linkMode) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setPos(null); return; }
      const range = sel.getRangeAt(0);
      const anchor = range.commonAncestorContainer as HTMLElement;
      const host = (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest(containerSel);
      if (!host) { setPos(null); return; }
      const r = range.getBoundingClientRect();
      if (!r.width && !r.height) { setPos(null); return; }
      savedRange.current = range.cloneRange();
      setPos({ top: r.top - 44, left: r.left + r.width / 2 });
    };
    document.addEventListener("selectionchange", onSel);
    return () => document.removeEventListener("selectionchange", onSel);
  }, [containerSel, linkMode]);

  const restore = () => {
    const sel = window.getSelection();
    if (savedRange.current && sel) { sel.removeAllRanges(); sel.addRange(savedRange.current); }
  };
  const cmd = (c: "bold" | "italic") => { restore(); document.execCommand(c); };
  const openLink = () => {
    restore();
    const a = window.getSelection()?.anchorNode?.parentElement?.closest("a");
    setLinkUrl(a?.getAttribute("href") || "https://");
    setLinkMode(true);
  };
  const applyLink = () => {
    restore();
    if (linkUrl.trim()) document.execCommand("createLink", false, linkUrl.trim());
    setLinkMode(false); setPos(null);
  };
  const clearLink = () => { restore(); document.execCommand("unlink"); setLinkMode(false); setPos(null); };

  if (!pos) return null;
  return (
    <div className="abody__rtb card" style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.preventDefault()}>
      {linkMode ? (
        <div className="abody__rtb-link">
          <input autoFocus value={linkUrl} placeholder="https://…" onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setLinkMode(false); }} />
          <button type="button" onClick={applyLink}>ОК</button>
          <button type="button" onClick={clearLink} title="Убрать ссылку"><X size={14} /></button>
        </div>
      ) : (
        <>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("bold"); }} title="Жирный"><Bold size={15} /></button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); cmd("italic"); }} title="Курсив"><Italic size={15} /></button>
          <button type="button" onMouseDown={(e) => { e.preventDefault(); openLink(); }} title="Ссылка"><Link2 size={15} /></button>
        </>
      )}
    </div>
  );
}

/* ---------------- caret helpers ---------------- */

function placeCaret(el: HTMLElement, atStart?: boolean) {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(!!atStart);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function caretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).startContainer, sel.getRangeAt(0).startOffset);
  return range.toString().length === 0;
}

function splitAtCaret(el: HTMLElement): { before: string; after: string } {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { before: htmlToInlineMd(el.innerHTML), after: "" };
  const range = sel.getRangeAt(0);
  const afterRange = range.cloneRange();
  afterRange.selectNodeContents(el);
  afterRange.setStart(range.endContainer, range.endOffset);
  const frag = afterRange.cloneContents();
  const tmp = document.createElement("div");
  tmp.appendChild(frag);
  const afterHtml = tmp.innerHTML;
  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(el);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  const bfrag = beforeRange.cloneContents();
  const btmp = document.createElement("div");
  btmp.appendChild(bfrag);
  return { before: htmlToInlineMd(btmp.innerHTML), after: htmlToInlineMd(afterHtml) };
}
