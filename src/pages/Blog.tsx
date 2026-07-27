/**
 * Blog — article manager. List of the client's articles (published + drafts) with a live SEO-ready
 * editor. Publishing runs local auto-SEO (slug/excerpt/meta) so the article is ready for the site.
 */

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Newspaper, Pencil, Trash2, Calendar } from "lucide-react";
import { loadArticles, removeArticle, newArticle, upsertArticle } from "../blog/store";
import type { Article } from "../engine/blog/types";
import "./blog.css";

const LOC_SHORT: Record<string, string> = { ro: "RO", ru: "RU" };

export function Blog() {
  const nav = useNavigate();
  const [list, setList] = useState<Article[]>(() => loadArticles());

  // One row per bilingual group (both locale versions share `group`); show which languages exist.
  const groups = useMemo(() => {
    const byGroup = new Map<string, Article[]>();
    for (const a of list) { const arr = byGroup.get(a.group) || []; arr.push(a); byGroup.set(a.group, arr); }
    return [...byGroup.values()].map((arr) => {
      const main = arr.find((x) => x.locale === (x.sourceLocale || x.locale)) || arr[0];
      return { main, locales: arr.map((x) => x.locale), ids: arr.map((x) => x.id) };
    });
  }, [list]);

  const create = () => { const a = newArticle("ro"); upsertArticle(a); nav(`/app/blog/${a.id}`); };
  const del = (main: Article, ids: string[]) => {
    if (!window.confirm(`Удалить статью «${main.title || "без названия"}» (все языковые версии)?`)) return;
    let next = list; for (const id of ids) next = removeArticle(id); setList(next);
  };

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
        {groups.length === 0 && <p className="muted blog__empty">Пока нет статей. Создайте первую.</p>}
        {groups.map(({ main: a, locales, ids }) => (
          <div key={a.group} className="art-row" onClick={() => nav(`/app/blog/${a.id}`)}>
            <div className="art-row__cover" style={a.coverUrl ? { backgroundImage: `url(${a.coverUrl})` } : undefined}>
              {!a.coverUrl && <Newspaper size={20} />}
            </div>
            <div className="art-row__body">
              <div className="art-row__top">
                <h3 className="art-row__name">{a.title || "Без названия"}</h3>
                {["ro", "ru"].map((l) => <span key={l} className={"art-locpill" + (locales.includes(l) ? " on" : "")}>{LOC_SHORT[l]}</span>)}
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
              <button className="art-row__act art-row__act--danger" title="Удалить" onClick={() => del(a, ids)}><Trash2 size={15} /></button>
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
