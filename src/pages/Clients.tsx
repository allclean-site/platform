/** Клиенты — the agency's client registry. Search + filter, table/cards view, add a client. Each row
 * opens the fullscreen client card. Reads the mock agency data layer. */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, LayoutGrid, Rows3, ExternalLink, X, Users } from "lucide-react";
import { loadAClients, projectsOf, addAClient, memberName, type AClient, type Plan } from "../agency/data";
import "./agency-ui.css";
import "./clients.css";

export function Clients() {
  const nav = useNavigate();
  const [clients, setClients] = useState<AClient[]>(() => loadAClients());
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState<"all" | Plan>("all");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => clients.filter((c) => {
    if (plan !== "all" && c.plan !== plan) return false;
    if (q && !(`${c.name} ${c.company ?? ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }), [clients, q, plan]);

  const stat = (c: AClient) => {
    const ps = projectsOf(c.id);
    return { projects: ps.length, leads: ps.reduce((s, p) => s + p.leads7d, 0), tickets: ps.reduce((s, p) => s + p.openTickets, 0) };
  };
  const open = (id: string) => nav(`/app/agency/clients/${id}`);

  return (
    <div className="agp">
      <div className="agp__head">
        <div><h2 className="agp__h">Клиенты</h2><p className="muted agp__sub">{clients.length} клиентов в реестре</p></div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Новый клиент</button>
      </div>

      <div className="ag-toolbar">
        <div className="ag-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по названию…" /></div>
        <div className="ag-seg">
          {(["all", "pro", "free"] as const).map((p) => (
            <button key={p} className={plan === p ? "on" : ""} onClick={() => setPlan(p)}>{p === "all" ? "Все" : p.toUpperCase()}</button>
          ))}
        </div>
        <div className="ag-seg">
          <button className={view === "cards" ? "on" : ""} onClick={() => setView("cards")}><LayoutGrid size={15} /></button>
          <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Rows3 size={15} /></button>
        </div>
      </div>

      {adding && <NewClient onClose={() => setAdding(false)} onCreated={(c) => { setClients(loadAClients()); open(c.id); }} />}

      {rows.length === 0 ? <div className="card ag-empty">Ничего не найдено.</div> : view === "cards" ? (
        <div className="cl-grid">
          {rows.map((c) => {
            const s = stat(c);
            return (
              <div key={c.id} className="cl2 card" onClick={() => open(c.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && open(c.id)}>
                <div className="cl2__top">
                  <span className="ag-ava" style={{ background: c.accent }}>{c.initials}</span>
                  <span className={"ag-badge " + (c.plan === "pro" ? "ag-badge--pro" : "ag-badge--soft")}>{c.plan === "pro" ? "PRO" : "Free"}</span>
                </div>
                <h3 className="cl2__name">{c.name}</h3>
                <span className="muted cl2__company">{c.company ?? "—"}</span>
                <div className="cl2__stats">
                  <span><b>{s.projects}</b> проектов</span>
                  <span><b>{s.leads}</b> заявок·7д</span>
                  <span className={s.tickets ? "has-t" : ""}><b>{s.tickets}</b> тикетов</span>
                </div>
                <div className="cl2__foot muted">Менеджер: {memberName(c.managerId)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table className="ag-table">
            <thead><tr><th>Клиент</th><th>Тариф</th><th>Проекты</th><th>Заявки·7д</th><th>Тикеты</th><th>Менеджер</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => { const s = stat(c); return (
                <tr key={c.id} onClick={() => open(c.id)}>
                  <td><div className="ag-row-name"><span className="ag-ava" style={{ background: c.accent, width: 28, height: 28 }}>{c.initials}</span><div><b>{c.name}</b><br /><span className="muted" style={{ fontSize: 12 }}>{c.company ?? ""}</span></div></div></td>
                  <td><span className={"ag-badge " + (c.plan === "pro" ? "ag-badge--pro" : "ag-badge--soft")}>{c.plan === "pro" ? "PRO" : "Free"}</span></td>
                  <td>{s.projects}</td><td>{s.leads}</td><td className={s.tickets ? "has-t" : ""}>{s.tickets}</td><td className="muted">{memberName(c.managerId)}</td>
                  <td><ExternalLink size={15} className="muted" /></td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewClient({ onClose, onCreated }: { onClose: () => void; onCreated: (c: AClient) => void }) {
  const [name, setName] = useState(""); const [company, setCompany] = useState("");
  const [cName, setCName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim()) return;
    onCreated(addAClient({ name, company, contact: { name: cName, phone, email } }));
  };
  return (
    <>
      <div className="nc__scrim" onClick={onClose} />
      <form className="nc card" onSubmit={submit}>
        <div className="nc__head"><h3><Users size={18} /> Новый клиент</h3><button type="button" className="nc__x" onClick={onClose}><X size={18} /></button></div>
        <div className="nc__grid">
          <label className="fld"><span>Название *</span><input className="ci" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee Lab" /></label>
          <label className="fld"><span>Компания</span><input className="ci" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Coffee Lab SRL" /></label>
          <label className="fld"><span>Контактное лицо</span><input className="ci" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Radu" /></label>
          <label className="fld"><span>Телефон</span><input className="ci" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+40 …" /></label>
          <label className="fld nc__wide"><span>Email</span><input className="ci" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="radu@coffeelab.ro" /></label>
        </div>
        <div className="nc__act"><button type="button" className="btn-ghost" onClick={onClose}>Отмена</button><button type="submit" className="btn-primary">Создать и открыть</button></div>
      </form>
    </>
  );
}
