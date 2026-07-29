/**
 * Agency Обзор — the command center an agency employee lands on. Situational awareness across ALL
 * clients: what needs attention today, aggregate KPIs, activity feed, upcoming tasks. Reads the mock
 * agency data layer (agency/data.ts); wires to real data on the backend phase.
 */

import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users, FolderKanban, Inbox, LifeBuoy, Wallet, Rocket, TrendingUp, UserPlus, CheckSquare, AlertTriangle,
  Globe, ArrowRight, CircleDot,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { overview, clientName, eur, STAGE_LABEL, type EventKind, type Priority } from "../agency/data";
import "./agency-home.css";

const GREET = () => {
  const h = new Date().getHours();
  return h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
};

const EVENT_ICON: Record<EventKind, React.ElementType> = {
  lead: Inbox, publish: Rocket, ticket: LifeBuoy, task: CheckSquare, seo: TrendingUp, client: UserPlus,
};

const PRIO_LABEL: Record<Priority, string> = { high: "Срочно", med: "Средне", low: "Низкий" };

function timeAgo(iso: string): string {
  const d = new Date(iso), now = new Date();
  const min = Math.round((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function AgencyHome() {
  const { session } = useAuth();
  const nav = useNavigate();
  const ov = useMemo(() => overview(), []);
  const paidPct = ov.kpis.priceTotal ? Math.round((ov.kpis.pricePaid / ov.kpis.priceTotal) * 100) : 0;
  const today = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="ah">
      <div className="ah__greet">
        <div>
          <h2 className="ah__h">{GREET()}, {session?.name?.split(" ")[0] ?? ""}</h2>
          <p className="muted ah__date">Сводка по всем клиентам · {today}</p>
        </div>
        <button className="btn-primary" onClick={() => nav("/app/agency/clients")}>
          <Users size={16} /> Все клиенты
        </button>
      </div>

      {/* KPI row */}
      <div className="ah__kpis">
        <Kpi icon={Users} label="Клиентов" value={ov.kpis.clients} to={{ label: "Все клиенты", path: "/app/agency/clients" }} />
        <Kpi icon={FolderKanban} label="Проектов" value={ov.kpis.projects} to={{ label: `${ov.kpis.activeSites} из ${ov.kpis.projects} онлайн`, path: "/app/agency/clients" }} />
        <Kpi icon={Inbox} label="Заявок · 7 дней" value={ov.kpis.leads7d} accent to={{ label: "Смотреть заявки", path: "/app/agency/leads" }} />
        <Kpi icon={LifeBuoy} label="Открытых тикетов" value={ov.kpis.openTickets} tone={ov.kpis.openTickets ? "warn" : undefined} to={{ label: "Поддержка", path: "/app/agency/support" }} />
        <div className="card ah-kpi ah-kpi--money">
          <div className="ah-kpi__top">
            <span className="ah-kpi__icon"><Wallet size={18} /></span>
            <span className="ah-kpi__label">Оплачено / всего</span>
          </div>
          <div className="ah-kpi__val">{eur(ov.kpis.pricePaid)} / {eur(ov.kpis.priceTotal)} €</div>
          <div className="ah-kpi__moneyfoot">
            <div className="ah-kpi__bar"><span style={{ width: `${paidPct}%` }} /></div>
            <span className="muted">{paidPct}% оплачено</span>
          </div>
        </div>
      </div>

      {/* Attention */}
      <section className="ah__attn">
        <div className="ah__section-h"><AlertTriangle size={16} /> Требует внимания</div>
        <div className="ah__attn-row">
          {ov.attention.map((a) => (
            <button key={a.id} className={"ah-attn ah-attn--" + a.tone} onClick={() => nav(a.id === "leads" ? "/app/agency/leads" : a.id === "tickets" ? "/app/agency/support" : a.id === "tasks" ? "/app/agency/tasks" : "/app/agency/clients")}>
              <b>{a.count}</b>
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="ah__grid">
        {/* Activity feed */}
        <section className="card ah__feed">
          <div className="ah__section-h">Лента активности</div>
          <ul className="ah-feed">
            {ov.events.map((e) => {
              const Icon = EVENT_ICON[e.kind];
              return (
                <li key={e.id} className="ah-feed__it">
                  <span className={"ah-feed__ic ah-feed__ic--" + e.kind}><Icon size={15} /></span>
                  <div className="ah-feed__body">
                    <p>{e.text}</p>
                    <span className="muted">{clientName(e.clientId)} · {timeAgo(e.at)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Upcoming tasks */}
        <section className="card ah__tasks">
          <div className="ah__section-h">Ближайшие задачи</div>
          <ul className="ah-tasks">
            {ov.tasks.map((t) => (
              <li key={t.id} className="ah-task">
                <span className={"ah-task__prio ah-task__prio--" + t.priority} title={PRIO_LABEL[t.priority]}><CircleDot size={13} /></span>
                <div className="ah-task__body">
                  <p>{t.title}</p>
                  <span className="muted">{t.clientId ? clientName(t.clientId) : "Агентство"}{t.due ? ` · до ${new Date(t.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}` : ""}</span>
                </div>
              </li>
            ))}
          </ul>
          <button className="ah__more" onClick={() => nav("/app/agency/tasks")}>Все задачи <ArrowRight size={14} /></button>
        </section>
      </div>

      {/* Projects by stage */}
      <section className="card ah__projects">
        <div className="ah__section-h"><Globe size={16} /> Проекты</div>
        <div className="ah-proj-grid">
          {ov.projects.map((p) => {
            const pct = p.priceTotal ? Math.round((p.pricePaid / p.priceTotal) * 100) : 0;
            return (
              <button key={p.id} className="ah-proj" onClick={() => nav(`/app/agency/clients/${p.clientId}`)}>
                <div className="ah-proj__top">
                  <span className="ah-proj__type">{p.type}</span>
                  <span className={"ah-proj__stage ah-proj__stage--" + p.stage}>{STAGE_LABEL[p.stage]}</span>
                </div>
                <h4 className="ah-proj__title">{p.title}</h4>
                <span className="muted ah-proj__client">{clientName(p.clientId)}</span>
                <div className="ah-proj__foot">
                  <span className="ah-proj__money">{eur(p.pricePaid)} / {eur(p.priceTotal)} €</span>
                  <div className="ah-proj__bar"><span style={{ width: `${pct}%` }} /></div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, to, accent, tone }: { icon: React.ElementType; label: string; value: number; sub?: string; to?: { label: string; path: string }; accent?: boolean; tone?: "warn" }) {
  return (
    <div className={"card ah-kpi" + (accent ? " ah-kpi--accent" : "")}>
      <div className="ah-kpi__top">
        <span className={"ah-kpi__icon" + (tone === "warn" ? " is-warn" : "")}><Icon size={18} /></span>
        <span className="ah-kpi__label">{label}</span>
      </div>
      <div className="ah-kpi__val">{value}{sub && <em className="ah-kpi__sub">{sub}</em>}</div>
      {to && <Link className="ah-kpi__foot" to={to.path}>{to.label} <ArrowRight size={14} /></Link>}
    </div>
  );
}
