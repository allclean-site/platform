/**
 * Blog — article manager. List of the client's articles (published + drafts) with a live SEO-ready
 * editor. Publishing runs local auto-SEO (slug/excerpt/meta) so the article is ready for the site.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Newspaper, Pencil, Trash2, Calendar } from "lucide-react";
import { loadArticles, removeArticle, newArticle, upsertArticle } from "../blog/store";
import type { Article } from "../engine/blog/types";
import "./blog.css";

export function Blog() {
  const nav = useNavigate();
  const [list, setList] = useState<Article[]>(() => loadArticles());

  const create = () => { const a = newArticle(); upsertArticle(a); nav(`/app/blog/${a.id}`); };
  const del = (a: Article) => { if (window.confirm(`Удалить статью «${a.title || "без названия"}»?`)) setList(removeArticle(a.id)); };

  return (
    <div className="blog">
      <div className="blog__head">
        <div>
          <h2 className="blog__title">Блог</h2>
          <p className="muted">Статьи с авто-SEO: заголовок, обложка, текст → «Опубликовать». Готово к RU/RO.</p>
        </div>
        <button className="btn-primary" onClick={create}><Plus size={17} /> Новая статья</button>
      </div>

      <div className="blog__list">
        {list.length === 0 && <p className="muted blog__empty">Пока нет статей. Создайте первую.</p>}
        {list.map((a) => (
          <div key={a.id} className="art-row" onClick={() => nav(`/app/blog/${a.id}`)}>
            <div className="art-row__cover" style={a.coverUrl ? { backgroundImage: `url(${a.coverUrl})` } : undefined}>
              {!a.coverUrl && <Newspaper size={20} />}
            </div>
            <div className="art-row__body">
              <div className="art-row__top">
                <h3 className="art-row__name">{a.title || "Без названия"}</h3>
                <span className={"art-badge art-badge--" + a.status}>{a.status === "published" ? "Опубликовано" : "Черновик"}</span>
              </div>
              <p className="art-row__excerpt">{a.excerpt || "Нет описания"}</p>
              <div className="art-row__meta">
                <span><Calendar size={13} /> {fmtDate(a.dateModified || a.datePublished)}</span>
                {(a.meta?.tags || []).slice(0, 3).map((t) => <span key={t} className="art-tag">{t}</span>)}
              </div>
            </div>
            <div className="art-row__acts" onClick={(e) => e.stopPropagation()}>
              <button className="art-row__act" title="Редактировать" onClick={() => nav(`/app/blog/${a.id}`)}><Pencil size={15} /></button>
              <button className="art-row__act art-row__act--danger" title="Удалить" onClick={() => del(a)}><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); } catch { return "—"; }
}
