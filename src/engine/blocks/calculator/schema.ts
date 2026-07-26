/** Calculator block content = a calculator config (same shape as cms CalculatorEditor) + heading. */

import type { CalcConfig } from "./engine";

export interface CalculatorContent {
  heading: string;
  fromWord: string;
  /** Which locale's option/field labels to render (config carries both ru+ro). Default "ru". */
  locale?: "ru" | "ro";
  config: CalcConfig;
}

/** Localized boilerplate (note + submit CTA) shared by both renderers. */
export const CALC_STRINGS = {
  ru: { note: "Это предварительная оценка. Точную цену подтвердит менеджер.", cta: "Отправить заявку" },
  ro: { note: "Aceasta este o estimare preliminară. Prețul exact va fi confirmat de manager.", cta: "Trimite cererea" },
} as const;

/** Representative AllClean "apartment cleaning" config (RU/RO, MDL). */
export function calculatorDefaults(): CalculatorContent {
  return {
    heading: "Рассчитайте стоимость уборки",
    fromWord: "от",
    config: {
      currency: "MDL",
      base: 0,
      minPrice: 500,
      showRange: true,
      rangeUpRatio: 1.25,
      fields: [
        {
          key: "type", type: "select", affects: "rate",
          label: { ru: "Тип уборки", ro: "Tipul curățeniei" },
          options: [
            { value: "support", label: { ru: "Поддерживающая", ro: "De întreținere" }, rate: 22 },
            { value: "general", label: { ru: "Генеральная", ro: "Generală" }, rate: 35 },
            { value: "postreno", label: { ru: "После ремонта", ro: "După renovare" }, rate: 45 },
          ],
        },
        {
          key: "area", type: "number", perUnitFrom: "rate",
          label: { ru: "Площадь, м²", ro: "Suprafața, m²" },
          min: 20, max: 300, step: 5, default: 50,
        },
        {
          key: "floor", type: "select",
          label: { ru: "Этаж", ro: "Etajul" },
          options: [
            { value: "1-5", label: { ru: "1–5", ro: "1–5" }, add: 0 },
            { value: "6-10", label: { ru: "6–10", ro: "6–10" }, add: 100 },
            { value: "10-17", label: { ru: "10–17", ro: "10–17" }, add: 200 },
          ],
        },
        {
          key: "windows", type: "select",
          label: { ru: "Окна", ro: "Geamuri" },
          options: [
            { value: "none", label: { ru: "Без окон", ro: "Fără" }, add: 0 },
            { value: "few", label: { ru: "1–3 окна", ro: "1–3 geamuri" }, add: 150 },
            { value: "many", label: { ru: "4+ окон", ro: "4+ geamuri" }, add: 300 },
          ],
        },
        {
          key: "extras", type: "multi",
          label: { ru: "Дополнительно", ro: "Suplimentar" },
          options: [
            { value: "surfaces", label: { ru: "Поверхности", ro: "Suprafețe" }, add: 100 },
            { value: "kitchen", label: { ru: "Кухня", ro: "Bucătărie" }, add: 150 },
            { value: "dishes", label: { ru: "Мойка посуды", ro: "Vase" }, add: 100 },
            { value: "bath", label: { ru: "Санузел", ro: "Baie" }, add: 120 },
            { value: "ironing", label: { ru: "Глажка", ro: "Călcat" }, add: 200 },
          ],
        },
      ],
    },
  };
}
