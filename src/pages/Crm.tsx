/**
 * CRM — sales pipeline board (amoCRM-style). Stages are columns, deals are draggable cards; drag a
 * card between columns to move a deal through the funnel. Click a card to open the deal drawer
 * (contact, amount, source, note). Column headers show count + total sum; a top strip shows KPIs.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Phone, Trash2, X, User, Tag, Banknote, TrendingUp, Inbox, Trophy, MessageSquare, UserCheck, RefreshCw,
  Calculator, FileText, Image as ImageIcon, ExternalLink,
} from "lucide-react";
import {
  loadDeals, upsertDeal, removeDeal, moveDealToStage, newDeal, importSiteLeads, fmtMoney, phoneDigits, STAGES, SOURCES,
  type Deal, type Stage, type LeadDetail,
} from "../crm/store";
import { fetchSiteLeads, leadsConfigured } from "../crm/leadsClient";
import { loadSettings, type TeamMember } from "../settings/store";
import "./crm.css";

const initials = (name: string) => (name || "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function Crm() {
  const [deals, setDeals] = useState<Deal[]>(() => loadDeals());
  const [openId, setOpenId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const dragId = useRef<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const team = useMemo<TeamMember[]>(() => loadSettings().team, []);
  const memberOf = (id: string) => team.find((m) => m.id === id);

  const open = deals.find((d) => d.id === openId) ?? null;

  const byStage = useMemo(() => {
    const m: Record<string, Deal[]> = {};
    for (const s of STAGES) m[s.id] = [];
    for (const d of deals) (m[d.stage] ??= []).push(d);
    for (const k in m) m[k].sort((a, b) => a.order - b.order);
    return m;
  }, [deals]);

  const kpis = useMemo(() => {
    const active = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = deals.filter((d) => d.stage === "won");
    const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost");
    const conv = closed.length ? Math.round((won.length / closed.length) * 100) : 0;
    return {
      active: active.length,
      pipeline: active.reduce((s, d) => s + d.amount, 0),
      won: won.reduce((s, d) => s + d.amount, 0),
      conv,
    };
  }, [deals]);

  // Pull real leads from the site (Supabase site_leads via /api/leads) into the board.
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const canSync = leadsConfigured();
  const dealsRef = useRef(deals);
  useEffect(() => { dealsRef.current = deals; }, [deals]);
  const syncLeads = async (silent = false) => {
    if (syncing) return;
    setSyncing(true); if (!silent) setSyncMsg("Загрузка…");
    const r = await fetchSiteLeads();
    if (!r.ok) { setSyncMsg(r.message); setSyncing(false); return; }
    const { list: out, added } = importSiteLeads(dealsRef.current, r.leads || []);
    dealsRef.current = out;
    setDeals(out);
    setSyncMsg(added ? `Новых заявок: ${added}` : "Новых заявок нет");
    setSyncing(false);
  };
  // Auto-pull once on open when configured (silent — no noisy message if nothing new).
  useEffect(() => { if (canSync) syncLeads(true); /* eslint-disable-next-line */ }, []);

  const startNew = () => { setIsNew(true); setOpenId("__new__"); };
  const save = (d: Deal) => {
    setDeals((list) => upsertDeal(list, d.order < 0 ? { ...d, order: 0 } : d));
    setIsNew(false); setOpenId(null);
  };
  const del = (id: string) => { setDeals((list) => removeDeal(list, id)); setOpenId(null); };

  const onDropTo = (stage: string, beforeId?: string) => {
    if (!dragId.current) return;
    setDeals((list) => moveDealToStage(list, dragId.current!, stage, beforeId));
    dragId.current = null; setDropStage(null);
  };

  return (
    <div className="crm">
      <div className="crm__top">
        <div className="crm__kpis">
          <Kpi icon={Inbox} label="Активные сделки" value={String(kpis.active)} />
          <Kpi icon={Banknote} label="Сумма воронки" value={fmtMoney(kpis.pipeline) + " MDL"} />
          <Kpi icon={Trophy} label="Выиграно" value={fmtMoney(kpis.won) + " MDL"} accent />
          <Kpi icon={TrendingUp} label="Конверсия" value={kpis.conv + "%"} />
        </div>
        <div className="crm__actions">
          {canSync && (
            <button className="btn-ghost crm__sync" onClick={() => syncLeads(false)} disabled={syncing} title="Загрузить новые заявки с сайта">
              <RefreshCw size={16} className={syncing ? "crm__spin" : ""} /> Заявки с сайта
            </button>
          )}
          {syncMsg && <span className="crm__syncmsg">{syncMsg}</span>}
          <button className="btn-primary crm__new" onClick={startNew}><Plus size={17} /> Новая сделка</button>
        </div>
      </div>

      <div className="crm__board">
        {STAGES.map((s) => (
          <Column
            key={s.id} stage={s} deals={byStage[s.id] || []} isDrop={dropStage === s.id} memberOf={memberOf}
            onDragEnter={() => setDropStage(s.id)}
            onDropCol={() => onDropTo(s.id)}
            onDropBefore={(bid) => onDropTo(s.id, bid)}
            onCardDragStart={(id) => (dragId.current = id)}
            onOpen={setOpenId}
            onAdd={() => { const d = newDeal(s.id); setDeals((l) => upsertDeal(l, d)); setOpenId(d.id); }}
          />
        ))}
      </div>

      {(open || isNew) && (
        <DealDrawer
          deal={open ?? newDeal()}
          isNew={isNew}
          team={team}
          onClose={() => { setIsNew(false); setOpenId(null); }}
          onSave={save}
          onDelete={del}
        />
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={"crm-kpi" + (accent ? " crm-kpi--accent" : "")}>
      <div className="crm-kpi__icon"><Icon size={18} /></div>
      <div>
        <div className="crm-kpi__v">{value}</div>
        <div className="crm-kpi__l">{label}</div>
      </div>
    </div>
  );
}

function Column({ stage, deals, isDrop, memberOf, onDragEnter, onDropCol, onDropBefore, onCardDragStart, onOpen, onAdd }: {
  stage: Stage; deals: Deal[]; isDrop: boolean; memberOf: (id: string) => TeamMember | undefined;
  onDragEnter: () => void; onDropCol: () => void; onDropBefore: (beforeId: string) => void;
  onCardDragStart: (id: string) => void; onOpen: (id: string) => void; onAdd: () => void;
}) {
  const sum = deals.reduce((s, d) => s + d.amount, 0);
  return (
    <div className={"crm-col crm-col--" + (stage.kind || "mid") + (isDrop ? " is-drop" : "")}
      onDragOver={(e) => { e.preventDefault(); onDragEnter(); }}
      onDrop={(e) => { e.preventDefault(); onDropCol(); }}>
      <div className="crm-col__head">
        <span className="crm-col__dot" />
        <span className="crm-col__label">{stage.label}</span>
        <span className="crm-col__count">{deals.length}</span>
      </div>
      <div className="crm-col__sum">{fmtMoney(sum)} MDL</div>
      <div className="crm-col__list">
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} member={memberOf(d.assignee)}
            onDragStart={() => onCardDragStart(d.id)}
            onDropBefore={() => onDropBefore(d.id)}
            onClick={() => onOpen(d.id)} />
        ))}
        <button className="crm-col__add" onClick={onAdd}><Plus size={15} /> Сделка</button>
      </div>
    </div>
  );
}

