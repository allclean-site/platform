/**
 * Publish dialog — the "Опубликовать" experience.
 *
 * Runs the auto-SEO pre-flight across EVERY page (title/description/H1/lang/alt on the final published
 * HTML), summarises edits, and hands over the deploy package (edits.json) that the build pipeline turns
 * into the live `out/`. Going live on hosting is a separate, explicitly-confirmed step (see the note),
 * so this dialog never deploys on its own.
 */

import React, { useEffect, useState } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Download, Loader2, Rocket } from "lucide-react";
import type { SiteIndex, ImportedPage } from "../editor/reassemble";
import type { SiteOverrides } from "../editor/realStore";
import type { SiteBp } from "../editor/bpStore";
import { reportForPage, type PageReport } from "../editor/publish";
import { publishConfigured, publishToSite } from "../editor/publishClient";

export function PublishDialog({
  index, dataBase, overrides, bp, onDownload, onClose,
}: {
  index: SiteIndex;
  dataBase: string;
  overrides: SiteOverrides;
  bp: SiteBp;
  onDownload: () => void;
  onClose: () => void;
}) {
  const [reports, setReports] = useState<PageReport[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [pubState, setPubState] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [pubMsg, setPubMsg] = useState("");
  const canPublish = publishConfigured();

  const doPublish = async () => {
    setPubState("publishing"); setPubMsg("");
    const r = await publishToSite(overrides, bp);
    setPubState(r.ok ? "done" : "error");
    setPubMsg(r.message);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: PageReport[] = [];
      for (const entry of index.pages) {
        try {
          const p: ImportedPage = await fetch(`${dataBase}/${entry.file}.json`).then((r) => r.json());
          out.push(reportForPage(p, overrides, bp));
        } catch {
          out.push({ id: entry.id, file: entry.file, slug: entry.slug, lang: entry.lang, title: entry.title, edits: 0, issues: [{ level: "error", msg: "Не удалось загрузить страницу" }] });
        }
        if (cancelled) return;
        setProgress(out.length);
      }
      if (!cancelled) setReports(out);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = index.pages.length;
  const errors = reports ? reports.reduce((n, r) => n + r.issues.filter((i) => i.level === "error").length, 0) : 0;
  const warns = reports ? reports.reduce((n, r) => n + r.issues.filter((i) => i.level === "warn").length, 0) : 0;
  const edits = reports ? reports.reduce((n, r) => n + r.edits, 0) : 0;
  const clean = reports ? reports.filter((r) => r.issues.length === 0).length : 0;

  return (
    <div className="pub__scrim" onClick={onClose}>
      <div className="pub glass" onClick={(e) => e.stopPropagation()}>
        <div className="pub__head">
          <span className="pub__title"><Rocket size={18} /> Публикация сайта</span>
          <button className="pub__x" onClick={onClose} title="Закрыть"><X size={18} /></button>
        </div>

        {!reports ? (
          <div className="pub__loading">
            <Loader2 size={22} className="pub__spin" />
            <p>Проверяю страницы… {progress} из {total}</p>
          </div>
        ) : (
          <>
            <div className="pub__summary">
              <div className="pub__stat"><b>{total}</b><span>страниц</span></div>
              <div className="pub__stat"><b>{edits}</b><span>правок</span></div>
              <div className="pub__stat pub__stat--ok"><b>{clean}</b><span>без замечаний</span></div>
              <div className={"pub__stat" + (errors ? " pub__stat--err" : "")}><b>{errors}</b><span>ошибок SEO</span></div>
              <div className={"pub__stat" + (warns ? " pub__stat--warn" : "")}><b>{warns}</b><span>предупреждений</span></div>
            </div>

            <div className="pub__gate">
              {errors === 0
                ? <p className="pub__gate-ok"><CheckCircle2 size={16} /> Проверка SEO пройдена — критичных проблем нет, сайт готов к публикации.</p>
                : <p className="pub__gate-err"><XCircle size={16} /> Есть {errors} критичных SEO-проблем. Их стоит исправить до публикации.</p>}
            </div>

            <div className="pub__list">
              {reports.map((r) => (
                <div key={r.id} className="pub__page">
                  <div className="pub__page-head">
                    {r.issues.some((i) => i.level === "error")
                      ? <XCircle size={15} className="pub__ic pub__ic--err" />
                      : r.issues.length
                        ? <AlertTriangle size={15} className="pub__ic pub__ic--warn" />
                        : <CheckCircle2 size={15} className="pub__ic pub__ic--ok" />}
                    <span className="pub__page-title">{r.title.replace(/ [—|].*$/, "")}</span>
                    <span className="pub__page-slug">{r.lang !== index.defaultLocale ? `/${r.lang}` : ""}{r.slug}</span>
                    {r.edits > 0 && <span className="pub__page-edits">{r.edits} правок</span>}
                  </div>
                  {r.issues.length > 0 && (
                    <ul className="pub__issues">
                      {r.issues.map((i, k) => (
                        <li key={k} className={"pub__issue pub__issue--" + i.level}>
                          {i.level === "error" ? <XCircle size={12} /> : <AlertTriangle size={12} />} {i.msg}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="pub__foot">
              {canPublish ? (
                <p className="pub__note">
                  <b>Опубликовать на сайт</b> — правки сохраняются и сайт автоматически пересобирается с авто-SEO
                  (title, описания, Open Graph, JSON-LD, sitemap, IndexNow). Обычно занимает 1–2 минуты.
                </p>
              ) : (
                <p className="pub__note">
                  Скачивается <b>пакет правок</b> (edits.json) для сборки. Чтобы публиковать <b>в один клик</b>,
                  задайте адрес <i>/api/publish</i> в разделе <i>Настройки → Публикация</i>.
                </p>
              )}
              {pubMsg && (
                <p className={"pub__result " + (pubState === "error" ? "is-err" : "is-ok")}>
                  {pubState === "error" ? <XCircle size={15} /> : <CheckCircle2 size={15} />} {pubMsg}
                </p>
              )}
              <div className="pub__actions">
                <button className="pub__btn-ghost" onClick={onClose}>Закрыть</button>
                <button className="pub__btn-ghost" onClick={onDownload}>
                  <Download size={15} /> Скачать пакет
                </button>
                {canPublish && (
                  <button className="pub__btn-primary" onClick={doPublish} disabled={pubState === "publishing"}>
                    {pubState === "publishing" ? <><Loader2 size={15} className="pub__spin" /> Публикую…</> : <><Rocket size={15} /> Опубликовать на сайт</>}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
