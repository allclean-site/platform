import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./app/App";
import { initTheme } from "./lib/theme";
import "./styles/base.css";

initTheme();

// HashRouter (URLs like /#/app/…) so deep links work on any static host without a SPA rewrite — the
// site (allclean.md) shares this repo's vercel.json and needs real file routing, so a catch-all
// rewrite to index.html isn't an option there.
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
