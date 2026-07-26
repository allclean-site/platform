/**
 * Calculator editor — build a calculator from questions with a live price preview.
 * Add / delete / reorder questions (select · number · multi-select), edit each option's label and its
 * effect on price, and tune base price / minimum / range. Autosaves to the library. The same config
 * powers the site's calculator block, so what you see here is exactly what visitors get.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, GripVertical, Check, ListChecks, Hash, CheckSquare,
  Coins, Eye, Copy,
} from "lucide-react";
import { getCalc, upsertCalc, duplicateCalc, newField, newOption, type CalcDoc } from "../calc/store";
import { compute, priceText, initState, visible, type CalcConfig, type Field, type Opt, type CalcState } from "../engine/blocks/calculator/engine";
import "./calculators.css";

type Loc = "ru" | "ro";
const FIELD_KINDS = [
  { type: "select" as const, icon: ListChecks, label: "Выбор одного" },
  { type: "number" as const, icon: Hash, label: "Число (ползунок)" },
  { type: "multi" as const, icon: CheckSquare, label: "Несколько" },
];

export function CalcEditor() {
  const { calcId = "" } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState<CalcDoc | null>(() => getCalc(calcId) ?? null);
  const [preview, setPreview] = useState<Loc>("ru");
  const [saved, setSaved] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  // Autosave (debounced) whenever the doc changes.
  useEffect(() => {
    if (!doc) return;
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { upsertCalc(doc); setSaved(true); }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [doc]);

  if (!doc) return <div className="calc-ed__missing">Калькулятор не найден. <button className="linklike" onClick={() => nav("/app/calculators")}>К библиотеке</button></div>;

  const cfg = doc.config;
  const patch = (p: Partial<CalcDoc>) => setDoc((d) => (d ? { ...d, ...p } : d));
  const patchCfg = (p: Partial<CalcConfig>) => setDoc((d) => (d ? { ...d, config: { ...d.config, ...p } } : d));
  const setFields = (fields: Field[]) => patchCfg({ fields });

  const addField = (type: Field["type"]) => setFields([...cfg.fields, newField(type, cfg.fields)]);
  const updateField = (i: number, f: Field) => setFields(cfg.fields.map((x, j) => (j === i ? f : x)));
  const removeField = (i: number) => setFields(cfg.fields.filter((_, j) => j !== i));
  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= cfg.fields.length) return;
    const a = [...cfg.fields]; [a[i], a[j]] = [a[j], a[i]]; setFields(a);
  };

  return (
    <div className="calc-ed">
      <div className="calc-ed__bar glass">
        <button className="calc-ed__back" onClick={() => nav("/app/calculators")}><ArrowLeft size={16} /> Библиотека</button>
        <input className="calc-ed__name" value={doc.name.ru} onChange={(e) => patch({ name: { ...doc.name, ru: e.target.value } })} placeholder="Название калькулятора" />
        <span className="calc-ed__save">{saved ? <><Check size={14} /> сохранено</> : "сохраняю…"}</span>
        <button className="btn-ghost" title="Дублировать" onClick={() => { const c = duplicateCalc(doc); upsertCalc(c); nav(`/app/calculators/${c.id}`); }}><Copy size={15} /> Копия</button>
        <button className="btn-primary" title="Скоро: вставка на страницу сайта" disabled><Plus size={16} /> Вставить на сайт</button>
      </div>

      <div className="calc-ed__body">
        <div className="calc-ed__form">
          <section className="calc-sec">
            <div className="calc-sec__head"><ListChecks size={16} /> <h3>Вопросы</h3><span className="muted">{cfg.fields.length}</span></div>
            {cfg.fields.length === 0 && <p className="calc-empty">Пока нет вопросов. Добавьте первый — например, «Тип уборки» с вариантами.</p>}
            <div className="calc-fields">
              {cfg.fields.map((f, i) => (
                <FieldCard key={f.key} field={f} index={i} count={cfg.fields.length} currency={cfg.currency}
                  onChange={(nf) => updateField(i, nf)} onRemove={() => removeField(i)} onMove={(d) => moveField(i, d)} />
              ))}
            </div>
            <AddFieldMenu onAdd={addField} />
          </section>

          <section className="calc-sec">
            <div className="calc-sec__head"><Coins size={16} /> <h3>Цена</h3></div>
            <div className="calc-price-grid">
              <Labeled label="Валюта"><input className="ci" value={cfg.currency} onChange={(e) => patchCfg({ currency: e.target.value })} /></Labeled>
              <Labeled label="Базовая цена" hint="Прибавляется всегда (стоимость выезда и т.п.)"><NumInput value={cfg.base} onChange={(v) => patchCfg({ base: v })} /></Labeled>
              <Labeled label="Минимум" hint="Ниже этой суммы цена не опустится"><NumInput value={cfg.minPrice} onChange={(v) => patchCfg({ minPrice: v })} /></Labeled>
              <Labeled label="Слово перед ценой"><input className="ci" value={doc.fromWord} onChange={(e) => patch({ fromWord: e.target.value })} placeholder="от" /></Labeled>
            </div>
            <label className="calc-check">
              <input type="checkbox" checked={cfg.showRange} onChange={(e) => patchCfg({ showRange: e.target.checked })} />
              Показывать вилку цен (от–до)
            </label>
            {cfg.showRange && (
              <Labeled label="Верхняя граница" hint="Множитель для верхней цены: 1.25 = +25%">
                <NumInput value={cfg.rangeUpRatio} onChange={(v) => patchCfg({ rangeUpRatio: v })} step={0.05} />
              </Labeled>
            )}
            <Labeled label="Заголовок над калькулятором"><input className="ci" value={doc.heading} onChange={(e) => patch({ heading: e.target.value })} /></Labeled>
          </section>
        </div>

        <aside className="calc-ed__preview">
          <div className="calc-prev-head">
            <span><Eye size={15} /> Предпросмотр</span>
            <div className="seg-mini">
              {(["ru", "ro"] as const).map((l) => (
                <button key={l} className={"seg-mini__b" + (preview === l ? " on" : "")} onClick={() => setPreview(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <CalcRun doc={doc} L={preview} />
        </aside>
      </div>
    </div>
  );
}

/* ---------- Field editor ---------- */

