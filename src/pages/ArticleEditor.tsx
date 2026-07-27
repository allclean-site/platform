/**
 * Bilingual article editor. Write in one language; "Перевести и SEO" runs the server (Claude) to
 * translate to the other language and generate SEO/GEO/AEO metadata for both. Locale tabs switch which
 * version you edit; "Опубликовать" shows a side-by-side preview of both versions before going live.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Eye, Search, Send, Image as ImageIcon, Languages, Loader2, X } from "lucide-react";
import { getArticle, getGroup, upsertArticle, publishArticle, enrich, newCounterpart } from "../blog/store";
import { markdownToHtml } from "../engine/blog/markdown";
import { translateArticle, translateConfigured } from "../blog/translateClient";
import { publishArticlesToSite } from "../blog/publishArticleClient";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Article, Locale } from "../engine/blog/types";
import "./blog.css";

const LOCALES: Locale[] = ["ro", "ru"];
const LOC_LABEL: Record<string, string> = { ro: "Румынский", ru: "Русский" };
const other = (l: Locale): Locale => (l === "ro" ? "ru" : "ro");

const articleUrl = (locale: Locale, slug: string) => (locale === "ro" ? `allclean.md › blog › ${slug}` : `allclean.md › ru › blog › ${slug}`);

export function ArticleEditor() {
  const { articleId = "" } = useParams();
  const nav = useNavigate();

  // Load the whole bilingual group (both locale versions share `group`).
  const [vers, setVers] = useState<Record<string, Article>>(() => {
    const a = getArticle(articleId);
    if (!a) return {};
    const g = getGroup(a.group);
    return Object.keys(g).length ? g : { [a.locale]: a };
  });
  // Source = the language the author wrote in. New articles set sourceLocale; older ones fall back to
  // their own locale so they open on the version that actually has content.
  const first = Object.values(vers)[0];
  const source: Locale = (first?.sourceLocale as Locale) || (first?.locale as Locale) || "ro";
  const [active, setActive] = useState<Locale>(source);
  const [tab, setTab] = useState<"preview" | "seo">("preview");
  const [saved, setSaved] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [err, setErr] = useState("");
  const [showPub, setShowPub] = useState(false);
  const [pubState, setPubState] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [pubMsg, setPubMsg] = useState("");
  const t = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!Object.keys(vers).length) return;
    setSaved(false);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => { Object.values(vers).forEach(upsertArticle); setSaved(true); }, 600);
    return () => clearTimeout(t.current);
  }, [vers]);

  const a = vers[active];
  const html = useMemo(() => (a ? markdownToHtml(a.body) : ""), [a?.body]);
  const seo = useMemo(() => (a ? enrich(a) : null), [a]);

  if (!Object.keys(vers).length) return <div className="art-ed__missing">Статья не найдена. <button className="linklike" onClick={() => nav("/app/blog")}>К списку</button></div>;

  const set = (p: Partial<Article>) => setVers((v) => ({ ...v, [active]: { ...v[active], ...p } }));
  const setTags = (val: string) => set({ meta: { ...a.meta, tags: val.split(",").map((s) => s.trim()).filter(Boolean) } });

  const doTranslate = async () => {
    const s = vers[source];
    if (!s?.title?.trim() || !s?.body?.trim()) { setErr("Заполните заголовок и текст оригинала перед переводом."); setActive(source); return; }
    setErr(""); setTranslating(true);
    try {
      const tl = other(source);
      const r = await translateArticle(s.title, s.body, source, tl);
      const src2: Article = { ...s, slug: s.slug || r.source.slug, excerpt: r.source.excerpt, seoTitle: s.seoTitle || r.source.seo_title, seoDescription: s.seoDescription || r.source.seo_description, meta: { faq: r.source.faq, takeaways: r.source.takeaways, tags: r.source.tags } };
      const base = vers[tl] || newCounterpart(s, tl);
      const tgt: Article = { ...base, title: r.target.title, body: r.target.body, slug: r.target.slug, excerpt: r.target.excerpt, seoTitle: r.target.seo_title, seoDescription: r.target.seo_description, meta: { faq: r.target.faq, takeaways: r.target.takeaways, tags: r.target.tags }, autoTranslated: true, sourceLocale: source };
      setVers((v) => ({ ...v, [source]: src2, [tl]: tgt }));
      setActive(tl);
    } catch (e: any) { setErr(String(e?.message || e)); }
    finally { setTranslating(false); }
  };

  const doPublish = async () => {
    setPubState("publishing"); setPubMsg("");
    // Fill slug/excerpt/SEO, mark published locally, then push both versions to the live site.
    const enriched = Object.values(vers).filter((v) => v.title?.trim()).map((v) => enrich({ ...v, status: "published" as const, datePublished: v.datePublished || new Date().toISOString() }));
    enriched.forEach(publishArticle);
    setVers((v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, { ...x, status: "published" as const }])));
    const r = await publishArticlesToSite(enriched);
    setPubState(r.ok ? "done" : "error"); setPubMsg(r.message);
  };

  const status = vers[source]?.status || "draft";
  const bothReady = LOCALES.every((l) => vers[l]?.title?.trim());

  return (
    <div className="art-ed">
      <div className="art-ed__bar glass">
        <button className="art-ed__back" onClick={() => nav("/app/blog")}><ArrowLeft size={16} /> Блог</button>
        <span className={"art-badge art-badge--" + status}>{status === "published" ? "Опубликовано" : "Черновик"}</span>
        {/* Locale tabs */}
        <div className="art-langs">
          {LOCALES.map((l) => {
            const v = vers[l];
            const isSrc = l === source;
            return (
              <button key={l} className={"art-lang" + (active === l ? " is-active" : "") + (!v?.title && !isSrc ? " is-empty" : "")} onClick={() => setActive(l)}>
                {LOC_LABEL[l]}
                <span className="art-lang__tag">{isSrc ? "оригинал" : v?.autoTranslated ? "перевод · авто" : v?.title ? "перевод" : "нет"}</span>
              </button>
            );
          })}
        </div>
        <button className="btn-ghost art-ed__translate" onClick={doTranslate} disabled={translating}>
          {translating ? <><Loader2 size={15} className="art-spin" /> Перевожу…</> : <><Languages size={15} /> Перевести и SEO</>}
        </button>
        <span className="art-ed__save">{saved ? <><Check size={14} /> сохранено</> : "сохраняю…"}</span>
        <button className="btn-primary" onClick={() => setShowPub(true)}><Send size={15} /> Опубликовать</button>
      </div>

      {err && <div className="art-ed__err"><X size={14} onClick={() => setErr("")} /> {err}{!translateConfigured() && " — задайте адрес /api/publish в Настройках → Публикация."}</div>}

      <div className="art-ed__body">
        {a ? (
          <div className="art-ed__form">
            {active !== source && a.autoTranslated && <div className="art-ed__auto"><Languages size={13} /> Автоперевод — проверьте и при необходимости поправьте текст.</div>}
            <input className="art-ed__titlein" value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder={active === source ? "Заголовок статьи" : "Появится после перевода"} />
            <div className="art-fld-row">
              <label className="fld"><span><ImageIcon size={13} /> Обложка (URL)</span>
                <input className="ci" value={a.coverUrl || ""} onChange={(e) => set({ coverUrl: e.target.value })} placeholder="https://…/cover.jpg" />
              </label>
              <label className="fld"><span>Alt обложки (SEO)</span>
                <input className="ci" value={a.coverAlt || ""} onChange={(e) => set({ coverAlt: e.target.value })} placeholder="Что на фото" />
              </label>
            </div>
            <div className="art-fld-row">
              <label className="fld"><span>Автор (E-E-A-T)</span>
                <input className="ci" value={a.author || ""} onChange={(e) => set({ author: e.target.value })} placeholder="Имя эксперта / команда" />
              </label>
              <label className="fld"><span>Метки (через запятую)</span>
                <input className="ci" value={(a.meta?.tags || []).join(", ")} onChange={(e) => setTags(e.target.value)} placeholder="Уборка, Советы" />
              </label>
            </div>
            <label className="fld art-ed__bodyfld"><span>Текст (Markdown){active === source ? " · оригинал" : " · перевод"}</span>
              <textarea className="ci art-ed__mark" value={a.body} onChange={(e) => set({ body: e.target.value })}
                placeholder={active === source ? "## Подзаголовок\nАбзац текста. **Жирный**, [ссылка](https://…).\n\n- Пункт списка" : "Нажмите «Перевести и SEO», чтобы заполнить эту версию автоматически."} />
            </label>
          </div>
        ) : <div className="art-ed__form" />}

        <aside className="art-ed__preview">
          <div className="art-prev-head">
            <div className="seg-mini">
              <button className={"seg-mini__b" + (tab === "preview" ? " on" : "")} onClick={() => setTab("preview")}><Eye size={14} /> Статья</button>
              <button className={"seg-mini__b" + (tab === "seo" ? " on" : "")} onClick={() => setTab("seo")}><Search size={14} /> SEO</button>
            </div>
            <span className="art-prev__lang">{LOC_LABEL[active]}</span>
          </div>
          {tab === "preview" ? (
            <article className="art-prev">
              {a?.coverUrl && <img className="art-prev__cover" src={a.coverUrl} alt={a.coverAlt || ""} />}
              <h1 className="art-prev__h1">{a?.title || "Заголовок статьи"}</h1>
              {a?.author && <div className="art-prev__byline">{a.author}</div>}
              <div className="art-prev__body" dangerouslySetInnerHTML={{ __html: html || "<p class='muted'>Текст появится здесь…</p>" }} />
            </article>
          ) : (
            <div className="art-seo">
              <div className="art-seo__snippet">
                <div className="art-seo__url">{articleUrl(active, seo?.slug || "")}</div>
                <div className="art-seo__title">{seo?.seoTitle}</div>
                <div className="art-seo__desc">{seo?.seoDescription}</div>
              </div>
              <label className="fld"><span>SEO-заголовок (title)</span>
                <input className="ci" value={a?.seoTitle || ""} onChange={(e) => set({ seoTitle: e.target.value })} placeholder={a?.title} />
                <span className="art-seo__count">{(a?.seoTitle || a?.title || "").length}/60</span>
              </label>
              <label className="fld"><span>SEO-описание (description)</span>
                <textarea className="ci ci--area" rows={3} value={a?.seoDescription || ""} onChange={(e) => set({ seoDescription: e.target.value })} placeholder={seo?.excerpt} />
                <span className="art-seo__count">{(a?.seoDescription || seo?.excerpt || "").length}/160</span>
              </label>
              <label className="fld"><span>URL (slug)</span>
                <input className="ci" value={a?.slug || ""} onChange={(e) => set({ slug: e.target.value })} placeholder={seo?.slug} />
              </label>
              {a?.meta?.faq && a.meta.faq.length > 0 && (
                <div className="art-seo__faq"><b>FAQ ({a.meta.faq.length})</b>{a.meta.faq.map((f, i) => <div key={i} className="art-seo__faq-q">{f.question}</div>)}</div>
              )}
            </div>
          )}
        </aside>
      </div>

      {showPub && (
        <PublishArticleDialog vers={vers} bothReady={bothReady} pubState={pubState} pubMsg={pubMsg} onPublish={doPublish} onClose={() => { setShowPub(false); setPubState("idle"); setPubMsg(""); }} />
      )}
    </div>
  );
}

