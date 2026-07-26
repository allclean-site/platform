/**
 * Article editor — write in Markdown with a live article preview and a Google-style SEO snippet.
 * Autosaves as a draft; "Опубликовать" runs local auto-SEO (slug/excerpt/meta) and marks it live.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Eye, Search, Send, Image as ImageIcon } from "lucide-react";
import { getArticle, upsertArticle, publishArticle, enrich } from "../blog/store";
import { markdownToHtml } from "../engine/blog/markdown";
import type { Article } from "../engine/blog/types";
import "./blog.css";

export function ArticleEditor() {
  const { articleId = "" } = useParams();
  const nav = useNavigate();
  const [a, setA] = useState<Article | null>(() => getArticle(articleId) ?? null);
  const [saved, setSaved] = useState(true);
  const [tab, setTab] = useState<"preview" | "seo">("preview");
  const t = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!a) return;
    setSaved(false);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => { upsertArticle(a); setSaved(true); }, 500);
    return () => clearTimeout(t.current);
  }, [a]);

  const html = useMemo(() => (a ? markdownToHtml(a.body) : ""), [a?.body]);
  const seo = useMemo(() => (a ? enrich(a) : null), [a]);

  if (!a) return <div className="art-ed__missing">Статья не найдена. <button className="linklike" onClick={() => nav("/app/blog")}>К списку</button></div>;
  const set = (p: Partial<Article>) => setA((x) => (x ? { ...x, ...p } : x));
  const setTags = (v: string) => setA((x) => (x ? { ...x, meta: { ...x.meta, tags: v.split(",").map((s) => s.trim()).filter(Boolean) } } : x));

  const publish = () => { publishArticle(a); setA({ ...a, status: "published" }); };

  return (
    <div className="art-ed">
      <div className="art-ed__bar glass">
        <button className="art-ed__back" onClick={() => nav("/app/blog")}><ArrowLeft size={16} /> Блог</button>
        <span className={"art-badge art-badge--" + a.status}>{a.status === "published" ? "Опубликовано" : "Черновик"}</span>
        <span className="art-ed__save">{saved ? <><Check size={14} /> сохранено</> : "сохраняю…"}</span>
        <button className="btn-primary" onClick={publish}><Send size={15} /> Опубликовать</button>
      </div>

      <div className="art-ed__body">
        <div className="art-ed__form">
          <input className="art-ed__titlein" value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder="Заголовок статьи" />
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
          <label className="fld art-ed__bodyfld"><span>Текст (Markdown)</span>
            <textarea className="ci art-ed__mark" value={a.body} onChange={(e) => set({ body: e.target.value })}
              placeholder={"## Подзаголовок\nАбзац текста. **Жирный**, [ссылка](https://…).\n\n- Пункт списка\n- Ещё пункт"} />
          </label>
        </div>

        <aside className="art-ed__preview">
          <div className="art-prev-head">
            <div className="seg-mini">
              <button className={"seg-mini__b" + (tab === "preview" ? " on" : "")} onClick={() => setTab("preview")}><Eye size={14} /> Статья</button>
              <button className={"seg-mini__b" + (tab === "seo" ? " on" : "")} onClick={() => setTab("seo")}><Search size={14} /> SEO</button>
            </div>
          </div>
          {tab === "preview" ? (
            <article className="art-prev">
              {a.coverUrl && <img className="art-prev__cover" src={a.coverUrl} alt={a.coverAlt || ""} />}
              <h1 className="art-prev__h1">{a.title || "Заголовок статьи"}</h1>
              {a.author && <div className="art-prev__byline">{a.author}</div>}
              <div className="art-prev__body" dangerouslySetInnerHTML={{ __html: html || "<p class='muted'>Начните писать текст слева…</p>" }} />
            </article>
          ) : (
            <div className="art-seo">
              <div className="art-seo__snippet">
                <div className="art-seo__url">allclean.md › blog › {seo?.slug}</div>
                <div className="art-seo__title">{seo?.seoTitle}</div>
                <div className="art-seo__desc">{seo?.seoDescription}</div>
              </div>
              <label className="fld"><span>SEO-заголовок (title)</span>
                <input className="ci" value={a.seoTitle || ""} onChange={(e) => set({ seoTitle: e.target.value })} placeholder={a.title} />
                <span className="art-seo__count">{(a.seoTitle || a.title).length}/60</span>
              </label>
              <label className="fld"><span>SEO-описание (description)</span>
                <textarea className="ci ci--area" rows={3} value={a.seoDescription || ""} onChange={(e) => set({ seoDescription: e.target.value })} placeholder={seo?.excerpt} />
                <span className="art-seo__count">{(a.seoDescription || seo?.excerpt || "").length}/160</span>
              </label>
              <label className="fld"><span>URL (slug)</span>
                <input className="ci" value={a.slug || ""} onChange={(e) => set({ slug: e.target.value })} placeholder={seo?.slug} />
              </label>
              <p className="art-seo__note">Пустые поля заполнятся автоматически при публикации.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
