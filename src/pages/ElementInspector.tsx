/**
 * Element properties panel (Tilda/Webflow-level) for the selected element on the real site.
 * Collapsible sections; values reflect the element's current computed style; a visual box-model
 * control for padding/margin (type a value or scrub-drag a side). All changes flow through `patch`
 * → applied as inline styles on the real node (reversible, foreign classes untouched).
 */

import React, { useState } from "react";
import { ChevronDown, Type, Ruler, Square, PaintBucket, Link2, Image as ImageIcon, Video as VideoIcon, HelpCircle, MousePointerClick, LayoutGrid, AlignLeft, AlignCenter, AlignRight, AlignJustify } from "lucide-react";
import type { ElStyle, ElPatch, SelectedEl, Breakpoint } from "../editor/elemTypes";

const WEIGHTS = [
  [300, "Лёгкий"], [400, "Обычный"], [500, "Средний"], [600, "Полужирный"], [700, "Жирный"], [800, "Чёрный"],
] as const;

function Section({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={"pi__sec" + (open ? " is-open" : "")}>
      <button className="pi__sec-head" onClick={() => setOpen((v) => !v)}>
        <Icon size={15} /> <span>{title}</span> <ChevronDown size={15} className="pi__chev" />
      </button>
      {open && <div className="pi__sec-body">{children}</div>}
    </div>
  );
}

/** A small orange dot marking a value overridden for the current (non-desktop) breakpoint; click = reset. */
function OverDot({ onReset, num }: { onReset?: () => void; num?: boolean }) {
  return (
    <button
      className={"pi__od" + (num ? " pi__od--num" : "")}
      title="Правка для этого экрана — сбросить к компьютерной версии"
      onClick={(e) => { e.stopPropagation(); onReset?.(); }}
    />
  );
}

/** Number field with drag-to-scrub (pointer-drag left/right changes the value). Honours `step` so
 *  fractional values (line-height 1.2, tracking 0.5) scrub smoothly instead of jumping by whole units. */
function NumField({ value, onChange, min = -200, max = 400, step = 1, suffix, w, over, onReset }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; w?: number; over?: boolean; onReset?: () => void }) {
  const start = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).closest(".pi__od")) return;
    e.preventDefault();
    const sx = e.clientX, sv = value;
    const move = (ev: PointerEvent) => {
      const snapped = Math.round((sv + (ev.clientX - sx) * (step / 2)) / step) * step;
      onChange(Math.max(min, Math.min(max, Number(snapped.toFixed(3)))));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div className={"pi__num" + (over ? " is-over" : "")} onPointerDown={start} style={w ? { width: w } : undefined} title="Потяните, чтобы изменить">
      <input type="number" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
      {suffix && <span className="pi__num-suf">{suffix}</span>}
      {over && <OverDot onReset={onReset} num />}
    </div>
  );
}

/** Range slider + number field, side by side (the friendly control for bounded numeric values). */
function SliderNum({ value, onChange, min, max, step = 1, suffix }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <>
      <input className="pi__slider" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <NumField value={value} onChange={onChange} min={min} max={max} step={step} suffix={suffix} w={64} />
    </>
  );
}

function Row({ label, hint, over, onReset, children }: { label: string; hint?: string; over?: boolean; onReset?: () => void; children: React.ReactNode }) {
  return (
    <div className="pi__row">
      <span className="pi__label">
        {label}
        {hint && <span className="pi__q" title={hint}><HelpCircle size={12} /></span>}
        {over && <OverDot onReset={onReset} />}
      </span>
      <div className="pi__ctl">{children}</div>
    </div>
  );
}

