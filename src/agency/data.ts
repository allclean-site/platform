/**
 * Agency data layer for the main platform (cms.leadgenium.pro). Richer than the legacy `store.ts`
 * (which still powers the active-client switch): here a CLIENT (customer) owns multiple PROJECTS
 * (site / landing / SEO), plus contacts, documents, tasks. Everything is mock in localStorage during
 * the interface phase — the shapes mirror the future Supabase tables (see AGENCY_CABINET_SPEC.md).
 */

export type Plan = "free" | "pro";
export type Stage = "brief" | "design" | "development" | "seo" | "launched" | "support";
export const STAGE_LABEL: Record<Stage, string> = {
  brief: "Бриф", design: "Дизайн", development: "Разработка", seo: "SEO", launched: "Запущен", support: "Поддержка",
};
export const STAGE_ORDER: Stage[] = ["brief", "design", "development", "seo", "launched", "support"];
export type ProjectType = "Сайт" | "Лендинг" | "SEO" | "Интернет-магазин" | "Другое";
export type Priority = "high" | "med" | "low";

export interface Contact { id: string; name: string; role?: string; phone?: string; email?: string; primary?: boolean }
export interface DocItem { id: string; name: string; kind: "contract" | "act" | "invoice" | "other"; sizeKB?: number; uploadedAt: string; uploadedBy: string }
export interface Health {
  online: boolean; lcpMs?: number; inpMs?: number; cls?: number;
  domainStatus?: "connected" | "pending" | "error"; sslDaysLeft?: number;
  lastPublish?: string | null; publishFailed?: boolean;
}
export interface Seo {
  score?: number; keywordsTracked?: number; avgPosition?: number; traffic30d?: number;
  wins: string[]; todos: { title: string; priority: Priority }[];
}
export interface Project {
  id: string; clientId: string; title: string; type: ProjectType; summary: string; stage: Stage;
  priceTotal: number; pricePaid: number; currency: "EUR"; siteSlug?: string;
  health: Health; seo?: Seo; leads7d: number; openTickets: number; updatedAt: string;
}
export interface AClient {
  id: string; name: string; company?: string; initials: string; accent?: string;
  since: string; managerId?: string; plan: Plan; contacts: Contact[]; notes?: string;
}
export interface ATask { id: string; clientId?: string; projectId?: string; title: string; assigneeId?: string; due?: string; status: "todo" | "doing" | "done"; priority: Priority }
export interface AMember { id: string; name: string; email: string; role: "owner" | "admin" | "manager" | "editor" }
export type EventKind = "lead" | "publish" | "ticket" | "task" | "seo" | "client";
export interface AEvent { id: string; at: string; clientId: string; kind: EventKind; text: string }

export type TicketStatus = "open" | "pending" | "closed";
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = { open: "Открыт", pending: "Ждёт клиента", closed: "Закрыт" };
export interface TicketMsg { from: "client" | "agent"; text: string; at: string }
export interface Ticket {
  id: string; clientId: string; projectId?: string; subject: string; category: string;
  status: TicketStatus; assigneeId?: string; messages: TicketMsg[];
}

const KEYS = { clients: "leadgenium:agency:clients", projects: "leadgenium:agency:projects", docs: "leadgenium:agency:docs", tasks: "leadgenium:agency:tasks", team: "leadgenium:agency:team", events: "leadgenium:agency:events", tickets: "leadgenium:agency:tickets" };

/* ---------------- seeds (read like a real, running agency during dev) ---------------- */

const TEAM: AMember[] = [
  { id: "u1", name: "Sergiu", email: "dev@leadgenium.pro", role: "owner" },
  { id: "u2", name: "Ana", email: "ana@leadgenium.pro", role: "manager" },
  { id: "u3", name: "Mihai", email: "mihai@leadgenium.pro", role: "editor" },
];

