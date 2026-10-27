/**
 * Blog — article manager. List of the client's articles (published + drafts) with a live SEO-ready
 * editor. Publishing runs local auto-SEO (slug/excerpt/meta) so the article is ready for the site.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Newspaper, Pencil, Trash2, Calendar, Check, X, RotateCcw, Loader2, AlertTriangle, ClipboardCheck } from "lucide-react";
import { loadArticles, removeArticle, newArticle, upsertArticle } from "../blog/store";
import type { Article } from "../engine/blog/types";
import { unpublishArticleGroup } from "../blog/publishArticleClient";
import { loadReview, reviewOp, openForEdit, slotIso, type ReviewRow } from "../blog/reviewClient";
import { siteApiReady } from "../editor/siteApi";
import "./blog.css";

const LOC_SHORT: Record<string, string> = { ro: "RO", ru: "RU" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Blog() {
  const nav = useNavigate();
  const [list, setList] = useState<Article[]>(() => loadArticles());

  // One row per bilingual group (both locale versions share `group`); show which languages exist.
  const groups = useMemo(() => {
    const byGroup = new Map<string, Article[]>();
    // Копии черновиков с проверки живут в разделе «На проверке», в общем списке их нет.
    for (const a of list) { if (a.reviewId) continue; const arr = byGroup.get(a.group) || []; arr.push(a); byGroup.set(a.group, arr); }
    return [...byGroup.values()].map((arr) => {
      const main = arr.find((x) => x.locale === (x.sourceLocale || x.locale)) || arr[0];
      return { main, locales: arr.map((x) => x.locale), ids: arr.map((x) => x.id) };
    });
  }, [list]);

  const create = () => { const a = newArticle("ro"); upsertArticle(a); nav(`/app/blog/${a.id}`); };
  const del = async (main: Article, ids: string[]) => {
    // На сайт уходят только группы с uuid (newGroupId); у старых локальных черновиков его нет.
    const onSite = list.some((a) => a.group === main.group && a.status === "published") && UUID.test(main.group);
    const name = main.title || "без названия";
    if (!window.confirm(onSite
      ? `Удалить статью «${name}»? Она будет снята с сайта (обе языковые версии).`
      : `Удалить статью «${name}» (все языковые версии)?`)) return;
    // Сначала снять с сайта: раньше удаление стирало статью только из браузера, а страница
    // оставалась на сайте, и убрать её из кабинета было уже нечем.
    if (onSite) {
      const r = await unpublishArticleGroup(main.group);
      if (!r.ok) { window.alert(r.message); return; }
    }
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

      <ReviewSection onEdit={(id) => nav(`/app/blog/${id}`)} />

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

/**
 * «На проверке»: черновики конвейера из базы. Без «Одобрить» статья на сайт не попадает; после
 * одобрения её публикует расписание в назначенный день (api/publish-scheduled.js).
 */
