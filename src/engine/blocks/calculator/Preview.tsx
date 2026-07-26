import React, { useMemo, useState } from "react";
import type { BlockRenderContext } from "../../types";
import { E } from "../Editable";
import type { CalculatorContent } from "./schema";
import { CALC_STRINGS } from "./schema";
import { compute, priceText, initState, visible, type CalcState, type Field } from "./engine";

/** Interactive calculator (editor preview). Uses the exact AllClean engine for pricing. */
export function CalculatorPreview({ ctx }: { ctx: BlockRenderContext<CalculatorContent> }) {
  const c = ctx.block.content;
  const cfg = c.config;
  const L: "ru" | "ro" = c.locale === "ro" ? "ro" : "ru";
  const s = CALC_STRINGS[L];
  const [state, setState] = useState<CalcState>(() => initState(cfg));

  const price = useMemo(() => priceText(cfg, state, c.fromWord), [cfg, state, c.fromWord]);
  const set = (k: string, v: any) => setState((s) => ({ ...s, [k]: v }));
  // Functional toggle for multi — robust to batched updates (reads latest state).
  const toggle = (k: string, value: string) =>
    setState((s) => {
      const arr = (s[k] as string[]) || [];
      return { ...s, [k]: arr.indexOf(value) >= 0 ? arr.filter((x) => x !== value) : [...arr, value] };
    });

  return (
    <section className="section calc-block" id={ctx.block.id}>
      <div className="container calc__wrap">
        <h2 className="section__heading"><E ctx={ctx} path={["heading"]} value={c.heading} /></h2>
        <div className="calc__grid">
          <div className="calc__fields">
            {cfg.fields.map((f) => (visible(f, state) ? <FieldView key={f.key} f={f} L={L} state={state} set={set} toggle={toggle} /> : null))}
          </div>
          <aside className="calc__side">
            <div className="calc__price-label">{cfg.fields[0]?.label[L]}</div>
            <div className="calc__price">{price} <span className="calc__cur">{cfg.currency}</span></div>
            <p className="calc__note">{s.note}</p>
            <button className="btn btn--primary calc__cta" type="button">{s.cta}</button>
          </aside>
        </div>
      </div>
    </section>
  );
}

function FieldView({ f, L, state, set, toggle }: { f: Field; L: "ru" | "ro"; state: CalcState; set: (k: string, v: any) => void; toggle: (k: string, v: string) => void }) {
  if (f.type === "select") {
    return (
      <div className="calc__field">
        <div className="calc__q">{f.label[L]}</div>
        <div className="calc__opts">
          {(f.options || []).map((o) => (
            <button key={o.value} type="button"
              className={"calc__opt" + (state[f.key] === o.value ? " on" : "")}
              onClick={() => set(f.key, o.value)}>
              {o.label[L]}{o.add ? <em className="calc__badge">+{o.add}</em> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (f.type === "number") {
    const v = Number(state[f.key]) || 0;
    return (
      <div className="calc__field">
        <div className="calc__q">{f.label[L]}: <b>{v}</b></div>
        <input type="range" className="calc__range" min={f.min ?? 0} max={f.max ?? 100} step={f.step ?? 1}
          value={v} onChange={(e) => set(f.key, Number(e.target.value))} />
      </div>
    );
  }
  // multi
  const arr = (state[f.key] as string[]) || [];
  return (
    <div className="calc__field">
      <div className="calc__q">{f.label[L]}</div>
      <div className="calc__opts">
        {(f.options || []).map((o) => (
          <button key={o.value} type="button"
            className={"calc__opt" + (arr.indexOf(o.value) >= 0 ? " on" : "")}
            onClick={() => toggle(f.key, o.value)}>
            {o.label[L]}{o.add ? <em className="calc__badge">+{o.add}</em> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
