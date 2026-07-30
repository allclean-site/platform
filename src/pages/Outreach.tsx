/** Рассылка — the agency's lead-gen control-plane (find local businesses w/ no/poor site → AI cold
 * email → track). Interface phase: mock/localStorage; the real engine (scrape+qualify+send) runs on a
 * VPS worker + Instantly/Smartlead later (see LeadGen/OUTREACH_SYSTEM_PLAN.md). Five tabs. */

import React, { useMemo, useState } from "react";
import {
  Send, Search, Radar, PlusCircle, Play, Pause, Trash2, Globe, Mail, X, ShieldCheck, ShieldAlert,
  BarChart3, Megaphone, Users2, CheckCircle2,
} from "lucide-react";
import {
  loadCampaigns, addCampaign, updateCampaign, removeCampaign,
  loadOutreachLeads, updateOutreachLead, mockFindLeads,
  loadTemplates, updateTemplate, loadOutreachSettings, saveOutreachSettings,
  loadSuppression, addSuppression, removeSuppression, outreachTotals,
  CAMPAIGN_STATUS_LABEL, OUTREACH_STATUS_LABEL, SCENARIO_LABEL, SITE_VERDICT_LABEL,
  type Campaign, type CampaignStatus, type OutreachLead, type EmailTemplate, type Scenario, type SiteVerdict,
} from "../outreach/data";
import "./agency-ui.css";
import "./outreach.css";

type Tab = "campaigns" | "leads" | "emails" | "analytics" | "settings";
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "campaigns", label: "Кампании", icon: Megaphone },
  { id: "leads", label: "Поиск лидов", icon: Radar },
  { id: "emails", label: "Письма", icon: Mail },
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "settings", label: "Настройки", icon: ShieldCheck },
];

const STATUS_CLS: Record<CampaignStatus, string> = { draft: "ag-badge--soft", active: "ag-badge--ok", paused: "ag-badge--warn", done: "ag-badge--info" };
const verdictTone = (score: number) => (score < 40 ? "danger" : "warn");

export function Outreach() {
  const [tab, setTab] = useState<Tab>("campaigns");
  return (
    <div className="agp">
      <div className="agp__head">
        <div><h2 className="agp__h"><Send size={20} style={{ verticalAlign: "-3px", marginRight: 8 }} />Рассылка</h2>
          <p className="muted agp__sub">Поиск лидов для агентства: находим бизнесы без сайта → холодное письмо → заявка</p></div>
      </div>

      <div className="ag-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={"ag-tab" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "campaigns" && <CampaignsView goLeads={() => setTab("leads")} />}
      {tab === "leads" && <LeadsView />}
      {tab === "emails" && <EmailsView />}
      {tab === "analytics" && <AnalyticsView />}
      {tab === "settings" && <SettingsView />}
    </div>
  );
}

