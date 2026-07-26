/**
 * CRM store — deals moving through a sales pipeline (amoCRM-style). Each deal is a lead/opportunity
 * with contact, amount and a stage; the board is stages × deals. localStorage for now; a Supabase
 * adapter (per-tenant, RLS) slots in later with the same shape.
 */

export interface Stage {
  id: string;
  label: string;
  kind?: "won" | "lost"; // terminal stages
}

export interface Deal {
  id: string;
  title: string;      // service / short summary
  contact: string;    // client name
  phone: string;
  amount: number;
  currency: string;
  stage: string;
  source: string;     // where the lead came from
  assignee: string;   // team member id responsible (from Settings → team); "" = unassigned
  note: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  order: number;      // sort within a stage
}

export const STAGES: Stage[] = [
  { id: "new", label: "Новая заявка" },
  { id: "work", label: "Взяли в работу" },
  { id: "nego", label: "Переговоры" },
  { id: "contract", label: "Договор / оплата" },
  { id: "won", label: "Успешно", kind: "won" },
  { id: "lost", label: "Отказ", kind: "lost" },
];

export const SOURCES = ["Сайт", "Звонок", "WhatsApp", "Telegram", "Instagram", "Рекомендация"] as const;

const KEY = "leadgenium:crm:deals";
const uid = () => "d" + Math.random().toString(36).slice(2, 9);

function seed(): Deal[] {
  const now = Date.now();
  const mk = (o: Partial<Deal> & { title: string; contact: string; amount: number; stage: string }, i: number): Deal => ({
    id: uid(), phone: "+373 6" + (Math.floor(Math.random() * 9000000) + 1000000), currency: "MDL",
    source: "Сайт", assignee: i % 2 ? "u1" : "u2", note: "", tags: [], createdAt: now - i * 3600e3, updatedAt: now - i * 3600e3, order: i, ...o,
  });
  return [
    mk({ title: "Уборка квартиры, 60 м²", contact: "Ирина М.", amount: 1200, stage: "new", source: "Сайт", tags: ["Квартира"] }, 0),
    mk({ title: "После ремонта, 90 м²", contact: "Андрей П.", amount: 3200, stage: "new", source: "WhatsApp", tags: ["Ремонт"] }, 1),
    mk({ title: "Мойка окон", contact: "Елена К.", amount: 800, stage: "new", source: "Instagram" }, 2),
    mk({ title: "Уборка офиса, 200 м²", contact: "Офис «Норд»", amount: 4500, stage: "work", source: "Звонок", tags: ["Офис", "Регулярно"] }, 0),
    mk({ title: "Химчистка дивана", contact: "Виктор С.", amount: 1500, stage: "work", source: "Telegram" }, 1),
    mk({ title: "Мойка фасада ТЦ", contact: "ТЦ «Плаза»", amount: 12000, stage: "nego", source: "Рекомендация", tags: ["Фасад", "Крупный"] }, 0),
    mk({ title: "Генеральная уборка дома", contact: "Мария Д.", amount: 2800, stage: "contract", source: "Сайт" }, 0),
    mk({ title: "Уборка после мероприятия", contact: "Ресторан «Вкус»", amount: 3500, stage: "won", source: "Звонок", tags: ["Событие"] }, 0),
    mk({ title: "Разовая уборка", contact: "Дмитрий Л.", amount: 900, stage: "lost", source: "Сайт", note: "Дорого, ушёл к конкуренту" }, 0),
  ];
}

export function loadDeals(): Deal[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as Deal[];
  } catch {
    return seed();
  }
}

export function saveDeals(list: Deal[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertDeal(list: Deal[], deal: Deal): Deal[] {
  const next = { ...deal, updatedAt: Date.now() };
  const i = list.findIndex((d) => d.id === deal.id);
  const out = i >= 0 ? list.map((d, j) => (j === i ? next : d)) : [...list, next];
  saveDeals(out);
  return out;
}

export function removeDeal(list: Deal[], id: string): Deal[] {
  const out = list.filter((d) => d.id !== id);
  saveDeals(out);
  return out;
}

/** Move a deal to a stage, placing it at the top of that stage. */
export function moveDealToStage(list: Deal[], id: string, stage: string, beforeId?: string): Deal[] {
  const deal = list.find((d) => d.id === id);
  if (!deal) return list;
  const others = list.filter((d) => d.id !== id);
  const inStage = others.filter((d) => d.stage === stage).sort((a, b) => a.order - b.order);
  const idx = beforeId ? inStage.findIndex((d) => d.id === beforeId) : 0;
  const at = idx < 0 ? inStage.length : idx;
  inStage.splice(at, 0, { ...deal, stage });
  inStage.forEach((d, i) => (d.order = i));
  const rest = others.filter((d) => d.stage !== stage);
  const out = [...rest, ...inStage];
  saveDeals(out);
  return out;
}

export function newDeal(stage = "new"): Deal {
  return {
    id: uid(), title: "", contact: "", phone: "", amount: 0, currency: "MDL",
    stage, source: "Сайт", assignee: "", note: "", tags: [], createdAt: Date.now(), updatedAt: Date.now(), order: -1,
  };
}

export const fmtMoney = (n: number) => Math.round(n).toLocaleString("ru-RU");
/** Digits-only phone for wa.me / t.me links (WhatsApp/Telegram need bare international digits). */
export const phoneDigits = (p: string) => (p || "").replace(/[^\d]/g, "");
