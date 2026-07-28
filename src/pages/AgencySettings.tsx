/** Настройки агентства — branding, default integrations, sub-processor list (GDPR). Interface only. */

import React, { useState } from "react";
import { Palette, Plug, ShieldCheck, Globe } from "lucide-react";
import "./agency-ui.css";

const SUBPROCESSORS = [
  { name: "Supabase", role: "БД + хранилище", region: "EU (Frankfurt)" },
  { name: "Cloudflare", role: "CDN / Pages / DNS", region: "EU-edge" },
  { name: "Hetzner", role: "Серверы (API)", region: "EU (DE/FI)" },
  { name: "Resend", role: "Транзакционная почта", region: "EU" },
  { name: "Paddle", role: "Приём оплат (MoR)", region: "EU / global" },
];

export function AgencySettings() {
  const [name, setName] = useState("LeadGenium");
  const [domain, setDomain] = useState("cms.leadgenium.pro");
  const [accent, setAccent] = useState("#7c3aed");

  return (
    <div className="agp">
      <div className="agp__head"><div><h2 className="agp__h">Настройки агентства</h2><p className="muted agp__sub">Бренд, интеграции, суб-обработчики</p></div></div>

      <div className="card" style={{ padding: 18 }}>
        <div className="pp__sec-h"><Palette size={16} /> Бренд</div>
        <div className="nc__grid" style={{ maxWidth: 620 }}>
          <label className="fld"><span>Название агентства</span><input className="ci" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="fld"><span><Globe size={12} /> Домен кабинета</span><input className="ci" value={domain} onChange={(e) => setDomain(e.target.value)} /></label>
          <label className="fld"><span>Акцентный цвет</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 44, height: 38, border: "1px solid var(--border)", borderRadius: 8, background: "none" }} /><code style={{ color: "var(--text-muted)" }}>{accent}</code></div></label>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="pp__sec-h"><Plug size={16} /> Дефолты интеграций (для новых проектов)</div>
        <div className="nc__grid" style={{ maxWidth: 620 }}>
          <label className="fld"><span>GA4 Measurement ID</span><input className="ci" placeholder="G-XXXXXXX" /></label>
          <label className="fld"><span>Telegram-бот уведомлений</span><input className="ci" placeholder="@leadgenium_bot" /></label>
          <label className="fld"><span>Отправитель почты</span><input className="ci" placeholder="noreply@leadgenium.pro" /></label>
          <label className="fld"><span>IndexNow ключ</span><input className="ci" placeholder="авто" /></label>
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div className="pp__sec-h"><ShieldCheck size={16} /> Суб-обработчики (GDPR)</div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Публичный список для DPA. Данные — в EU. Полный юр-комплект — на фазе документов (см. план массовой платформы).</p>
        <table className="ag-table">
          <thead><tr><th>Поставщик</th><th>Роль</th><th>Регион данных</th></tr></thead>
          <tbody>{SUBPROCESSORS.map((s) => <tr key={s.name} style={{ cursor: "default" }}><td><b>{s.name}</b></td><td>{s.role}</td><td><span className="ag-badge ag-badge--ok">{s.region}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