/** Side-by-side preview of both language versions before publishing. */
function PublishArticleDialog({ vers, bothReady, pubState, pubMsg, onPublish, onClose }: { vers: Record<string, Article>; bothReady: boolean; pubState: "idle" | "publishing" | "done" | "error"; pubMsg: string; onPublish: () => void; onClose: () => void }) {
  return (
    <div className="artpub__scrim" onClick={onClose}>
      <div className="artpub glass" onClick={(e) => e.stopPropagation()}>
        <div className="artpub__head">
          <span className="artpub__title"><Send size={17} /> Публикация статьи — обе версии</span>
          <button className="artpub__x" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="artpub__cols">
          {LOCALES.map((l) => {
            const v = vers[l];
            const e = v ? enrich(v) : null;
            return (
              <div key={l} className="artpub__col">
                <div className="artpub__col-head">{LOC_LABEL[l]}{v?.autoTranslated && l !== (Object.values(vers)[0]?.sourceLocale) ? " · авто-перевод" : ""}</div>
                {v?.title ? (
                  <article className="artpub__prev">
                    {v.coverUrl && <img src={v.coverUrl} alt={v.coverAlt || ""} />}
                    <h2>{v.title}</h2>
                    <div className="artpub__url">{articleUrl(l, e?.slug || "")}</div>
                    <div className="artpub__body" dangerouslySetInnerHTML={{ __html: markdownToHtml(v.body).slice(0, 900) }} />
                  </article>
                ) : <div className="artpub__empty">Версия не заполнена — нажмите «Перевести и SEO».</div>}
              </div>
            );
          })}
        </div>
        <div className="artpub__foot">
          {pubMsg
            ? <span className={"artpub__result " + (pubState === "error" ? "is-err" : "is-ok")}>{pubState === "error" ? <XCircle size={15} /> : <CheckCircle2 size={15} />} {pubMsg}</span>
            : !bothReady && <span className="artpub__warn">Готова только одна версия — вторую переведите для двуязычной публикации.</span>}
          <div className="artpub__actions">
            <button className="btn-ghost" onClick={onClose}>{pubState === "done" ? "Закрыть" : "Отмена"}</button>
            {pubState !== "done" && (
              <button className="btn-primary" onClick={onPublish} disabled={pubState === "publishing"}>
                {pubState === "publishing" ? <><Loader2 size={15} className="art-spin" /> Публикую…</> : <><Send size={15} /> Опубликовать обе версии</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
