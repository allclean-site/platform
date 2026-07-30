/**
 * Outreach («Рассылка») data layer — the agency's own lead-gen engine control-plane. Mock/localStorage
 * during the interface phase; shapes mirror the `outreach-pro` Python models + the future Supabase
 * tables (see LeadGen/OUTREACH_SYSTEM_PLAN.md). The real engine (scrape Maps → qualify site → AI copy)
 * runs on an EU-VPS worker later; sending is offloaded to Instantly/Smartlead. Replies feed the agency
 * «Заявки» funnel (Prospect.source="outreach").
 */

import { type SiteVerdict, SITE_VERDICT_LABEL } from "../agency/data";
export { SITE_VERDICT_LABEL };
export type { SiteVerdict };

/* ---------------- types ---------------- */

export type CampaignStatus = "draft" | "active" | "paused" | "done";
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = { draft: "Черновик", active: "Активна", paused: "Пауза", done: "Завершена" };

export interface Campaign {
  id: string; name: string; niche: string; country: string; cities: string[];
  dailyLimit: number; status: CampaignStatus; createdAt: string; templateId?: string;
  // funnel counters (mock — the worker fills these for real)
  found: number; contacted: number; opened: number; replied: number; won: number;
}

/** A found business + its website qualification (mirrors outreach-pro Lead + website_check). */
export type OutreachStatus = "new" | "analyzed" | "queued" | "sent" | "opened" | "replied" | "won" | "lost";
export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  new: "Найден", analyzed: "Проанализирован", queued: "В очереди", sent: "Отправлено", opened: "Открыл", replied: "Ответил", won: "Клиент", lost: "Отказ",
};
export interface OutreachLead {
  id: string; campaignId?: string; business: string; city: string; phone?: string; email?: string; siteUrl?: string;
  siteVerdict: SiteVerdict; siteScore: number; issues: string[]; tech?: string; year?: number;
  rating?: number; reviews?: number; status: OutreachStatus; selected?: boolean; at: string;
}

/** Cold-email template per website scenario (mirrors ai/writer.py scenarios + A/B variants). */
export type Scenario = "no_website" | "outdated_site" | "not_mobile" | "improvement";
export const SCENARIO_LABEL: Record<Scenario, string> = {
  no_website: "Нет сайта", outdated_site: "Устаревший сайт", not_mobile: "Не адаптивный", improvement: "Есть сайт — улучшения",
};
export interface EmailTemplate {
  id: string; name: string; scenario: Scenario;
  subjectA: string; bodyA: string; subjectB: string; bodyB: string;
}

/** Sending + compliance config. */
export interface OutreachSettings {
  platform: "instantly" | "smartlead" | "none"; apiKey: string;
  sendingDomains: string[]; inboxes: number; dailyPerInbox: number;
  footer: string; euRep: string; senderName: string;
}
export interface Suppression { id: string; email: string; reason: string; at: string }

/* ---------------- keys ---------------- */
const K = {
  campaigns: "leadgenium:outreach:campaigns", leads: "leadgenium:outreach:leads",
  templates: "leadgenium:outreach:templates", settings: "leadgenium:outreach:settings",
  suppression: "leadgenium:outreach:suppression",
};

/* ---------------- seeds ---------------- */

function seedCampaigns(): Campaign[] {
  return [
    { id: "cmp1", name: "Клининг · Кишинёв", niche: "Клининговые компании", country: "Молдова", cities: ["Chișinău"], dailyLimit: 40, status: "active", createdAt: "2026-07-24", templateId: "tpl1", found: 62, contacted: 41, opened: 23, replied: 6, won: 1 },
    { id: "cmp2", name: "Стоматологии · Bucuresti", niche: "Стоматологические клиники", country: "Румыния", cities: ["București"], dailyLimit: 30, status: "active", createdAt: "2026-07-26", templateId: "tpl2", found: 38, contacted: 18, opened: 9, replied: 2, won: 0 },
    { id: "cmp3", name: "Автосервисы · Bălți", niche: "Автосервисы", country: "Молдова", cities: ["Bălți"], dailyLimit: 30, status: "draft", createdAt: "2026-07-29", found: 0, contacted: 0, opened: 0, replied: 0, won: 0 },
  ];
}

