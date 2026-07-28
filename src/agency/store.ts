/**
 * Agency clients registry — the "master list" of tenants an agency staff member manages. Each Client is
 * a project (site + cabinet). The agency console lists these; entering one scopes the cabinet to that
 * tenant. localStorage now; a Supabase master-registry `projects` table later (same shape).
 *
 * AllClean is the one real, live client; the other seeds are demo projects so the console reads as a
 * real multi-client agency console during development.
 */

export type SiteStatus = "live" | "draft" | "building";

export interface Client {
  id: string;
  name: string;
  domain: string;
  plan: "free" | "pro";
  hosting: "ours" | "external";
  siteStatus: SiteStatus;
  /** ISO date of last publish, or null if never published. */
  lastPublish: string | null;
  openTickets: number;
  leads7d: number;
  /** Two-letter monogram for the avatar. */
  initials: string;
  /** Accent for the avatar chip (falls back to the brand gradient). */
  accent?: string;
}

const KEY = "leadgenium:clients";
const ACTIVE = "leadgenium:activeClient";

function seed(): Client[] {
  return [
    {
      id: "allclean", name: "AllClean", domain: "allclean.md", plan: "pro", hosting: "external",
      siteStatus: "live", lastPublish: "2026-07-27", openTickets: 1, leads7d: 38, initials: "AC",
      accent: "#537fdd",
    },
    {
      id: "verde-spa", name: "Verde SPA", domain: "verde-spa.ro", plan: "pro", hosting: "ours",
      siteStatus: "live", lastPublish: "2026-07-24", openTickets: 0, leads7d: 21, initials: "VS",
      accent: "#10b981",
    },
    {
      id: "dentalux", name: "DentaLux", domain: "dentalux.md", plan: "free", hosting: "external",
      siteStatus: "draft", lastPublish: null, openTickets: 2, leads7d: 0, initials: "DL",
      accent: "#f59e0b",
    },
  ];
}

export function loadClients(): Client[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as Client[];
  } catch {
    return seed();
  }
}

export function saveClients(list: Client[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getClient(id: string | null | undefined): Client | undefined {
  if (!id) return undefined;
  return loadClients().find((c) => c.id === id);
}

export function addClient(name: string, domain: string): Client {
  const list = loadClients();
  const id = slugId(name, list);
  const initials = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean)
    .slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || name.slice(0, 2).toUpperCase();
  const client: Client = {
    id, name: name.trim(), domain: domain.trim(), plan: "free", hosting: "external",
    siteStatus: "building", lastPublish: null, openTickets: 0, leads7d: 0, initials,
  };
  saveClients([...list, client]);
  return client;
}

export function removeClient(id: string): void {
  saveClients(loadClients().filter((c) => c.id !== id));
  if (getActiveClientId() === id) clearActiveClient();
}

function slugId(name: string, existing: Client[]): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "client";
  let id = base, i = 2;
  while (existing.some((c) => c.id === id)) id = `${base}-${i++}`;
  return id;
}

/* ---- Active client (which tenant the agency staff has "entered") ---- */

export function getActiveClientId(): string | null {
  return localStorage.getItem(ACTIVE);
}

export function setActiveClientId(id: string): void {
  localStorage.setItem(ACTIVE, id);
}

export function clearActiveClient(): void {
  localStorage.removeItem(ACTIVE);
}
