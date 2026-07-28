/** Биллинг — subscriptions/plans per client + revenue overview. Interface only; real charges via a
 * Merchant-of-Record (Paddle/Lemon Squeezy) on the payments phase — see PLATFORM_MASSCLIENT_PLAN.md. */

import React, { useMemo } from "react";
import { Wallet, TrendingUp, CreditCard } from "lucide-react";
import { loadAClients, projectsOf, eur } from "../agency/data";
import "./agency-ui.css";

const PRO_PRICE = 30; // €/mo

export function AgencyBilling() {
  const clients = useMemo(() => loadAClients(), []);
  const proCount = clients.filter((c) => c.plan === "pro").length;
  const mrr = proCount * PRO_PRICE;
  const perClient = clients.map((c) => {
    const ps = projectsOf(c.id);
    return { c, paid: ps.reduce((s, p) => s + p.pricePaid, 0), total: ps.reduce((s, p) => s + p.priceTotal, 0) };
  });
  const paid = perClient.reduce((s, x) => s + x.paid, 0);
  const total = perClient.reduce((s, x) => s + x.total, 0);

  return (
    <div className="agp">
      <div className="agp__head"><div><h2 className="agp__h">Биллинг</h2><p className="muted agp__sub">Подписки и выручка по клиентам</p></div></div>

      <div className="ag-stats">
        <div className="ag-stat"><b>{eur(mrr)} €</b><span>MRR (подписки PRO)</span></div>
        <div className="ag-stat"><b>{proCount}</b><span>PRO-клиентов</span></div>
        <div className="ag-stat"><b>{eur(paid)} €</b><span>Получено по проектам</span></div>
        <div className="ag-stat"><b>{eur(total - paid)} €</b><span>К оплате по проектам</span></div>
      </div>

      <div className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <span className="ag-badge ag-badge--soft"><CreditCard size={13} /> Платёжка не подключена</span>
        <span className="muted" style={{ fontSize: 13 }}>На фазе оплат — Merchant of Record (Paddle / Lemon Squeezy): хранение карт, EU-VAT и инвойсы на их стороне.</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="ag-table">
          <thead><tr><th>Клиент</th><th>Тариф</th><th>Подписка / мес</th><th>Проекты (получено / всего)</th><th>Прогресс оплаты</th></tr></thead>
          <tbody>
            {perClient.map(({ c, paid, total }) => {
              const pct = total ? Math.round((paid / total) * 100) : 0;
              return (
                <tr key={c.id}>
                  <td><div className="ag-row-name"><span className="ag-ava" style={{ background: c.accent, width: 28, height: 28 }}>{c.initials}</span><b>{c.name}</b></div></td>
                  <td><span className={"ag-badge " + (c.plan === "pro" ? "ag-badge--pro" : "ag-badge--soft")}>{c.plan === "pro" ? "PRO" : "Free"}</span></td>
                  <td>{c.plan === "pro" ? `${PRO_PRICE} €` : "—"}</td>
                  <td>{eur(paid)} / {eur(total)} €</td>
                  <td><div className="ag-money" style={{ minWidth: 140 }}><div className="bar"><span style={{ width: `${pct}%` }} /></div></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
