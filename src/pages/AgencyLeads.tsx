/** Заявки — the agency's OWN inbound sales funnel: potential clients who want to hire the agency
 * (from the marketing landing + replies from our outreach «Рассылка»). NOT client business leads —
 * those live in each project's CRM. Inbox table + detail drawer with stage / notes / convert-to-client. */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Phone, Mail, Globe, Send, Users2, Link as LinkIcon, PlusCircle, X, UserPlus, Trash2, MessageCircle,
} from "lucide-react";
import {
  loadProspects, addProspect, updateProspect, removeProspect, convertProspectToClient,
  loadTeam, phoneDigits,
  PROSPECT_STAGE_LABEL, PROSPECT_STAGE_ORDER, PROSPECT_SOURCE_LABEL, SITE_VERDICT_LABEL,
  type Prospect, type ProspectStage, type ProspectSource,
} from "../agency/data";
import "./agency-ui.css";

const STAGE_CLS: Record<ProspectStage, string> = {
  new: "ag-badge--info", contacted: "ag-badge--warn", qualified: "ag-badge--warn",
  proposal: "ag-badge--info", won: "ag-badge--ok", lost: "ag-badge--soft",
};
const SOURCE_ICON: Record<ProspectSource, React.ElementType> = { landing: Globe, outreach: Send, referral: Users2, manual: LinkIcon };
const fmtDate = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AgencyLeads() {
  const [rev, force] = useState(0);
  const all = useMemo(() => loadProspects().slice().sort((a, b) => (a.at < b.at ? 1 : -1)), [rev]);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<"all" | ProspectSource>("all");
  const [stage, setStage] = useState<"all" | ProspectStage>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = all.filter((p) => {
    if (source !== "all" && p.source !== source) return false;
    if (stage !== "all" && p.stage !== stage) return false;
    if (q && !(`${p.business} ${p.contactName ?? ""} ${p.interest} ${p.email ?? ""}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  // KPIs
  const weekAgo = Date.now() - 7 * 864e5;
  const newWeek = all.filter((p) => new Date(p.at).getTime() >= weekAgo).length;
  const inWork = all.filter((p) => ["contacted", "qualified", "proposal"].includes(p.stage)).length;
  const won = all.filter((p) => p.stage === "won").length;
  const decided = all.filter((p) => p.stage === "won" || p.stage === "lost").length;
  const conv = decided ? Math.round((won / decided) * 100) : 0;

  const open = openId ? all.find((p) => p.id === openId) ?? null : null;

  return (
    <div className="agp">
      <div className="agp__head">
        <div><h2 className="agp__h">Заявки</h2><p className="muted agp__sub">Входящие от потенциальных клиентов агентства — {all.length}</p></div>
        <button className="btn-primary" onClick={() => setAdding(true)}><PlusCircle size={16} /> Заявка</button>
      </div>

      <div className="ag-kpis">
        <Kpi label="Новых · 7 дней" value={newWeek} tone="info" />
        <Kpi label="В работе" value={inWork} tone="warn" />
        <Kpi label="Стали клиентами" value={won} tone="ok" />
        <Kpi label="Конверсия" value={`${conv}%`} tone="" />
      </div>

      <div className="ag-toolbar">
        <div className="ag-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Бизнес, контакт, интерес…" /></div>
        <select className="ci" style={{ width: "auto" }} value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
          <option value="all">Все источники</option>
          {(Object.keys(PROSPECT_SOURCE_LABEL) as ProspectSource[]).map((s) => <option key={s} value={s}>{PROSPECT_SOURCE_LABEL[s]}</option>)}
        </select>
        <div className="ag-seg">
          <button className={stage === "all" ? "on" : ""} onClick={() => setStage("all")}>Все</button>
          {PROSPECT_STAGE_ORDER.map((s) => <button key={s} className={stage === s ? "on" : ""} onClick={() => setStage(s)}>{PROSPECT_STAGE_LABEL[s]}</button>)}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {rows.length === 0 ? <div className="ag-empty">Заявок не найдено.</div> : (
          <table className="ag-table">
            <thead><tr><th>Бизнес</th><th>Контакт</th><th>Интерес</th><th>Источник</th><th>Когда</th><th>Этап</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const SIcon = SOURCE_ICON[p.source];
                return (
                  <tr key={p.id} onClick={() => setOpenId(p.id)}>
                    <td><b>{p.business}</b>{p.city && <div className="muted ag-sub">{p.city}</div>}</td>
                    <td>{p.contactName ?? "—"}{p.email && <div className="muted ag-sub">{p.email}</div>}</td>
                    <td>{p.interest}</td>
                    <td>
                      <span className="ag-badge ag-badge--soft"><SIcon size={12} /> {PROSPECT_SOURCE_LABEL[p.source]}</span>
                      {p.source === "outreach" && p.siteVerdict && <span className={"ag-chip ag-chip--" + (p.siteScore != null && p.siteScore < 40 ? "danger" : "warn")}>{SITE_VERDICT_LABEL[p.siteVerdict]}</span>}
                    </td>
                    <td className="muted">{fmtDate(p.at)}</td>
                    <td><span className={"ag-badge " + STAGE_CLS[p.stage]}>{PROSPECT_STAGE_LABEL[p.stage]}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {open && <ProspectDrawer key={open.id} p={open} onClose={() => setOpenId(null)} onChange={() => force((x) => x + 1)} />}
      {adding && <NewProspect onClose={() => setAdding(false)} onDone={() => { setAdding(false); force((x) => x + 1); }} />}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return <div className={"ag-kpi" + (tone ? " ag-kpi--" + tone : "")}><b>{value}</b><span className="muted">{label}</span></div>;
}

function ProspectDrawer({ p, onClose, onChange }: { p: Prospect; onClose: () => void; onChange: () => void }) {
  const nav = useNavigate();
  const team = useMemo(() => loadTeam(), []);
  const [note, setNote] = useState(p.note ?? "");
  const digits = phoneDigits(p.phone ?? "");

  const setStage = (s: ProspectStage) => { updateProspect(p.id, { stage: s }); onChange(); };
  const saveNote = () => { updateProspect(p.id, { note }); onChange(); };
  const setAssignee = (id: string) => { updateProspect(p.id, { assigneeId: id || undefined }); onChange(); };
  const convert = () => {
    const c = convertProspectToClient(p.id);
    onChange();
    if (c) nav(`/app/agency/clients/${c.id}`);
  };
  const del = () => { removeProspect(p.id); onChange(); onClose(); };

  return (
    <>
      <div className="ag-scrim" onClick={onClose} />
      <aside className="pdr glass">
        <div className="pdr__head">
          <div>
            <h3 className="pdr__title">{p.business}</h3>
            <span className="ag-badge ag-badge--soft">{PROSPECT_SOURCE_LABEL[p.source]}</span>
            {p.city && <span className="muted"> · {p.city}</span>}
          </div>
          <button className="iconbtn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pdr__body">
          {/* Contact actions */}
          <div className="pdr__contact">
            {p.phone && <a className="pdr__cbtn" href={`tel:${p.phone}`}><Phone size={15} /> Позвонить</a>}
            {p.email && <a className="pdr__cbtn" href={`mailto:${p.email}`}><Mail size={15} /> Email</a>}
            {digits && <a className="pdr__cbtn" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>}
          </div>
          {(p.contactName || p.email || p.phone) && (
            <p className="pdr__contactline muted">{[p.contactName, p.phone, p.email].filter(Boolean).join(" · ")}</p>
          )}

          {/* Stage picker */}
          <div className="pdr__label">Этап</div>
          <div className="pdr__stages">
            {PROSPECT_STAGE_ORDER.map((s) => (
              <button key={s} className={"pdr__stage" + (p.stage === s ? " on" : "")} onClick={() => setStage(s)}>{PROSPECT_STAGE_LABEL[s]}</button>
            ))}
          </div>

          {/* Details */}
          <div className="pdr__grid">
            <Field label="Интерес">{p.interest}</Field>
            {p.budget && <Field label="Бюджет">{p.budget}</Field>}
            <Field label="Ответственный">
              <select className="ci" value={p.assigneeId ?? ""} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">— не назначен —</option>
                {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          {/* Outreach site qualifier */}
          {p.source === "outreach" && p.siteVerdict && (
            <div className="pdr__qual">
              <div className="pdr__qual-h"><Globe size={14} /> Анализ сайта (из рассылки)</div>
              <div className="pdr__qual-row">
                <span className={"ag-chip ag-chip--" + ((p.siteScore ?? 0) < 40 ? "danger" : "warn")}>{SITE_VERDICT_LABEL[p.siteVerdict]}</span>
                {p.siteScore != null && <span className="muted">скор {p.siteScore}/100</span>}
                {p.siteUrl && <a className="ag-link" href={`https://${p.siteUrl}`} target="_blank" rel="noreferrer">{p.siteUrl}</a>}
              </div>
            </div>
          )}

          {/* Note */}
          <div className="pdr__label">Заметка</div>
          <textarea className="ci pdr__note" value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Договорённости, следующий шаг…" />
        </div>

        <div className="pdr__foot">
          <button className="btn-ghost pdr__del" onClick={del}><Trash2 size={15} /> Удалить</button>
          <div className="pdr__foot-r">
            {p.stage !== "won" && <button className="btn-primary" onClick={convert}><UserPlus size={15} /> Создать клиента</button>}
            {p.stage === "won" && <span className="ag-badge ag-badge--ok">Уже клиент</span>}
          </div>
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="pdr__field"><span className="muted">{label}</span><div>{children}</div></div>;
}

function NewProspect({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [business, setBusiness] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("");
  const [source, setSource] = useState<ProspectSource>("manual");

  const submit = () => {
    if (!business.trim()) return;
    addProspect({ business, contactName, email, phone, interest, source });
    onDone();
  };

  return (
    <>
      <div className="ag-scrim" onClick={onClose} />
      <aside className="pdr glass">
        <div className="pdr__head"><h3 className="pdr__title">Новая заявка</h3><button className="iconbtn" onClick={onClose}><X size={18} /></button></div>
        <div className="pdr__body">
          <label className="pdr__f"><span className="muted">Бизнес *</span><input className="ci" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Напр. Pizzeria Roma" /></label>
          <label className="pdr__f"><span className="muted">Контактное лицо</span><input className="ci" value={contactName} onChange={(e) => setContactName(e.target.value)} /></label>
          <label className="pdr__f"><span className="muted">Email</span><input className="ci" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="pdr__f"><span className="muted">Телефон</span><input className="ci" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="pdr__f"><span className="muted">Интерес</span><input className="ci" value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Сайт, лендинг, SEO…" /></label>
          <label className="pdr__f"><span className="muted">Источник</span>
            <select className="ci" value={source} onChange={(e) => setSource(e.target.value as ProspectSource)}>
              {(Object.keys(PROSPECT_SOURCE_LABEL) as ProspectSource[]).map((s) => <option key={s} value={s}>{PROSPECT_SOURCE_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
        <div className="pdr__foot"><span /><button className="btn-primary" onClick={submit} disabled={!business.trim()}>Добавить</button></div>
      </aside>
    </>
  );
}