function seedLeads(): OutreachLead[] {
  return [
    { id: "ol1", campaignId: "cmp1", business: "Curat Total SRL", city: "Chișinău", phone: "+373 60 200 100", email: "office@curattotal.md", siteVerdict: "no_website", siteScore: 0, issues: ["Сайт не найден — только страница в Facebook"], status: "sent", rating: 4.6, reviews: 34, at: "2026-07-28T10:00:00" },
    { id: "ol2", campaignId: "cmp1", business: "Clean House", city: "Chișinău", phone: "+373 69 111 222", email: "contact@cleanhouse.md", siteUrl: "cleanhouse.md", siteVerdict: "outdated", siteScore: 31, issues: ["Не адаптивный", "Устаревший дизайн (~2015)", "Нет SSL"], tech: "joomla", year: 2015, status: "opened", rating: 4.2, reviews: 12, at: "2026-07-28T10:05:00" },
    { id: "ol3", campaignId: "cmp1", business: "Sparkle Clean", city: "Chișinău", phone: "+373 68 333 444", email: "info@sparkle.md", siteUrl: "sparkle.md", siteVerdict: "not_mobile", siteScore: 52, issues: ["Нет viewport — не мобильный", "Медленная загрузка (5.2 с)"], tech: "wordpress", year: 2020, status: "replied", rating: 4.8, reviews: 51, at: "2026-07-27T14:00:00" },
    { id: "ol4", campaignId: "cmp1", business: "EcoClean MD", city: "Chișinău", phone: "+373 79 555 666", siteVerdict: "no_website", siteScore: 0, issues: ["Сайт не найден"], status: "new", rating: 4.1, reviews: 8, at: "2026-07-29T09:00:00" },
    { id: "ol5", campaignId: "cmp2", business: "DentPlus Clinic", city: "București", phone: "+40 721 100 200", email: "office@dentplus.ro", siteUrl: "dentplus.ro", siteVerdict: "builder_basic", siteScore: 48, issues: ["Собран на Wix", "Слабый призыв к действию"], tech: "wix", year: 2021, status: "sent", rating: 4.7, reviews: 88, at: "2026-07-28T11:00:00" },
    { id: "ol6", campaignId: "cmp2", business: "Smile Dental", city: "București", phone: "+40 733 200 300", email: "contact@smiledental.ro", siteVerdict: "no_website", siteScore: 0, issues: ["Сайт не найден"], status: "new", rating: 4.9, reviews: 120, at: "2026-07-29T08:30:00" },
  ];
}

function seedTemplates(): EmailTemplate[] {
  return [
    { id: "tpl1", name: "Клининг — нет сайта", scenario: "no_website",
      subjectA: "Ваша уборка и Google",
      bodyA: "Здравствуйте! Заметил {business} в Google Maps — {rating}★, {reviews} отзывов, но у вас нет сайта. Клиенты, которые ищут уборку в {city}, находят конкурентов с сайтом. Мы делаем сайт с онлайн-заявкой за 2 недели. Показать пример под вашу нишу?",
      subjectB: "Быстрый вопрос про {business}",
      bodyB: "Здравствуйте! У {business} отличный рейтинг в Maps, но нет сайта — а 8 из 10 клиентов сначала гуглят. Что если у вас появился бы сайт с формой заявки за пару недель — куда прислать пример?" },
    { id: "tpl2", name: "Стоматология — устаревший сайт", scenario: "outdated_site",
      subjectA: "Сайт {business} на телефоне",
      bodyA: "Здравствуйте! Открыл сайт {business} с телефона — он не адаптирован под мобильные, а больше половины пациентов записываются со смартфона. Сделаем современный сайт с онлайн-записью за 2 недели. Прислать пример?",
      subjectB: "{business} — пара идей по сайту",
      bodyB: "Здравствуйте! Посмотрел ваш сайт — дизайн устарел и грузится медленно, из-за этого часть пациентов уходит. Есть 2–3 идеи, как это исправить. Уделите пару минут?" },
  ];
}

function seedSettings(): OutreachSettings {
  return {
    platform: "none", apiKey: "",
    sendingDomains: ["getleadgenium.com"], inboxes: 3, dailyPerInbox: 40,
    footer: "LeadGenium · Chișinău, str. Mesager 7 · Политика конфиденциальности: leadgenium.pro/privacy\nЕсли письмо не актуально — ответьте «стоп», и мы больше не побеспокоим.",
    euRep: "", senderName: "Sergiu",
  };
}

function seedSuppression(): Suppression[] {
  return [
    { id: "s1", email: "noreply@example.md", reason: "Отписка", at: "2026-07-27" },
  ];
}

/* ---------------- load/save ---------------- */
function load<T>(key: string, seed: () => T): T {
  try { const raw = localStorage.getItem(key); if (!raw) { const s = seed(); localStorage.setItem(key, JSON.stringify(s)); return s; } return JSON.parse(raw) as T; }
  catch { return seed(); }
}
const save = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));
const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);