function seedClients(): AClient[] {
  return [
    { id: "allclean", name: "AllClean", company: "All Clean SRL", initials: "AC", accent: "#537fdd", since: "2026-05-01", managerId: "u1", plan: "pro",
      contacts: [{ id: "c1", name: "Victor", role: "Владелец", phone: "+373 79 955 044", email: "info@allclean.md", primary: true }] },
    { id: "verde-spa", name: "Verde SPA", company: "Verde Wellness SRL", initials: "VS", accent: "#10b981", since: "2026-06-10", managerId: "u2", plan: "pro",
      contacts: [{ id: "c2", name: "Elena", role: "Маркетинг", phone: "+40 720 111 222", email: "elena@verde-spa.ro", primary: true }] },
    { id: "dentalux", name: "DentaLux", company: "DentaLux Clinic", initials: "DL", accent: "#f59e0b", since: "2026-07-15", managerId: "u2", plan: "free",
      contacts: [{ id: "c3", name: "Dr. Popescu", role: "Директор", phone: "+373 68 333 444", email: "office@dentalux.md", primary: true }] },
    { id: "coffee-lab", name: "Coffee Lab", company: "Coffee Lab SRL", initials: "CL", accent: "#8b5cf6", since: "2026-07-25", managerId: "u3", plan: "free",
      contacts: [{ id: "c4", name: "Radu", role: "Основатель", phone: "+40 733 555 666", email: "radu@coffeelab.ro", primary: true }] },
  ];
}

function seedProjects(): Project[] {
  const H = (o: Partial<Health>): Health => ({ online: true, domainStatus: "connected", sslDaysLeft: 60, publishFailed: false, ...o });
  return [
    { id: "allclean-site", clientId: "allclean", title: "Основной сайт allclean.md", type: "Сайт", summary: "Двуязычный сайт (RO/RU), калькуляторы, блог, форма заявок.",
      stage: "support", priceTotal: 1000, pricePaid: 600, currency: "EUR", siteSlug: "allclean",
      health: H({ lcpMs: 1800, inpMs: 120, cls: 0.03, lastPublish: "2026-07-27" }), leads7d: 38, openTickets: 1, updatedAt: "2026-07-27",
      seo: { score: 82, keywordsTracked: 24, avgPosition: 11, traffic30d: 2400, wins: ["8 запросов в топ-10", "Core Web Vitals — зелёные"], todos: [{ title: "Дописать alt у 12 фото услуг", priority: "med" }, { title: "Статья: уборка после ремонта", priority: "high" }] } },
    { id: "verde-site", clientId: "verde-spa", title: "Сайт-визитка verde-spa.ro", type: "Сайт", summary: "Одностраничник + запись, галерея процедур.",
      stage: "launched", priceTotal: 800, pricePaid: 800, currency: "EUR", siteSlug: "verde-spa",
      health: H({ lcpMs: 2100, inpMs: 90, cls: 0.01, lastPublish: "2026-07-24", sslDaysLeft: 42 }), leads7d: 21, openTickets: 0, updatedAt: "2026-07-24",
      seo: { score: 74, keywordsTracked: 15, avgPosition: 18, traffic30d: 1100, wins: ["Локальная выдача Bucuresti — топ-5"], todos: [{ title: "Собрать отзывы в Google", priority: "med" }] } },
    { id: "verde-seo", clientId: "verde-spa", title: "SEO-продвижение (3 мес)", type: "SEO", summary: "Семантика, статьи, локальное SEO, отчёты.",
      stage: "seo", priceTotal: 1500, pricePaid: 500, currency: "EUR",
      health: H({ online: true }), leads7d: 0, openTickets: 0, updatedAt: "2026-07-26",
      seo: { score: 61, keywordsTracked: 40, avgPosition: 27, traffic30d: 300, wins: ["+18 запросов в трекинге"], todos: [{ title: "3 статьи кластера «спа»", priority: "high" }, { title: "Наращивание ссылок", priority: "med" }] } },
    { id: "dentalux-site", clientId: "dentalux", title: "Сайт клиники dentalux.md", type: "Сайт", summary: "Услуги, врачи, онлайн-запись.",
      stage: "development", priceTotal: 900, pricePaid: 300, currency: "EUR", siteSlug: "dentalux",
      health: H({ online: false, domainStatus: "pending", sslDaysLeft: 0, lastPublish: null }), leads7d: 0, openTickets: 2, updatedAt: "2026-07-22" },
    { id: "coffee-landing", clientId: "coffee-lab", title: "Лендинг подписки на кофе", type: "Лендинг", summary: "Подписка, оплата, доставка по RO.",
      stage: "design", priceTotal: 600, pricePaid: 0, currency: "EUR",
      health: H({ online: false, domainStatus: "pending", sslDaysLeft: 9, lastPublish: null, publishFailed: true }), leads7d: 0, openTickets: 0, updatedAt: "2026-07-25" },
  ];
}