/* ======================= Кампании ======================= */
function CampaignsView({ goLeads }: { goLeads: () => void }) {
  const [rev, force] = useState(0);
  const campaigns = useMemo(() => loadCampaigns(), [rev]);
  const [adding, setAdding] = useState(false);
  const bump = () => force((x) => x + 1);

  const toggle = (c: Campaign) => { updateCampaign(c.id, { status: c.status === "active" ? "paused" : "active" }); bump(); };
  const del = (c: Campaign) => { if (confirm(`Удалить кампанию «${c.name}»?`)) { removeCampaign(c.id); bump(); } };

  return (
    <>
      <div className="or-bar">
        <span className="muted">{campaigns.length} кампаний</span>
        <button className="btn-primary" onClick={() => setAdding(true)}><PlusCircle size={16} /> Новая кампания</button>
      </div>
      {campaigns.length === 0 ? <div className="card ag-empty">Кампаний пока нет.</div> : (
        <div className="or-cmps">
          {campaigns.map((c) => (
            <div key={c.id} className="card or-cmp">
              <div className="or-cmp__top">
                <div>
                  <h3 className="or-cmp__name">{c.name}</h3>
                  <p className="muted or-cmp__meta">{c.niche} · {c.country} · {c.cities.join(", ")}</p>
                </div>
                <span className={"ag-badge " + STATUS_CLS[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</span>
              </div>
              <Funnel c={c} />
              <div className="or-cmp__foot">
                <span className="muted">лимит {c.dailyLimit}/день</span>
                <div className="or-cmp__actions">
                  <button className="or-ib" title={c.status === "active" ? "Пауза" : "Запустить"} onClick={() => toggle(c)}>
                    {c.status === "active" ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <button className="or-ib or-ib--danger" title="Удалить" onClick={() => del(c)}><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="muted or-hint"><Radar size={13} /> Наполнить кампанию бизнесами — во вкладке <button className="linklike" onClick={goLeads}>«Поиск лидов»</button>.</p>
      {adding && <NewCampaign onClose={() => setAdding(false)} onDone={() => { setAdding(false); bump(); }} />}
    </>
  );
}

function Funnel({ c }: { c: Campaign }) {
  const steps = [
    { k: "Найдено", v: c.found }, { k: "Написано", v: c.contacted }, { k: "Открыли", v: c.opened },
    { k: "Ответили", v: c.replied }, { k: "Клиенты", v: c.won },
  ];
  const max = Math.max(1, c.found);
  return (
    <div className="or-funnel">
      {steps.map((s) => (
        <div key={s.k} className="or-fstep">
          <div className="or-fbar"><span style={{ width: `${Math.round((s.v / max) * 100)}%` }} /></div>
          <b>{s.v}</b><span className="muted">{s.k}</span>
        </div>
      ))}
    </div>
  );
}

function NewCampaign({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [country, setCountry] = useState("Молдова");
  const [cities, setCities] = useState("");
  const [dailyLimit, setDailyLimit] = useState(30);
  const submit = () => {
    if (!niche.trim()) return;
    addCampaign({ name: name.trim() || niche.trim(), niche: niche.trim(), country, cities: cities.split(",").map((s) => s.trim()).filter(Boolean), dailyLimit });
    onDone();
  };
  return (
    <>
      <div className="ag-scrim" onClick={onClose} />
      <aside className="pdr glass">
        <div className="pdr__head"><h3 className="pdr__title">Новая кампания</h3><button className="iconbtn" onClick={onClose}><X size={18} /></button></div>
        <div className="pdr__body">
          <label className="pdr__f"><span className="muted">Ниша *</span><input className="ci" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Клининговые компании" /></label>
          <label className="pdr__f"><span className="muted">Название кампании</span><input className="ci" value={name} onChange={(e) => setName(e.target.value)} placeholder="(по умолчанию = ниша)" /></label>
          <label className="pdr__f"><span className="muted">Страна</span>
            <select className="ci" value={country} onChange={(e) => setCountry(e.target.value)}><option>Молдова</option><option>Румыния</option></select>
          </label>
          <label className="pdr__f"><span className="muted">Города (через запятую)</span><input className="ci" value={cities} onChange={(e) => setCities(e.target.value)} placeholder="Chișinău, Bălți" /></label>
          <label className="pdr__f"><span className="muted">Лимит писем в день</span><input className="ci" type="number" value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} /></label>
          <p className="or-note"><ShieldAlert size={13} /> Безопасно 30–50/день на ящик; больше — через доп. ящики и ротацию (Настройки).</p>
        </div>
        <div className="pdr__foot"><span /><button className="btn-primary" onClick={submit} disabled={!niche.trim()}>Создать</button></div>
      </aside>
    </>
  );
}

/* ======================= Поиск лидов ======================= */
function LeadsView() {
  const [rev, force] = useState(0);
  const leads = useMemo(() => loadOutreachLeads().slice().sort((a, b) => (a.at < b.at ? 1 : -1)), [rev]);
  const campaigns = useMemo(() => loadCampaigns(), [rev]);
  const [niche, setNiche] = useState("");
  const [city, setCity] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [verdict, setVerdict] = useState<"all" | SiteVerdict>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const bump = () => force((x) => x + 1);

  const find = () => { mockFindLeads(niche || "бизнесы", city || "Chișinău", campaignId || undefined, 4); bump(); };
  const rows = leads.filter((l) => verdict === "all" || l.siteVerdict === verdict);
  const open = openId ? leads.find((l) => l.id === openId) ?? null : null;

  return (
    <>
      <div className="card or-find">
        <div className="or-find__row">
          <input className="ci" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ниша (напр. кафе)" />
          <input className="ci" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Город (напр. Chișinău)" />
          <select className="ci" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Без кампании</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-primary" onClick={find}><Search size={16} /> Найти</button>
        </div>
        <p className="muted or-find__note">Демо: поиск имитируется. На бэкенде — Google Maps (SerpAPI/Outscraper) + анализ сайта (Playwright) на воркере.</p>
      </div>

      <div className="ag-toolbar">
        <div className="ag-seg">
          <button className={verdict === "all" ? "on" : ""} onClick={() => setVerdict("all")}>Все</button>
          {(["no_website", "outdated", "not_mobile", "builder_basic"] as SiteVerdict[]).map((v) => (
            <button key={v} className={verdict === v ? "on" : ""} onClick={() => setVerdict(v)}>{SITE_VERDICT_LABEL[v]}</button>
          ))}
        </div>
        <span className="muted" style={{ marginLeft: "auto" }}>{rows.length} бизнесов</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        {rows.length === 0 ? <div className="ag-empty">Пусто — запустите поиск выше.</div> : (
          <table className="ag-table">
            <thead><tr><th>Бизнес</th><th>Город</th><th>Сайт</th><th>Скор</th><th>Рейтинг</th><th>Статус</th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} onClick={() => setOpenId(l.id)}>
                  <td><b>{l.business}</b></td>
                  <td className="muted">{l.city}</td>
                  <td><span className={"ag-chip ag-chip--" + verdictTone(l.siteScore)}>{SITE_VERDICT_LABEL[l.siteVerdict]}</span></td>
                  <td><span className="or-score">{l.siteScore}</span></td>
                  <td className="muted">{l.rating ? <>{l.rating}★ · {l.reviews}</> : "—"}</td>
                  <td><span className="ag-badge ag-badge--soft">{OUTREACH_STATUS_LABEL[l.status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {open && <LeadDrawer key={open.id} l={open} campaigns={campaigns} onClose={() => setOpenId(null)} onChange={bump} />}
    </>
  );
}

function LeadDrawer({ l, campaigns, onClose, onChange }: { l: OutreachLead; campaigns: Campaign[]; onClose: () => void; onChange: () => void }) {
  const setCampaign = (id: string) => { updateOutreachLead(l.id, { campaignId: id || undefined }); onChange(); };
  return (
    <>
      <div className="ag-scrim" onClick={onClose} />
      <aside className="pdr glass">
        <div className="pdr__head">
          <div><h3 className="pdr__title">{l.business}</h3><span className="muted">{l.city}{l.rating ? ` · ${l.rating}★ (${l.reviews})` : ""}</span></div>
          <button className="iconbtn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pdr__body">
          <div className="or-shot"><Globe size={26} /><span className="muted">{l.siteUrl ? l.siteUrl : "нет сайта"}</span></div>
          <div className="pdr__qual">
            <div className="pdr__qual-h"><Globe size={14} /> Анализ сайта</div>
            <div className="pdr__qual-row">
              <span className={"ag-chip ag-chip--" + verdictTone(l.siteScore)}>{SITE_VERDICT_LABEL[l.siteVerdict]}</span>
              <span className="muted">скор {l.siteScore}/100</span>
              {l.tech && <span className="muted">· {l.tech}{l.year ? ` ${l.year}` : ""}</span>}
            </div>
            {l.issues.length > 0 && <ul className="or-issues">{l.issues.map((it, i) => <li key={i}>{it}</li>)}</ul>}
          </div>
          <label className="pdr__f"><span className="muted">Кампания</span>
            <select className="ci" value={l.campaignId ?? ""} onChange={(e) => setCampaign(e.target.value)}>
              <option value="">— без кампании —</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <p className="or-note"><Mail size={13} /> Сценарий письма: <b>{SCENARIO_LABEL[scenarioFor(l.siteVerdict)]}</b> — редактируется во вкладке «Письма».</p>
        </div>
        <div className="pdr__foot"><span className="muted">{OUTREACH_STATUS_LABEL[l.status]}</span><span /></div>
      </aside>
    </>
  );
}
const scenarioFor = (v: SiteVerdict): Scenario => v === "no_website" ? "no_website" : v === "outdated" ? "outdated_site" : v === "not_mobile" ? "not_mobile" : "improvement";

/* ======================= Письма ======================= */
const SAMPLE = { business: "Curat Total", city: "Chișinău", rating: "4.6", reviews: "34" };
function fillVars(s: string) { return s.replace(/\{(\w+)\}/g, (_, k) => (SAMPLE as Record<string, string>)[k] ?? `{${k}}`); }

function EmailsView() {
  const [rev, force] = useState(0);
  const templates = useMemo(() => loadTemplates(), [rev]);
  const settings = useMemo(() => loadOutreachSettings(), [rev]);
  const [sel, setSel] = useState(0);
  const [variant, setVariant] = useState<"A" | "B">("A");
  const t = templates[sel];
  const patch = (p: Partial<EmailTemplate>) => { if (t) { updateTemplate(t.id, p); force((x) => x + 1); } };
  if (!t) return <div className="card ag-empty">Шаблонов нет.</div>;
  const subj = variant === "A" ? t.subjectA : t.subjectB;
  const body = variant === "A" ? t.bodyA : t.bodyB;

  return (
    <div className="or-emails">
      <div className="or-tpls card">
        <div className="or-tpls__h muted">Шаблоны по сценариям</div>
        {templates.map((tp, i) => (
          <button key={tp.id} className={"or-tpl" + (i === sel ? " on" : "")} onClick={() => setSel(i)}>
            <b>{tp.name}</b><span className="ag-badge ag-badge--soft">{SCENARIO_LABEL[tp.scenario]}</span>
          </button>
        ))}
      </div>

      <div className="or-editor">
        <div className="or-editor__bar">
          <span className="ag-badge ag-badge--soft">{SCENARIO_LABEL[t.scenario]}</span>
          <div className="ag-seg">
            <button className={variant === "A" ? "on" : ""} onClick={() => setVariant("A")}>Вариант A</button>
            <button className={variant === "B" ? "on" : ""} onClick={() => setVariant("B")}>Вариант B</button>
          </div>
        </div>
        <label className="pdr__f"><span className="muted">Тема</span>
          <input className="ci" value={subj} onChange={(e) => patch(variant === "A" ? { subjectA: e.target.value } : { subjectB: e.target.value })} />
        </label>
        <label className="pdr__f"><span className="muted">Текст письма</span>
          <textarea className="ci or-body" value={body} onChange={(e) => patch(variant === "A" ? { bodyA: e.target.value } : { bodyB: e.target.value })} />
        </label>
        <p className="muted or-vars">Переменные: <code>{"{business}"}</code> <code>{"{city}"}</code> <code>{"{rating}"}</code> <code>{"{reviews}"}</code></p>

        <div className="or-preview card">
          <div className="or-preview__h muted"><Mail size={13} /> Предпросмотр (пример: {SAMPLE.business})</div>
          <div className="or-preview__subj"><b>{fillVars(subj)}</b></div>
          <div className="or-preview__body">{fillVars(body)}</div>
          <div className="or-preview__footer muted">{settings.footer}</div>
        </div>
      </div>
    </div>
  );
}

/* ======================= Аналитика ======================= */
function AnalyticsView() {
  const t = useMemo(() => outreachTotals(), []);
  const campaigns = useMemo(() => loadCampaigns(), []);
  const funnel = [
    { k: "Найдено", v: t.found }, { k: "Написано", v: t.contacted }, { k: "Открыли", v: t.opened },
    { k: "Ответили", v: t.replied }, { k: "Клиенты", v: t.won },
  ];
  const max = Math.max(1, t.found);
  return (
    <>
      <div className="ag-kpis">
        <div className="ag-kpi ag-kpi--info"><b>{t.contacted}</b><span className="muted">Написано</span></div>
        <div className="ag-kpi"><b>{t.openRate}%</b><span className="muted">Открытий</span></div>
        <div className="ag-kpi ag-kpi--warn"><b>{t.replyRate}%</b><span className="muted">Ответов</span></div>
        <div className="ag-kpi ag-kpi--ok"><b>{t.won}</b><span className="muted">Новых клиентов</span></div>
      </div>

      <div className="card or-an">
        <div className="pp__sec-h"><BarChart3 size={16} /> Воронка (все кампании)</div>
        <div className="or-anfunnel">
          {funnel.map((s, i) => (
            <div key={s.k} className="or-anrow">
              <span className="or-anrow__k">{s.k}</span>
              <div className="or-anbar"><span style={{ width: `${Math.round((s.v / max) * 100)}%` }}>{s.v}</span></div>
              {i > 0 && funnel[i - 1].v > 0 && <span className="muted or-anrow__pct">{Math.round((s.v / funnel[i - 1].v) * 100)}%</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "auto" }}>
        <table className="ag-table">
          <thead><tr><th>Кампания</th><th>Найдено</th><th>Написано</th><th>Открыли</th><th>Ответили</th><th>Клиенты</th></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} style={{ cursor: "default" }}>
                <td><b>{c.name}</b></td><td>{c.found}</td><td>{c.contacted}</td><td>{c.opened}</td><td>{c.replied}</td><td>{c.won}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ======================= Настройки / Комплаенс ======================= */
function SettingsView() {
  const [rev, force] = useState(0);
  const s = useMemo(() => loadOutreachSettings(), [rev]);
  const supp = useMemo(() => loadSuppression(), [rev]);
  const [domain, setDomain] = useState("");
  const [suppEmail, setSuppEmail] = useState("");
  const bump = () => force((x) => x + 1);
  const set = (p: Partial<typeof s>) => { saveOutreachSettings({ ...s, ...p }); bump(); };
  const capacity = s.inboxes * s.dailyPerInbox;

  return (
    <div className="or-settings">
      <div className="card or-set">
        <div className="pp__sec-h"><Send size={15} /> Платформа отправки</div>
        <div className="or-set__row">
          <label className="pdr__f"><span className="muted">Сервис</span>
            <select className="ci" value={s.platform} onChange={(e) => set({ platform: e.target.value as typeof s.platform })}>
              <option value="none">Не подключено</option><option value="instantly">Instantly</option><option value="smartlead">Smartlead</option>
            </select>
          </label>
          <label className="pdr__f" style={{ flex: 1 }}><span className="muted">API-ключ</span>
            <input className="ci" type="password" value={s.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="вставьте ключ платформы" />
          </label>
          <span className={"ag-badge " + (s.platform !== "none" && s.apiKey ? "ag-badge--ok" : "ag-badge--soft")}>
            {s.platform !== "none" && s.apiKey ? "Подключено" : "Не подключено"}
          </span>
        </div>
        <p className="or-note"><ShieldAlert size={13} /> Отправка через спец-платформу (прогрев + ротация ящиков). Транзакционные API (Resend/SendGrid) запрещают холодную рассылку.</p>
      </div>

      <div className="card or-set">
        <div className="pp__sec-h"><Globe size={15} /> Домены и ящики</div>
        <div className="or-tags">
          {s.sendingDomains.map((d) => (
            <span key={d} className="or-tag">{d}<button onClick={() => set({ sendingDomains: s.sendingDomains.filter((x) => x !== d) })}><X size={12} /></button></span>
          ))}
        </div>
        <div className="or-set__row">
          <input className="ci" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="домен-для-рассылки.com" />
          <button className="btn-ghost" onClick={() => { if (domain.trim()) { set({ sendingDomains: [...s.sendingDomains, domain.trim()] }); setDomain(""); } }}>Добавить домен</button>
        </div>
        <div className="or-set__row">
          <label className="pdr__f"><span className="muted">Ящиков</span><input className="ci" type="number" value={s.inboxes} onChange={(e) => set({ inboxes: Number(e.target.value) })} /></label>
          <label className="pdr__f"><span className="muted">Писем/день на ящик</span><input className="ci" type="number" value={s.dailyPerInbox} onChange={(e) => set({ dailyPerInbox: Number(e.target.value) })} /></label>
          <div className="or-cap"><b>{capacity}</b><span className="muted">писем/день суммарно</span></div>
        </div>
      </div>

      <div className="card or-set">
        <div className="pp__sec-h"><ShieldCheck size={15} /> Комплаенс (обязательно для B2B в EU/Румынии)</div>
        <label className="pdr__f"><span className="muted">Имя отправителя</span><input className="ci" value={s.senderName} onChange={(e) => set({ senderName: e.target.value })} /></label>
        <label className="pdr__f"><span className="muted">Футер письма (адрес + политика + отписка)</span>
          <textarea className="ci or-body" value={s.footer} onChange={(e) => set({ footer: e.target.value })} />
        </label>
        <label className="pdr__f"><span className="muted">Представитель в ЕС (GDPR Art. 27)</span><input className="ci" value={s.euRep} onChange={(e) => set({ euRep: e.target.value })} placeholder="имя / компания" /></label>
        <p className="or-note"><ShieldAlert size={13} /> Румыния — фактически opt-in даже для B2B: слать на ролевые адреса (<code>office@</code>, <code>contact@</code>), не на личные. Футер с отпиской обязателен.</p>
      </div>

      <div className="card or-set">
        <div className="pp__sec-h"><Users2 size={15} /> Suppression-лист ({supp.length}) — кому НЕ писать</div>
        <div className="or-set__row">
          <input className="ci" value={suppEmail} onChange={(e) => setSuppEmail(e.target.value)} placeholder="email@company.md" />
          <button className="btn-ghost" onClick={() => { addSuppression(suppEmail); setSuppEmail(""); bump(); }}>Добавить</button>
        </div>
        {supp.length > 0 && (
          <ul className="or-supp">
            {supp.map((x) => (
              <li key={x.id}><CheckCircle2 size={13} /> {x.email}<span className="muted">{x.reason} · {x.at}</span><button className="or-x" onClick={() => { removeSuppression(x.id); bump(); }}><X size={13} /></button></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
