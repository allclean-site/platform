/**
 * Analytics data + local "AI report". Until Google Analytics is connected (Settings → Интеграции),
 * we show deterministic DEMO data so the section is fully designed and testable; when a GA id is set
 * we'd swap `demoData()` for a real fetch (same shape). `buildInsights()` derives a human report with
 * advice from the numbers — a local stand-in the AI adapter (/api/*) can replace later.
 */

export interface Point { date: string; visitors: number }
export interface Slice { label: string; value: number; cssColor: string }
export interface PageRow { path: string; title: string; views: number; conv: number }
export interface GeoRow { city: string; visitors: number }

export interface Kpi { label: string; value: string; delta: number; up: boolean }

export interface FunnelStep { label: string; count: number; rate: number; drop: number } // rate = % of top; drop = % lost from prev step
export interface EventRow { label: string; count: number }

export interface AnalyticsData {
  days: number;
  kpis: Kpi[];
  series: Point[];
  sources: Slice[];
  devices: Slice[];
  topPages: PageRow[];
  geo: GeoRow[];
  funnel: FunnelStep[];
  events: EventRow[];
  newReturning: { newV: number; returning: number };
  exitPages: { title: string; path: string; exits: number; rate: number }[];
  channelPerf: { label: string; sessions: number; leads: number; conv: number }[];
}

export interface Insight { kind: "up" | "down" | "tip"; text: string }
export interface Report { summary: string; insights: Insight[] }

