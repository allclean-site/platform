/** Поддержка — unified ticket inbox across all clients. List + thread, assign, reply, change status. */

import React, { useMemo, useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";
import {
  loadTickets, saveTickets, clientName, memberName, TICKET_STATUS_LABEL, type Ticket, type TicketStatus,
} from "../agency/data";
import "./agency-ui.css";
import "./agency-support.css";

const STATUS_CLS: Record<TicketStatus, string> = { open: "ag-badge--warn", pending: "ag-badge--info", closed: "ag-badge--soft" };

export function AgencySupport() {
  const [tickets, setTickets] = useState<Ticket[]>(() => loadTickets());
  const [filter, setFilter] = useState<"all" | TicketStatus>("all");
  const [openId, setOpenId] = useState<string | null>(tickets[0]?.id ?? null);
  const [reply, setReply] = useState("");

  const rows = useMemo(() => tickets.filter((t) => filter === "all" || t.status === filter), [tickets, filter]);
  const active = tickets.find((t) => t.id === openId) ?? null;

  const persist = (next: Ticket[]) => { setTickets(next); saveTickets(next); };
  const send = () => {
    if (!active || !reply.trim()) return;
    persist(tickets.map((t) => t.id === active.id ? { ...t, status: "pending", messages: [...t.messages, { from: "agent", text: reply.trim(), at: new Date().toISOString() }] } : t));
    setReply("");
  };
  const setStatus = (s: TicketStatus) => active && persist(tickets.map((t) => t.id === active.id ? { ...t, status: s } : t));

  return (
    <div className="agp">
      <div className="agp__head"><div><h2 className="agp__h">Поддержка</h2><p className="muted agp__sub">Тикеты всех клиентов — {tickets.filter((t) => t.status !== "closed").length} активных</p></div></div>

      <div className="sup">
        <div className="sup__list card">
          <div className="ag-seg sup__filter">
            {(["all", "open", "pending", "closed"] as const).map((s) => <button key={s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>{s === "all" ? "Все" : TICKET_STATUS_LABEL[s]}</button>)}
          </div>
          {rows.map((t) => (
            <button key={t.id} className={"sup__it" + (t.id === openId ? " on" : "")} onClick={() => setOpenId(t.id)}>
              <div className="sup__it-top"><b>{t.subject}</b><span className={"ag-badge " + STATUS_CLS[t.status]}>{TICKET_STATUS_LABEL[t.status]}</span></div>
              <span className="muted">{clientName(t.clientId)} · {t.category}</span>
              <span className="muted sup__preview">{t.messages[t.messages.length - 1]?.text}</span>
            </button>
          ))}
        </div>

        <div className="sup__thread card">
          {!active ? <div className="ag-empty">Выберите тикет.</div> : (
            <>
              <div className="sup__thread-h">
                <div><b>{active.subject}</b><br /><span className="muted">{clientName(active.clientId)} · Ответственный: {memberName(active.assigneeId)}</span></div>
                <div className="ag-cbtns">
                  {active.status !== "closed"
                    ? <button className="ag-cbtn" onClick={() => setStatus("closed")}><CheckCircle2 size={15} /> Закрыть</button>
                    : <button className="ag-cbtn" onClick={() => setStatus("open")}>Открыть</button>}
                </div>
              </div>
              <div className="sup__msgs">
                {active.messages.map((m, i) => (
                  <div key={i} className={"sup__msg sup__msg--" + m.from}>
                    <p>{m.text}</p>
                    <span className="muted">{m.from === "agent" ? "Вы" : clientName(active.clientId)} · {new Date(m.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
              <div className="sup__reply">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ответить клиенту…" onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }} />
                <button className="btn-primary" onClick={send} disabled={!reply.trim()}><Send size={15} /> Отправить</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
