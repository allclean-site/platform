/**
 * Settings — tabbed: Уведомления (events × channels matrix), Домен, Интеграции, Команда, Биллинг.
 * Autosaves to localStorage. Notifications are the centre: choose where each event reaches you.
 */

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bell, Globe, Plug, Users, CreditCard, Check, Plus, Trash2, Mail, Send, Phone, MonitorSmartphone, Server, ExternalLink, Minus, Crown, AlertTriangle,
} from "lucide-react";
import { loadSettings, saveSettings, publishConfig, NOTIF_EVENTS, CHANNELS, type Settings, type Channel, type NotifRow, type TeamMember } from "../settings/store";
import { PLANS, hasPro, isPro, inGracePeriod } from "../lib/plans";
import "./settings.css";

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "");
/** 30 days from now, ISO — the paid period the client keeps after cancelling. */
const periodEnd = () => new Date(Date.now() + 30 * 864e5).toISOString();

const TABS = [
  { id: "notif", icon: Bell, label: "Уведомления" },
  { id: "domain", icon: Globe, label: "Домен и хостинг" },
  { id: "integr", icon: Plug, label: "Интеграции" },
  { id: "team", icon: Users, label: "Команда" },
  { id: "billing", icon: CreditCard, label: "Тариф" },
] as const;

export function Settings() {
  const { hash } = useLocation();
  const [s, setS] = useState<Settings>(() => loadSettings());
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(hash === "#billing" ? "billing" : "notif");
  const [saved, setSaved] = useState(true);
  // Deep-link from the PRO gate → open the Тариф tab.
  useEffect(() => { if (hash === "#billing") setTab("billing"); }, [hash]);
  const t = useRef<number | undefined>(undefined);
  const sRef = useRef(s); sRef.current = s;

  useEffect(() => {
    setSaved(false);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => { saveSettings(s); setSaved(true); }, 400);
    return () => clearTimeout(t.current);
  }, [s]);
  // Flush the latest settings on unmount so a change made right before navigating away isn't lost.
  useEffect(() => () => saveSettings(sRef.current), []);

  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));

  return (
    <div className="set">
      <aside className="set__tabs">
        {TABS.map((tt) => (
          <button key={tt.id} className={"set-tab" + (tab === tt.id ? " is-active" : "")} onClick={() => setTab(tt.id)}>
            <tt.icon size={18} /> <span>{tt.label}</span>
          </button>
        ))}
        <div className="set__save">{saved ? <><Check size={13} /> сохранено</> : "сохраняю…"}</div>
      </aside>

      <section className="set__panel">
        {tab === "notif" && <NotifTab s={s} set={set} />}
        {tab === "domain" && <DomainTab s={s} set={set} />}
        {tab === "integr" && <IntegrTab s={s} set={set} />}
        {tab === "team" && <TeamTab s={s} set={set} />}
        {tab === "billing" && <BillingTab s={s} set={set} />}
      </section>
    </div>
  );
}

/* ---------- Notifications ---------- */
const CH_ICON: Record<Channel, any> = { inapp: MonitorSmartphone, email: Mail, telegram: Send, whatsapp: Phone };