/** Visual box-model: outer margin band + inner padding band, 8 editable insets. */
function BoxModel({ s, patch, bp }: { s: ElStyle; patch: (p: ElPatch) => void; bp: (k: keyof ElStyle) => { over?: boolean; onReset?: () => void } }) {
  const set = (k: keyof ElStyle) => (v: number) => patch({ style: { [k]: v } as Partial<ElStyle> });
  return (
    <div className="bm">
      <span className="bm__cap bm__cap--m">отступ снаружи</span>
      <div className="bm__side bm__side--mt"><NumField value={s.marTop} onChange={set("marTop")} {...bp("marTop")} /></div>
      <div className="bm__side bm__side--mb"><NumField value={s.marBottom} onChange={set("marBottom")} {...bp("marBottom")} /></div>
      <div className="bm__side bm__side--ml"><NumField value={s.marLeft} onChange={set("marLeft")} {...bp("marLeft")} /></div>
      <div className="bm__side bm__side--mr"><NumField value={s.marRight} onChange={set("marRight")} {...bp("marRight")} /></div>
      <div className="bm__pad">
        <span className="bm__cap bm__cap--p">внутри</span>
        <div className="bm__side bm__side--pt"><NumField value={s.padTop} onChange={set("padTop")} min={0} {...bp("padTop")} /></div>
        <div className="bm__side bm__side--pb"><NumField value={s.padBottom} onChange={set("padBottom")} min={0} {...bp("padBottom")} /></div>
        <div className="bm__side bm__side--pl"><NumField value={s.padLeft} onChange={set("padLeft")} min={0} {...bp("padLeft")} /></div>
        <div className="bm__side bm__side--pr"><NumField value={s.padRight} onChange={set("padRight")} min={0} {...bp("padRight")} /></div>
        <div className="bm__box" />
      </div>
    </div>
  );
}

/**
 * Text field for a heading whose lines are separate nodes in the markup.
 *
 * A site heading is rarely one string: it is a line break the client added, or one element per word
 * that the design styles individually. Writing the whole thing back through `textContent` would
 * collapse all of that and take the site's classes with it — which is why the panel used to show a
 * hint instead of a field, and read as "editing is broken".
 *
 * So it stays ONE ordinary field, the way the heading actually reads, and the line breaks in it are
 * the line breaks on the page: each line is written back into its own node, untouched lines are not
 * rewritten at all, and Enter/Backspace add and remove a real break. Nothing here needs the client to
 * know that the heading is made of pieces.
 */
function StructuredText({ parts, patch }: { parts: string[]; patch: (p: ElPatch) => void }) {
  if (!parts.length) {
    return <p className="pi__note">Правьте текст прямо на странице — кликните и печатайте.</p>;
  }
  return (
    <>
      <textarea
        className="pi__inp pi__area"
        rows={Math.min(6, Math.max(2, parts.length))}
        value={parts.join("\n")}
        onChange={(e) => patch({ parts: e.target.value.split("\n") })}
      />
      {parts.length > 1 && <p className="pi__note">Каждая строка — отдельная строка заголовка.</p>}
    </>
  );
}

