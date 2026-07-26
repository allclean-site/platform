/**
 * Support — tickets between the client and the developer assigned to their site. Left: ticket list
 * (filterable by status). Right: the selected thread with a reply box. "Новый тикет" opens a compose
 * form. Mirrors a helpdesk conversation view.
 */

import React, { useMemo, useRef, useState } from "react";
import { Plus, LifeBuoy, Send, X, CheckCircle2, RotateCcw } from "lucide-react";
import {
  loadTickets, upsertTicket, addReply, setStatus, newTicket, CATEGORIES, ASSIGNEE, STATUS_LABEL,
  type Ticket, type TicketStatus,
} from "../support/store";
import "./support.css";

export function Support() {
  const [list, setList] = useState<Ticket[]>(() => loadTickets());
  const [openId, setOpenId] = useState<string | null>(() => loadTickets()[0]?.id ?? null);
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [composing, setComposing] = useState(false);

  const filtered = useMemo(
    () => list.filter((t) => filter === "all" || t.status === filter).sort((a, b) => b.updatedAt - a.updatedAt),
    [list, filter],
  );
  const active = list.find((t) => t.id === openId) ?? null;

  const reply = (text: string) => setList((l) => addReply(l, openId!, text));
  const changeStatus = (s: TicketStatus) => setList((l) => setStatus(l, openId!, s));
  const create = (subject: string, category: string, text: string) => {
    const t = newTicket(subject, category, text);
    setList((l) => upsertTicket(l, t));
    setOpenId(t.id); setComposing(false);
  };

  return (
    <div className="sup">
      <aside className="sup__list">
        <div className="sup__list-head">
          <div className="seg-mini">
            {([["all", "Все"], ["open", "Открытые"], ["closed", "Закрытые"]] as const).map(([k, l]) => (
              <button key={k} className={"seg-mini__b" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <button className="sup__new" onClick={() => setComposing(true)} title="Новый тикет"><Plus size={16} /></button>
        </div>
        <div className="sup__tickets">
          {filtered.length === 0 && <p className="muted sup__empty">Нет тикетов</p>}
          {filtered.map((t) => (
            <button key={t.id} className={"sup-item" + (openId === t.id && !composing ? " is-active" : "")} onClick={() => { setOpenId(t.id); setComposing(false); }}>
              <div className="sup-item__top">
                <span className="sup-item__subj">{t.subject}</span>
                <span className={"sup-dot sup-dot--" + t.status} />
              </div>
              <div className="sup-item__last">{t.messages[t.messages.length - 1]?.text || "Нет сообщений"}</div>
              <div className="sup-item__meta"><span className="sup-cat">{t.category}</span><span className="muted">{fmtWhen(t.updatedAt)}</span></div>
            </button>
          ))}
        </div>
      </aside>

      <section className="sup__thread">
        {composing ? (
          <Compose onCancel={() => setComposing(false)} onCreate={create} />
        ) : active ? (
          <Thread key={active.id} ticket={active} onReply={reply} onStatus={changeStatus} />
        ) : (
          <div className="sup__none"><LifeBuoy size={30} /><p>Выберите тикет или создайте новый</p></div>
        )}
      </section>
    </div>
  );
}

function Thread({ ticket, onReply, onStatus }: { ticket: Ticket; onReply: (t: string) => void; onStatus: (s: TicketStatus) => void }) {
  const [text, setText] = useState("");
  const send = () => { if (text.trim()) { onReply(text.trim()); setText(""); } };
  return (
    <>
      <div className="sup-th__head">
        <div>
          <h3 className="sup-th__subj">{ticket.subject}</h3>
          <div className="sup-th__meta"><span className="sup-cat">{ticket.category}</span> · Исполнитель: <b>{ticket.assignee}</b></div>
        </div>
        <div className="sup-th__acts">
          <span className={"sup-status sup-status--" + ticket.status}>{STATUS_LABEL[ticket.status]}</span>
          {ticket.status !== "closed"
            ? <button className="btn-ghost" onClick={() => onStatus("closed")}><CheckCircle2 size={15} /> Закрыть</button>
            : <button className="btn-ghost" onClick={() => onStatus("open")}><RotateCcw size={15} /> Открыть</button>}
        </div>
      </div>
      <div className="sup-th__msgs">
        {ticket.messages.map((m) => (
          <div key={m.id} className={"sup-msg sup-msg--" + m.from}>
            <div className="sup-msg__who">{m.from === "client" ? "Вы" : ticket.assignee}</div>
            <div className="sup-msg__bubble">{m.text}</div>
            <div className="sup-msg__at">{fmtWhen(m.at)}</div>
          </div>
        ))}
        {ticket.messages.length === 0 && <p className="muted">Пока нет сообщений.</p>}
      </div>
      <div className="sup-th__reply">
        <textarea className="ci" rows={2} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder="Напишите сообщение… (Ctrl+Enter — отправить)" />
        <button className="btn-primary" onClick={send} disabled={!text.trim()}><Send size={15} /> Отправить</button>
      </div>
    </>
  );
}

function Compose({ onCancel, onCreate }: { onCancel: () => void; onCreate: (s: string, c: string, t: string) => void }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [text, setText] = useState("");
  return (
    <div className="sup-compose">
      <div className="sup-th__head">
        <h3 className="sup-th__subj">Новый тикет</h3>
        <button className="sup-x" onClick={onCancel}><X size={18} /></button>
      </div>
      <div className="sup-compose__body">
        <label className="fld"><span>Тема</span><input className="ci" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Коротко о вопросе" autoFocus /></label>
        <label className="fld"><span>Раздел</span>
          <select className="ci" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="fld"><span>Сообщение</span><textarea className="ci ci--area" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Опишите, что нужно сделать…" /></label>
        <p className="muted sup-compose__note">Тикет получит {ASSIGNEE} и ответит здесь же.</p>
      </div>
      <div className="sup-compose__foot">
        <button className="btn-ghost" onClick={onCancel}>Отмена</button>
        <button className="btn-primary" disabled={!subject.trim()} onClick={() => onCreate(subject.trim(), category, text)}><Send size={15} /> Создать тикет</button>
      </div>
    </div>
  );
}

function fmtWhen(ts: number) {
  const diff = Date.now() - ts, min = 60e3, h = 60 * min, d = 24 * h;
  if (diff < h) return Math.max(1, Math.round(diff / min)) + " мин назад";
  if (diff < d) return Math.round(diff / h) + " ч назад";
  if (diff < 7 * d) return Math.round(diff / d) + " дн назад";
  try { return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); } catch { return ""; }
}
