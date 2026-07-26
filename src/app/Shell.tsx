import React, { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Globe, Newspaper, Calculator, Users, BarChart3, LifeBuoy, Settings, Bell, Search, PanelLeft,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo } from "../components/Logo";
import { loadSettings } from "../settings/store";
import { hasPro, routeNeedsPro } from "../lib/plans";
import "./shell.css";

const NAV = [
  { to: "/app", end: true, icon: LayoutDashboard, label: "Дашборд" },
  { to: "/app/sites", icon: Globe, label: "Сайты" },
  { to: "/app/blog", icon: Newspaper, label: "Блог" },
  { to: "/app/calculators", icon: Calculator, label: "Калькуляторы" },
  { to: "/app/crm", icon: Users, label: "CRM" },
  { to: "/app/analytics", icon: BarChart3, label: "Аналитика" },
  { to: "/app/support", icon: LifeBuoy, label: "Поддержка" },
  { to: "/app/settings", icon: Settings, label: "Настройки" },
];

const TITLES: Record<string, string> = {
  "/app": "Дашборд", "/app/sites": "Сайты", "/app/blog": "Блог", "/app/calculators": "Калькуляторы",
  "/app/crm": "CRM", "/app/analytics": "Аналитика", "/app/support": "Поддержка", "/app/settings": "Настройки",
};

export function Shell() {
  const { pathname } = useLocation();
  const settings = loadSettings();
  const pro = hasPro(settings.plan, settings.subscription);
  // Resolve the section title by longest matching prefix so sub-routes (e.g. /app/calculators/:id) keep it.
  const title = TITLES[pathname]
    ?? Object.entries(TITLES).filter(([k]) => k !== "/app" && pathname.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0]?.[1]
    ?? "Дашборд";
  // The editor needs horizontal room → auto-collapse the nav to an icon rail there (user can toggle).
  const isEditor = /^\/app\/sites\/[^/]+/.test(pathname);
  const [collapsed, setCollapsed] = useState(isEditor);
  const prevEditor = useRef(isEditor);
  useEffect(() => {
    if (isEditor !== prevEditor.current) { setCollapsed(isEditor); prevEditor.current = isEditor; }
  }, [isEditor]);

  return (
    <div className={"shell" + (collapsed ? " shell--rail" : "")}>
      <aside className="sidebar glass">
        <NavLink to="/" className="sidebar__brand">
          <Logo size={26} />
        </NavLink>
        <nav className="sidebar__nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} title={n.label + (!pro && routeNeedsPro(n.to) ? " (тариф PRO)" : "")}
              className={({ isActive }) => "navitem" + (isActive ? " is-active" : "")}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {!pro && routeNeedsPro(n.to) && <span className="navitem__pro">PRO</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <NavLink to="/app/settings" className="plan card">
            <span className="badge badge--soft">{pro ? "PRO" : "Free"}</span>
            <p className="muted">{pro ? `Хостинг · ${settings.domain || "AllClean.md"}` : "Тариф Free · открыть PRO"}</p>
          </NavLink>
        </div>
      </aside>

      <div className="shell__main">
        <header className="topbar glass">
          <button className="iconbtn rail-btn" title={collapsed ? "Развернуть меню" : "Свернуть меню"} onClick={() => setCollapsed((c) => !c)}>
            <PanelLeft size={18} />
          </button>
          <h1 className="topbar__title">{title}</h1>
          <div className="topbar__search">
            <Search size={17} />
            <input placeholder="Поиск…" />
          </div>
          <div className="topbar__actions">
            <ThemeToggle />
            <button className="iconbtn" title="Уведомления"><Bell size={18} /><span className="dot" /></button>
            <div className="avatar">S</div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