function seedDocs(): DocItem[] {
  return [
    { id: "d1", name: "Договор AllClean — сайт.pdf", kind: "contract", sizeKB: 240, uploadedAt: "2026-05-02", uploadedBy: "Sergiu" },
    { id: "d2", name: "Акт приёмо-передачи AllClean.pdf", kind: "act", sizeKB: 120, uploadedAt: "2026-07-27", uploadedBy: "Ana" },
    { id: "d3", name: "Договор Verde SPA.pdf", kind: "contract", sizeKB: 210, uploadedAt: "2026-06-11", uploadedBy: "Ana" },
  ] as (DocItem & { clientId: string })[] as DocItem[]; // clientId attached below via seed mapping
}

function seedTasks(): ATask[] {
  return [
    { id: "t1", clientId: "allclean", projectId: "allclean-site", title: "Опубликовать статью про уборку после ремонта", assigneeId: "u3", due: "2026-07-27", status: "todo", priority: "high" },
    { id: "t2", clientId: "dentalux", projectId: "dentalux-site", title: "Подключить домен dentalux.md", assigneeId: "u2", due: "2026-07-29", status: "doing", priority: "high" },
    { id: "t3", clientId: "verde-spa", projectId: "verde-seo", title: "Сдать SEO-отчёт за месяц", assigneeId: "u2", due: "2026-07-31", status: "todo", priority: "med" },
    { id: "t4", clientId: "coffee-lab", projectId: "coffee-landing", title: "Согласовать дизайн лендинга", assigneeId: "u3", due: "2026-07-26", status: "todo", priority: "med" },
  ];
}

function seedEvents(): AEvent[] {
  return [
    { id: "e1", at: "2026-07-28T09:10:00", clientId: "allclean", kind: "lead", text: "Новая заявка через калькулятор — уборка квартиры, оценка 1 850 MDL" },
    { id: "e2", at: "2026-07-28T08:30:00", clientId: "verde-spa", kind: "lead", text: "Новая заявка с формы записи" },
    { id: "e3", at: "2026-07-27T18:40:00", clientId: "allclean", kind: "publish", text: "Сайт опубликован (RO-primary)" },
    { id: "e4", at: "2026-07-27T15:05:00", clientId: "dentalux", kind: "ticket", text: "Клиент открыл тикет: не работает форма" },
    { id: "e5", at: "2026-07-26T12:00:00", clientId: "verde-spa", kind: "seo", text: "+18 запросов добавлено в трекинг" },
    { id: "e6", at: "2026-07-25T10:20:00", clientId: "coffee-lab", kind: "client", text: "Новый клиент добавлен в реестр" },
  ];
}

/* ---------------- load/save ---------------- */

function load<T>(key: string, seed: () => T): T {
  try { const raw = localStorage.getItem(key); if (!raw) { const s = seed(); localStorage.setItem(key, JSON.stringify(s)); return s; } return JSON.parse(raw) as T; }
  catch { return seed(); }
}

