import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./Shell";
import { Landing } from "../pages/Landing";
import { Dashboard } from "../pages/Dashboard";
import { Placeholder } from "../pages/Placeholder";
import { Sites } from "../pages/Sites";
import { SiteEditor } from "../pages/SiteEditor";
import { BlockEditor } from "../pages/BlockEditor";
import { Calculators } from "../pages/Calculators";
import { CalcEditor } from "../pages/CalcEditor";
import { Crm } from "../pages/Crm";
import { Blog } from "../pages/Blog";
import { ArticleEditor } from "../pages/ArticleEditor";
import { Support } from "../pages/Support";
import { Settings } from "../pages/Settings";
import { Analytics } from "../pages/Analytics";
import { Agency } from "../pages/Agency";
import { AgencyHome } from "../pages/AgencyHome";
import { ProGate } from "../components/ProGate";
import { AuthProvider } from "../auth/AuthContext";
import { AuthGate } from "../auth/AuthGate";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AuthGate><Shell /></AuthGate>}>
          <Route index element={<Dashboard />} />
          <Route path="agency" element={<AgencyHome />} />
          <Route path="agency/clients" element={<Agency />} />
          <Route path="agency/clients/:clientId" element={<Placeholder title="Карточка клиента" note="Контакты, документы, проекты клиента." />} />
          <Route path="agency/leads" element={<Placeholder title="Заявки" note="Сквозная лента лидов по всем клиентам." />} />
          <Route path="agency/support" element={<Placeholder title="Поддержка" note="Единый инбокс тикетов всех клиентов." />} />
          <Route path="agency/tasks" element={<Placeholder title="Задачи" note="Доска задач агентства по всем проектам." />} />
          <Route path="agency/team" element={<Placeholder title="Команда" note="Сотрудники агентства, роли и привязки к клиентам." />} />
          <Route path="agency/billing" element={<Placeholder title="Биллинг" note="Подписки, тарифы и выручка по клиентам." />} />
          <Route path="agency/settings" element={<Placeholder title="Настройки агентства" note="Бренд, интеграции, суб-обработчики, шаблоны." />} />
          <Route path="sites" element={<Sites />} />
        <Route path="sites/:siteId" element={<SiteEditor />} />
        <Route path="sites/:siteId/edit" element={<BlockEditor />} />
        <Route path="blog" element={<Blog />} />
        <Route path="blog/:articleId" element={<ArticleEditor />} />
        <Route path="calculators" element={<Calculators />} />
        <Route path="calculators/:calcId" element={<CalcEditor />} />
        <Route path="crm" element={<ProGate><Crm /></ProGate>} />
        <Route path="analytics" element={<ProGate><Analytics /></ProGate>} />
        <Route path="support" element={<Support />} />
        <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
