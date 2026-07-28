import React, { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Globe, Newspaper, Calculator, Users, BarChart3, LifeBuoy, Settings, Bell, Search,
  PanelLeft, ArrowLeft, LogOut,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle";
import { Logo } from "../components/Logo";
import { loadSettings } from "../settings/store";
import { hasPro, routeNeedsPro } from "../lib/plans";
import { useAuth } from "../auth/AuthContext";
import { getClient } from "../agency/store";
import "./shell.css";

const CLIENT_NAV = [
  { to: "/app", end: true, icon: LayoutDashboard, label: "Дашборд" },
  { to: "/app/sites", icon: Globe, label: "Сайты" },
  { to: "/app/blog", icon: Newspaper, label: "Блог" },
  { to: "/app/calculators", icon: Calculator, label: "Калькуляторы" },
  { to: "/app/crm", icon: Users, label: "CRM" },
  { to: "/app/analytics", icon: BarChart3, label: "Аналитика" },
  { to: "/app/support", icon: LifeBuoy, label: "Поддержка" },
  { to: "/app/settings", icon: Settings, label: "Настройки" },
];

const AGENCY_NAV = [
  { to: "/app/agency", end: true, icon: Users, label: "Клиенты" },
];

const TITLES: Record<string, string> = {
  "/app": "Дашборд", "/app/agency": "Клиенты", "/app/sites": "Сайты", "/app/blog": "Блог",
  "/app/calculators": "Калькуляторы", "/app/crm": "CRM", "/app/analytics": "Аналитика",
  "/app/support": "Поддержка", "/app/settings": "Настройки",
};

export function Shell() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { session, activeClientId, exitClient, signOut } = useAuth();
  const settings = loadSettings();
  const pro = hasPro(settings.plan, settings.subscription);

  const isAgency = session?.role === "agency";
  const inConsole = isAgency && !activeClientId; // agency staff without a client entered → console mode
  const onAgencyRoute = pathname.startsWith("/app/agency");

  // The editor needs horizontal room → auto-collapse the nav to an icon rail there (user can toggle).
  const isEditor = /^\/app\/sites\/[^/]+/.test(pathname);
  const [collapsed, setCollapsed] = useState(isEditor);
  const prevEditor = useRef(isEditor);
  useEffect(() => {
    if (isEditor !== prevEditor.current) { setCollapsed(isEditor); prevEditor.current = isEditor; }
  }, [isEditor]);
  const [userMenu, setUserMenu] = useState(false);

  // Role-based route protection (after all hooks so hook order stays stable).
  if (isAgency && !activeClientId && !onAgencyRoute) return <Navigate to="/app/agency" replace />;
  if (!isAgency && onAgencyRoute) return <Navigate to="/app" replace />;

  const menu = inConsole ? AGENCY_NAV : CLIENT_NAV;
  const client = getClient(activeClientId);

  // Resolve the section title by longest matching prefix so sub-routes (e.g. /app/calculators/:id) keep it.
  const title = TITLES[pathname]
    ?? Object.entries(TITLES).filter(([k]) => k !== "/app" && pathname.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0]?.[1]
    ?? (inConsole ? "Клиенты" : "Дашборд");

  const backToConsole = () => { exitClient(); nav("/app/agency"); };
  const doSignOut = () => { signOut(); nav("/"); };

  return (
    <div className={"shell" + (collapsed ? " shell--rail" : "")}>
      <aside className="sidebar glass">
        <NavLink to={inConsole ? "/app/agency" : "/app"} className="sidebar__brand">
          <Logo size={26} />
        </NavLink>

        {/* Agency-in-client context: which client's cabinet is open + a way back to the console. */}
        {isAgency && client && (
          <button className="ctxbar" onClick={backToConsole} title="Вернуться к списку клиентов">
            <span className="ctxbar__back"><ArrowLeft size={14} /></span>
            <span className="ctxbar__body">
              <span className="ctxbar__kicker">Проект клиента</span>
              <span className="ctxbar__name">{client.name}</span>
            </span>
          </button>
        )}

        <nav className="sidebar__nav">
          {menu.map((n) => (
            <NavLink key={n.to} to={n.to} end={(n as { end?: boolean }).end} title={n.label + (!pro && routeNeedsPro(n.to) ? " (тариф PRO)" : "")}
              className={({ isActive }) => "navitem" + (isActive ? " is-active" : "")}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {!pro && routeNeedsPro(n.to) && <span className="navitem__pro">PRO</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          {inConsole ? (
            <div className="plan card">
              <span className="badge badge--soft">Агентство</span>
              <p className="muted">{session?.name} · штат</p>
            </div>
          ) : (
            <NavLink to="/app/settings" className="plan card">
              <span className="badge badge--soft">{pro ? "PRO" : "Free"}</span>
              <p className="muted">{pro ? `Хостинг · ${settings.domain || "AllClean.md"}` : "Тариф Free · открыть PRO"}</p>
            </NavLink>
          )}
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
            <div className="usermenu">
              <button className="avatar" title={session?.name} onClick={() => setUserMenu((v) => !v)}>
                {session?.name?.[0]?.toUpperCase() ?? "?"}
              </button>
              {userMenu && (
                <>
                  <div className="usermenu__scrim" onClick={() => setUserMenu(false)} />
                  <div className="usermenu__pop card">
                    <div className="usermenu__id">
                      <b>{session?.name}</b>
                      <span className="muted">{session?.email}</span>
                      <span className="badge badge--soft usermenu__role">{isAgency ? "Сотрудник агентства" : "Клиент"}</span>
                    </div>
                    {isAgency && client && (
                      <button className="usermenu__item" onClick={() => { setUserMenu(false); backToConsole(); }}>
                        <ArrowLeft size={15} /> Все клиенты
                      </button>
                    )}
                    <button className="usermenu__item usermenu__item--danger" onClick={doSignOut}>
                      <LogOut size={15} /> Выйти
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