export const loadAClients = () => load(KEYS.clients, seedClients);
export const loadProjects = () => load(KEYS.projects, seedProjects);
export const loadTasks = () => load(KEYS.tasks, seedTasks);
export const loadTeam = () => load(KEYS.team, () => TEAM);
export const loadEvents = () => load(KEYS.events, seedEvents);
export const loadDocs = (): (DocItem & { clientId?: string })[] => {
  const withClient = [
    { ...seedDocs()[0], clientId: "allclean" }, { ...seedDocs()[1], clientId: "allclean" }, { ...seedDocs()[2], clientId: "verde-spa" },
  ];
  return load(KEYS.docs, () => withClient);
};

function seedTickets(): Ticket[] {
  return [
    { id: "tk1", clientId: "dentalux", projectId: "dentalux-site", subject: "Не работает форма записи", category: "Сайт", status: "open", assigneeId: "u2",
      messages: [{ from: "client", text: "Здравствуйте, форма на сайте не отправляется.", at: "2026-07-27T15:05:00" }] },
    { id: "tk2", clientId: "dentalux", subject: "Когда будет готов сайт?", category: "Проект", status: "pending", assigneeId: "u2",
      messages: [{ from: "client", text: "Подскажите сроки запуска.", at: "2026-07-26T10:00:00" }, { from: "agent", text: "На этой неделе подключаем домен, затем публикуем.", at: "2026-07-26T10:20:00" }] },
    { id: "tk3", clientId: "allclean", projectId: "allclean-site", subject: "Заменить фото на главной", category: "Правки", status: "open", assigneeId: "u3",
      messages: [{ from: "client", text: "Можно заменить баннер на новый?", at: "2026-07-28T08:00:00" }] },
  ];
}

export const loadTickets = () => load(KEYS.tickets, seedTickets);
export const saveTickets = (l: Ticket[]) => localStorage.setItem(KEYS.tickets, JSON.stringify(l));

export const projectsOf = (clientId: string) => loadProjects().filter((p) => p.clientId === clientId);
export const docsOf = (clientId: string) => loadDocs().filter((d) => d.clientId === clientId);
export const getAClient = (id: string) => loadAClients().find((c) => c.id === id);
export const getProject = (id: string) => loadProjects().find((p) => p.id === id);
export const memberName = (id?: string) => loadTeam().find((m) => m.id === id)?.name ?? "—";
export const phoneDigits = (p: string) => (p || "").replace(/[^\d]/g, "");

/* ---------------- Обзор derivations ---------------- */

export interface Attention { id: string; kind: EventKind | "domain"; label: string; count: number; tone: "danger" | "warn" | "info" }

export function overview() {
  const clients = loadAClients();
  const projects = loadProjects();
  const tasks = loadTasks();
  const today = new Date().toISOString().slice(0, 10);

  const activeSites = projects.filter((p) => p.health.online).length;
  const leads7d = projects.reduce((s, p) => s + p.leads7d, 0);
  const openTickets = projects.reduce((s, p) => s + p.openTickets, 0);
  const priceTotal = projects.reduce((s, p) => s + p.priceTotal, 0);
  const pricePaid = projects.reduce((s, p) => s + p.pricePaid, 0);

  const overdue = tasks.filter((t) => t.status !== "done" && t.due && t.due < today).length;
  const failedPublish = projects.filter((p) => p.health.publishFailed).length;
  const expiringDomains = projects.filter((p) => (p.health.sslDaysLeft ?? 99) <= 14).length;

  const allAttention: Attention[] = [
    { id: "leads", kind: "lead", label: "Новых заявок за 7 дней", count: leads7d, tone: "info" },
    { id: "tickets", kind: "ticket", label: "Открытых тикетов", count: openTickets, tone: openTickets ? "warn" : "info" },
    { id: "publish", kind: "publish", label: "Ошибок публикации", count: failedPublish, tone: failedPublish ? "danger" : "info" },
    { id: "domain", kind: "domain", label: "Доменов/SSL истекают (≤14 дн)", count: expiringDomains, tone: expiringDomains ? "warn" : "info" },
    { id: "tasks", kind: "task", label: "Просроченных задач", count: overdue, tone: overdue ? "danger" : "info" },
  ];
  const attention = allAttention.filter((a) => a.count > 0 || a.id === "leads");

  return {
    kpis: { clients: clients.length, projects: projects.length, activeSites, leads7d, openTickets, pricePaid, priceTotal },
    attention,
    events: loadEvents().slice().sort((a, b) => (a.at < b.at ? 1 : -1)),
    tasks: tasks.filter((t) => t.status !== "done").sort((a, b) => (a.due ?? "9") < (b.due ?? "9") ? -1 : 1),
    projects,
    clients,
  };
}