function fieldRole(f: Field): "rate" | "add" | "mult" {
  if (f.affects === "rate") return "rate";
  if ((f.options || []).some((o) => o.mult != null)) return "mult";
  return "add";
}

function FieldCard({ field, index, count, currency, onChange, onRemove, onMove }: {
  field: Field; index: number; count: number; currency: string;
  onChange: (f: Field) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void;
}) {
  const role = fieldRole(field);
  const setLabel = (l: Loc, v: string) => onChange({ ...field, label: { ...field.label, [l]: v } });
  const setOpts = (options: Opt[]) => onChange({ ...field, options });
  const setRole = (r: "rate" | "add" | "mult") => {
    const options = (field.options || []).map((o) => {
      const n: Opt = { value: o.value, label: o.label };
      if (r === "rate") n.rate = o.rate ?? 20;
      else if (r === "mult") n.mult = o.mult ?? 1;
      else n.add = o.add ?? 0;
      return n;
    });
    onChange({ ...field, affects: r === "rate" ? "rate" : undefined, options });
  };

  return (
    <div className="fcard">
      <div className="fcard__head">
        <span className="fcard__grip"><GripVertical size={15} /></span>
        <span className={"fcard__type fcard__type--" + field.type}>
          {field.type === "select" ? <ListChecks size={13} /> : field.type === "number" ? <Hash size={13} /> : <CheckSquare size={13} />}
          {field.type === "select" ? "Выбор" : field.type === "number" ? "Число" : "Несколько"}
        </span>
        <div className="fcard__ord">
          <button className="fcard__ib" disabled={index === 0} onClick={() => onMove(-1)} title="Выше"><ChevronUp size={15} /></button>
          <button className="fcard__ib" disabled={index === count - 1} onClick={() => onMove(1)} title="Ниже"><ChevronDown size={15} /></button>
        </div>
        <button className="fcard__del" onClick={onRemove} title="Удалить вопрос"><Trash2 size={15} /></button>
      </div>

      <div className="fcard__labels">
        <input className="ci" value={field.label.ru} onChange={(e) => setLabel("ru", e.target.value)} placeholder="Вопрос (рус)" />
        <input className="ci ci--ro" value={field.label.ro} onChange={(e) => setLabel("ro", e.target.value)} placeholder="Vopros (рум)" />
      </div>

      {field.type === "number" ? (
        <NumberFieldEditor field={field} currency={currency} onChange={onChange} />
      ) : (
        <>
          {field.type === "select" && (
            <div className="fcard__role">
              <span className="fcard__role-l">Влияет на цену:</span>
              <div className="seg-mini">
                {([["add", "+ надбавка"], ["rate", "× ставка"], ["mult", "× множитель"]] as const).map(([r, l]) => (
                  <button key={r} className={"seg-mini__b" + (role === r ? " on" : "")} onClick={() => setRole(r)}>{l}</button>
                ))}
              </div>
            </div>
          )}
          <OptionsEditor options={field.options || []} role={field.type === "multi" ? "add" : role} currency={currency} onChange={setOpts} />
        </>
      )}
    </div>
  );
}