export function ElementInspector({ sel, patch, onReplaceImage, breakpoint = "desktop", onResetBp, onState, onResetState, onResizeMode, onVAlign }: { sel: SelectedEl; patch: (p: ElPatch) => void; onReplaceImage: () => void; breakpoint?: Breakpoint; onResetBp?: (key?: keyof ElStyle) => void; onState?: (layer: "hover" | "active", s: Partial<ElStyle>) => void; onResetState?: (layer: "hover" | "active", key: "color" | "background") => void; onResizeMode?: (mode: "hug" | "fixw" | "fixed") => void; onVAlign?: (value: "top" | "center" | "bottom") => void }) {
  const [stateTab, setStateTab] = useState<"hover" | "active">("hover");
  const s = sel.style;
  const isText = sel.kind !== "image"; // text/link/container get typography
  const st = (k: keyof ElStyle) => (v: any) => patch({ style: { [k]: v } as Partial<ElStyle> });
  // Breakpoint affordances: on tablet/mobile each control shows an orange dot when overridden + reset.
  const isBp = breakpoint !== "desktop";
  const over = sel.bpOver ?? {};
  const bp = (k: keyof ElStyle) => (isBp ? { over: !!over[k], onReset: () => onResetBp?.(k) } : {});
  const isFlex = s.display === "flex" || s.display === "inline-flex";
  // Figma text-box resize mode, derived from the element's width/height.
  const frameMode: "hug" | "fixw" | "fixed" | "" =
    s.height ? "fixed" : s.width === "max-content" || s.width === "fit-content" ? "hug" : s.width ? "fixw" : "";
  const matchDisplay = (cur: string, v: string) => (v === "block" ? cur === "block" || cur === "inline-block" : cur === v);
  return (
    <div className="pi">
      {isBp && (
        <div className="pi__bp">
          <span className="pi__bp-t">
            Правки для {breakpoint === "tablet" ? "планшета" : "телефона"}
            <span className="pi__q" title="Меняют вид только на этом размере экрана. Компьютерная версия не затрагивается."><HelpCircle size={12} /></span>
          </span>
          {Object.keys(over).length > 0 && (
            <button className="pi__bp-reset" onClick={() => onResetBp?.()}>Сбросить экран</button>
          )}
        </div>
      )}
      {sel.kind === "image" && (
        <Section title="Изображение" icon={ImageIcon}>
          <button className="pi__btn" onClick={onReplaceImage}>Заменить фото</button>
          <Row label="Alt (SEO)"><input className="pi__inp" value={sel.text} onChange={(e) => patch({ text: e.target.value })} /></Row>
        </Section>
      )}

      {sel.kind === "video" && (
        <Section title="Видео" icon={VideoIcon}>
          <button className="pi__btn" onClick={onReplaceImage}>Заменить видео</button>
          <p className="pi__note">Загрузите новое видео с устройства/ПК или выберите из галереи.</p>
        </Section>
      )}

      {(sel.kind === "text" || sel.kind === "link") && (
        <Section title={sel.kind === "link" ? "Надпись" : "Текст"} icon={Type}>
          {sel.structured ? (
            <StructuredText parts={sel.parts ?? []} patch={patch} />
          ) : (
            <textarea className="pi__inp pi__area" rows={2} value={sel.text} onChange={(e) => patch({ text: e.target.value })} />
          )}
        </Section>
      )}

      {sel.kind === "link" && (
        <Section title="Ссылка" icon={Link2}>
          <Row label="URL"><input className="pi__inp" value={sel.href} onChange={(e) => patch({ href: e.target.value })} placeholder="#book / https://…" /></Row>
        </Section>
      )}

      {sel.kind === "link" && (() => {
        const cur = stateTab === "hover" ? sel.hover : sel.active;
        return (
          <Section title="Состояния кнопки" icon={MousePointerClick} defaultOpen={false}>
            <p className="pi__note">Как выглядит кнопка при наведении мышкой и при нажатии. Обычный вид не меняется (генерируется как <code>:hover</code> / <code>:active</code>).</p>
            <div className="pi__seg pi__seg--full pi__states">
              {([["hover", "Наведение"], ["active", "Нажатие"]] as const).map(([st, l]) => {
                const marked = st === "hover" ? sel.hover : sel.active;
                const dot = !!(marked?.over.color || marked?.over.background);
                return (
                  <button key={st} className={"pi__seg-btn pi__seg-btn--wide" + (stateTab === st ? " is-active" : "")} onClick={() => setStateTab(st)}>
                    {l}{dot && <span className="pi__state-dot" />}
                  </button>
                );
              })}
            </div>
            <Row label="Цвет текста" over={!!cur?.over.color} onReset={() => onResetState?.(stateTab, "color")}>
              <label className="pi__swatch" style={{ background: cur?.color || s.color }}>
                <input type="color" aria-label="Выбор цвета" value={cur?.color || s.color} onChange={(e) => onState?.(stateTab, { color: e.target.value })} />
              </label>
              <span className="pi__hex">{cur?.color || "как обычно"}</span>
            </Row>
            <Row label="Цвет фона" over={!!cur?.over.background} onReset={() => onResetState?.(stateTab, "background")}>
              <label className="pi__swatch" style={{ background: cur?.background || "#ffffff" }}>
                <input type="color" aria-label="Выбор цвета" value={cur?.background || "#ffffff"} onChange={(e) => onState?.(stateTab, { background: e.target.value })} />
              </label>
              <span className="pi__hex">{cur?.background || "как обычно"}</span>
            </Row>
          </Section>
        );
      })()}

      {isText && (
        <Section title="Типографика" icon={Type}>
          <Row label="Размер" {...bp("fontSize")}>
            <SliderNum value={s.fontSize} onChange={st("fontSize")} min={8} max={200} suffix="px" />
          </Row>
          <Row label="Начертание" hint="Толщина шрифта" {...bp("weight")}>
            <select className="pi__sel" value={s.weight} onChange={(e) => st("weight")(Number(e.target.value))}>
              {WEIGHTS.map(([w, l]) => <option key={w} value={w}>{l}</option>)}
            </select>
          </Row>
          <Row label="Интерлиньяж" hint="Высота строки (множитель): 1.0 — плотно, 1.5 — просторно" {...bp("lineHeight")}>
            <SliderNum value={s.lineHeight} onChange={st("lineHeight")} min={0.8} max={3} step={0.05} />
          </Row>
          <Row label="Трекинг" hint="Расстояние между буквами, px" {...bp("letterSpacing")}>
            <SliderNum value={s.letterSpacing} onChange={st("letterSpacing")} min={-5} max={20} step={0.5} suffix="px" />
          </Row>
          <Row label="Выравнивание" {...bp("align")}>
            <div className="pi__seg">
              {([["left", AlignLeft, "Слева"], ["center", AlignCenter, "По центру"], ["right", AlignRight, "Справа"], ["justify", AlignJustify, "По ширине"]] as const).map(([a, Ic, t]) => (
                <button key={a} className={"pi__seg-btn" + (s.align === a ? " is-active" : "")} onClick={() => st("align")(a)} title={t}>
                  <Ic size={15} />
                </button>
              ))}
            </div>
          </Row>
          <Row label="Цвет" hint="Цвет всего текста. Чтобы покрасить часть — выделите её и жмите цвет на панельке." {...bp("color")}>
            <label className="pi__swatch" style={{ background: s.color }}>
              <input type="color" aria-label="Выбор цвета" value={s.color} onChange={(e) => st("color")(e.target.value)} />
            </label>
            <span className="pi__hex">{s.color}</span>
          </Row>
        </Section>
      )}

      <Section title="Раскладка" icon={LayoutGrid} defaultOpen={sel.kind === "container"}>
        <Row label="Вид" hint="Как располагаются дочерние элементы. Флекс = удобная авто-раскладка (карточки/кнопки в ряд). «Скрыть» прячет элемент — на планшете/телефоне только для этого экрана." {...bp("display")}>
          <div className="pi__seg pi__seg--full">
            {(["block", "flex", "grid", "none"] as const).map((v) => (
              <button key={v} className={"pi__seg-btn pi__seg-btn--wide" + (matchDisplay(s.display, v) ? " is-active" : "")} onClick={() => st("display")(v)}>
                {v === "block" ? "Блок" : v === "flex" ? "Флекс" : v === "grid" ? "Сетка" : "Скрыть"}
              </button>
            ))}
          </div>
        </Row>
        {isFlex && (
          <>
            <Row label="Направление" {...bp("flexDir")}>
              <div className="pi__seg pi__seg--full">
                {(["row", "column"] as const).map((v) => (
                  <button key={v} className={"pi__seg-btn pi__seg-btn--wide" + (s.flexDir === v ? " is-active" : "")} onClick={() => st("flexDir")(v)}>{v === "row" ? "Ряд" : "Колонка"}</button>
                ))}
              </div>
            </Row>
            <Row label="Перенос" hint="Переносить элементы на новую строку, если не влезают" {...bp("flexWrap")}>
              <div className="pi__seg pi__seg--full">
                {(["nowrap", "wrap"] as const).map((v) => (
                  <button key={v} className={"pi__seg-btn pi__seg-btn--wide" + (s.flexWrap === v ? " is-active" : "")} onClick={() => st("flexWrap")(v)}>{v === "nowrap" ? "Нет" : "Да"}</button>
                ))}
              </div>
            </Row>
            <Row label="По оси" hint="Выравнивание вдоль направления" {...bp("justify")}>
              <select className="pi__sel" value={s.justify} onChange={(e) => st("justify")(e.target.value)}>
                <option value="flex-start">В начало</option>
                <option value="center">По центру</option>
                <option value="flex-end">В конец</option>
                <option value="space-between">С промежутками</option>
                <option value="space-around">Вокруг</option>
              </select>
            </Row>
            <Row label="Поперёк" {...bp("alignItems")}>
              <select className="pi__sel" value={s.alignItems} onChange={(e) => st("alignItems")(e.target.value)}>
                <option value="stretch">Растянуть</option>
                <option value="flex-start">В начало</option>
                <option value="center">По центру</option>
                <option value="flex-end">В конец</option>
              </select>
            </Row>
            <Row label="Промежуток" hint="Расстояние между элементами, px" {...bp("gap")}>
              <SliderNum value={s.gap} onChange={st("gap")} min={0} max={80} suffix="px" />
            </Row>
          </>
        )}
      </Section>

      <Section title="Отступы" icon={Ruler}>
        <BoxModel s={s} patch={patch} bp={bp} />
      </Section>

      <Section title="Размер рамки" icon={Square} defaultOpen={sel.kind === "text" || sel.kind === "container"}>
        <Row label="Режим" hint="Как ведёт себя рамка (как в Figma): «Обнять» — по тексту; «Фикс. ширина» — ширина задана, высота по контенту (текст переносится); «Фикс.» — заданы и ширина, и высота.">
          <div className="pi__seg pi__seg--full">
            {([["hug", "Обнять"], ["fixw", "Фикс. ширина"], ["fixed", "Фикс."]] as const).map(([m, l]) => (
              <button key={m} className={"pi__seg-btn pi__seg-btn--wide" + (frameMode === m ? " is-active" : "")} onClick={() => onResizeMode?.(m)}>{l}</button>
            ))}
          </div>
        </Row>
        <Row label="Ширина" hint="Тяни боковые ручки на элементе — текст переносится вживую. Или впиши: 640px, 100%, max-content." {...bp("width")}>
          <input className="pi__inp" value={s.width} onChange={(e) => st("width")(e.target.value)} placeholder="авто" />
        </Row>
        {frameMode === "fixed" && (
          <>
            <Row label="Высота" {...bp("height")}>
              <input className="pi__inp" value={s.height} onChange={(e) => st("height")(e.target.value)} placeholder="авто" />
            </Row>
            <Row label="По вертикали" hint="Положение текста внутри рамки">
              <div className="pi__seg pi__seg--full">
                {([["top", "Верх"], ["center", "Центр"], ["bottom", "Низ"]] as const).map(([v, l]) => (
                  <button key={v} className="pi__seg-btn pi__seg-btn--wide" onClick={() => onVAlign?.(v)}>{l}</button>
                ))}
              </div>
            </Row>
          </>
        )}
      </Section>

      <Section title="Фон" icon={PaintBucket} defaultOpen={false}>
        <Row label="Цвет фона" {...bp("background")}>
          <label className="pi__swatch" style={{ background: s.background || "transparent" }}>
            <input type="color" aria-label="Выбор цвета" value={s.background || "#ffffff"} onChange={(e) => st("background")(e.target.value)} />
          </label>
          <span className="pi__hex">{s.background || "нет"}</span>
        </Row>
      </Section>
    </div>
  );
}