export const loadCampaigns = () => load(K.campaigns, seedCampaigns);
export const saveCampaigns = (l: Campaign[]) => save(K.campaigns, l);
export const loadOutreachLeads = () => load(K.leads, seedLeads);
export const saveOutreachLeads = (l: OutreachLead[]) => save(K.leads, l);
export const loadTemplates = () => load(K.templates, seedTemplates);
export const saveTemplates = (l: EmailTemplate[]) => save(K.templates, l);
export const loadOutreachSettings = () => load(K.settings, seedSettings);
export const saveOutreachSettings = (s: OutreachSettings) => save(K.settings, s);
export const loadSuppression = () => load(K.suppression, seedSuppression);
export const saveSuppression = (l: Suppression[]) => save(K.suppression, l);

/* ---------------- mutations ---------------- */
export function addCampaign(input: { name: string; niche: string; country: string; cities: string[]; dailyLimit: number }): Campaign {
  const c: Campaign = {
    id: uid("cmp"), name: input.name.trim() || input.niche, niche: input.niche, country: input.country,
    cities: input.cities, dailyLimit: input.dailyLimit || 30, status: "draft", createdAt: new Date().toISOString().slice(0, 10),
    found: 0, contacted: 0, opened: 0, replied: 0, won: 0,
  };
  saveCampaigns([c, ...loadCampaigns()]);
  return c;
}
export const updateCampaign = (id: string, patch: Partial<Campaign>) => saveCampaigns(loadCampaigns().map((c) => (c.id === id ? { ...c, ...patch } : c)));
export const removeCampaign = (id: string) => saveCampaigns(loadCampaigns().filter((c) => c.id !== id));

export const updateOutreachLead = (id: string, patch: Partial<OutreachLead>) => saveOutreachLeads(loadOutreachLeads().map((l) => (l.id === id ? { ...l, ...patch } : l)));
export const updateTemplate = (id: string, patch: Partial<EmailTemplate>) => saveTemplates(loadTemplates().map((t) => (t.id === id ? { ...t, ...patch } : t)));
export const addSuppression = (email: string, reason = "Отписка") => { if (!email.trim()) return; saveSuppression([{ id: uid("s"), email: email.trim(), reason, at: new Date().toISOString().slice(0, 10) }, ...loadSuppression()]); };
export const removeSuppression = (id: string) => saveSuppression(loadSuppression().filter((s) => s.id !== id));

/* ---------------- mock lead finder (interface phase only) ----------------
 * Simulates the VPS worker's scrape+qualify step so «Поиск лидов» is interactive on mocks.
 * The real worker replaces this with SerpAPI/Outscraper + Playwright website_check. */
const MOCK_BIZ = ["Curat", "Clean House", "Sparkle", "EcoClean", "Prime", "Lux Service", "Bright", "Nova", "Fresh", "TopClean"];
const MOCK_SUF = ["SRL", "MD", "Pro", "Group", "Studio", "Company"];
export function mockFindLeads(niche: string, city: string, campaignId?: string, n = 4): OutreachLead[] {
  const verdicts: SiteVerdict[] = ["no_website", "no_website", "outdated", "not_mobile", "builder_basic"];
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const issuesFor: Record<SiteVerdict, string[]> = {
    no_website: ["Сайт не найден — только соцсети"], outdated: ["Устаревший дизайн", "Нет SSL", "Медленная загрузка"],
    not_mobile: ["Нет viewport — не мобильный"], builder_basic: ["Собран на конструкторе", "Слабый призыв к действию"], ok: [],
  };
  const made: OutreachLead[] = [];
  for (let i = 0; i < n; i++) {
    const v = pick(verdicts);
    const score = v === "no_website" ? 0 : v === "outdated" ? 20 + Math.floor(Math.random() * 20) : 40 + Math.floor(Math.random() * 25);
    made.push({
      id: uid("ol"), campaignId, business: `${pick(MOCK_BIZ)} ${pick(MOCK_SUF)}`, city, siteVerdict: v, siteScore: score,
      issues: issuesFor[v], status: "new", rating: +(4 + Math.random()).toFixed(1), reviews: Math.floor(Math.random() * 120),
      at: new Date().toISOString(),
    });
  }
  saveOutreachLeads([...made, ...loadOutreachLeads()]);
  return made;
}

/* ---------------- derivations ---------------- */
export const leadsOfCampaign = (campaignId: string) => loadOutreachLeads().filter((l) => l.campaignId === campaignId);
export function outreachTotals() {
  const c = loadCampaigns();
  const sum = (k: keyof Campaign) => c.reduce((s, x) => s + (x[k] as number), 0);
  const found = sum("found"), contacted = sum("contacted"), opened = sum("opened"), replied = sum("replied"), won = sum("won");
  return {
    campaigns: c.length, active: c.filter((x) => x.status === "active").length,
    found, contacted, opened, replied, won,
    openRate: contacted ? Math.round((opened / contacted) * 100) : 0,
    replyRate: contacted ? Math.round((replied / contacted) * 100) : 0,
    winRate: replied ? Math.round((won / replied) * 100) : 0,
  };
}