function NumberFieldEditor({ field, currency, onChange }: { field: Field; currency: string; onChange: (f: Field) => void }) {
  const byRate = field.perUnitFrom === "rate";
  return (
    <div className="nfe">
      <div className="nfe__price">
        <span className="fcard__role-l">Цена за единицу:</span>
        <div className="seg-mini">
          <button className={"seg-mini__b" + (byRate ? " on" : "")} onClick={() => onChange({ ...field, perUnitFrom: "rate", perUnit: undefined })}>по ставке</button>
          <button className={"seg-mini__b" + (!byRate ? " on" : "")} onClick={() => onChange({ ...field, perUnitFrom: undefined, perUnit: field.perUnit ?? 20 })}>фикс</button>
        </div>
        {byRate ? (
          <span className="nfe__hint">берётся из вопроса-«ставки» выше</span>
        ) : (
          <NumInput value={field.perUnit ?? 0} onChange={(v) => onChange({ ...field, perUnit: v })} suffix={currency} />
        )}
      </div>
      <div className="nfe__range">
        <Labeled label="Мин."><NumInput value={field.min ?? 0} onChange={(v) => onChange({ ...field, min: v })} /></Labeled>
        <Labeled label="Макс."><NumInput value={field.max ?? 100} onChange={(v) => onChange({ ...field, max: v })} /></Labeled>
        <Labeled label="Шаг"><NumInput value={field.step ?? 1} onChange={(v) => onChange({ ...field, step: v })} /></Labeled>
        <Labeled label="По умолч."><NumInput value={field.default ?? field.min ?? 0} onChange={(v) => onChange({ ...field, default: v })} /></Labeled>
      </div>
    </div>
  );
}

function OptionsEditor({ options, role, currency, onChange }: { options: Opt[]; role: "rate" | "add" | "mult"; currency: string; onChange: (o: Opt[]) => void }) {
  const set = (i: number, o: Opt) => onChange(options.map((x, j) => (j === i ? o : x)));
  const numKey = role === "rate" ? "rate" : role === "mult" ? "mult" : "add";
  const numLabel = role === "rate" ? `ставка, ${currency}/ед.` : role === "mult" ? "×" : `+${currency}`;
  return (
    <div className="opts">
      {options.map((o, i) => (
        <div className="opt" key={o.value}>
          <input className="ci opt__ru" value={o.label.ru} onChange={(e) => set(i, { ...o, label: { ...o.label, ru: e.target.value } })} placeholder="Вариант (рус)" />
          <input className="ci ci--ro opt__ro" value={o.label.ro} onChange={(e) => set(i, { ...o, label: { ...o.label, ro: e.target.value } })} placeholder="рум" />
          <div className="opt__num" title={numLabel}>
            <NumInput value={(o as any)[numKey] ?? 0} onChange={(v) => set(i, { ...o, [numKey]: v } as Opt)} step={role === "mult" ? 0.05 : 1} w={72} />
            <span className="opt__num-l">{numLabel}</span>
          </div>
          <button className="opt__del" onClick={() => onChange(options.filter((_, j) => j !== i))} title="Удалить вариант"><Trash2 size={14} /></button>
        </div>
      ))}
      <button className="opt-add" onClick={() => onChange([...options, newOption()])}><Plus size={14} /> Вариант</button>
    </div>
  );
}