/** Tiny deterministic PRNG so the demo is stable across renders (seeded by day). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const fmt = (n: number) => Math.round(n).toLocaleString("ru-RU");

export function demoData(days: number): AnalyticsData {
  const rand = rng(days * 7 + 42);
  const base = days <= 7 ? 130 : days <= 30 ? 145 : 160;
  const series: Point[] = [];
  let total = 0;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5);
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.75 : 1;
    const trend = 1 + (days - 1 - i) / days * 0.28; // gentle upward trend
    const v = Math.round(base * weekend * trend * (0.8 + rand() * 0.5));
    series.push({ date: d.toISOString().slice(0, 10), visitors: v });
    total += v;
  }
  const sessions = Math.round(total * 1.32);
  const leads = Math.round(total * 0.034);
  const conv = Math.round((leads / total) * 1000) / 10;

  // Conversion funnel (visitor → lead). Drop rates chosen so the calculator→request step is the leak.
  const fsteps = [
    { label: "Зашли на сайт", n: total },
    { label: "Смотрели услуги / цены", n: Math.round(total * 0.62) },
    { label: "Открыли калькулятор", n: Math.round(total * 0.28) },
    { label: "Начали заполнять заявку", n: Math.round(total * 0.11) },
    { label: "Отправили заявку", n: leads },
  ];
  const funnel: FunnelStep[] = fsteps.map((s, i) => ({
    label: s.label,
    count: s.n,
    rate: Math.round((s.n / total) * 1000) / 10,
    drop: i === 0 ? 0 : Math.round((1 - s.n / fsteps[i - 1].n) * 1000) / 10,
  }));

  return {
    days,
    kpis: [
      { label: "Посетители", value: fmt(total), delta: 12, up: true },
      { label: "Сеансы", value: fmt(sessions), delta: 9, up: true },
      { label: "Заявки", value: fmt(leads), delta: 15, up: true },
      { label: "Конверсия", value: conv + "%", delta: 0.4, up: true },
      { label: "Ср. время", value: "2:14", delta: 6, up: true },
      { label: "Отказы", value: "38%", delta: 3, up: false },
    ],
    series,
    sources: [
      { label: "Органический поиск", value: 48, cssColor: "var(--accent)" },
      { label: "Прямые заходы", value: 22, cssColor: "var(--info)" },
      { label: "Соцсети", value: 16, cssColor: "var(--success)" },
      { label: "Переходы", value: 9, cssColor: "var(--warning)" },
      { label: "Реклама", value: 5, cssColor: "var(--text-muted)" },
    ],
    devices: [
      { label: "Телефон", value: 63, cssColor: "var(--accent)" },
      { label: "Компьютер", value: 31, cssColor: "var(--info)" },
      { label: "Планшет", value: 6, cssColor: "var(--success)" },
    ],
    topPages: [
      { path: "/", title: "Главная", views: Math.round(total * 0.34), conv: 3.1 },
      { path: "/pricing", title: "Цены", views: Math.round(total * 0.18), conv: 6.8 },
      { path: "/services/apartments", title: "Уборка квартир", views: Math.round(total * 0.12), conv: 5.2 },
      { path: "/book-cleaning", title: "Заказать уборку", views: Math.round(total * 0.09), conv: 9.4 },
      { path: "/blog", title: "Блог", views: Math.round(total * 0.08), conv: 0.6 },
    ],
    geo: [
      { city: "Кишинёв", visitors: Math.round(total * 0.71) },
      { city: "Бельцы", visitors: Math.round(total * 0.09) },
      { city: "Тирасполь", visitors: Math.round(total * 0.05) },
      { city: "Другие города", visitors: Math.round(total * 0.15) },
    ],
    funnel,
    events: [
      { label: "Открытие калькулятора", count: Math.round(total * 0.28) },
      { label: "Расчёт стоимости", count: Math.round(total * 0.19) },
      { label: "Клик по «Позвонить»", count: Math.round(total * 0.06) },
      { label: "Клик по WhatsApp", count: Math.round(total * 0.05) },
      { label: "Начало заявки", count: Math.round(total * 0.11) },
    ],
    newReturning: { newV: 68, returning: 32 },
    exitPages: [
      { title: "Калькулятор", path: "/#pricing", exits: Math.round(total * 0.22), rate: 46 },
      { title: "Блог", path: "/blog", exits: Math.round(total * 0.12), rate: 71 },
      { title: "Услуги", path: "/services", exits: Math.round(total * 0.08), rate: 33 },
    ],
    channelPerf: [
      { label: "Органический поиск", sessions: Math.round(sessions * 0.48), leads: Math.round(leads * 0.42), conv: 3.0 },
      { label: "Прямые заходы", sessions: Math.round(sessions * 0.22), leads: Math.round(leads * 0.20), conv: 3.1 },
      { label: "Соцсети", sessions: Math.round(sessions * 0.16), leads: Math.round(leads * 0.13), conv: 2.8 },
      { label: "Реклама", sessions: Math.round(sessions * 0.05), leads: Math.round(leads * 0.15), conv: 9.9 },
    ],
  };
}

/** Local "AI report" — reads the numbers and writes a short summary + actionable advice. */
export function buildInsights(d: AnalyticsData): Report {
  const trafficUp = d.kpis[0].up;
  const mobile = d.devices.find((x) => x.label === "Телефон")?.value ?? 0;
  const organic = d.sources[0].value;
  const best = [...d.topPages].sort((a, b) => b.conv - a.conv)[0];
  const worst = [...d.topPages].filter((p) => p.views > 0).sort((a, b) => a.conv - b.conv)[0];
  const period = d.days === 7 ? "неделю" : d.days === 30 ? "месяц" : "3 месяца";

  // Where do clients drop off? Find the funnel step with the biggest loss from the previous one.
  const leak = d.funnel.slice(1).reduce((a, b) => (b.drop > a.drop ? b : a), d.funnel[1]);
  const leakAdvice: Record<string, string> = {
    "Смотрели услуги / цены": "Многие уходят, не дойдя до услуг. Сделайте оффер и кнопку расчёта заметнее на первом экране.",
    "Открыли калькулятор": "До калькулятора доходит мало людей. Добавьте кнопку «Рассчитать стоимость» в шапку и после каждого блока услуг.",
    "Начали заполнять заявку": "Посчитали цену, но не начали заявку. Покажите цену сразу с кнопкой «Оставить заявку» и уберите лишние шаги.",
    "Отправили заявку": "Начинают заявку, но не отправляют. Сократите форму до имени и телефона, добавьте отправку в WhatsApp одним кликом.",
  };
  const exitLeak = [...d.exitPages].sort((a, b) => b.rate - a.rate)[0];

  const insights: Insight[] = [];
  insights.push({ kind: trafficUp ? "up" : "down", text: `Трафик за ${period} ${trafficUp ? "вырос" : "снизился"} на ${d.kpis[0].delta}% — ${d.kpis[0].value} посетителей.` });
  insights.push({ kind: "down", text: `Больше всего клиентов теряется на шаге «${leak.label}»: −${leak.drop}%. ${leakAdvice[leak.label] || "Упростите этот шаг."}` });
  if (exitLeak) insights.push({ kind: "tip", text: `Чаще всего уходят со страницы «${exitLeak.title}» (${exitLeak.rate}% выходов). Добавьте туда призыв к действию и ссылку на заявку.` });
  insights.push({ kind: "tip", text: `${mobile}% посетителей с телефона. Проверьте, что калькулятор и форма заявки удобны на мобильном.` });
  const ads = d.channelPerf.find((c) => c.label === "Реклама");
  if (ads && ads.conv > 6) insights.push({ kind: "up", text: `Реклама даёт лучшую конверсию (${ads.conv}%). Есть смысл увеличить бюджет — окупаемость выше, чем у других каналов.` });
  else insights.push({ kind: "up", text: `Основной источник — органический поиск (${organic}%). SEO работает: продолжайте публиковать статьи в блоге.` });

  const summary = `За ${period} сайт получил ${d.kpis[0].value} посетителей и ${d.kpis[2].value} заявок (конверсия ${d.kpis[3].value}). ${trafficUp ? "Динамика положительная." : "Есть спад — стоит усилить продвижение."} Главная точка потери клиентов — «${leak.label}» (−${leak.drop}%). Ниже — что улучшить.`;
  return { summary, insights };
}
