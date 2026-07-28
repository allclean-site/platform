/** Карточка клиента — fullscreen tab for one customer: contacts (+Viber/WhatsApp), documents
 * (contracts / acceptance acts, uploaded by staff), and the client's projects. */

import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, UserRound, FileText, FolderKanban, Upload, Download, Trash2, Plus, X,
  MessageCircle, ExternalLink,
} from "lucide-react";
import {
  getAClient, projectsOf, docsOf, memberName, addDoc, removeDoc, addProject, phoneDigits, eur,
  STAGE_LABEL, type DocItem, type ProjectType,
} from "../agency/data";
import { useAuth } from "../auth/AuthContext";
import "./agency-ui.css";
import "./client-card.css";

const DOC_KIND: Record<DocItem["kind"], string> = { contract: "Договор", act: "Акт", invoice: "Инвойс", other: "Документ" };
type Tab = "contacts" | "docs" | "projects";

export function ClientCard() {
  const { clientId = "" } = useParams();
  const nav = useNavigate();
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("contacts");
  const [, force] = useState(0);
  const client = getAClient(clientId);
  const projects = useMemo(() => projectsOf(clientId), [clientId, tab]);
  const docs = useMemo(() => docsOf(clientId), [clientId, tab]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!client) return <div className="agp"><button className="ag-back" onClick={() => nav("/app/agency/clients")}><ArrowLeft size={14} /> Клиенты</button><div className="card ag-empty">Клиент не найден.</div></div>;

  const primary = client.contacts.find((c) => c.primary) ?? client.contacts[0];
  const onFiles = (files: FileList | null, kind: DocItem["kind"]) => {
    if (!files) return;
    [...files].forEach((f) => addDoc(clientId, { name: f.name, kind, sizeKB: Math.round(f.size / 1024), uploadedBy: session?.name ?? "Сотрудник" }));
    force((x) => x + 1);
  };

  return (
    <div className="agp cc">
      <button className="ag-back" onClick={() => nav("/app/agency/clients")}><ArrowLeft size={14} /> Все клиенты</button>

      <div className="cc__head card">
        <span className="ag-ava cc__ava" style={{ background: client.accent }}>{client.initials}</span>
        <div className="cc__id">
          <h2 className="cc__name">{client.name}</h2>
          <span className="muted">{client.company ?? ""}</span>
        </div>
        <div className="cc__facts">
          <span className={"ag-badge " + (client.plan === "pro" ? "ag-badge--pro" : "ag-badge--soft")}>{client.plan === "pro" ? "PRO" : "Free"}</span>
          <span className="muted">Менеджер: {memberName(client.managerId)}</span>
          <span className="muted">Клиент с {new Date(client.since).toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</span>
        </div>
      </div>

      <div className="ag-tabs">
        <button className={"ag-tab" + (tab === "contacts" ? " on" : "")} onClick={() => setTab("contacts")}><UserRound size={16} /> Контакты</button>
        <button className={"ag-tab" + (tab === "docs" ? " on" : "")} onClick={() => setTab("docs")}><FileText size={16} /> Документы <span className="ag-tab__count">{docs.length}</span></button>
        <button className={"ag-tab" + (tab === "projects" ? " on" : "")} onClick={() => setTab("projects")}><FolderKanban size={16} /> Проекты <span className="ag-tab__count">{projects.length}</span></button>
      </div>

      {tab === "contacts" && (
        <div className="cc__contacts">
          <div className="card cc__contact">
            <div className="cc__c-h"><UserRound size={16} /> {primary ? primary.name : "Контакт не указан"}{primary?.role ? <span className="muted"> · {primary.role}</span> : null}</div>
            {primary?.phone && <div className="cc__c-row"><Phone size={15} /> <a href={`tel:${primary.phone}`}>{primary.phone}</a></div>}
            {primary?.email && <div className="cc__c-row"><Mail size={15} /> <a href={`mailto:${primary.email}`}>{primary.email}</a></div>}
            {primary?.phone && (
              <div className="ag-cbtns cc__cbtns">
                <a className="ag-cbtn ag-cbtn--wa" href={`https://wa.me/${phoneDigits(primary.phone)}`} target="_blank" rel="noopener"><MessageCircle size={15} /> WhatsApp</a>
                <a className="ag-cbtn ag-cbtn--vb" href={`viber://chat?number=%2B${phoneDigits(primary.phone)}`}><MessageCircle size={15} /> Viber</a>
                <a className="ag-cbtn" href={`tel:${primary.phone}`}><Phone size={15} /> Позвонить</a>
              </div>
            )}
          </div>
          {client.notes && <div className="card"><div className="cc__c-h">Заметки</div><p className="muted" style={{ margin: 0 }}>{client.notes}</p></div>}
        </div>
      )}

      {tab === "docs" && (
        <div className="card cc__docs">
          <div className="cc__docs-h">
            <span className="muted">Договоры, акты приёмо-передачи и другие файлы. Загружает сотрудник.</span>
            <div className="ag-cbtns">
              <button className="ag-cbtn" onClick={() => { fileRef.current?.setAttribute("data-kind", "contract"); fileRef.current?.click(); }}><Upload size={15} /> Договор</button>
              <button className="ag-cbtn" onClick={() => { fileRef.current?.setAttribute("data-kind", "act"); fileRef.current?.click(); }}><Upload size={15} /> Акт</button>
              <button className="ag-cbtn" onClick={() => { fileRef.current?.setAttribute("data-kind", "other"); fileRef.current?.click(); }}><Plus size={15} /> Файл</button>
            </div>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onFiles(e.target.files, (e.target.getAttribute("data-kind") as DocItem["kind"]) || "other"); e.target.value = ""; }} />
          </div>
          {docs.length === 0 ? <div className="ag-empty">Пока нет документов. Загрузите договор или акт.</div> : (
            <ul className="cc__doclist">
              {docs.map((d) => (
                <li key={d.id} className="cc__doc">
                  <span className="cc__doc-ic"><FileText size={17} /></span>
                  <div className="cc__doc-body">
                    <b>{d.name}</b>
                    <span className="muted">{DOC_KIND[d.kind]} · {d.sizeKB ? `${d.sizeKB} КБ · ` : ""}{new Date(d.uploadedAt).toLocaleDateString("ru-RU")} · {d.uploadedBy}</span>
                  </div>
                  <button className="cc__doc-b" title="Скачать (заглушка)"><Download size={15} /></button>
                  <button className="cc__doc-b cc__doc-b--del" title="Удалить" onClick={() => { removeDoc(d.id); force((x) => x + 1); }}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "projects" && (
        <div className="cc__projects">
          <div className="cc__proj-head"><span className="muted">{projects.length} проектов у клиента</span><NewProjectBtn clientId={clientId} onAdd={() => force((x) => x + 1)} /></div>
          <div className="cc__proj-grid">
            {projects.map((p) => {
              const pct = p.priceTotal ? Math.round((p.pricePaid / p.priceTotal) * 100) : 0;
              return (
                <div key={p.id} className="cc-proj card">
                  <div className="cc-proj__top"><span className="ag-badge ag-badge--soft">{p.type}</span><span className={"ag-badge stage-" + p.stage}>{STAGE_LABEL[p.stage]}</span></div>
                  <h4 className="cc-proj__title">{p.title}</h4>
                  <p className="muted cc-proj__sum">{p.summary || "Без описания"}</p>
                  <div className="ag-money cc-proj__money"><b>{eur(p.pricePaid)} / {eur(p.priceTotal)} €<span className="muted"> · {pct}%</span></b><div className="bar"><span style={{ width: `${pct}%` }} /></div></div>
                  <button className="cc-proj__go" onClick={() => nav(`/app/agency/clients/${clientId}/projects/${p.id}`)}>Перейти к проекту <ExternalLink size={14} /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NewProjectBtn({ clientId, onAdd }: { clientId: string; onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(""); const [type, setType] = useState<ProjectType>("Сайт"); const [price, setPrice] = useState("");
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!title.trim()) return; addProject(clientId, { title, type, priceTotal: Number(price) || 0 }); setOpen(false); setTitle(""); setPrice(""); onAdd(); };
  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> Новый проект</button>;
  return (
    <>
      <div className="nc__scrim" onClick={() => setOpen(false)} />
      <form className="nc card" onSubmit={submit}>
        <div className="nc__head"><h3><FolderKanban size={18} /> Новый проект</h3><button type="button" className="nc__x" onClick={() => setOpen(false)}><X size={18} /></button></div>
        <div className="nc__grid">
          <label className="fld nc__wide"><span>Название *</span><input className="ci" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Основной сайт" /></label>
          <label className="fld"><span>Тип</span><select className="ci" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>{["Сайт", "Лендинг", "SEO", "Интернет-магазин", "Другое"].map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="fld"><span>Стоимость, €</span><input className="ci" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1000" /></label>
        </div>
        <div className="nc__act"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Отмена</button><button type="submit" className="btn-primary">Создать</button></div>
      </form>
    </>
  );
}