function DealCard({ deal, member, onDragStart, onDropBefore, onClick }: { deal: Deal; member?: TeamMember; onDragStart: () => void; onDropBefore: () => void; onClick: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <div className={"crm-card" + (over ? " is-over" : "")} draggable
      onDragStart={(e) => { onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); onDropBefore(); }}
      onClick={onClick}>
      <div className="crm-card__title">{deal.title || "Без названия"}</div>
      <div className="crm-card__contact"><User size={13} /> {deal.contact || "—"}</div>
      <div className="crm-card__row">
        <span className="crm-card__amount">{fmtMoney(deal.amount)} <i>{deal.currency}</i></span>
        <span className="crm-card__src">{deal.source}</span>
      </div>
      <div className="crm-card__foot">
        {deal.tags.length > 0
          ? <div className="crm-card__tags">{deal.tags.map((t) => <span key={t} className="crm-tag">{t}</span>)}</div>
          : <span />}
        {member && <span className="crm-ava" title={"Ответственный: " + member.name}>{initials(member.name)}</span>}
      </div>
    </div>
  );
}

function DealDrawer({ deal, isNew, team, onClose, onSave, onDelete }: { deal: Deal; isNew: boolean; team: TeamMember[]; onClose: () => void; onSave: (d: Deal) => void; onDelete: (id: string) => void }) {
  const [d, setD] = useState<Deal>(deal);
  const set = (p: Partial<Deal>) => setD((x) => ({ ...x, ...p }));
  const stage = STAGES.find((s) => s.id === d.stage);
  const wa = phoneDigits(d.phone);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      <div className="crm-drawer__scrim" onClick={onClose} />
      <aside className="crm-drawer glass">
        <div className="crm-drawer__head">
          <span className={"crm-drawer__stage crm-drawer__stage--" + (stage?.kind || "mid")}>{stage?.label}</span>
          <button className="crm-drawer__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="crm-drawer__body">
          {d.lead && <LeadSubmission detail={d.lead} createdAt={d.createdAt} onPhoto={setLightbox} />}
          <label className="fld"><span>Название сделки / услуга</span>
            <input className="ci" value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Напр. Уборка квартиры, 60 м²" autoFocus={isNew} />
          </label>
          <div className="fld-row">
            <label className="fld"><span><User size={13} /> Клиент</span>
              <input className="ci" value={d.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Имя" />
            </label>
            <label className="fld"><span><Phone size={13} /> Телефон</span>
              <input className="ci" value={d.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+373…" />
            </label>
          </div>
          <div className="fld-row">
            <label className="fld"><span><Banknote size={13} /> Сумма</span>
              <input className="ci" type="number" value={d.amount} onChange={(e) => set({ amount: Number(e.target.value) })} />
            </label>
            <label className="fld"><span>Источник</span>
              <select className="ci" value={d.source} onChange={(e) => set({ source: e.target.value })}>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="fld"><span><UserCheck size={13} /> Ответственный</span>
            <select className="ci" value={d.assignee} onChange={(e) => set({ assignee: e.target.value })}>
              <option value="">Не назначен</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}{m.role ? ` — ${m.role}` : ""}</option>)}
            </select>
            {team.length <= 2 && <span className="crm-hint">Добавьте менеджеров в «Настройки → Команда», чтобы назначать их на сделки.</span>}
          </label>
          <label className="fld"><span>Этап</span>
            <div className="crm-stagepick">
              {STAGES.map((s) => (
                <button key={s.id} className={"crm-stagepick__b crm-stagepick__b--" + (s.kind || "mid") + (d.stage === s.id ? " on" : "")}
                  onClick={() => set({ stage: s.id })}>{s.label}</button>
              ))}
            </div>
          </label>
          <label className="fld"><span><Tag size={13} /> Метки (через запятую)</span>
            <input className="ci" value={d.tags.join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="Квартира, Регулярно" />
          </label>
          <label className="fld"><span><MessageSquare size={13} /> Заметка</span>
            <textarea className="ci ci--area" rows={4} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Договорённости, детали заказа…" />
          </label>
          {d.phone && (
            <div className="crm-contact">
              <span className="crm-contact__l">Связаться с клиентом</span>
              <div className="crm-contact__btns">
                <a className="crm-cbtn crm-cbtn--call" href={"tel:" + d.phone}><Phone size={15} /> Позвонить</a>
                <a className="crm-cbtn crm-cbtn--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener"><WaIcon /> WhatsApp</a>
                <a className="crm-cbtn crm-cbtn--tg" href={`https://t.me/+${wa}`} target="_blank" rel="noopener"><TgIcon /> Telegram</a>
              </div>
              <span className="crm-contact__soon">Скоро: переписка в WhatsApp/Telegram прямо из кабинета.</span>
            </div>
          )}
        </div>
        <div className="crm-drawer__foot">
          {!isNew && <button className="crm-drawer__del" onClick={() => onDelete(d.id)}><Trash2 size={15} /> Удалить</button>}
          <button className="btn-ghost" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={() => onSave(d)}>{isNew ? "Создать" : "Сохранить"}</button>
        </div>
      </aside>
      {lightbox && (
        <div className="crm-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Фото из заявки" onClick={(e) => e.stopPropagation()} />
          <button className="crm-lightbox__x" onClick={() => setLightbox(null)} aria-label="Закрыть"><X size={22} /></button>
        </div>
      )}
    </>
  );
}

