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
import { ProGate } from "../components/ProGate";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Shell />}>
        <Route index element={<Dashboard />} />
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
  );
}
