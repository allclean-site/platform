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
import { AgencyHome } from "../pages/AgencyHome";
import { Clients } from "../pages/Clients";
import { ClientCard } from "../pages/ClientCard";
import { ProjectPage } from "../pages/ProjectPage";
import { AgencyLeads } from "../pages/AgencyLeads";
import { AgencySupport } from "../pages/AgencySupport";
import { AgencyTasks } from "../pages/AgencyTasks";
import { AgencyTeam } from "../pages/AgencyTeam";
import { AgencyBilling } from "../pages/AgencyBilling";
import { AgencySettings } from "../pages/AgencySettings";
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
          <Route path="agency/clients" element={<Clients />} />
          <Route path="agency/clients/:clientId" element={<ClientCard />} />
          <Route path="agency/clients/:clientId/projects/:projectId" element={<ProjectPage />} />
          <Route path="agency/leads" element={<AgencyLeads />} />
          <Route path="agency/support" element={<AgencySupport />} />
          <Route path="agency/tasks" element={<AgencyTasks />} />
          <Route path="agency/team" element={<AgencyTeam />} />
          <Route path="agency/billing" element={<AgencyBilling />} />
          <Route path="agency/settings" element={<AgencySettings />} />
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
