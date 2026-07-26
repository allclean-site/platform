/**
 * Plans. Free = the tools (editor, blog, calculators, support) — a client can use them and keep their
 * OWN hosting. PRO adds our hosting, CRM and analytics. Used by the landing pricing block, the billing
 * tab, and light nav gating (a PRO chip on PRO-only sections when the tenant is on Free).
 */

export interface PlanFeature { t: string; on: boolean }
export interface Plan {
  id: "free" | "pro";
  name: string;
  price: string;
  per: string;
  tagline: string;
  features: PlanFeature[];
  cta: string;
  highlight?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free", name: "Free", price: "0 €", per: "навсегда",
    tagline: "Инструменты для сайта. Хостинг — ваш.",
    cta: "Начать бесплатно",
    features: [
      { t: "Редактор сайта (уровень Figma/Tilda)", on: true },
      { t: "Блог с авто-SEO", on: true },
      { t: "Калькуляторы: создание и правка", on: true },
      { t: "Поддержка", on: true },
      { t: "Хостинг в ЕС + домен + SSL", on: false },
      { t: "CRM заявок", on: false },
      { t: "Аналитика + AI-отчёт", on: false },
    ],
  },
  {
    id: "pro", name: "PRO", price: "30 €", per: "/ мес", highlight: true,
    tagline: "Всё для сайта, заявок и роста.",
    cta: "Подключить PRO",
    features: [
      { t: "Всё из Free", on: true },
      { t: "Хостинг в ЕС + домен + SSL", on: true },
      { t: "CRM заявок (как amoCRM)", on: true },
      { t: "Аналитика + AI-советы", on: true },
      { t: "Уведомления: email · Telegram · WhatsApp", on: true },
    ],
  },
];

/** Nav routes that require PRO. On Free they show but the page is gated behind an upgrade plaque. */
export const PRO_ROUTES = ["/app/crm", "/app/analytics"];
export const isPro = (plan: string) => plan?.toUpperCase() === "PRO";
export const routeNeedsPro = (route: string) => PRO_ROUTES.includes(route);

/**
 * Subscription state. When the client cancels, PRO access continues until `endsAt` (end of the paid
 * period); after that the PRO sections close automatically.
 */
export interface Subscription { status: "active" | "cancelled"; endsAt?: string }

/** Effective PRO access: PRO + active → yes; PRO + cancelled → until endsAt; otherwise no. */
export function hasPro(plan: string, sub?: Subscription): boolean {
  if (!isPro(plan)) return false;
  if (!sub || sub.status === "active") return true;
  return sub.endsAt ? Date.now() < Date.parse(sub.endsAt) : false;
}

/** True when the subscription is cancelled but still inside its paid period (grace window). */
export function inGracePeriod(plan: string, sub?: Subscription): boolean {
  return isPro(plan) && sub?.status === "cancelled" && !!sub.endsAt && Date.now() < Date.parse(sub.endsAt);
}
