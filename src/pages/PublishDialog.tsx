/**
 * Publish dialog — the "Опубликовать" experience.
 *
 * Runs the auto-SEO pre-flight across EVERY page (title/description/H1/lang/alt on the final published
 * HTML), summarises edits, and hands over the deploy package (edits.json) that the build pipeline turns
 * into the live `out/`. Going live on hosting is a separate, explicitly-confirmed step (see the note),
 * so this dialog never deploys on its own.
 */

import React, { useEffect, useRef, useState } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Download, Loader2, Rocket, Copy } from "lucide-react";
import type { SiteIndex, ImportedPage } from "../editor/reassemble";
import type { SiteOverrides } from "../editor/realStore";
import type { SiteBp } from "../editor/bpStore";
import { reportForPage, type PageReport } from "../editor/publish";
import { publishConfigured, publishToSite } from "../editor/publishClient";
import { Dialog } from "../components/Dialog";
import { listVersions, restoreVersion, type SiteVersion } from "../editor/versionsClient";
import { isSharedKey, langOfSharedKey, resolveShared } from "../editor/sharedBlocks";
import type { PageOverrides } from "../editor/realStore";

export function PublishDialog({
  index, dataBase, overrides, bp, onDownload, onClose, publishedBy = "", othersPages = [],
}: {
  index: SiteIndex;
  dataBase: string;
  overrides: SiteOverrides;
  bp: SiteBp;
  /** Receives the FINAL overrides (shared header/footer edits already expanded per page). */
  onDownload: (overrides: SiteOverrides) => void;
  onClose: () => void;
  /** Shown in the version history as who published. */
  publishedBy?: string;
  /** Override keys whose pending edits came from the shared draft — someone else's work in progress. */
  othersPages?: string[];
}) {
  // Publishing pushes the merged state, so a client can end up shipping the agency's unfinished work
  // (and the other way round). Every edited page can be left out of this publish instead.
  const [skip, setSkip] = useState<Set<string>>(() => new Set());
  const toggleSkip = (id: string) =>
    setSkip((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const others = new Set(othersPages);
  const sharedFromOthers = othersPages.some(isSharedKey);
  const [reports, setReports] = useState<PageReport[] | null>(null);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [pubState, setPubState] = useState<"idle" | "publishing" | "done" | "error">("idle");
  const [pubMsg, setPubMsg] = useState("");
  const [pubDetail, setPubDetail] = useState("");
  const [copied, setCopied] = useState(false);
  const [versions, setVersions] = useState<SiteVersion[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreMsg, setRestoreMsg] = useState("");
  /** Pages where a shared header/footer edit could not be placed — named rather than silently dropped. */
  const [missed, setMissed] = useState<string[]>([]);
  const canPublish = publishConfigured();
  // Nothing was changed anywhere (this browser, the shared draft, or what is already live). Scanning
  // 38 pages to tell someone that is ten seconds spent proving there is nothing to say.
  const nothingToPublish =
    Object.values(overrides).every((o) => !o || !Object.keys(o).length) &&
    Object.values(bp).every((p) => !p || (!Object.keys(p.tablet ?? {}).length && !Object.keys(p.mobile ?? {}).length
      && !Object.keys(p.hover ?? {}).length && !Object.keys(p.active ?? {}).length));

  /**
   * Header and footer edits are stored once per locale as a patch. The site and the static build know
   * nothing about that — they take plain per-page HTML — so the patch is expanded here, against each
   * page's OWN copy of the block, which is also the only place that already loads every page.
   */
  const expanded = useRef<SiteOverrides>({});
  const scanned = useRef<Set<string>>(new Set());
  const missedOn = useRef<Set<string>>(new Set());
  const hasShared = Object.keys(overrides).some(isSharedKey);

  const expandForPage = (p: ImportedPage): PageOverrides => {
    const out: PageOverrides = { ...(overrides[p.id] || {}) };
    for (const key of Object.keys(overrides)) {
      if (!isSharedKey(key) || langOfSharedKey(key) !== p.lang) continue;
      for (const blockId of Object.keys(overrides[key])) {
        const val = overrides[key][blockId];
        if (val == null || out[blockId] != null) continue;   // a page-specific edit is more specific
        const base = p.blocks.find((b) => b.id === blockId)?.content.html;
        if (base == null) continue;
        const r = resolveShared(base, val);
        out[blockId] = r.html;
        if (r.missed) missedOn.current.add(p.slug);
      }
    }
    return out;
  };
  const noteScanned = (p: ImportedPage) => {
    expanded.current[p.id] = expandForPage(p);
    scanned.current.add(p.id);
  };
  /** Pages the scan has not reached yet still have to be expanded before anything is published. */
  const ensureExpanded = async (): Promise<SiteOverrides> => {
    if (!hasShared) return overrides;
    for (const entry of index.pages) {
      if (scanned.current.has(entry.id)) continue;
      try {
        const p: ImportedPage = await fetch(`${dataBase}/${entry.file}.json`).then((r) => r.json());
        noteScanned(p);
      } catch { /* a page we cannot read keeps whatever it already had */ }
    }
    return expanded.current;
  };

  /** Only the pages the client left checked. Untouched pages carry nothing, so they cost nothing. */
  const selected = (all: SiteOverrides): SiteOverrides => {
    if (!skip.size) return all;
    const out: SiteOverrides = {};
    for (const pid of Object.keys(all)) if (!skip.has(pid)) out[pid] = all[pid];
    return out;
  };
  const selectedBp = (): SiteBp => {
    if (!skip.size) return bp;
    const out: SiteBp = {};
    for (const pid of Object.keys(bp)) if (!skip.has(pid)) out[pid] = bp[pid];
    return out;
  };

  const doPublish = async () => {
    setPubState("publishing"); setPubMsg(""); setPubDetail(""); setCopied(false);
    const payload = selected(await ensureExpanded());
    const r = await publishToSite(payload, selectedBp(), publishedBy);
    setPubState(r.ok ? "done" : "error");
    setPubMsg(r.message);
    setPubDetail(r.detail ?? "");
    if (r.ok) setVersions(null);     // a new restore point exists now
  };
  const openHistory = async () => {
    setShowHistory((v) => !v);
    if (versions === null) setVersions(await listVersions());
  };
  const doRestore = async (v: SiteVersion) => {
    const when = new Date(v.createdAt).toLocaleString("ru-RU");
    if (!window.confirm(`Вернуть версию от ${when}?

Сайт будет пересобран и посетители увидят её. Текущая версия останется в истории.`)) return;
    setRestoring(v.id); setRestoreMsg("");
    const r = await restoreVersion(v.id);
    setRestoring(null);
    setRestoreMsg(r.ok
      ? `Версия от ${when} возвращена — сайт пересобирается (1–2 минуты).`
      : "Не удалось вернуть версию. Проверьте связь и попробуйте ещё раз.");
    if (r.ok) setVersions(await listVersions());
  };

  const copyError = () => {
    navigator.clipboard?.writeText(`${pubMsg}\n\n${pubDetail}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  useEffect(() => {
    if (nothingToPublish) { setScanning(false); return; }
    expanded.current = Object.fromEntries(Object.entries(overrides).filter(([k]) => !isSharedKey(k)));
    let cancelled = false;
    (async () => {
      const out: PageReport[] = [];
      // Check the pages the client actually changed FIRST. Scanning all 38 before showing anything
      // meant a ten-second wait for someone who edited one heading; now their pages — the only ones
      // whose result can change the decision — are on screen almost immediately.
      const edited = (e: { id: string; lang: string }) =>
        (overrides[e.id] && Object.keys(overrides[e.id]).length) || (bp[e.id] ? 1 : 0) ||
        // a shared header/footer edit changes every page of that locale
        (Object.keys(overrides).some((k) => isSharedKey(k) && langOfSharedKey(k) === e.lang) ? 1 : 0);
      const order = [...index.pages].sort((a, b) => Number(!!edited(b)) - Number(!!edited(a)));
      // In batches: 38 pages fetched strictly one after another spent most of the wait idle on the
      // network. The order is preserved, so edited pages still come first.
      const CHUNK = 6;
      for (let i = 0; i < order.length; i += CHUNK) {
        const batch = order.slice(i, i + CHUNK);
        const loaded = await Promise.all(
          batch.map((e) => fetch(`${dataBase}/${e.file}.json`).then((r) => r.json() as Promise<ImportedPage>).catch(() => null))
        );
        if (cancelled) return;
        loaded.forEach((p, k) => {
          const entry = batch[k];
          if (!p) {
            out.push({ id: entry.id, file: entry.file, slug: entry.slug, lang: entry.lang, title: entry.title, edits: 0, changes: [], issues: [{ level: "error", msg: "Не удалось загрузить страницу" }] });
            return;
          }
          noteScanned(p);
          // Report on what will ACTUALLY be published for this page — shared edits included.
          out.push(reportForPage(p, expanded.current, bp));
        });
        setProgress(out.length);
        setReports([...out]);      // show results as they arrive instead of one long blank wait
      }
      if (!cancelled) { setScanning(false); setMissed([...missedOn.current]); }
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
    <Dialog label="Публикация сайта" onClose={onClose} className="pub__scrim" boxClassName="pub glass">
        <div className="pub__head">
          <span className="pub__title"><Rocket size={18} /> Публикация сайта</span>
          <button className="pub__x" onClick={onClose} title="Закрыть"><X size={18} /></button>
        </div>

        {nothingToPublish ? (
          <div className="pub__none">
            <CheckCircle2 size={26} className="pub__ic pub__ic--ok" />
            <p className="pub__none-t">Публиковать пока нечего</p>
            <p className="pub__none-s">
              Сайт уже соответствует последней публикации. Измените текст, фото или оформление на странице —
              и правки появятся здесь вместе с проверкой SEO.
            </p>
            <div className="pub__actions">
              <button className="pub__btn-primary" onClick={onClose}>Вернуться к правкам</button>
            </div>
          </div>
        ) : !reports ? (
          <div className="pub__loading">
            <Loader2 size={22} className="pub__spin" />
            <p>Проверяю страницы… {progress} из {total}</p>
          </div>
        ) : (
          <>
            {scanning && (
              <p className="pub__scanline" role="status" aria-live="polite">
                <Loader2 size={14} className="pub__spin" /> Проверено {progress} из {total} — изменённые страницы первыми
              </p>
            )}
            <div className="pub__summary">
              <div className="pub__stat"><b>{total}</b><span>страниц</span></div>
              <div className="pub__stat"><b>{edits}</b><span>правок</span></div>
              <div className="pub__stat pub__stat--ok"><b>{clean}</b><span>без замечаний</span></div>
              <div className={"pub__stat" + (errors ? " pub__stat--err" : "")}><b>{errors}</b><span>ошибок SEO</span></div>
              <div className={"pub__stat" + (warns ? " pub__stat--warn" : "")}><b>{warns}</b><span>предупреждений</span></div>
            </div>

            {missed.length > 0 && (
              <div className="pub__gate">
                <p className="pub__gate-warn">
                  <AlertTriangle size={16} /> Правку в шапке или подвале не удалось перенести на {missed.length}{" "}
                  {missed.length === 1 ? "страницу" : "страниц(ы)"} — там этот блок свёрстан иначе: {missed.slice(0, 4).join(", ")}
                  {missed.length > 4 ? "…" : ""}. Проверьте их и при необходимости повторите правку на такой странице.
                </p>
              </div>
            )}
            {(others.size > 0 || sharedFromOthers) && (
              <div className="pub__gate">
                <p className="pub__gate-warn">
                  <AlertTriangle size={16} /> В публикацию попадут и правки из общего черновика —
                  {sharedFromOthers ? " в том числе в шапке или подвале." : " они отмечены «правки коллеги»."}
                  {" "}Снимите галочку у страницы, если её публиковать пока рано.
                </p>
              </div>
            )}
            <div className="pub__gate">
              {errors === 0
                ? <p className="pub__gate-ok"><CheckCircle2 size={16} /> Проверка SEO пройдена — критичных проблем нет, сайт готов к публикации.</p>
                : <p className="pub__gate-err"><XCircle size={16} /> Есть {errors} критичных SEO-проблем. Их стоит исправить до публикации.</p>}
            </div>

            <div className="pub__list">
              {reports.map((r) => (
                <div key={r.id} className="pub__page">
                  <div className="pub__page-head">
                    {r.edits > 0 && (
                      <label className="pub__page-pick" title={skip.has(r.id) ? "Не публиковать эту страницу сейчас" : "Опубликовать эту страницу"}>
                        <input type="checkbox" checked={!skip.has(r.id)} onChange={() => toggleSkip(r.id)}
                          aria-label={`Публиковать страницу ${r.title.replace(/ [—|].*$/, "")}`} />
                      </label>
                    )}
                    {r.issues.some((i) => i.level === "error")
                      ? <XCircle size={15} className="pub__ic pub__ic--err" />
                      : r.issues.length
                        ? <AlertTriangle size={15} className="pub__ic pub__ic--warn" />
                        : <CheckCircle2 size={15} className="pub__ic pub__ic--ok" />}
                    <span className="pub__page-title">{r.title.replace(/ [—|].*$/, "")}</span>
                    {/* the stored slug already carries the locale prefix — adding it again showed
                        clients "/ru/ru/about" in the one place they check what is going live */}
                    <span className="pub__page-slug">{r.slug}</span>
                    {r.edits > 0 && <span className="pub__page-edits">{r.edits} правок</span>}
                    {others.has(r.id) && <span className="pub__page-who" title="Эти правки пришли из общего черновика — их сделал кто-то другой">правки коллеги</span>}
                  </div>
                  {r.changes.length > 0 && (
                    <ul className="pub__changes">
                      {r.changes.map((c) => (
                        <li key={c.blockId} className="pub__change">
                          <span className="pub__change-where">{c.label}{c.shared ? " · на всех страницах" : ""}</span>
                          {c.before && <><span className="pub__change-old">{c.before}</span><span className="pub__change-arrow">→</span></>}
                          <span className="pub__change-new">{c.after}</span>
                        </li>
                      ))}
                    </ul>
                  )}
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

            {canPublish && (
              <div className="pub__history">
                <button type="button" className="pub__history-toggle" onClick={openHistory} aria-expanded={showHistory}>
                  История публикаций{versions ? ` · ${versions.length}` : ""}
                </button>
                {showHistory && (
                  <div className="pub__history-body">
                    {versions === null ? <p className="pub__note">Загружаю…</p>
                      : versions.length === 0 ? <p className="pub__note">Пока нет сохранённых версий — они появятся после первой публикации.</p>
                      : (
                        <ul className="pub__versions">
                          {versions.map((v) => (
                            <li key={v.id} className="pub__version">
                              <span className="pub__version-when">{new Date(v.createdAt).toLocaleString("ru-RU")}</span>
                              <span className="pub__version-meta">{v.note}{v.createdBy ? ` · ${v.createdBy}` : ""}</span>
                              <button type="button" className="pub__version-btn" disabled={restoring !== null}
                                onClick={() => doRestore(v)}>
                                {restoring === v.id ? "Возвращаю…" : "Вернуть"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    {restoreMsg && <p className="pub__note" role="status" aria-live="polite">{restoreMsg}</p>}
                  </div>
                )}
              </div>
            )}

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
                <div className={"pub__result " + (pubState === "error" ? "is-err" : "is-ok")}>
                  <p className="pub__result-msg">
                    {pubState === "error" ? <XCircle size={15} /> : <CheckCircle2 size={15} />} {pubMsg}
                  </p>
                  {pubState === "error" && pubDetail && (
                    <div className="pub__result-detail">
                      <pre>{pubDetail}</pre>
                      <button className="pub__copy" onClick={copyError}>
                        <Copy size={13} /> {copied ? "Скопировано" : "Скопировать ошибку"}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="pub__actions">
                <button className="pub__btn-ghost" onClick={onClose}>Закрыть</button>
                <button className="pub__btn-ghost" onClick={() => { void ensureExpanded().then(onDownload); }}>
                  <Download size={15} /> Скачать пакет
                </button>
                {canPublish && (
                  <button className="pub__btn-primary" onClick={doPublish}
                    disabled={pubState === "publishing" || (reports != null && reports.every((r) => r.edits === 0 || skip.has(r.id)))}>
                    {pubState === "publishing" ? <><Loader2 size={15} className="pub__spin" /> Публикую…</> : <><Rocket size={15} /> Опубликовать на сайт</>}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
    </Dialog>
  );
}