function AddFieldMenu({ onAdd }: { onAdd: (t: Field["type"]) => void }) {
  return (
    <div className="addfield">
      {FIELD_KINDS.map((k) => (
        <button key={k.type} className="addfield__b" onClick={() => onAdd(k.type)}>
          <k.icon size={16} /> {k.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Live preview (runs the real engine) ---------- */

function CalcRun({ doc, L }: { doc: CalcDoc; L: Loc }) {
  const cfg = doc.config;
  const [state, setState] = useState<CalcState>(() => initState(cfg));
  // Reset state if the set of field keys changes (added/removed question).
  const keys = cfg.fields.map((f) => f.key).join(",");
  useEffect(() => { setState(initState(cfg)); /* eslint-disable-next-line */ }, [keys]);

  const price = useMemo(() => { try { return priceText(cfg, state, doc.fromWord); } catch { return "—"; } }, [cfg, state, doc.fromWord]);
  const set = (k: string, v: any) => setState((s) => ({ ...s, [k]: v }));
  const toggle = (k: string, v: string) => setState((s) => {
    const arr = (s[k] as string[]) || [];
    return { ...s, [k]: arr.indexOf(v) >= 0 ? arr.filter((x) => x !== v) : [...arr, v] };
  });

  return (
    <div className="crun">
      <h4 className="crun__title">{doc.heading}</h4>
      <div className="crun__fields">
        {cfg.fields.filter((f) => visible(f, state)).map((f) => (
          <div className="crun__field" key={f.key}>
            <div className="crun__q">{f.label[L] || f.label.ru}{f.type === "number" ? <b> {Number(state[f.key]) || 0}</b> : null}</div>
            {f.type === "number" ? (
              <input type="range" className="crun__range" min={f.min ?? 0} max={f.max ?? 100} step={f.step ?? 1}
                value={Number(state[f.key]) || 0} onChange={(e) => set(f.key, Number(e.target.value))} />
            ) : (
              <div className="crun__opts">
                {(f.options || []).map((o) => {
                  const on = f.type === "multi" ? ((state[f.key] as string[]) || []).indexOf(o.value) >= 0 : state[f.key] === o.value;
                  return (
                    <button key={o.value} className={"crun__opt" + (on ? " on" : "")}
                      onClick={() => (f.type === "multi" ? toggle(f.key, o.value) : set(f.key, o.value))}>
                      {o.label[L] || o.label.ru}{o.add ? <em>+{o.add}</em> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {cfg.fields.length === 0 && <p className="muted">Добавьте вопросы слева — здесь появится живой калькулятор.</p>}
      </div>
      <div className="crun__result">
        <span className="crun__result-l">Итого</span>
        <div className="crun__price">{price} <span>{cfg.currency}</span></div>
      </div>
    </div>
  );
}

/* ---------- Small inputs ---------- */

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="lbl">
      <span className="lbl__t">{label}{hint && <span className="lbl__h" title={hint}>?</span>}</span>
      {children}
    </label>
  );
}

function NumInput({ value, onChange, step = 1, suffix, w }: { value: number; onChange: (v: number) => void; step?: number; suffix?: string; w?: number }) {
  return (
    <span className="ni" style={w ? { width: w } : undefined}>
      <input type="number" value={value} step={step} onChange={(e) => onChange(Number(e.target.value))} />
      {suffix && <span className="ni__s">{suffix}</span>}
    </span>
  );
}
