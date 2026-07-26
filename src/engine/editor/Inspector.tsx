/** Generic, schema-less content editor.
 *
 * Walks a block's `content` JSON and renders an appropriate control for each field:
 * strings → text/textarea, objects → nested groups, arrays → repeatable item lists.
 * This means every block is editable with ZERO per-block form code — add a block type
 * and its fields are editable automatically. */

import React from "react";
import { pickImage } from "./image";
import type { BlockStyle } from "../blocks/style";

const LABELS: Record<string, string> = {
  logo: "Логотип", links: "Ссылки", cta: "Кнопка", label: "Текст", href: "Ссылка",
  badge: "Плашка", heading: "Заголовок", subheading: "Подзаголовок", body: "Текст",
  primaryCta: "Основная кнопка", secondaryCta: "Вторая кнопка", phone: "Телефон",
  image: "Изображение", src: "URL", alt: "Alt (для SEO)", items: "Элементы", title: "Заголовок",
  text: "Текст", lead: "Подводка", ratingText: "Рейтинг", quote: "Цитата", author: "Автор",
  source: "Источник", q: "Вопрос", a: "Ответ", brand: "Бренд", address: "Адрес", email: "E-mail",
  columns: "Колонки", copyright: "Копирайт",
};
const label = (k: string) => LABELS[k] ?? k;

const LONG = new Set(["body", "text", "quote", "a", "subheading", "lead", "address"]);

function StringField({ k, value, onChange }: { k: string; value: string; onChange: (v: string) => void }) {
  const long = LONG.has(k) || value.length > 46;
  return (
    <label className="insp__field">
      <span className="insp__label">{label(k)}</span>
      {long ? (
        <textarea className="insp__input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="insp__input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function ArrayField({ k, value, onChange }: { k: string; value: any[]; onChange: (v: any[]) => void }) {
  const addItem = () => {
    const template = value.length ? structuredClone(value[value.length - 1]) : "";
    onChange([...value, template]);
  };
  return (
    <div className="insp__array">
      <div className="insp__label insp__label--group">{label(k)}</div>
      {value.map((item, i) => (
        <div className="insp__item" key={i}>
          <div className="insp__item-head">
            <span>#{i + 1}</span>
            <button className="insp__mini" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Удалить">✕</button>
          </div>
          <AnyField
            k={""}
            value={item}
            onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))}
          />
        </div>
      ))}
      <button className="insp__add" onClick={addItem}>+ Добавить</button>
    </div>
  );
}

function ObjectField({ value, onChange }: { value: Record<string, any>; onChange: (v: Record<string, any>) => void }) {
  return (
    <div className="insp__object">
      {Object.keys(value).map((key) => (
        <AnyField key={key} k={key} value={value[key]} onChange={(v) => onChange({ ...value, [key]: v })} />
      ))}
    </div>
  );
}

function ImageField({ value, onChange }: { value: { src: string; alt: string }; onChange: (v: any) => void }) {
  return (
    <div className="insp__field">
      <span className="insp__label">Изображение</span>
      {value.src ? (
        <img className="insp__thumb" src={value.src} alt="" />
      ) : (
        <div className="insp__thumb insp__thumb--empty">нет фото</div>
      )}
      <button
        className="insp__add"
        onClick={async () => {
          const r = await pickImage();
          if (r) onChange({ ...value, src: r.src });
        }}
      >
        ⬆ Загрузить фото
      </button>
      <label className="insp__field" style={{ marginTop: 8 }}>
        <span className="insp__label">Alt (для SEO)</span>
        <input className="insp__input" value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} />
      </label>
    </div>
  );
}

const isImage = (v: any) => v && typeof v === "object" && !Array.isArray(v) && "src" in v && "alt" in v;

export function AnyField({ k, value, onChange }: { k: string; value: any; onChange: (v: any) => void }) {
  if (typeof value === "string") return <StringField k={k} value={value} onChange={onChange} />;
  if (isImage(value)) return <ImageField value={value} onChange={onChange} />;
  if (typeof value === "number")
    return (
      <label className="insp__field">
        <span className="insp__label">{label(k)}</span>
        <input className="insp__input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      </label>
    );
  if (Array.isArray(value)) return <ArrayField k={k} value={value} onChange={onChange} />;
  if (value && typeof value === "object") return <ObjectField value={value} onChange={onChange} />;
  return null;
}

export function ContentEditor({ content, onChange }: { content: Record<string, any>; onChange: (c: any) => void }) {
  return <ObjectField value={content} onChange={onChange} />;
}

/** Presentation controls (background / padding / alignment / width) → block.style. */
const STYLE_FIELDS: { key: keyof BlockStyle; label: string; opts: [string, string][] }[] = [
  { key: "bg", label: "Фон", opts: [["", "обычный"], ["soft", "светлый"], ["accent", "акцент"], ["dark", "тёмный"]] },
  { key: "pad", label: "Отступы", opts: [["", "по умолчанию"], ["s", "малые"], ["m", "средние"], ["l", "большие"]] },
  { key: "align", label: "Выравнивание", opts: [["", "слева"], ["center", "по центру"]] },
  { key: "width", label: "Ширина контента", opts: [["", "обычная"], ["narrow", "узкая"], ["wide", "широкая"]] },
];

export function StylePanel({ style, onChange }: { style?: BlockStyle; onChange: (s: BlockStyle) => void }) {
  const set = (k: keyof BlockStyle, v: string) => {
    const next: any = { ...style };
    if (v) next[k] = v;
    else delete next[k];
    onChange(next);
  };
  return (
    <div>
      {STYLE_FIELDS.map(({ key, label, opts }) => (
        <label className="insp__field" key={key}>
          <span className="insp__label">{label}</span>
          <select className="insp__input" value={(style as any)?.[key] ?? ""} onChange={(e) => set(key, e.target.value)}>
            {opts.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
