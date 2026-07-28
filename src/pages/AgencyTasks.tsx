/** Задачи — agency task board across all clients. Columns todo/doing/done; click a card to advance. */

import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { loadTasks, saveTasks, loadAClients, clientName, memberName, loadTeam, type ATask, type Priority } from "../agency/data";
import "./agency-ui.css";
import "./agency-tasks.css";

const COLS: { id: ATask["status"]; label: string }[] = [
  { id: "todo", label: "К выполнению" }, { id: "doing", label: "В работе" }, { id: "done", label: "Готово" },
];
const NEXT: Record<ATask["status"], ATask["status"]> = { todo: "doing", doing: "done", done: "todo" };
const PRIO_LABEL: Record<Priority, string> = { high: "Срочно", med: "Средне", low: "Низкий" };

export function AgencyTasks() {
  const [tasks, setTasks] = useState<ATask[]>(() => loadTasks());
  const [adding, setAdding] = useState(false);
  const persist = (n: ATask[]) => { setTasks(n); saveTasks(n); };
  const advance = (id: string) => persist(tasks.map((t) => t.id === id ? { ...t, status: NEXT[t.status] } : t));

  return (
    <div className="agp">
      <div className="agp__head"><div><h2 className="agp__h">Задачи</h2><p className="muted agp__sub">{tasks.filter((t) => t.status !== "done").length} активных задач по всем клиентам</p></div>
        <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Задача</button></div>

      {adding && <NewTask onClose={() => setAdding(false)} onAdd={(t) => { persist([t, ...tasks]); setAdding(false); }} />}

      <div className="tsk">
        {COLS.map((col) => {
          const items = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="tsk__col">
              <div className="tsk__col-h">{col.label} <span className="tsk__count">{items.length}</span></div>
              {items.map((t) => (
                <button key={t.id} className="tsk__card card" onClick={() => advance(t.id)} title="Клик — следующий статус">
                  <span className={"pp__prio pp__prio--" + t.priority}>{PRIO_LABEL[t.priority]}</span>
                  <p>{t.title}</p>
                  <div className="tsk__meta muted">
                    <span>{t.clientId ? clientName(t.clientId) : "Агентство"}</span>
                    <span>{memberName(t.assigneeId)}</span>
                  </div>
                  {t.due && <span className="muted tsk__due">до {new Date(t.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewTask({ onClose, onAdd }: { onClose: () => void; onAdd: (t: ATask) => void }) {
  const [title, setTitle] = useState(""); const [clientId, setClientId] = useState(""); const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>("med"); const [due, setDue] = useState("");
  const clients = loadAClients(); const team = loadTeam();
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!title.trim()) return; onAdd({ id: "t" + Math.random().toString(36).slice(2, 8), title: title.trim(), clientId: clientId || undefined, assigneeId: assigneeId || undefined, due: due || undefined, priority, status: "todo" }); };
  return (
    <>
      <div className="nc__scrim" onClick={onClose} />
      <form className="nc card" onSubmit={submit}>
        <div className="nc__head"><h3>Новая задача</h3><button type="button" className="nc__x" onClick={onClose}><X size={18} /></button></div>
        <div className="nc__grid">
          <label className="fld nc__wide"><span>Задача *</span><input className="ci" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Опубликовать статью" /></label>
          <label className="fld"><span>Клиент</span><select className="ci" value={clientId} onChange={(e) => setClientId(e.target.value)}><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="fld"><span>Ответственный</span><select className="ci" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}><option value="">—</option>{team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="fld"><span>Приоритет</span><select className="ci" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}><option value="high">Срочно</option><option value="med">Средне</option><option value="low">Низкий</option></select></label>
          <label className="fld"><span>Срок</span><input className="ci" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        </div>
        <div className="nc__act"><button type="button" className="btn-ghost" onClick={onClose}>Отмена</button><button type="submit" className="btn-primary">Добавить</button></div>
      </form>
    </>
  );
}