function ReviewSection({ onEdit }: { onEdit: (id: string) => void }) {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [suggested, setSuggested] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string | undefined>>({});
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});

  const reload = useCallback(async () => {
    if (!siteApiReady()) return;
    setState("loading");
    const r = await loadReview();
    if (!r.ok) { setState("error"); setErr(r.error); return; }
    setRows(r.rows); setSuggested(r.suggested); setState("idle");
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  if (!siteApiReady()) return null;
  const review = rows.filter((r) => r.status === "review");
  const planned = rows.filter((r) => r.status === "approved").sort((a, b) => String(a.publish_at).localeCompare(String(b.publish_at)));
  const rejected = rows.filter((r) => r.status === "rejected").slice(0, 5);

  const run = async (row: ReviewRow, op: "approve" | "unapprove" | "reject", extra: Record<string, unknown> = {}) => {
    setBusy(row.id);
    const r = await reviewOp(op, { id: row.id, ...extra });
    setBusy("");
    const ok = op === "approve" ? `Одобрено, выйдет ${fmtDate(r.data?.publish_at || "")}` : op === "reject" ? "Отклонено" : "Снято с графика";
    setMsg((m) => ({ ...m, [row.id]: { ok: r.ok, text: r.ok ? ok : r.error } }));
    if (r.ok) { setNotes((n) => ({ ...n, [row.id]: undefined })); await reload(); }
  };

  if (state === "error") return <div className="rev rev--err"><AlertTriangle size={15} /> На проверке: {err} <button className="linklike" onClick={reload}>Повторить</button></div>;
  if (!review.length && !planned.length && state !== "loading") return null;

  return (
    <section className="rev" aria-label="На проверке">
      <div className="rev__head">
        <h3 className="rev__title"><ClipboardCheck size={17} /> На проверке {review.length > 0 && <span className="rev__count">{review.length}</span>}</h3>
        {state === "loading" && <Loader2 size={15} className="art-spin" />}
      </div>
      {review.map((r) => {
        const checks = r.meta?.checks || {};
        const day = days[r.id] ?? String(suggested[r.id] || "").slice(0, 10);
        const note = notes[r.id];
        return (
          <article key={r.id} className="rev-card">
            <div className="rev-card__top">
              <span className="art-locpill on">{(r.locale || "").toUpperCase()}</span>
              {r.meta?.queue?.id && <span className="rev-card__topic">Тема {r.meta.queue.id} · {r.meta.queue.query}</span>}
            </div>
            <h4 className="rev-card__name">{r.title}</h4>
            {r.excerpt && <p className="rev-card__excerpt">{r.excerpt}</p>}
            {(checks.errors || []).length > 0 && (
              <ul className="rev-card__checks is-err">{(checks.errors || []).map((e) => <li key={e}>{e}</li>)}</ul>
            )}
            {(checks.warnings || []).length > 0 && (
              <ul className="rev-card__checks">{(checks.warnings || []).map((e) => <li key={e}>{e}</li>)}</ul>
            )}
            <div className="rev-card__acts">
              <label className="rev-card__date">Выход
                <input type="date" className="ci" value={day} onChange={(e) => setDays((d) => ({ ...d, [r.id]: e.target.value }))} />
              </label>
              <button className="btn-primary" disabled={busy === r.id} onClick={() => run(r, "approve", day ? { publishAt: slotIso(day) } : {})}>
                {busy === r.id ? <Loader2 size={15} className="art-spin" /> : <Check size={15} />} Одобрить
              </button>
              <button className="btn-ghost" onClick={() => onEdit(openForEdit(r).id)}><Pencil size={15} /> Поправить</button>
              <button className="btn-ghost rev-card__reject" onClick={() => setNotes((n) => ({ ...n, [r.id]: note === undefined ? "" : undefined }))}><X size={15} /> Отклонить</button>
            </div>
            {note !== undefined && (
              <div className="rev-card__note">
                <textarea className="ci ci--area" rows={2} value={note} placeholder="Что не так (уйдёт в следующий черновик этой темы)"
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
                <button className="btn-ghost rev-card__reject" disabled={busy === r.id} onClick={() => run(r, "reject", { note })}>Отклонить статью</button>
              </div>
            )}
            {msg[r.id] && <div className={"rev-card__msg" + (msg[r.id].ok ? "" : " is-err")}>{msg[r.id].text}</div>}
          </article>
        );
      })}
      {planned.length > 0 && (
        <div className="rev__planned">
          <div className="rev__sub">В графике</div>
          {planned.map((r) => (
            <div key={r.id} className="rev-line">
              <span className="art-locpill on">{(r.locale || "").toUpperCase()}</span>
              <span className="rev-line__date"><Calendar size={13} /> {fmtDate(r.publish_at || "")}</span>
              <span className="rev-line__name">{r.title}</span>
              <button className="linklike" disabled={busy === r.id} onClick={() => run(r, "unapprove")}><RotateCcw size={13} /> Вернуть на проверку</button>
            </div>
          ))}
        </div>
      )}
      {rejected.length > 0 && (
        <div className="rev__planned">
          <div className="rev__sub">Отклонённые</div>
          {rejected.map((r) => (
            <div key={r.id} className="rev-line">
              <span className="art-locpill on">{(r.locale || "").toUpperCase()}</span>
              <span className="rev-line__name">{r.title}</span>
              {r.review_note && <span className="rev-line__note">{r.review_note}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }); } catch { return "—"; }
}
