/**
 * Calculator library — the client's saved calculators. Each doc is a full pricing config (same shape
 * the site's calculator block renders) plus a name, so a calculator built here can later be dropped
 * into any place on the site. localStorage for now; a Supabase adapter slots in later (same shape).
 */

import type { CalcConfig, Field, Opt } from "../engine/blocks/calculator/engine";
import { calculatorDefaults } from "../engine/blocks/calculator/schema";

export interface CalcDoc {
  id: string;
  name: { ru: string; ro: string };
  heading: string;
  fromWord: string;
  config: CalcConfig;
  updatedAt: number;
}

const KEY = "leadgenium:calculators";
const uid = () => "c" + Math.random().toString(36).slice(2, 9);

/** A second ready-made example so the library doesn't start empty. */
function officeSeed(): CalcConfig {
  return {
    currency: "MDL",
    base: 0,
    minPrice: 800,
    showRange: true,
    rangeUpRatio: 1.2,
    fields: [
      {
        key: "type", type: "select", affects: "rate",
        label: { ru: "Тип помещения", ro: "Tipul spațiului" },
        options: [
          { value: "office", label: { ru: "Офис", ro: "Birou" }, rate: 18 },
          { value: "store", label: { ru: "Магазин", ro: "Magazin" }, rate: 20 },
          { value: "warehouse", label: { ru: "Склад", ro: "Depozit" }, rate: 14 },
        ],
      },
      {
        key: "area", type: "number", perUnitFrom: "rate",
        label: { ru: "Площадь, м²", ro: "Suprafața, m²" },
        min: 30, max: 1000, step: 10, default: 120,
      },
      {
        key: "freq", type: "select",
        label: { ru: "Периодичность", ro: "Frecvența" },
        options: [
          { value: "once", label: { ru: "Разово", ro: "O dată" }, add: 0 },
          { value: "weekly", label: { ru: "Еженедельно", ro: "Săptămânal" }, mult: 0.9 },
          { value: "daily", label: { ru: "Ежедневно", ro: "Zilnic" }, mult: 0.8 },
        ],
      },
    ],
  };
}

function seed(): CalcDoc[] {
  const apt = calculatorDefaults();
  return [
    { id: "apartments", name: { ru: "Уборка квартир", ro: "Curățenie apartamente" }, heading: apt.heading, fromWord: apt.fromWord, config: apt.config, updatedAt: Date.now() },
    { id: "office", name: { ru: "Уборка помещений", ro: "Curățenie spații" }, heading: "Рассчитайте стоимость", fromWord: "от", config: officeSeed(), updatedAt: Date.now() },
  ];
}

export function loadCalcs(): CalcDoc[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as CalcDoc[];
  } catch {
    return seed();
  }
}

export function saveCalcs(list: CalcDoc[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getCalc(id: string): CalcDoc | undefined {
  return loadCalcs().find((c) => c.id === id);
}

/** Insert or replace a calculator, bump updatedAt, persist. Returns the new list. */
export function upsertCalc(doc: CalcDoc): CalcDoc[] {
  const list = loadCalcs();
  const next = { ...doc, updatedAt: Date.now() };
  const i = list.findIndex((c) => c.id === doc.id);
  if (i >= 0) list[i] = next; else list.push(next);
  saveCalcs(list);
  return list;
}

export function removeCalc(id: string): CalcDoc[] {
  const list = loadCalcs().filter((c) => c.id !== id);
  saveCalcs(list);
  return list;
}

export function newCalc(): CalcDoc {
  return {
    id: uid(),
    name: { ru: "Новый калькулятор", ro: "Calculator nou" },
    heading: "Рассчитайте стоимость",
    fromWord: "от",
    config: { currency: "MDL", base: 0, minPrice: 500, showRange: true, rangeUpRatio: 1.25, fields: [] },
    updatedAt: Date.now(),
  };
}

export function duplicateCalc(doc: CalcDoc): CalcDoc {
  return { ...structuredClone(doc), id: uid(), name: { ru: doc.name.ru + " (копия)", ro: doc.name.ro + " (copie)" }, updatedAt: Date.now() };
}

/** A fresh field of the given type, with a unique key and one starter option (for choice types). */
export function newField(type: Field["type"], existing: Field[]): Field {
  const key = uniqueKey(type === "select" ? "вопрос" : type === "number" ? "число" : "опции", existing);
  if (type === "number") {
    return { key, type: "number", label: { ru: "Число (например, площадь)", ro: "Număr" }, min: 0, max: 300, step: 5, default: 50, perUnitFrom: "rate" };
  }
  const opt = (): Opt => ({ value: uid(), label: { ru: "Вариант", ro: "Opțiune" }, add: 0 });
  return { key, type, label: { ru: type === "select" ? "Новый вопрос" : "Выберите нужное", ro: "Întrebare nouă" }, options: [opt(), opt()] };
}

export function newOption(): Opt {
  return { value: "o" + Math.random().toString(36).slice(2, 7), label: { ru: "Вариант", ro: "Opțiune" }, add: 0 };
}

function uniqueKey(base: string, existing: Field[]): string {
  const used = new Set(existing.map((f) => f.key));
  let k = base, i = 2;
  while (used.has(k)) k = base + i++;
  return k;
}