export const clientName = (id: string) => loadAClients().find((c) => c.id === id)?.name ?? id;
export const eur = (n: number) => n.toLocaleString("ru-RU");

/* ---------------- mutations (mock; localStorage) ---------------- */
const uid = (p: string) => p + Math.random().toString(36).slice(2, 8);
const save = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));

export const saveAClients = (l: AClient[]) => save(KEYS.clients, l);
export function addAClient(input: { name: string; company?: string; contact?: Partial<Contact> }): AClient {
  const list = loadAClients();
  const base = input.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
  let id = base, i = 2; while (list.some((c) => c.id === id)) id = `${base}-${i++}`;
  const initials = input.name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || input.name.slice(0, 2).toUpperCase();
  const accents = ["#537fdd", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
  const c: AClient = {
    id, name: input.name.trim(), company: input.company?.trim() || undefined, initials, accent: accents[list.length % accents.length],
    since: new Date().toISOString().slice(0, 10), managerId: "u1", plan: "free",
    contacts: input.contact?.name ? [{ id: uid("c"), name: input.contact.name!, phone: input.contact.phone, email: input.contact.email, primary: true }] : [],
  };
  saveAClients([...list, c]);
  return c;
}
export const removeAClient = (id: string) => { saveAClients(loadAClients().filter((c) => c.id !== id)); save(KEYS.projects, loadProjects().filter((p) => p.clientId !== id)); };

export const saveProjects = (l: Project[]) => save(KEYS.projects, l);
export function addProject(clientId: string, input: { title: string; type: ProjectType; priceTotal: number }): Project {
  const p: Project = {
    id: uid("pr"), clientId, title: input.title.trim(), type: input.type, summary: "", stage: "brief",
    priceTotal: input.priceTotal || 0, pricePaid: 0, currency: "EUR",
    health: { online: false, domainStatus: "pending" }, leads7d: 0, openTickets: 0, updatedAt: new Date().toISOString().slice(0, 10),
  };
  saveProjects([...loadProjects(), p]);
  return p;
}
export const updateProject = (id: string, patch: Partial<Project>) => saveProjects(loadProjects().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString().slice(0, 10) } : p)));

export function addDoc(clientId: string, meta: { name: string; kind: DocItem["kind"]; sizeKB?: number; uploadedBy: string }): void {
  const d = { id: uid("d"), clientId, name: meta.name, kind: meta.kind, sizeKB: meta.sizeKB, uploadedAt: new Date().toISOString().slice(0, 10), uploadedBy: meta.uploadedBy } as DocItem & { clientId: string };
  save(KEYS.docs, [...loadDocs(), d]);
}
export const removeDoc = (id: string) => save(KEYS.docs, loadDocs().filter((d) => d.id !== id));

export const saveTasks = (l: ATask[]) => save(KEYS.tasks, l);
export const saveTeam = (l: AMember[]) => save(KEYS.team, l);

/* ==================== Agency sales funnel (prospects) ====================
 * Potential clients OF THE AGENCY — inbound inquiries (marketing landing) + replies from our own
 * outreach ("Рассылка"). This is the agency's OWN sales pipeline. Distinct from a client's business
 * leads, which live in that project's CRM (страница проекта → CRM). */

