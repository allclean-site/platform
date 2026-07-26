/**
 * Analytics — Google Analytics data in our design + a local "AI report" with advice.
 * Shows demo data (deterministic) until a GA id is connected in Settings → Интеграции; the report is
 * generated from the numbers. Charts are inline theme-aware SVG (area, donut, bars).
 */

import React, { useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Sparkles, ArrowUpRight, Users, MousePointerClick, Target,
  Clock, LogOut, Inbox, MapPin, Info,
} from "lucide-react";
import { demoData, buildInsights, type AnalyticsData, type Slice, type Insight, type FunnelStep } from "../analytics/data";
import { loadSettings } from "../settings/store";
import "./analytics.css";

const KPI_ICONS = [Users, MousePointerClick, Inbox, Target, Clock, LogOut];
const PERIODS = [7, 30, 90] as const;

export function Analytics() {
  const [days, setDays] = useState<number>(30);
  const data = useMemo(() => demoData(days), [days]);
  const report = useMemo(() => buildInsights(data), [data]);
  const gaConnected = !!loadSettings().integrations.gaId;

  return (
    <div className="an">
      <div className="an__head">
        <div className="an__head-l">
          <h2 className="an__title">Аналитика</h2>
          {gaConnected
            ? <span className="an-badge an-badge--live">Google Analytics</span>
            : <span className="an-badge an-badge--demo" title="Подключите GA в «Настройки → Интеграции» — здесь появятся реальные данные">Демо-данные</span>}
        </div>
        <div className="seg-mini">
          {PERIODS.map((p) => (
            <button key={p} className={"seg-mini__b" + (days === p ? " on" : "")} onClick={() => setDays(p)}>{p} дней</button>
          ))}
        </div>
      </div>

      <div className="an__kpis">
        {data.kpis.map((k, i) => {
          const Icon = KPI_ICONS[i] || Users;
          return (
            <div className="an-kpi card" key={k.label}>
              <div className="an-kpi__icon"><Icon size={18} /></div>
              <div className="an-kpi__meta">
                <span className="muted">{k.label}</span>
                <div className="an-kpi__row">
                  <b>{k.value}</b>
                  <span className={"an-kpi__delta " + (k.up ? "up" : "down")}>
                    {k.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{k.delta}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="an__grid">
        <div className="an__main">
          <div className="card an-card">
            <div className="an-card__head"><h3>Посещаемость</h3><span className="muted">{days} дней</span></div>
            <AreaChart data={data} />
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Воронка конверсии</h3><span className="muted">путь до заявки</span></div>
            <Funnel steps={data.funnel} />
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Эффективность каналов</h3></div>
            <div className="an-chan">
              <div className="an-chan__h"><span>Канал</span><span>Сеансы</span><span>Заявки</span><span>Конверсия</span></div>
              {data.channelPerf.map((c) => (
                <div className="an-chan__r" key={c.label}>
                  <span className="an-chan__name">{c.label}</span>
                  <span>{c.sessions.toLocaleString("ru-RU")}</span>
                  <span>{c.leads}</span>
                  <span className={"an-conv" + (c.conv >= 5 ? " good" : c.conv < 2 ? " bad" : "")}>{c.conv}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Источники трафика</h3></div>
            <Bars slices={data.sources} />
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Топ страниц</h3></div>
            <div className="an-pages">
              <div className="an-pages__h"><span>Страница</span><span>Просмотры</span><span>Конверсия</span></div>
              {data.topPages.map((p) => (
                <div className="an-pages__r" key={p.path}>
                  <div className="an-pages__page"><b>{p.title}</b><span className="muted">{p.path}</span></div>
                  <span>{p.views.toLocaleString("ru-RU")}</span>
                  <span className={"an-conv" + (p.conv >= 4 ? " good" : p.conv < 1 ? " bad" : "")}>{p.conv}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="an__side">
          <div className="card an-ai">
            <div className="an-ai__head"><Sparkles size={17} /> <h3>AI-отчёт</h3></div>
            <p className="an-ai__summary">{report.summary}</p>
            <ul className="an-ai__list">
              {report.insights.map((ins, i) => <InsightRow key={i} ins={ins} />)}
            </ul>
            <p className="an-ai__note"><Info size={12} /> Отчёт сформирован по данным сайта. Реальные данные — после подключения GA.</p>
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Устройства</h3></div>
            <Donut slices={data.devices} />
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Новые и вернувшиеся</h3></div>
            <div className="an-nr">
              <div className="an-nr__bar">
                <span className="an-nr__new" style={{ width: data.newReturning.newV + "%" }} />
                <span className="an-nr__ret" style={{ width: data.newReturning.returning + "%" }} />
              </div>
              <div className="an-nr__legend">
                <span><i className="an-nr__d an-nr__d--new" /> Новые {data.newReturning.newV}%</span>
                <span><i className="an-nr__d an-nr__d--ret" /> Вернулись {data.newReturning.returning}%</span>
              </div>
            </div>
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>События</h3></div>
            <div className="an-ev">
              {data.events.map((e) => (
                <div className="an-ev__r" key={e.label}><span>{e.label}</span><b>{e.count.toLocaleString("ru-RU")}</b></div>
              ))}
            </div>
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3>Страницы выхода</h3></div>
            <div className="an-ev">
              {data.exitPages.map((p) => (
                <div className="an-ev__r" key={p.path}>
                  <div className="an-ev__pg"><b>{p.title}</b><span className="muted">{p.path}</span></div>
                  <span className={"an-conv" + (p.rate >= 60 ? " bad" : "")} title="% выходов">{p.rate}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card an-card">
            <div className="an-card__head"><h3><MapPin size={15} /> География</h3></div>
            <div className="an-geo">
              {data.geo.map((g) => {
                const max = data.geo[0].visitors || 1;
                return (
                  <div className="an-geo__r" key={g.city}>
                    <span className="an-geo__city">{g.city}</span>
                    <div className="an-geo__bar"><span style={{ width: (g.visitors / max) * 100 + "%" }} /></div>
                    <span className="an-geo__n">{g.visitors.toLocaleString("ru-RU")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightRow({ ins }: { ins: Insight }) {
  const Icon = ins.kind === "up" ? TrendingUp : ins.kind === "down" ? TrendingDown : ArrowUpRight;
  return (
    <li className={"an-ins an-ins--" + ins.kind}>
      <span className="an-ins__i"><Icon size={13} /></span>
      <span>{ins.text}</span>
    </li>
  );
}

/* ---- Charts (theme-aware SVG) ---- */

function AreaChart({ data }: { data: AnalyticsData }) {
  const pts = data.series.map((p) => p.visitors);
  const w = 640, h = 180, pad = 6;
  const max = Math.max(...pts, 1) * 1.1;
  const step = (w - pad * 2) / (pts.length - 1 || 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const line = pts.map((v, i) => `${pad + i * step},${y(v)}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${pad + (pts.length - 1) * step},${h - pad}`;
  const grid = [0.25, 0.5, 0.75].map((f) => h - pad - f * (h - pad * 2));
  const labels = [0, Math.floor(pts.length / 2), pts.length - 1].map((i) => ({ x: pad + i * step, d: data.series[i]?.date.slice(5) }));
  const last = pts.length - 1;

  return (
    <div className="an-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="an-chart__svg">
        <defs>
          <linearGradient id="ang" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {grid.map((gy, i) => <line key={i} x1={pad} y1={gy} x2={w - pad} y2={gy} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
        <polygon points={area} fill="url(#ang)" />
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={pad + last * step} cy={y(pts[last])} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="an-chart__x">{labels.map((l, i) => <span key={i}>{l.d}</span>)}</div>
    </div>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  return (
    <div className="an-fun">
      {steps.map((s, i) => (
        <div className="an-fun__step" key={s.label}>
          <div className="an-fun__row">
            <span className="an-fun__label">{s.label}</span>
            <span className="an-fun__count">{s.count.toLocaleString("ru-RU")} <em>{s.rate}%</em></span>
          </div>
          <div className="an-fun__bar"><span style={{ width: Math.max(s.rate, 2) + "%" }} /></div>
          {i < steps.length - 1 && steps[i + 1].drop > 0 && (
            <div className={"an-fun__drop" + (steps[i + 1].drop >= 55 ? " hot" : "")}>↓ −{steps[i + 1].drop}% уходят</div>
          )}
        </div>
      ))}
    </div>
  );
}

function Bars({ slices }: { slices: Slice[] }) {
  const max = Math.max(...slices.map((s) => s.value), 1);
  return (
    <div className="an-bars">
      {slices.map((s) => (
        <div className="an-bar" key={s.label}>
          <span className="an-bar__l">{s.label}</span>
          <div className="an-bar__track"><span style={{ width: (s.value / max) * 100 + "%", background: s.cssColor }} /></div>
          <span className="an-bar__v">{s.value}%</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ slices }: { slices: Slice[] }) {
  const R = 54, C = 2 * Math.PI * R, sw = 18;
  let acc = 0;
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="an-donut">
      <svg viewBox="0 0 140 140" className="an-donut__svg">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={sw} />
        <g transform="rotate(-90 70 70)">
          {slices.map((s) => {
            const len = (s.value / total) * C;
            const el = (
              <circle key={s.label} cx="70" cy="70" r={R} fill="none" stroke={s.cssColor} strokeWidth={sw}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} strokeLinecap="butt" />
            );
            acc += len;
            return el;
          })}
        </g>
        <text x="70" y="66" textAnchor="middle" className="an-donut__big">{slices[0].value}%</text>
        <text x="70" y="84" textAnchor="middle" className="an-donut__sm">{slices[0].label}</text>
      </svg>
      <div className="an-donut__legend">
        {slices.map((s) => (
          <div className="an-leg" key={s.label}><span className="an-leg__dot" style={{ background: s.cssColor }} />{s.label} <b>{s.value}%</b></div>
        ))}
      </div>
    </div>
  );
}
