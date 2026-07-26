/** Calculator pricing engine — faithful port of AllClean's Calculator.astro compute().
 *  Same config shape as cms-leadgenium CalculatorEditor. Used by the block's React preview
 *  AND emitted verbatim into the static export's inline script, so prices always match. */

export interface Loc { ru: string; ro: string }
export interface Opt { value: string; label: Loc; rate?: number; add?: number; mult?: number; badge?: string; img?: string }
export interface Field {
  key: string;
  type: "select" | "number" | "multi";
  label: Loc;
  affects?: string;
  options?: Opt[];
  min?: number; max?: number; step?: number; default?: number;
  perUnit?: number; perUnitFrom?: string;
  doubleIf?: { field: string; in: string[] };
  showIf?: { field: string; in: string[] };
}
export interface CalcConfig {
  currency: string;
  base: number;
  minPrice: number;
  showRange: boolean;
  rangeUpRatio: number;
  fields: Field[];
}
export type CalcState = Record<string, string | number | string[]>;

export function initState(cfg: CalcConfig): CalcState {
  const s: CalcState = {};
  for (const f of cfg.fields) {
    if (f.type === "select") s[f.key] = f.options?.[0]?.value ?? "";
    else if (f.type === "number") s[f.key] = f.default ?? f.min ?? 0;
    else s[f.key] = [];
  }
  return s;
}

export function visible(f: Field, state: CalcState): boolean {
  return !f.showIf || (f.showIf.in || []).indexOf(state[f.showIf.field] as string) >= 0;
}

/** Exact port of Calculator.astro compute(): base + rate·area + add/mult + doubleIf + multi, ×mult, floored at minPrice. */
export function compute(cfg: CalcConfig, state: CalcState): number {
  let total = cfg.base || 0;
  let mult = 1;
  const rates: Record<string, number> = {};

  for (const f of cfg.fields) {
    if (visible(f, state) && f.type === "select" && f.affects) {
      const o = (f.options || []).find((x) => x.value === state[f.key]);
      if (o && o.rate != null) rates[f.affects] = o.rate;
    }
  }
  for (const f of cfg.fields) {
    if (!visible(f, state)) continue;
    if (f.type === "select") {
      const o = (f.options || []).find((x) => x.value === state[f.key]);
      if (!o) continue;
      if (o.add) total += o.add;
      if (o.mult != null) mult *= o.mult;
    } else if (f.type === "number") {
      const per = f.perUnit != null ? f.perUnit : f.perUnitFrom ? rates[f.perUnitFrom] || 0 : 0;
      let c = (Number(state[f.key]) || 0) * per;
      if (f.doubleIf && (f.doubleIf.in || []).indexOf(state[f.doubleIf.field] as string) >= 0) c *= 2;
      total += c;
    } else if (f.type === "multi") {
      for (const v of (state[f.key] as string[]) || []) {
        const o = (f.options || []).find((x) => x.value === v);
        if (o && o.add) total += o.add;
      }
    }
  }
  total *= mult;
  if (cfg.minPrice) total = Math.max(total, cfg.minPrice);
  return total;
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

/** Price label: "от 1 100–1 380" (range) or "1 100". */
export function priceText(cfg: CalcConfig, state: CalcState, fromWord = "от"): string {
  const low = compute(cfg, state);
  if (cfg.showRange) {
    const high = Math.round((low * (cfg.rangeUpRatio || 1.25)) / 10) * 10;
    return `${fromWord} ${fmt(low)}–${fmt(high)}`;
  }
  return fmt(low);
}