/** Read-only card showing exactly what the client submitted through the site (calculator or form). */
function LeadSubmission({ detail, createdAt, onPhoto }: { detail: LeadDetail; createdAt: number; onPhoto: (url: string) => void }) {
  const when = new Date(createdAt).toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  return (
    <section className="crm-lead">
      <div className="crm-lead__head">
        <span className="crm-lead__badge">{detail.kind === "calculator" ? <><Calculator size={13} /> Заявка с калькулятора</> : <><FileText size={13} /> Заявка с формы</>}</span>
        <span className="crm-lead__when">{when}</span>
      </div>
      {detail.estimate && (
        <div className="crm-lead__price">
          <span>Расчёт клиента</span>
          <b>{detail.estimate}</b>
        </div>
      )}
      {detail.fields.length > 0 && (
        <dl className="crm-lead__fields">
          {detail.fields.map((f, i) => (
            <div className="crm-lead__field" key={i}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {detail.comment && (
        <div className="crm-lead__comment">
          <span className="crm-lead__label">Комментарий клиента</span>
          <p>{detail.comment}</p>
        </div>
      )}
      {detail.photos.length > 0 && (
        <div className="crm-lead__photos-wrap">
          <span className="crm-lead__label"><ImageIcon size={13} /> Фото ({detail.photos.length})</span>
          <div className="crm-lead__photos">
            {detail.photos.map((url, i) => (
              <button type="button" className="crm-lead__photo" key={i} onClick={() => onPhoto(url)} title="Открыть фото">
                <img src={url} alt={`Фото ${i + 1} из заявки`} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}
      {detail.sourceUrl && (
        <a className="crm-lead__src" href={detail.sourceUrl} target="_blank" rel="noopener">
          <ExternalLink size={12} /> Страница заявки
        </a>
      )}
    </section>
  );
}

/* Brand glyphs (lucide has no WhatsApp/Telegram). */
function WaIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.92C21.95 6.45 17.5 2 12.04 2Zm5.8 14.02c-.24.68-1.4 1.31-1.93 1.35-.53.05-1.02.24-3.43-.72-2.9-1.14-4.74-4.09-4.88-4.28-.14-.19-1.17-1.55-1.17-2.96 0-1.4.73-2.09.99-2.38.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.38-.42.51-.14.14-.28.29-.12.57.16.29.72 1.18 1.54 1.92 1.06.94 1.95 1.24 2.24 1.38.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.65-.14.26.09 1.68.79 1.97.93.29.14.48.21.55.33.07.12.07.69-.17 1.37Z" />
    </svg>
  );
}
function TgIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.9 18.9 19.2c-.23 1.02-.84 1.27-1.7.79l-4.7-3.46-2.27 2.18c-.25.25-.46.46-.94.46l.34-4.78 8.7-7.86c.38-.34-.08-.53-.59-.19L6.7 13.2 2.03 11.74c-1.02-.32-1.04-1.02.21-1.51L20.63 3.4c.85-.32 1.59.19 1.31 1.5Z" />
    </svg>
  );
}
