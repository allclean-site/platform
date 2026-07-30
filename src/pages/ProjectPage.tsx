/** Страница проекта — health dashboard + SEO tracking + tasks + module shortcuts for one project.
 * Stage and payment are set by staff here (updateProject). */

import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Globe, Gauge, Rocket, ShieldCheck, TrendingUp, Search, Target, CheckCircle2, ListChecks,
  Pencil, Newspaper, Calculator, Users, BarChart3, Settings, CircleDot, ScrollText, AlertCircle, AlertTriangle, Info,
} from "lucide-react";
import {
  getProject, getAClient, loadTasks, updateProject, logsOf, STAGE_LABEL, STAGE_ORDER, clientName, eur,
  type Stage, type Priority, type LogLevel,
} from "../agency/data";
import { useAuth } from "../auth/AuthContext";
import "./agency-ui.css";
import "./project-page.css";

const PRIO_LABEL: Record<Priority, string> = { high: "Срочно", med: "Средне", low: "Низкий" };
const LOG_ICON: Record<LogLevel, React.ElementType> = { error: AlertCircle, warn: AlertTriangle, info: Info };
const metricTone = (v: number | undefined, good: number, ok: number) => v == null ? "" : v <= good ? "ok" : v <= ok ? "warn" : "danger";

export function ProjectPage() {
  const { clientId = "", projectId = "" } = useParams();
  const nav = useNavigate();
  const [tick, force] = useState(0);
  const project = useMemo(() => getProject(projectId), [projectId, tick]);
  const client = getAClient(clientId);
  const tasks = useMemo(() => loadTasks().filter((t) => t.projectId === projectId && t.status !== "done"), [projectId]);
  const logs = useMemo(() => logsOf(projectId), [projectId]);
  const { enterClient } = useAuth();

  if (!project) return <div className="agp"><button className="ag-back" onClick={() => nav(`/app/agency/clients/${clientId}`)}><ArrowLeft size={14} /> Назад</button><div className="card ag-empty">Проект не найден.</div></div>;

  const h = project.health, seo = project.seo;
  const pct = project.priceTotal ? Math.round((project.pricePaid / project.priceTotal) * 100) : 0;
  const setStage = (s: Stage) => { updateProject(project.id, { stage: s }); force((x) => x + 1); };
  const setPaid = (v: number) => { updateProject(project.id, { pricePaid: v }); force((x) => x + 1); };

  // Each module opens the CLIENT's own section (we enter the client's cabinet on this project),
  // exactly the screen the client sees. Редактор needs a published site slug.
  const openClientSection = (to: string) => { enterClient(clientId); nav(to); };
  const modules = [
    { icon: Pencil, label: "Редактор", to: project.siteSlug ? `/app/sites/${project.siteSlug}` : null },
    { icon: Newspaper, label: "Блог", to: "/app/blog" },
    { icon: Calculator, label: "Калькуляторы", to: "/app/calculators" },
    { icon: Users, label: "CRM", to: "/app/crm" },
    { icon: BarChart3, label: "Аналитика", to: "/app/analytics" },
    { icon: Settings, label: "Настройки", to: "/app/settings" },
  ];
  const logErrors = logs.filter((l) => l.level === "error").length;
  const logWarns = logs.filter((l) => l.level === "warn").length;

  return (
    <div className="agp pp">
      <button className="ag-back" onClick={() => nav(`/app/agency/clients/${clientId}`)}><ArrowLeft size={14} /> {clientName(clientId)}</button>

      <div className="pp__head card">
        <div className="pp__id">
          <div className="pp__badges"><span className="ag-badge ag-badge--soft">{project.type}</span><span className={"ag-badge stage-" + project.stage}>{STAGE_LABEL[project.stage]}</span></div>
          <h2 className="pp__title">{project.title}</h2>
          <span className="muted">{client?.name}{project.siteSlug ? ` · ${project.siteSlug}` : ""}</span>
        </div>
        <div className="pp__controls">
          <label className="pp__ctl"><span className="muted">Этап</span>
            <select className="ci" value={project.stage} onChange={(e) => setStage(e.target.value as Stage)}>
              {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="pp__ctl"><span className="muted">Оплачено, €</span>
            <input className="ci" type="number" value={project.pricePaid} onChange={(e) => setPaid(Number(e.target.value))} />
          </label>
          <div className="pp__money">
            <b>{eur(project.pricePaid)} / {eur(project.priceTotal)} €</b>
            <div className="ag-money"><div className="bar"><span style={{ width: `${pct}%` }} /></div></div>
          </div>
        </div>
      </div>

      {/* Health */}
      <section>
        <div className="pp__sec-h"><Gauge size={16} /> Здоровье сайта</div>
        <div className="pp__health">
          <HealthCard icon={Globe} label="Статус" value={h.online ? "Онлайн" : "Офлайн"} tone={h.online ? "ok" : "danger"} />
          <HealthCard icon={Gauge} label="LCP" value={h.lcpMs ? `${(h.lcpMs / 1000).toFixed(1)} c` : "—"} tone={metricTone(h.lcpMs, 2500, 4000)} />
          <HealthCard icon={Target} label="INP" value={h.inpMs ? `${h.inpMs} мс` : "—"} tone={metricTone(h.inpMs, 200, 500)} />
          <HealthCard icon={CircleDot} label="CLS" value={h.cls != null ? h.cls.toFixed(2) : "—"} tone={metricTone(h.cls != null ? h.cls * 1000 : undefined, 100, 250)} />
          <HealthCard icon={Rocket} label="Публикация" value={h.lastPublish ? new Date(h.lastPublish).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"} tone="" />
          <HealthCard icon={ShieldCheck} label="Домен / SSL" value={h.domainStatus === "connected" ? `${h.sslDaysLeft ?? "—"} дн` : h.domainStatus === "pending" ? "Ожидает" : "Ошибка"} tone={h.domainStatus === "connected" ? ((h.sslDaysLeft ?? 99) <= 14 ? "warn" : "ok") : h.domainStatus === "error" ? "danger" : "warn"} />
        </div>
        {h.publishFailed && <div className="pp__alert">⚠ Последняя публикация завершилась с ошибкой — проверьте деплой.</div>}
      </section>

      {/* SEO */}
      <section>
        <div className="pp__sec-h"><TrendingUp size={16} /> SEO-здоровье и трекинг</div>
        {seo ? (
          <div className="pp__seo">
            <div className="card pp__seo-metrics">
              <div className="pp__seo-score"><div className={"pp__ring pp__ring--" + (seo.score! >= 80 ? "ok" : seo.score! >= 60 ? "warn" : "danger")} style={{ ["--v" as string]: (seo.score ?? 0) / 100 } as React.CSSProperties}><b>{seo.score}</b><span>score</span></div></div>
              <div className="pp__seo-nums">
                <div><b>{seo.keywordsTracked ?? "—"}</b><span className="muted">запросов в трекинге</span></div>
                <div><b>{seo.avgPosition ?? "—"}</b><span className="muted">средняя позиция</span></div>
                <div><b>{seo.traffic30d ? eur(seo.traffic30d) : "—"}</b><span className="muted">трафик / 30 дней</span></div>
              </div>
            </div>
            <div className="card pp__seo-list">
              <div className="pp__seo-list-h pp__ok"><CheckCircle2 size={15} /> Успехи (что сделано)</div>
              <ul>{seo.wins.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div className="card pp__seo-list">
              <div className="pp__seo-list-h pp__todo"><Search size={15} /> Рекомендации (что дальше)</div>
              <ul className="pp__todos">{seo.todos.map((t, i) => <li key={i}><span className={"pp__prio pp__prio--" + t.priority}>{PRIO_LABEL[t.priority]}</span>{t.title}</li>)}</ul>
            </div>
          </div>
        ) : <div className="card ag-empty">SEO-трекинг ещё не подключён для этого проекта.</div>}
      </section>

      {/* Tasks */}
      <section className="card pp__tasks">
        <div className="pp__sec-h"><ListChecks size={16} /> Задачи проекта</div>
        {tasks.length === 0 ? <p className="muted" style={{ margin: 0 }}>Активных задач нет.</p> : (
          <ul className="pp__tasklist">
            {tasks.map((t) => (
              <li key={t.id}><span className={"pp__prio pp__prio--" + t.priority}>{PRIO_LABEL[t.priority]}</span><span>{t.title}</span>{t.due && <span className="muted pp__due">до {new Date(t.due).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Logs — agency-only technical journal (errors & problems) */}
      <section className="card pp__logs">
        <div className="pp__sec-h pp__logs-h">
          <span><ScrollText size={16} /> Логи</span>
          <span className="pp__logs-count">
            {logErrors > 0 && <span className="pp__lc pp__lc--error">{logErrors} ошибок</span>}
            {logWarns > 0 && <span className="pp__lc pp__lc--warn">{logWarns} предупр.</span>}
            {logErrors === 0 && logWarns === 0 && <span className="pp__lc pp__lc--ok">без ошибок</span>}
          </span>
        </div>
        {logs.length === 0 ? <p className="muted" style={{ margin: 0 }}>Записей нет.</p> : (
          <ul className="pp__loglist">
            {logs.map((l) => {
              const Icon = LOG_ICON[l.level];
              return (
                <li key={l.id} className={"pp__log pp__log--" + l.level + (l.resolved ? " is-resolved" : "")}>
                  <span className="pp__log-ic"><Icon size={15} /></span>
                  <div className="pp__log-body">
                    <div className="pp__log-top"><span className="pp__log-cat">{l.category}</span><span className="muted pp__log-at">{new Date(l.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
                    <p className="pp__log-msg">{l.message}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Module shortcuts — open the client's own section for this project */}
      <section>
        <div className="pp__sec-h"><Globe size={16} /> Разделы проекта <span className="muted pp__sec-hint">— открываются как у клиента</span></div>
        <div className="pp__mods">
          {modules.map((m) => (
            <button key={m.label} className="pp__mod" disabled={!m.to} title={m.to ? "Открыть раздел клиента" : "Сайт ещё не опубликован"} onClick={() => m.to && openClientSection(m.to)}>
              <m.icon size={20} /><span>{m.label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone: string }) {
  return (
    <div className={"card pp-hc pp-hc--" + (tone || "none")}>
      <div className="pp-hc__ic"><Icon size={17} /></div>
      <div className="pp-hc__meta"><span className="muted">{label}</span><b>{value}</b></div>
    </div>
  );
}
