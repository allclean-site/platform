/**
 * Settings store — domain, integrations, team, billing, and notification preferences.
 * Notifications are a matrix of events × channels (where should each event ping the client).
 * localStorage now; Supabase per-tenant later.
 */

import type { Subscription } from "../lib/plans";

export type Channel = "inapp" | "email" | "telegram" | "whatsapp";
export interface NotifRow { inapp: boolean; email: boolean; telegram: boolean; whatsapp: boolean }
export interface TeamMember { id: string; name: string; email: string; role: string }

export interface Settings {
  domain: string;
  domainStatus: "connected" | "pending" | "none";
  /** "ours" = hosted on LeadGenium (EU, SSL, we manage). "external" = client keeps their own hosting/domain;
   *  the Хостинг/Домен sections are then delegated — the platform's other tools still work. */
  hosting: "ours" | "external";
  channels: { email: string; telegram: string; whatsapp: string };
  integrations: { gaId: string; gscVerified: boolean; telegramBot: string; pixel: string };
  /** Supabase Storage for image uploads (замена картинок). Empty anonKey → uploads fall back to inline data URLs. */
  storage: { url: string; anonKey: string; bucket: string };
  /** Instant publish: the /api/publish endpoint on the deployed site + its edit key. Empty endpoint → the
   *  Publish dialog only offers the edits.json download (no one-click go-live). */
  publish: { endpoint: string; editKey: string };
  notif: Record<string, NotifRow>;
  team: TeamMember[];
  plan: string;
  /** PRO subscription state (drives the plan gates: cancelled → access until endsAt, then sections close). */
  subscription: Subscription;
}

export const NOTIF_EVENTS = [
  { id: "lead", label: "Новая заявка / сделка", desc: "Клиент оставил заявку на сайте" },
  { id: "ticket", label: "Ответ в поддержке", desc: "Разработчик ответил в вашем тикете" },
  { id: "publish", label: "Публикация статьи", desc: "Статья опубликована в блоге" },
  { id: "report", label: "Еженедельный отчёт", desc: "Сводка по трафику и заявкам за неделю" },
] as const;

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: "inapp", label: "В кабинете" },
  { id: "email", label: "Email" },
  { id: "telegram", label: "Telegram" },
  { id: "whatsapp", label: "WhatsApp" },
];

const KEY = "leadgenium:settings";

function defaults(): Settings {
  const row = (email: boolean, tg: boolean): NotifRow => ({ inapp: true, email, telegram: tg, whatsapp: false });
  return {
    domain: "allclean.md",
    domainStatus: "connected",
    hosting: "external", // AllClean keeps its own hosting; platform tools (editor/blog/calc/CRM/…) still used

    channels: { email: "info@allclean.md", telegram: "", whatsapp: "+373 79 955 044" },
    integrations: { gaId: "", gscVerified: false, telegramBot: "", pixel: "" },
    // Reuse AllClean's existing client Supabase project + its public `article-images` bucket; the
    // anon (publishable) key is pasted in Настройки → Интеграции to activate real uploads.
    storage: { url: "https://fnlgclkcbkmoailfdukt.supabase.co", anonKey: "", bucket: "article-images" },
    publish: { endpoint: "https://allclean.md/api/publish", editKey: "" },
    notif: {
      lead: row(true, true),
      ticket: row(true, false),
      publish: row(false, false),
      report: row(true, false),
    },
    team: [
      { id: "u1", name: "Вы (владелец)", email: "info@allclean.md", role: "Владелец" },
      { id: "u2", name: "Sergiu", email: "dev@leadgenium.pro", role: "Разработчик" },
    ],
    plan: "PRO",
    subscription: { status: "active" },
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = defaults(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return { ...defaults(), ...(JSON.parse(raw) as Settings) };
  } catch {
    return defaults();
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