function NotifTab({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const toggle = (ev: string, ch: Channel) =>
    set({ notif: { ...s.notif, [ev]: { ...s.notif[ev], [ch]: !s.notif[ev][ch] } } });
  const setChannel = (k: keyof Settings["channels"], v: string) => set({ channels: { ...s.channels, [k]: v } });

  return (
    <div className="set-body">
      <h3 className="set-h">Уведомления</h3>
      <p className="muted set-sub">Выберите, куда присылать каждое событие. «В кабинете» — колокольчик вверху, всегда доступен.</p>

      <div className="notif-grid">
        <div className="notif-grid__head">
          <span />
          {CHANNELS.map((c) => { const I = CH_ICON[c.id]; return <span key={c.id} className="notif-ch"><I size={15} /> {c.label}</span>; })}
        </div>
        {NOTIF_EVENTS.map((ev) => (
          <div className="notif-row" key={ev.id}>
            <div className="notif-ev">
              <b>{ev.label}</b>
              <span className="muted">{ev.desc}</span>
            </div>
            {CHANNELS.map((c) => (
              <label key={c.id} className="notif-cell">
                <input type="checkbox" checked={(s.notif[ev.id] as NotifRow)[c.id]} onChange={() => toggle(ev.id, c.id)} />
                <span className="notif-switch" />
              </label>
            ))}
          </div>
        ))}
      </div>

      <h4 className="set-h4">Куда отправлять</h4>
      <div className="set-grid2">
        <label className="fld"><span><Mail size={13} /> Email</span><input className="ci" value={s.channels.email} onChange={(e) => setChannel("email", e.target.value)} placeholder="you@mail.com" /></label>
        <label className="fld"><span><Send size={13} /> Telegram</span>
          {s.channels.telegram
            ? <div className="set-connected"><Check size={14} /> Подключён · {s.channels.telegram} <button className="linklike" onClick={() => setChannel("telegram", "")}>отключить</button></div>
            : <button className="btn-ghost set-connectbtn" onClick={() => setChannel("telegram", "@allclean_owner")}><Send size={15} /> Подключить Telegram</button>}
        </label>
        <label className="fld"><span><Phone size={13} /> WhatsApp</span><input className="ci" value={s.channels.whatsapp} onChange={(e) => setChannel("whatsapp", e.target.value)} placeholder="+373…" /></label>
      </div>
    </div>
  );
}

/* ---------- Domain ---------- */
function DomainTab({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const external = s.hosting === "external";
  return (
    <div className="set-body">
      <h3 className="set-h">Домен и хостинг</h3>
      <p className="muted set-sub">Где размещён сайт и по какому адресу открывается.</p>

      <h4 className="set-h4">Хостинг</h4>
      <div className="set-hostpick">
        <button className={"set-host" + (!external ? " is-active" : "")} onClick={() => set({ hosting: "ours" })}>
          <Server size={18} />
          <div><b>Хостинг LeadGenium</b><span className="muted">Размещение в ЕС, домен, SSL, скорость и SEO — на нас (тариф PRO).</span></div>
          {!external && <Check size={16} className="set-host__ok" />}
        </button>
        <button className={"set-host" + (external ? " is-active" : "")} onClick={() => set({ hosting: "external" })}>
          <ExternalLink size={18} />
          <div><b>Сторонний хостинг</b><span className="muted">Сайт живёт на вашем хостинге. Платформой (редактор, блог, калькуляторы, CRM) пользуетесь как обычно.</span></div>
          {external && <Check size={16} className="set-host__ok" />}
        </button>
      </div>

      {external ? (
        <div className="set-deleg">
          <ExternalLink size={16} />
          <div>
            <b>Хостинг и домен делегированы стороннему провайдеру.</b>
            <p className="muted">Размещение, DNS и SSL для <b>{s.domain || "вашего домена"}</b> управляются на вашей стороне. Мы не выпускаем SSL и не привязываем домен — публикацию сайта вы выгружаете и заливаете на свой хостинг. Остальные разделы кабинета работают полностью.</p>
          </div>
        </div>
      ) : (
        <>
          <h4 className="set-h4">Домен</h4>
          <div className="set-card">
            <div className="set-card__row">
              <div><div className="set-domain">{s.domain || "—"}</div><span className="muted">Основной домен сайта</span></div>
              <span className={"set-pill set-pill--" + s.domainStatus}>{s.domainStatus === "connected" ? "Подключён · SSL" : s.domainStatus === "pending" ? "Ожидает DNS" : "Не подключён"}</span>
            </div>
          </div>
          <label className="fld" style={{ maxWidth: 420 }}><span>Домен</span><input className="ci" value={s.domain} onChange={(e) => set({ domain: e.target.value })} placeholder="example.md" /></label>
          <p className="muted set-note">Чтобы подключить новый домен, добавьте A-запись на наш IP и напишите в «Поддержку» — разработчик выпустит SSL.</p>
        </>
      )}
    </div>
  );
}

/* ---------- Integrations ---------- */
function IntegrTab({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const setI = (p: Partial<Settings["integrations"]>) => set({ integrations: { ...s.integrations, ...p } });
  const setSt = (p: Partial<Settings["storage"]>) => set({ storage: { ...s.storage, ...p } });
  const setPub = (p: Partial<Settings["publish"]>) => set({ publish: { ...s.publish, ...p } });
  return (
    <div className="set-body">
      <h3 className="set-h">Интеграции</h3>
      <p className="muted set-sub">Аналитика и каналы. Данные попадут в раздел «Аналитика» и уведомления.</p>
      <div className="set-grid2">
        <label className="fld"><span>Google Analytics (ID)</span><input className="ci" value={s.integrations.gaId} onChange={(e) => setI({ gaId: e.target.value })} placeholder="G-XXXXXXXXXX" /></label>
        <label className="fld"><span>Facebook Pixel (ID)</span><input className="ci" value={s.integrations.pixel} onChange={(e) => setI({ pixel: e.target.value })} placeholder="1234567890" /></label>
        <label className="fld"><span>Telegram-бот (токен)</span><input className="ci" value={s.integrations.telegramBot} onChange={(e) => setI({ telegramBot: e.target.value })} placeholder="123:ABC…" /></label>
        <label className="fld"><span>Google Search Console</span>
          <label className="set-check"><input type="checkbox" checked={s.integrations.gscVerified} onChange={(e) => setI({ gscVerified: e.target.checked })} /> Сайт подтверждён</label>
        </label>
      </div>

      <h4 className="set-h4">Хранилище картинок (Supabase Storage)</h4>
      <p className="muted set-sub">Куда загружаются фото при замене на сайте. Без ключа картинки встраиваются в страницу (тяжелее). С ключом — уходят в бакет и получают постоянный URL.</p>
      <div className="set-grid2">
        <label className="fld"><span>Supabase URL</span><input className="ci" value={s.storage.url} onChange={(e) => setSt({ url: e.target.value })} placeholder="https://xxxx.supabase.co" /></label>
        <label className="fld"><span>Bucket</span><input className="ci" value={s.storage.bucket} onChange={(e) => setSt({ bucket: e.target.value })} placeholder="article-images" /></label>
        <label className="fld set-grid2__full"><span>Anon (publishable) ключ</span><input className="ci" value={s.storage.anonKey} onChange={(e) => setSt({ anonKey: e.target.value })} placeholder="sb_publishable_… (публичный ключ, безопасно)" /></label>
      </div>
      <div className={"set-storage-status " + (s.storage.url && s.storage.anonKey ? "is-on" : "is-off")}>
        {s.storage.url && s.storage.anonKey
          ? <><Check size={14} /> Загрузка в бакет <b>{s.storage.bucket || "article-images"}</b> включена</>
          : <>Ключ не задан — загрузка идёт во встроенные data-URL (fallback)</>}
      </div>

      <h4 className="set-h4">Публикация (моментальная)</h4>
      <p className="muted set-sub">Обычно настроено агентством при сборке — <b>вводить ничего не нужно</b>, кнопка «Опубликовать на сайт» работает сразу. Поля ниже — необязательное переопределение (например, свой адрес или ключ).</p>
      <div className="set-grid2">
        <label className="fld"><span>Адрес /api/publish (необязательно)</span><input className="ci" value={s.publish.endpoint} onChange={(e) => setPub({ endpoint: e.target.value })} placeholder="по умолчанию задан агентством" /></label>
        <label className="fld"><span>Ключ публикации (необязательно)</span><input className="ci" type="password" value={s.publish.editKey} onChange={(e) => setPub({ editKey: e.target.value })} placeholder="задан агентством — можно оставить пустым" /></label>
      </div>
      <div className={"set-storage-status " + (publishConfig().editKey ? "is-on" : "is-off")}>
        {publishConfig().editKey
          ? <><Check size={14} /> Публикация на сайт настроена и готова</>
          : <>Ключ не задан ни в сборке, ни здесь — публикация недоступна</>}
      </div>
    </div>
  );
}

/* ---------- Team ---------- */
function TeamTab({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const add = () => set({ team: [...s.team, { id: "u" + Math.random().toString(36).slice(2, 6), name: "", email: "", role: "Менеджер" }] });
  const upd = (id: string, p: Partial<TeamMember>) => set({ team: s.team.map((m) => (m.id === id ? { ...m, ...p } : m)) });
  const del = (id: string) => set({ team: s.team.filter((m) => m.id !== id) });
  return (
    <div className="set-body">
      <h3 className="set-h">Команда</h3>
      <p className="muted set-sub">Кто имеет доступ к кабинету.</p>
      <div className="team">
        {s.team.map((m) => (
          <div className="team-row" key={m.id}>
            <div className="team-ava">{(m.name || "?")[0]}</div>
            <input className="ci" value={m.name} onChange={(e) => upd(m.id, { name: e.target.value })} placeholder="Имя" />
            <input className="ci" value={m.email} onChange={(e) => upd(m.id, { email: e.target.value })} placeholder="email" />
            <input className="ci team-role" value={m.role} onChange={(e) => upd(m.id, { role: e.target.value })} placeholder="Роль" />
            <button className="team-del" onClick={() => del(m.id)} title="Убрать"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <button className="btn-ghost" onClick={add}><Plus size={15} /> Пригласить участника</button>
    </div>
  );
}

/* ---------- Plan / billing ---------- */
function BillingTab({ s, set }: { s: Settings; set: (p: Partial<Settings>) => void }) {
  const current = isPro(s.plan) ? "pro" : "free";
  const pro = hasPro(s.plan, s.subscription);          // effective access right now
  const grace = inGracePeriod(s.plan, s.subscription); // cancelled but paid period not over

  const subscribePro = () => set({ plan: "PRO", subscription: { status: "active" } });
  const downgradeFree = () => set({ plan: "FREE", subscription: { status: "active" } });
  const cancel = () => set({ subscription: { status: "cancelled", endsAt: periodEnd() } });
  const resume = () => set({ subscription: { status: "active" } });

  return (
    <div className="set-body">
      <h3 className="set-h">Тариф</h3>
      <p className="muted set-sub">Free — инструменты для сайта. PRO — плюс хостинг, CRM и аналитика.</p>

      {/* Subscription status banner */}
      {isPro(s.plan) && (
        grace ? (
          <div className="set-sub-banner set-sub-banner--warn">
            <AlertTriangle size={17} />
            <div>
              <b>Подписка PRO отменена.</b>
              <p className="muted">Доступ к PRO-разделам сохраняется до <b>{fmtDate(s.subscription.endsAt)}</b>, затем они закроются. Можно возобновить в любой момент.</p>
            </div>
            <button className="btn-primary set-sub-btn" onClick={resume}>Возобновить</button>
          </div>
        ) : pro ? (
          <div className="set-sub-banner set-sub-banner--ok">
            <Crown size={17} />
            <div>
              <b>Подписка PRO активна.</b>
              <p className="muted">Хостинг, CRM, аналитика и уведомления включены. Продление ежемесячно.</p>
            </div>
            <button className="btn-ghost set-sub-btn" onClick={cancel}>Отменить подписку</button>
          </div>
        ) : (
          <div className="set-sub-banner set-sub-banner--warn">
            <AlertTriangle size={17} />
            <div>
              <b>Подписка PRO завершена.</b>
              <p className="muted">PRO-разделы закрыты. Возобновите, чтобы вернуть их — данные сохранены.</p>
            </div>
            <button className="btn-primary set-sub-btn" onClick={subscribePro}>Возобновить PRO</button>
          </div>
        )
      )}

      <div className="set-plans">
        {PLANS.map((p) => {
          const isCur = current === p.id;
          return (
            <div className={"set-plan" + (p.highlight ? " set-plan--pro" : "") + (isCur ? " is-current" : "")} key={p.id}>
              <div className="set-plan__top">
                <b className="set-plan__name">{p.name}</b>
                {isCur && <span className="set-plan__cur">Ваш тариф</span>}
              </div>
              <div className="set-plan__price">{p.price} <span>{p.per}</span></div>
              <ul className="set-plan__feats">
                {p.features.map((f) => (
                  <li key={f.t} className={f.on ? "on" : "off"}>{f.on ? <Check size={15} /> : <Minus size={15} />} {f.t}</li>
                ))}
              </ul>
              {isCur
                ? <button className="btn-ghost" disabled>Текущий тариф</button>
                : <button className={p.id === "pro" ? "btn-primary" : "btn-ghost"} onClick={() => (p.id === "pro" ? subscribePro() : downgradeFree())}>{p.id === "pro" ? "Перейти на PRO" : "Перейти на Free"}</button>}
            </div>
          );
        })}
      </div>
      <p className="muted set-note">Оплата (Stripe для ЕС · T-Bank для RU) подключается на этапе запуска. Расчёт PRO — 30 €/мес.</p>
    </div>
  );
}
