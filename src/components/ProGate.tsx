/**
 * Gate for PRO-only sections. On a Free tenant (or after a cancelled subscription lapses), the real
 * page renders BEHIND a blurred glass veil with a centred upgrade plaque — the section is teased, not
 * usable. During the grace window (cancelled but paid period not over) access stays open, with a banner
 * shown by the section itself / billing tab.
 */

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { loadSettings } from "../settings/store";
import { hasPro, isPro } from "../lib/plans";
import "./progate.css";

export function ProGate({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const s = loadSettings();
  if (hasPro(s.plan, s.subscription)) return <>{children}</>;

  const cancelled = isPro(s.plan) && s.subscription?.status === "cancelled";
  return (
    <div className="progate">
      <div className="progate__behind" aria-hidden>{children}</div>
      <div className="progate__veil">
        <div className="progate__card glass">
          <div className="progate__badge"><Crown size={15} /> PRO</div>
          <h2 className="progate__title">{cancelled ? "Подписка PRO завершена" : "Этот раздел — на тарифе PRO"}</h2>
          <p className="progate__text">
            {cancelled
              ? "Доступ к CRM, аналитике, хостингу в ЕС и уведомлениям закрылся вместе с подпиской. Возобновите PRO, чтобы вернуть их — ваши данные и настройки сохранены."
              : "CRM, аналитика, хостинг в ЕС, домен, SSL и уведомления входят в PRO — 30 €/мес. Всё остальное остаётся бесплатным."}
          </p>
          <div className="progate__actions">
            <button className="btn-primary" onClick={() => nav("/app/settings#billing")}>
              {cancelled ? "Возобновить PRO" : "Перейти на PRO"}
            </button>
            <Link className="btn-ghost" to="/#pricing">Сравнить тарифы</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
