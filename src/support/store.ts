/**
 * Support store — tickets between the client and the agency (the developer assigned to their site).
 * Each ticket is a thread of messages with a status. localStorage now; Supabase per-tenant later.
 */

export type TicketStatus = "open" | "pending" | "closed";
export interface TicketMsg { id: string; from: "client" | "agent"; text: string; at: number }
export interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: TicketStatus;
  assignee: string;      // the site's developer
  messages: TicketMsg[];
  createdAt: number;
  updatedAt: number;
}

export const CATEGORIES = ["Сайт", "Домен", "Оплата", "Калькулятор", "Другое"] as const;
export const ASSIGNEE = "Sergiu (ваш разработчик)";

const KEY = "leadgenium:support:tickets";
const uid = () => "t" + Math.random().toString(36).slice(2, 9);

export const STATUS_LABEL: Record<TicketStatus, string> = { open: "Открыт", pending: "Ждёт вас", closed: "Закрыт" };

function seed(): Ticket[] {
  const now = Date.now();
  return [
    {
      id: uid(), subject: "Поменять телефон в шапке сайта", category: "Сайт", status: "open", assignee: ASSIGNEE,
      createdAt: now - 2 * 864e5, updatedAt: now - 3600e3,
      messages: [
        { id: uid(), from: "client", text: "Здравствуйте! Нужно обновить номер телефона в шапке на +373 79 955 044.", at: now - 2 * 864e5 },
        { id: uid(), from: "agent", text: "Принял, поменяю сегодня и напишу. Также обновлю в футере и микроразметке.", at: now - 3600e3 },
      ],
    },
    {
      id: uid(), subject: "Подключить домен allclean.md", category: "Домен", status: "closed", assignee: ASSIGNEE,
      createdAt: now - 10 * 864e5, updatedAt: now - 8 * 864e5,
      messages: [
        { id: uid(), from: "client", text: "Домен куплен, нужно направить на наш сайт.", at: now - 10 * 864e5 },
        { id: uid(), from: "agent", text: "Готово, домен подключён, SSL выпущен. Сайт открывается по https://allclean.md ✅", at: now - 8 * 864e5 },
      ],
    },
  ];
}

export function loadTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as Ticket[];
  } catch {
    return seed();
  }
}

export function saveTickets(list: Ticket[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertTicket(list: Ticket[], t: Ticket): Ticket[] {
  const next = { ...t, updatedAt: Date.now() };
  const i = list.findIndex((x) => x.id === t.id);
  const out = i >= 0 ? list.map((x, j) => (j === i ? next : x)) : [next, ...list];
  saveTickets(out);
  return out;
}

export function newTicket(subject: string, category: string, text: string): Ticket {
  const at = Date.now();
  return {
    id: uid(), subject, category, status: "open", assignee: ASSIGNEE, createdAt: at, updatedAt: at,
    messages: text.trim() ? [{ id: uid(), from: "client", text: text.trim(), at }] : [],
  };
}

export function addReply(list: Ticket[], id: string, text: string): Ticket[] {
  const t = list.find((x) => x.id === id);
  if (!t) return list;
  const msg: TicketMsg = { id: uid(), from: "client", text, at: Date.now() };
  return upsertTicket(list, { ...t, status: "open", messages: [...t.messages, msg] });
}

export function setStatus(list: Ticket[], id: string, status: TicketStatus): Ticket[] {
  const t = list.find((x) => x.id === id);
  return t ? upsertTicket(list, { ...t, status }) : list;
}
