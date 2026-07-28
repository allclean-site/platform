/**
 * Agency console — the landing view for agency staff. A cross-client overview: aggregate KPIs, then a
 * grid of client projects. "Войти" enters a client's cabinet (scopes the rest of the app to that tenant).
 * This is what an agency employee sees that a client never does.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Globe, Inbox, LifeBuoy, ExternalLink, Plus, LogIn, Trash2, X,
} from "lucide-react";
import { loadClients, addClient, removeClient, type Client, type SiteStatus } from "../agency/store";
import { useAuth } from "../auth/AuthContext";
import "./agency.css";

const STATUS: Record<SiteStatus, { label: string; cls: string }> = {
  live: { label: "Опубликован", cls: "st-live" },
  draft: { label: "Черновик", cls: "st-draft" },
  building: { label: "В разработке", cls: "st-building" },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch { return iso; }
}

export function Agency() {
  const { session, enterClient } = useAuth();
  const nav = useNavigate();
  const [clients, setClients] = useState<Client[]>(() => loadClients());
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");

  const kpis = useMemo(() => ({
    total: clients.length,
    live: clients.filter((c) => c.siteStatus === "live").length,
    leads: clients.reduce((s, c) => s + c.leads7d, 0),
    tickets: clients.reduce((s, c) => s + c.openTickets, 0),
  }), [clients]);

  const open = (id: string) => { enterClient(id); nav("/app"); };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const c = addClient(name, domain || `${name.trim().toLowerCase().replace(/\s+/g, "")}.md`);
    setClients(loadClients());
    setName(""); setDomain(""); setAdding(false);
    open(c.id);
  };

  const del = (e: React.MouseEvent, c: Client) => {
    e.stopPropagation();
    if (!confirm(`Удалить клиента «${c.name}» из реестра? Сайт и данные не трогаются.`)) return;
    removeClient(c.id);
    setClients(loadClients());
  };

  return (
    <div className="agency">
      <div className="agency__head">
        <div>
          <h2 className="agency__h">Клиенты агентства</h2>
          <p className="muted">Добро пожаловать, {session?.name}. Выберите проект, чтобы открыть его кабинет.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding((v) => !v)}>
          <Plus size={16} /> Новый клиент
        </button>
      </div>

      <div className="agency__kpis">
        <Kpi icon={Users} label="Клиентов" value={kpis.total} />
        <Kpi icon={Globe} label="Активных сайтов" value={kpis.live} />
        <Kpi icon={Inbox} label="Заявок за 7 дней" value={kpis.leads} />
        <Kpi icon={LifeBuoy} label="Открытых тикетов" value={kpis.tickets} tone={kpis.tickets ? "warn" : undefined} />
      </div>

      {adding && (
        <form className="agency__add card" onSubmit={create}>
          <div className="agency__add-row">
            <label>
              <span>Название</span>
              <input value={name} autoFocus placeholder="Напр. Coffee Lab" onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              <span>Домен</span>
              <input value={domain} placeholder="coffeelab.md" onChange={(e) => setDomain(e.target.value)} />
            </label>
          </div>
          <div className="agency__add-act">
            <button type="button" className="btn-ghost" onClick={() => setAdding(false)}><X size={15} /> Отмена</button>
            <button type="submit" className="btn-primary">Создать и открыть</button>
          </div>
        </form>
      )}

      <div className="agency__grid">
        {clients.map((c) => {
          const st = STATUS[c.siteStatus];
          return (
            <div key={c.id} className="cl-card card" onClick={() => open(c.id)} role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") open(c.id); }}>
              <div className="cl-card__top">
                <span className="cl-card__ava" style={c.accent ? { background: c.accent } : undefined}>{c.initials}</span>
                <div className="cl-card__badges">
                  <span className={"badge " + (c.plan === "pro" ? "badge--pro" : "badge--soft")}>{c.plan === "pro" ? "PRO" : "Free"}</span>
                  <button className="cl-card__del" title="Убрать из реестра" onClick={(e) => del(e, c)}><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 className="cl-card__name">{c.name}</h3>
              <a className="cl-card__domain" href={`https://${c.domain}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}>
                {c.domain} <ExternalLink size={12} />
              </a>
              <div className="cl-card__meta">
                <span className={"cl-st " + st.cls}>{st.label}</span>
                <span className="muted">Публикация: {fmtDate(c.lastPublish)}</span>
              </div>
              <div className="cl-card__stats">
                <span><b>{c.leads7d}</b> заявок / 7дн</span>
                <span className={c.openTickets ? "has-tickets" : ""}><b>{c.openTickets}</b> тикетов</span>
                <span>{c.hosting === "ours" ? "Хостинг наш" : "Хостинг клиента"}</span>
              </div>
              <button className="cl-card__enter" onClick={(e) => { e.stopPropagation(); open(c.id); }}>
                <LogIn size={15} /> Войти в проект
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone?: "warn" }) {
  return (
    <div className="card ag-kpi">
      <div className={"ag-kpi__icon" + (tone === "warn" ? " is-warn" : "")}><Icon size={19} /></div>
      <div className="ag-kpi__meta">
        <span className="muted">{label}</span>
        <b>{value}</b>
      </div>
    </div>
  );
}
