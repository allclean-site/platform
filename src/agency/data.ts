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

const KEYS = { clients: "leadgenium:agency:clients", projects: "leadgenium:agency:projects", docs: "leadgenium:agency:docs", tasks: "leadgenium:agency:tasks", team: "leadgenium:agency:team", events: "leadgenium:agency:events" };

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

export const projectsOf = (clientId: string) => loadProjects().filter((p) => p.clientId === clientId);
export const memberName = (id?: string) => loadTeam().find((m) => m.id === id)?.name ?? "—";

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
