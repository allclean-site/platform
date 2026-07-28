/** Команда — agency staff, roles, and which clients they manage. Mock CRUD. */

import React, { useState } from "react";
import { Plus, X, Mail, Shield } from "lucide-react";
import { loadTeam, saveTeam, loadAClients, type AMember } from "../agency/data";
import "./agency-ui.css";

const ROLE_LABEL: Record<AMember["role"], string> = { owner: "Владелец", admin: "Администратор", manager: "Менеджер", editor: "Редактор" };
const ROLE_CLS: Record<AMember["role"], string> = { owner: "ag-badge--pro", admin: "ag-badge--info", manager: "ag-badge", editor: "ag-badge--soft" };

export function AgencyTeam() {
  const [team, setTeam] = useState<AMember[]>(() => loadTeam());
  const [adding, setAdding] = useState(false);
  const clients = loadAClients();
  const managed = (id: string) => clients.filter((c) => c.managerId === id).length;
  const persist = (n: AMember[]) => { setTeam(n); saveTeam(n); };

  return (
    <div className="agp">
      <div className="agp__head"><div><h2 className="agp__h">Команда</h2><p className="muted agp__sub">{team.length} сотрудников агентства</p></div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Пригласить</button></div>

      {adding && <NewMember onClose={() => setAdding(false)} onAdd={(m) => { persist([...team, m]); setAdding(false); }} />}

      <div className="cl-grid">
        {team.map((m) => (
          <div key={m.id} className="cl2 card">
            <div className="cl2__top">
              <span className="ag-ava">{m.name.slice(0, 2).toUpperCase()}</span>
              <span className={"ag-badge " + ROLE_CLS[m.role]}><Shield size={11} /> {ROLE_LABEL[m.role]}</span>
            </div>
            <h3 className="cl2__name">{m.name}</h3>
            <span className="muted cl2__company"><Mail size={12} /> {m.email}</span>
            <div className="cl2__foot muted">Ведёт клиентов: {managed(m.id)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewMember({ onClose, onAdd }: { onClose: () => void; onAdd: (m: AMember) => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [role, setRole] = useState<AMember["role"]>("manager");
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!name.trim() || !email.trim()) return; onAdd({ id: "u" + Math.random().toString(36).slice(2, 7), name: name.trim(), email: email.trim(), role }); };
  return (
    <>
      <div className="nc__scrim" onClick={onClose} />
      <form className="nc card" onSubmit={submit}>
        <div className="nc__head"><h3>Пригласить сотрудника</h3><button type="button" className="nc__x" onClick={onClose}><X size={18} /></button></div>
        <div className="nc__grid">
          <label className="fld"><span>Имя *</span><input className="ci" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana" /></label>
          <label className="fld"><span>Роль</span><select className="ci" value={role} onChange={(e) => setRole(e.target.value as AMember["role"])}><option value="admin">Администратор</option><option value="manager">Менеджер</option><option value="editor">Редактор</option></select></label>
          <label className="fld nc__wide"><span>Email *</span><input className="ci" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ana@leadgenium.pro" /></label>
        </div>
        <div className="nc__act"><button type="button" className="btn-ghost" onClick={onClose}>Отмена</button><button type="submit" className="btn-primary">Пригласить</button></div>
      </form>
    </>
  );
}