export type ProspectStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
export const PROSPECT_STAGE_LABEL: Record<ProspectStage, string> = {
  new: "Новая", contacted: "Связались", qualified: "Квалифицирован", proposal: "КП отправлено", won: "Стал клиентом", lost: "Отказ",
};
export const PROSPECT_STAGE_ORDER: ProspectStage[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];
export type ProspectSource = "landing" | "outreach" | "referral" | "manual";
export const PROSPECT_SOURCE_LABEL: Record<ProspectSource, string> = {
  landing: "Лендинг", outreach: "Рассылка", referral: "Реферал", manual: "Вручную",
};
/** Website qualifier verdict carried over from outreach (see outreach-pro website_check). */
export type SiteVerdict = "no_website" | "outdated" | "not_mobile" | "builder_basic" | "ok";
export const SITE_VERDICT_LABEL: Record<SiteVerdict, string> = {
  no_website: "Нет сайта", outdated: "Устаревший", not_mobile: "Не адаптивный", builder_basic: "Конструктор", ok: "Норм",
};
export interface Prospect {
  id: string; business: string; contactName?: string; email?: string; phone?: string; city?: string;
  interest: string; source: ProspectSource; stage: ProspectStage; note?: string; at: string;
  assigneeId?: string; budget?: string;
  siteVerdict?: SiteVerdict; siteScore?: number; siteUrl?: string; // from the outreach qualifier
}

const KEY_PROSPECTS = "leadgenium:agency:prospects";

function seedProspects(): Prospect[] {
  return [
    { id: "p1", business: "Pizzeria Roma", contactName: "Andrei", phone: "+373 60 111 222", email: "roma.pizza@gmail.com", city: "Chișinău",
      interest: "Сайт с меню и доставкой", source: "outreach", stage: "new", at: "2026-07-29T10:20:00", assigneeId: "u2",
      siteVerdict: "no_website", siteScore: 0 },
    { id: "p2", business: "AutoService MotorMax", contactName: "Ion", phone: "+373 68 700 800", email: "office@motormax.md", city: "Bălți",
      interest: "Новый сайт вместо старого", source: "outreach", stage: "contacted", at: "2026-07-28T14:00:00", assigneeId: "u2",
      siteVerdict: "outdated", siteScore: 28, siteUrl: "motormax.md", note: "Сайт ~2016 г., не адаптивный. Ответил, ждёт КП." },
    { id: "p3", business: "Studio Nails Bella", contactName: "Elena", phone: "+40 720 900 800", email: "bella.nails@gmail.com", city: "București",
      interest: "Лендинг + онлайн-запись", source: "landing", stage: "qualified", at: "2026-07-27T09:15:00", assigneeId: "u1", budget: "500 €" },
    { id: "p4", business: "Ferma Verde", contactName: "Radu", phone: "+40 733 200 100", email: "radu@fermaverde.ro", city: "Cluj",
      interest: "Интернет-магазин фермерских продуктов", source: "referral", stage: "proposal", at: "2026-07-25T16:40:00", assigneeId: "u1", budget: "1 200 €",
      note: "Реферал от Verde SPA. КП отправлено, думают." },
    { id: "p5", business: "Dental Smile", contactName: "Dr. Ionescu", phone: "+40 721 555 111", email: "office@dentalsmile.ro", city: "București",
      interest: "Сайт клиники", source: "landing", stage: "won", at: "2026-07-20T11:00:00", assigneeId: "u2", budget: "900 €", note: "Договор подписан." },
    { id: "p6", business: "Kebab House", phone: "+373 69 400 500", city: "Chișinău",
      interest: "Сайт", source: "outreach", stage: "lost", at: "2026-07-22T13:00:00", siteVerdict: "no_website", siteScore: 0, note: "Не заинтересованы — ведут только Instagram." },
  ];
}

