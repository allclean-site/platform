/** Заявки — cross-client leads feed. Every lead from every project in one filterable table. */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Phone, Calculator, FileText } from "lucide-react";
import { loadLeads, loadAClients, clientName, LEAD_STATUS_LABEL, type LeadStatus } from "../agency/data";
import "./agency-ui.css";

const STATUS_CLS: Record<LeadStatus, string> = { new: "ag-badge--info", in_work: "ag-badge--warn", done: "ag-badge--ok", lost: "ag-badge--soft" };

export function AgencyLeads() {
  const nav = useNavigate();
  const all = useMemo(() => loadLeads().slice().sort((a, b) => (a.at < b.at ? 1 : -1)), []);
  const clients = useMemo(() => loadAClients(), []);
  const [q, setQ] = useState("");
  const [client, setClient] = useState("all");
  const [status, setStatus] = useState<"all" | LeadStatus>("all");

  const rows = all.filter((l) => {
    if (client !== "all" && l.clientId !== client) return false;
    if (status !== "all" && l.status !== status) return false;
    if (q && !(`${l.name} ${l.phone} ${l.service}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="agp">
      <div className="agp__head"><div><h2 className="agp__h">Заявки</h2><p className="muted agp__sub">Все лиды по всем клиентам — {all.length}</p></div></div>

      <div className="ag-toolbar">
        <div className="ag-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Имя, телефон, услуга…" /></div>
        <select className="ci" style={{ width: "auto" }} value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="all">Все клиенты</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="ag-seg">
          {(["all", "new", "in_work", "done", "lost"] as const).map((s) => (
            <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s === "all" ? "Все" : LEAD_STATUS_LABEL[s]}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {rows.length === 0 ? <div className="ag-empty">Заявок не найдено.</div> : (
          <table className="ag-table">
            <thead><tr><th>Клиент</th><th>Имя</th><th>Телефон</th><th>Услуга</th><th>Источник</th><th>Оценка</th><th>Когда</th><th>Статус</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => nav(`/app/agency/clients/${l.clientId}`)}>
                  <td>{clientName(l.clientId)}</td>
                  <td><b>{l.name}</b></td>
                  <td><a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()} className="ag-link"><Phone size={13} /> {l.phone}</a></td>
                  <td>{l.service}</td>
                  <td><span className="ag-badge ag-badge--soft">{l.kind === "calculator" ? <><Calculator size={12} /> Калькулятор</> : <><FileText size={12} /> Форма</>}</span></td>
                  <td>{l.estimate ?? "—"}</td>
                  <td className="muted">{new Date(l.at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td><span className={"ag-badge " + STATUS_CLS[l.status]}>{LEAD_STATUS_LABEL[l.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
