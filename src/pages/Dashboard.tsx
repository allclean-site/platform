import React from "react";
import { TrendingUp, TrendingDown, Inbox, Eye, Target, Newspaper, ArrowUpRight } from "lucide-react";
import "./dashboard.css";

const KPIS = [
  { icon: Inbox, label: "Заявки за 7 дней", value: "38", delta: "+12%", up: true },
  { icon: Eye, label: "Посетители", value: "4 210", delta: "+8%", up: true },
  { icon: Target, label: "Конверсия", value: "3,4%", delta: "-0,3%", up: false },
  { icon: Newspaper, label: "Статьи в блоге", value: "17", delta: "+2", up: true },
];

const LEADS = [
  { name: "Ирина М.", svc: "Уборка квартиры", time: "12 мин назад", status: "Новая" },
  { name: "Офис «Норд»", svc: "Уборка офиса", time: "1 ч назад", status: "В работе" },
  { name: "Андрей П.", svc: "После ремонта", time: "3 ч назад", status: "Новая" },
  { name: "ТЦ «Плаза»", svc: "Мойка фасадов", time: "вчера", status: "Заказ" },
];

export function Dashboard() {
  return (
    <div className="dash">
      <div className="dash__kpis">
        {KPIS.map((k) => (
          <div className="card kpi" key={k.label}>
            <div className="kpi__icon"><k.icon size={20} /></div>
            <div className="kpi__meta">
              <span className="muted">{k.label}</span>
              <div className="kpi__row">
                <b>{k.value}</b>
                <span className={"kpi__delta " + (k.up ? "up" : "down")}>
                  {k.up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{k.delta}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash__grid">
        <div className="card dash__chart">
          <div className="dash__cardhead">
            <h3>Посещаемость</h3>
            <span className="badge badge--soft">30 дней</span>
          </div>
          <Sparkline />
          <p className="muted dash__hint">Данные из Google Analytics появятся здесь после подключения в «Настройках».</p>
        </div>

        <div className="card dash__leads">
          <div className="dash__cardhead">
            <h3>Последние заявки</h3>
            <a className="dash__more" href="/app/crm">Все <ArrowUpRight size={14} /></a>
          </div>
          <ul className="leads">
            {LEADS.map((l, i) => (
              <li key={i} className="lead">
                <div className="lead__ava">{l.name[0]}</div>
                <div className="lead__body">
                  <b>{l.name}</b>
                  <span className="muted">{l.svc}</span>
                </div>
                <div className="lead__side">
                  <span className={"badge lead__status s-" + l.status}>{l.status}</span>
                  <span className="muted lead__time">{l.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* Lightweight inline sparkline (placeholder until real analytics). */
function Sparkline() {
  const pts = [12, 18, 15, 24, 20, 32, 28, 40, 36, 48, 44, 60];
  const w = 560, h = 130, max = 64;
  const step = w / (pts.length - 1);
  const line = pts.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#g)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