export const loadProspects = () => load(KEY_PROSPECTS, seedProspects);
export const saveProspects = (l: Prospect[]) => localStorage.setItem(KEY_PROSPECTS, JSON.stringify(l));
export function addProspect(input: { business: string; contactName?: string; email?: string; phone?: string; city?: string; interest?: string; source?: ProspectSource }): Prospect {
  const p: Prospect = {
    id: uid("p"), business: input.business.trim(), contactName: input.contactName?.trim() || undefined,
    email: input.email?.trim() || undefined, phone: input.phone?.trim() || undefined, city: input.city?.trim() || undefined,
    interest: input.interest?.trim() || "Сайт", source: input.source ?? "manual", stage: "new", at: new Date().toISOString(),
  };
  saveProspects([p, ...loadProspects()]);
  return p;
}
export const updateProspect = (id: string, patch: Partial<Prospect>) => saveProspects(loadProspects().map((p) => (p.id === id ? { ...p, ...patch } : p)));
export const removeProspect = (id: string) => saveProspects(loadProspects().filter((p) => p.id !== id));
/** Promote a won prospect into the client registry (creates an AClient). */
export function convertProspectToClient(id: string): AClient | null {
  const p = loadProspects().find((x) => x.id === id);
  if (!p) return null;
  const c = addAClient({ name: p.business, contact: { name: p.contactName ?? p.business, phone: p.phone, email: p.email } });
  updateProspect(id, { stage: "won" });
  return c;
}

/* ==================== Project logs (agency-only tech journal) ====================
 * Errors & problems for a single project: failed publishes, domain/SSL, form/lead-capture errors,
 * broken assets, backups, SEO warnings. Agency-only (клиент этого не видит). */

export type LogLevel = "error" | "warn" | "info";
export const LOG_LEVEL_LABEL: Record<LogLevel, string> = { error: "Ошибка", warn: "Внимание", info: "Событие" };
export interface ProjectLog { id: string; projectId: string; level: LogLevel; category: string; message: string; at: string; resolved?: boolean }

const KEY_LOGS = "leadgenium:agency:logs";

function seedLogs(): ProjectLog[] {
  return [
    { id: "g1", projectId: "coffee-landing", level: "error", category: "Публикация", message: "Сборка прервана: изображение hero.jpg 6.2 МБ превышает лимит 4.5 МБ.", at: "2026-07-25T12:10:00" },
    { id: "g2", projectId: "coffee-landing", level: "warn", category: "Домен/SSL", message: "SSL-сертификат истекает через 9 дней — требуется продление.", at: "2026-07-25T08:00:00" },
    { id: "g3", projectId: "dentalux-site", level: "error", category: "Домен", message: "Домен dentalux.md не делегирован: NS-записи не указывают на наши серверы.", at: "2026-07-27T15:30:00" },
    { id: "g4", projectId: "dentalux-site", level: "error", category: "Форма", message: "Заявка с формы не сохранена: таблица site_leads недоступна (проект ещё не опубликован).", at: "2026-07-27T15:05:00" },
    { id: "g5", projectId: "allclean-site", level: "info", category: "Публикация", message: "Сайт опубликован (RO-primary): 38 страниц, sitemap обновлён, IndexNow пинг отправлен.", at: "2026-07-27T18:40:00", resolved: true },
    { id: "g6", projectId: "allclean-site", level: "warn", category: "SEO", message: "12 изображений услуг без атрибута alt — снижает SEO и доступность.", at: "2026-07-27T19:00:00" },
    { id: "g7", projectId: "allclean-site", level: "info", category: "Заявки", message: "Заявка с калькулятора сохранена и передана в CRM (оценка 1 850 MDL).", at: "2026-07-28T09:10:00", resolved: true },
    { id: "g8", projectId: "verde-site", level: "info", category: "Публикация", message: "Плановая переиндексация выполнена, IndexNow пинг отправлен.", at: "2026-07-24T20:00:00", resolved: true },
  ];
}

export const loadLogs = () => load(KEY_LOGS, seedLogs);
export const logsOf = (projectId: string) => loadLogs().filter((l) => l.projectId === projectId).sort((a, b) => (a.at < b.at ? 1 : -1));
