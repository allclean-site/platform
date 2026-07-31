/**
 * Site editor — the AllClean site (imported as `section` blocks) edited inside the platform cabinet.
 * Canvas = the whole page on a zoomable stage (Tilda-like): scale in/out, fit-to-width, device widths.
 * The iframe is a real document isolated from platform chrome; inline click-to-edit posts changes back,
 * saved as overrides. Styled with the LeadGeniumCMS design tokens (glass / violet / themes).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Monitor, Tablet, Smartphone, Pencil, Eye, ArrowLeft, Check, ZoomIn, ZoomOut, Scan, Bold, Italic, Underline, Link2, Eraser, Undo2, Redo2, Rocket, Trash2, RotateCcw, ChevronDown, Plus, ChevronUp, X } from "lucide-react";
import { type ImportedPage, type SiteIndex } from "../editor/reassemble";
import { previewDoc } from "../editor/preview";
import { applyOverrides, loadOverrides, saveOverrides, mergeOverrideLayers,
  type SiteOverrides, type PageOverrides, type StoredSiteOverrides } from "../editor/realStore";
import { fetchPublishedOverrides } from "../editor/overridesClient";
import { fetchDraft, saveDraftPage, beaconDraftPage, draftConfigured, type DraftMeta } from "../editor/draftClient";
import { toCanonical, toPreview, canonicalizeOverrides } from "../editor/assetPaths";
import { useAuth } from "../auth/AuthContext";
import { loadBp, saveBp, bpCount, emptyPageBp, BP_LAYERS, type SiteBp, type PageBp } from "../editor/bpStore";
import { indexMediaFromDoc } from "../editor/media";
import { ElementInspector } from "./ElementInspector";
import { LayersTree } from "./Layers";
import { PublishDialog } from "./PublishDialog";
import { MediaPicker } from "./MediaPicker";
import type { ElStyle, SelectedEl, Breakpoint, SelectOption } from "../editor/elemTypes";
import "./site-editor.css";

const DATA = "/import/allclean";
const DEVICE_W = { desktop: 1440, tablet: 834, mobile: 390 } as const;
// Default canvas = a REAL laptop width (1440), not 1920 — so a size that looks balanced on the canvas
// also fits the viewer's actual screen (WYSIWYG). Wider options stay available in the picker.
const DESK_WIDTHS = [1440, 1366, 1280, 1600, 1920] as const;
type Device = keyof typeof DEVICE_W;
const TENANT = "tenant-allclean";
const clampZoom = (z: number) => Math.min(2, Math.max(0.2, z));

const KIND_LABEL: Record<SelectedEl["kind"], string> = { text: "Текст", link: "Кнопка / ссылка", image: "Изображение", video: "Видео", container: "Контейнер", select: "Список (выпадающий)" };

/** Live text selection inside the iframe → drives the floating rich-text toolbar. */
interface TextSel {
  type: "lg-text-sel";
  rect: { top: number; left: number; width: number; height: number };
  state: { bold: boolean; italic: boolean; underline: boolean; link: boolean; href: string; newTab: boolean };
}

export function SiteEditor() {
  const { siteId = "allclean" } = useParams();
  const SITE = `site-${siteId}`;
  const { session } = useAuth(); // name is stamped on shared-draft saves ("кто правил последним")
  const [index, setIndex] = useState<SiteIndex | null>(null);
  const [locale, setLocale] = useState("ru");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [page, setPage] = useState<ImportedPage | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [deskW, setDeskW] = useState<number>(1440); // desktop canvas width (shown scaled-to-fit, Tilda-like)
  const [edit, setEdit] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selEl, setSelEl] = useState<SelectedEl | null>(null);
  const [textSel, setTextSel] = useState<TextSel | null>(null);
  const [linkPop, setLinkPop] = useState<{ url: string; newTab: boolean } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [publishing, setPublishing] = useState(false);
  const [mediaPick, setMediaPick] = useState<{ blockId: string; el: string; accept: "image" | "video" | "both" } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [frameH, setFrameH] = useState(900);
  const overrides = useRef<StoredSiteOverrides>({});   // LOCAL edits (this browser, localStorage)
  const bpOverrides = useRef<SiteBp>({});
  const pubOverrides = useRef<StoredSiteOverrides>({}); // PUBLISHED edits from Supabase (shared, read-only base)
  const pubBp = useRef<SiteBp>({});
  const draftOv = useRef<StoredSiteOverrides>({});     // SHARED DRAFT (unpublished, live between cabinets)
  const draftBp = useRef<SiteBp>({});
  const draftMeta = useRef<Record<string, DraftMeta>>({});
  const [draftState, setDraftState] = useState<"off" | "syncing" | "synced" | "error" | "conflict">("off");
  const [conflictBy, setConflictBy] = useState("");
  const [draftWho, setDraftWho] = useState<string>("");  // "кто правил последним" for the current page
  const draftTimers = useRef<Record<string, number>>({});   // one debounce per page
  const [syncTick, setSyncTick] = useState(0);         // bump when published/draft edits arrive → re-render
  const [, setBpTick] = useState(0); // bump to re-render device-tab dots after a bp change
  const frameRef = useRef<HTMLIFrameElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const settleTimers = useRef<number[]>([]);   // re-measure passes for the current iframe load
  // ---- undo/redo: transactions, not per-message snapshots ----------------------------------------
  // A page's state lives in TWO stores: block HTML (content + desktop inline styles) and the
  // per-device rule layers. One user gesture routinely writes to both — resizing a row sets an inline
  // height AND releases that height on tablet/phone. The old history recorded each store separately,
  // so a single gesture produced two entries and one Ctrl+Z undid only half of it: visibly "undo does
  // nothing". Now a gesture opens a TRANSACTION, every write records the previous value of the key it
  // touches (once), and closing the transaction pushes ONE step covering both stores.
  //
  // Only touched keys are captured, so a step costs a few strings rather than a clone of the page.
  // undefined = this layer had no entry · null = tombstone · string = override html
  type Snap = { blocks: Record<string, string | null | undefined>; bp: PageBp | null | undefined };
  type Step = { pageId: string; before: Snap; after: Snap };
  const history = useRef<Step[]>([]);
  const future = useRef<Step[]>([]);
  const txn = useRef<{ pageId: string; blocks: Record<string, string | null | undefined>; bp: PageBp | null | undefined } | null>(null);
  const txnDepth = useRef(0);          // >0 while a gesture (drag) is in progress
  const txnTimer = useRef<number | undefined>(undefined);
  const lastHtml = useRef<Record<string, string>>({});
  const lastEditAt = useRef(0); // for coalescing rapid typing into one undo entry
  const [histLen, setHistLen] = useState(0);
  const [futLen, setFutLen] = useState(0);        // redo availability must be STATE, not a ref read
  const baseHtml = useRef<Record<string, string>>({});   // pristine block markup for "undo to unedited"
  const loadedPageId = useRef<string | null>(null);
  const [pagesOpen, setPagesOpen] = useState(true);   // collapsible left-panel sections
  const [blocksOpen, setBlocksOpen] = useState(true);

  // canonicalizeOverrides heals blocks saved by the older code path, which stored the iframe's
  // /site-assets/* preview paths (and grew another prefix on every save).
  useEffect(() => {
    overrides.current = canonicalizeOverrides(loadOverrides(TENANT, SITE));
    bpOverrides.current = loadBp(TENANT, SITE);
    saveOverrides(TENANT, SITE, overrides.current); // persist the healed copy
  }, [SITE]);

  // Pull the PUBLISHED edits (shared state) so the editor matches the live site and shows the client's
  // published edits — not just this browser's local ones. Published = base, local unpublished edits win
  // per block. Graceful no-op when publish isn't configured or offline (falls back to local-only).
  useEffect(() => {
    let cancelled = false;
    fetchPublishedOverrides("allclean").then((pub) => {
      if (!pub || cancelled) return;
      pubOverrides.current = canonicalizeOverrides(pub.overrides);
      pubBp.current = pub.breakpoints;
      setSyncTick((t) => t + 1); // re-render the current page with the merged (published + local) edits
    });
    return () => { cancelled = true; };
  }, [SITE]);

  // Layers, weakest first: PUBLISHED (live site) → SHARED DRAFT (everyone's unpublished work) → LOCAL
  // (this browser, freshest). Local wins per block because it is what the user is typing right now.
  const mergedOv = (pid: string): PageOverrides =>
    mergeOverrideLayers(pubOverrides.current[pid], draftOv.current[pid], overrides.current[pid]);

  /**
   * Breakpoint rules merge PER ELEMENT, per layer — not whole-object. Taking the first layer that had
   * anything meant a single stale rule left in one browser hid, and then overwrote, every tablet and
   * phone rule someone else had made on that page.
   */
  const mergedBp = (pid: string): PageBp | undefined => {
    const sources = [pubBp.current[pid], draftBp.current[pid], bpOverrides.current[pid]].filter(Boolean) as PageBp[];
    if (!sources.length) return undefined;
    const out = emptyPageBp();
    for (const src of sources) {
      for (const layer of BP_LAYERS) {
        const rec = src[layer];
        if (!rec) continue;
        for (const id of Object.keys(rec)) out[layer][id] = rec[id];   // later layer wins for THAT element
      }
    }
    return out;
  };
  // Full merged maps for publish/export so publishing preserves others' published + drafted edits.
  const allOverrides = (): SiteOverrides => {
    const out: SiteOverrides = {};
    new Set([...Object.keys(pubOverrides.current), ...Object.keys(draftOv.current), ...Object.keys(overrides.current)])
      .forEach((pid) => { out[pid] = mergedOv(pid); });
    return out;
  };
  const allBp = (): SiteBp => {
    const out: SiteBp = {};
    new Set([...Object.keys(pubBp.current), ...Object.keys(draftBp.current), ...Object.keys(bpOverrides.current)])
      .forEach((pid) => { const m = mergedBp(pid); if (m) out[pid] = m; });
    return out;
  };

  // ---- live editing: pull the SHARED draft, push our edits into it -------------------------------
  // Without this the client's in-progress work stayed in their browser and the agency saw something
  // else. Pull on open and on window focus (so switching back to the tab shows the other side's work).
  const pullDraft = useCallback(async () => {
    if (!draftConfigured()) { setDraftState("off"); return; }
    const d = await fetchDraft("allclean");
    if (!d) { setDraftState("error"); return; }
    draftOv.current = canonicalizeOverrides(d.overrides);
    draftBp.current = d.breakpoints;
    draftMeta.current = d.meta;
    setDraftState("synced");
    setSyncTick((t) => t + 1);
  }, []);

  useEffect(() => { void pullDraft(); }, [pullDraft, SITE]);
  useEffect(() => {
    const onFocus = () => { void pullDraft(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [pullDraft]);

  /** Mirror this page's current state into the shared draft (debounced — we save on every keystroke). */
  const scheduleDraft = useCallback((pageId: string) => {
    if (!draftConfigured() || !pageId) return;
    setDraftState("syncing");
    // One timer PER PAGE: a single shared timer meant that editing one page and moving to another
    // within the debounce window cancelled the first page's push, so those edits never reached the
    // shared draft and the other side never saw them.
    window.clearTimeout(draftTimers.current[pageId]);
    draftTimers.current[pageId] = window.setTimeout(async () => {
      // Merge (not spread) so a tombstone REMOVES the block from what we push: undoing an edit that
      // already reached the draft has to delete it there too, or the next sync brings it back and
      // publishing ships it anyway.
      const pushedLocal = { ...overrides.current[pageId] };
      const ov = mergeOverrideLayers(draftOv.current[pageId], overrides.current[pageId]);
      const bp = mergedBp(pageId);
      const res = await saveDraftPage("allclean", pageId, ov, bp, session?.name || "",
        draftMeta.current[pageId]?.updatedAt);
      if (!res) { setDraftState("error"); return; }
      if (res.conflict) {
        // Someone else (another tab, the client on their phone) changed this page since we last read
        // it. Nothing was written — take their version and keep ours on top, rather than silently
        // replacing their work.
        setDraftState("conflict");
        setConflictBy(res.conflictBy || "");
        await pullDraft();
        return;
      }
      const at = res.updatedAt;
      if (!at) { setDraftState("error"); return; }
      // Keep the local mirror of the draft in step so a later pull can't resurrect stale blocks.
      draftOv.current[pageId] = ov;
      if (bp) draftBp.current[pageId] = bp;
      // The shared draft now owns these edits, so drop this browser's copy: a local layer that is
      // never cleared keeps shadowing — and eventually overwriting — a collaborator's newer work.
      // Only entries that are still exactly what we pushed are cleared, so edits made during the
      // request survive.
      const stillLocal = overrides.current[pageId];
      if (stillLocal) {
        for (const k of Object.keys(pushedLocal)) if (stillLocal[k] === pushedLocal[k]) delete stillLocal[k];
        if (!Object.keys(stillLocal).length) delete overrides.current[pageId];
      }
      if (bpOverrides.current[pageId]) { delete bpOverrides.current[pageId]; saveBp(TENANT, SITE, bpOverrides.current); }
      saveOverrides(TENANT, SITE, overrides.current);
      draftMeta.current[pageId] = { updatedAt: at, updatedBy: session?.name || "" };
      setDraftState("synced");
    }, 1200);
  }, [session?.name]);

  /**
   * Send anything the debounce still owes before the tab goes away. Closing the tab (or switching
   * away on a phone, where the browser may never come back) otherwise dropped up to 1.2s of edits:
   * they stayed in this browser and the other side never saw them, while the pill still read
   * "синхронизирую…".
   */
  const flushDrafts = useCallback(() => {
    const pending = Object.keys(draftTimers.current);
    if (!pending.length || !draftConfigured()) return;
    for (const pageId of pending) {
      window.clearTimeout(draftTimers.current[pageId]);
      delete draftTimers.current[pageId];
      const ov = mergeOverrideLayers(draftOv.current[pageId], overrides.current[pageId]);
      beaconDraftPage("allclean", pageId, ov, mergedBp(pageId), session?.name || "");
    }
  }, [session?.name]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushDrafts(); };
    window.addEventListener("pagehide", flushDrafts);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flushDrafts);
      document.removeEventListener("visibilitychange", onHide);
      flushDrafts();          // leaving the editor for another screen counts too
      Object.values(draftTimers.current).forEach((t) => window.clearTimeout(t));
      settleTimers.current.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(txnTimer.current);
    };
  }, [flushDrafts]);

  // ---- the single mutation gateway ---------------------------------------------------------------
  // Every change to a page's stored state goes through writeBlock / writeBp. They keep persistence,
  // draft sync and the undo transaction in step, so no code path can mutate state and forget one.

  /** Remember a key's previous value the FIRST time this transaction touches it. */
  const recordBlock = (pageId: string, blockId: string) => {
    const t = txn.current;
    if (!t || t.pageId !== pageId || blockId in t.blocks) return;
    t.blocks[blockId] = overrides.current[pageId]?.[blockId];
  };
  const recordBp = (pageId: string) => {
    const t = txn.current;
    if (!t || t.pageId !== pageId || t.bp !== undefined) return;
    const cur = bpOverrides.current[pageId];
    t.bp = cur ? (JSON.parse(JSON.stringify(cur)) as PageBp) : null;
  };
  const openTxn = (pageId: string) => { if (!txn.current) txn.current = { pageId, blocks: {}, bp: undefined }; };
  /** Close the transaction and push ONE undo step describing everything it changed. */
  const commitTxn = () => {
    const t = txn.current; txn.current = null;
    if (!t) return;
    const before: Snap = { blocks: t.blocks, bp: t.bp };
    const after: Snap = { blocks: {}, bp: undefined };
    let changed = false;
    for (const bid of Object.keys(t.blocks)) {
      const now = overrides.current[t.pageId]?.[bid];
      after.blocks[bid] = now;
      if (now !== t.blocks[bid]) changed = true;
    }
    if (t.bp !== undefined) {
      const now = bpOverrides.current[t.pageId] ?? null;
      after.bp = now ? (JSON.parse(JSON.stringify(now)) as PageBp) : null;
      if (JSON.stringify(now) !== JSON.stringify(t.bp)) changed = true;
    }
    if (!changed) return;
    history.current.push({ pageId: t.pageId, before, after });
    if (history.current.length > 100) history.current.shift();
    future.current = []; setFutLen(0);
    setHistLen(history.current.length);
  };
  /** Discrete edits (a keystroke, a slider tick) have no gesture end — close them on a short idle,
   *  which also coalesces a burst of typing into one undo step. Drags hold the transaction open. */
  const autoCommit = () => {
    window.clearTimeout(txnTimer.current);
    txnTimer.current = window.setTimeout(() => { if (txnDepth.current === 0) commitTxn(); }, 400);
  };
  /** Force-close a gesture. The drag listeners live in the iframe, so releasing the mouse over the
   *  panel or outside the window never delivered their pointerup: the gesture stayed "open" and every
   *  later edit was swallowed by it, which killed undo for the rest of the session. */
  const endGesture = useCallback(() => {
    if (txnDepth.current === 0) return;
    txnDepth.current = 0;
    commitTxn();
  }, []);
  useEffect(() => {
    const onUp = () => endGesture();
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
    };
  }, [endGesture]);

  const writeBlock = (pageId: string, blockId: string, html: string | null) => {
    openTxn(pageId); recordBlock(pageId, blockId);
    setSaveState("saving");
    const page = (overrides.current[pageId] ??= {});
    // A tombstone, not a deletion: "this block has no override" has to be stated so it survives the
    // merge with the shared draft and the published layer (that is what makes undo stick for others).
    page[blockId] = html;
    if (!saveOverrides(TENANT, SITE, overrides.current)) {
      setErr("Не удалось сохранить правку в этом браузере: закончилось место. Опубликуйте изменения или очистите данные сайта.");
      return;
    }
    setSaveState("saved");
    scheduleDraft(pageId);
    autoCommit();
  };
  const writeBp = (pageId: string, rules: PageBp) => {
    openTxn(pageId); recordBp(pageId);
    bpOverrides.current[pageId] = rules;
    saveBp(TENANT, SITE, bpOverrides.current);
    setSaveState("saved");
    scheduleDraft(pageId);
    autoCommit();
  };

  useEffect(() => {
    fetch(`${DATA}/_pages.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index ${r.status}`))))
      .then((idx: SiteIndex) => {
        setIndex(idx);
        setLocale(idx.defaultLocale);
        const home = idx.pages.find((p) => p.slug === "/" && p.lang === idx.defaultLocale) ?? idx.pages[0];
        if (home) setActiveFile(home.file);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  // Load (or reload) a page from the read-only base + apply the current overrides. Reused by delete/
  // restore so structural changes re-render the canvas from the base + edits.
  const loadPage = useCallback((file: string | null) => {
    if (!file) return;
    setSelected(null);
    fetch(`${DATA}/${file}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`page ${r.status}`))))
      .then((p: ImportedPage) => {
        // Pristine markup, before any override — undoing back to "no edit" restores from this instead
        // of reloading the whole page.
        baseHtml.current = Object.fromEntries(p.blocks.map((b) => [b.id, b.content.html]));
        const blocks = applyOverrides(p.blocks, mergedOv(p.id));
        lastHtml.current = Object.fromEntries(blocks.map((b) => [b.id, b.content.html]));
        // Only a move to a DIFFERENT page starts a new history. This function also runs when the page
        // is merely re-rendered — after an undo, a section delete, or a draft sync when the window
        // regains focus — and wiping the stack there is what made undo/redo "stop working".
        if (loadedPageId.current !== p.id) {
          loadedPageId.current = p.id;
          history.current = []; future.current = []; setHistLen(0); setFutLen(0);
        }
        setPage({ ...p, blocks });
      })
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => { loadPage(activeFile); }, [activeFile, loadPage, syncTick]);
  // Who touched the current page's shared draft last (shown next to the sync status).
  useEffect(() => { setDraftWho(page ? (draftMeta.current[page.id]?.updatedBy || "") : ""); }, [page, syncTick]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      // The imported page runs its own third-party scripts (Webflow, analytics, chat widgets), and any
      // of them can postMessage to us. Only accept what our own canvas sent — otherwise a widget could
      // write arbitrary markup into the page and have it published.
      if (e.source !== frameRef.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "lg-select") setSelected(d.id);
      // Ctrl+Z pressed while the cursor is in the canvas — the iframe forwards it here.
      else if (d.type === "lg-undo") undoRef.current();
      else if (d.type === "lg-redo") redoRef.current();
      else if (d.type === "lg-elem-select") { setSelEl(d as SelectedEl); setSelected(d.blockId); }
      else if (d.type === "lg-elem-deleted") setSelEl(null);
      else if (d.type === "lg-text-sel") { setTextSel(d.rect ? (d as TextSel) : null); if (!d.rect) setLinkPop(null); }
      else if (d.type === "lg-ready") {
        // Iframe loaded → push this page's saved breakpoint rules + the active device into the runtime.
        const rules = (page && mergedBp(page.id)) || emptyPageBp();
        const win = frameRef.current?.contentWindow;
        win?.postMessage({ type: "lg-bp-init", rules }, "*");
        win?.postMessage({ type: "lg-device", breakpoint: device }, "*");
        win?.postMessage({ type: "lg-zoom", zoom }, "*");
      }
      // Gesture boundaries from the runtime: everything between them is ONE undo step.
      else if (d.type === "lg-txn-begin" && page) { txnDepth.current++; window.clearTimeout(txnTimer.current); openTxn(page.id); }
      else if (d.type === "lg-txn-end") { txnDepth.current = Math.max(0, txnDepth.current - 1); if (txnDepth.current === 0) commitTxn(); }
      else if (d.type === "lg-bp-changed" && page) {
        writeBp(page.id, d.rules as PageBp);
        setBpTick((t) => t + 1);
        setSaveState("saved");
      }
      else if (d.type === "lg-edit" && page) {
        // The iframe serves assets under /site-assets/*, so its innerHTML carries preview paths.
        // Strip them back to canonical root paths BEFORE storing — otherwise every save appended
        // another prefix and the published page pointed at a path nothing serves (404 video/images).
        d.html = toCanonical(d.html);
        if (d.html === lastHtml.current[d.id]) return;   // nothing actually changed
        lastHtml.current[d.id] = d.html;
        writeBlock(page.id, d.id, d.html);
        setSaveState("saved");
      }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [page, SITE, device, zoom, scheduleDraft]);

  const localePages = useMemo(
    () => (index?.pages ?? []).filter((p) => p.lang === locale).sort((a, b) => a.slug.localeCompare(b.slug)),
    [index, locale]
  );
  const activeEntry = index?.pages.find((p) => p.file === activeFile);
  const srcDoc = useMemo(() => (page ? previewDoc(page, edit, edit ? undefined : mergedBp(page.id)) : ""), [page, edit]); // eslint-disable-line react-hooks/exhaustive-deps
  const frameW = device === "desktop" ? deskW : DEVICE_W[device];
  const totalEdited =
    Object.values(allOverrides()).reduce((n, o) => n + Object.keys(o).length, 0) +
    Object.values(allBp()).reduce((n, p) => n + Object.keys(p.tablet ?? {}).length + Object.keys(p.mobile ?? {}).length, 0);

  // Apply a property change to the selected element (updates the panel + the iframe → saved).
  // On tablet/mobile, style changes become @media overrides (breakpoint field routes them in the runtime).
  const patchEl = (patch: { text?: string; href?: string; style?: Partial<ElStyle> }) => {
    if (!selEl) return;
    const bpMode = device !== "desktop";
    let bpOver = selEl.bpOver;
    if (bpMode && patch.style) {
      bpOver = { ...(selEl.bpOver ?? {}) };
      for (const k of Object.keys(patch.style)) (bpOver as Record<string, boolean>)[k] = true;
    }
    setSelEl({ ...selEl, ...(patch.text != null ? { text: patch.text } : {}), ...(patch.href != null ? { href: patch.href } : {}), style: { ...selEl.style, ...(patch.style ?? {}) }, bpOver });
    frameRef.current?.contentWindow?.postMessage({ type: "lg-elem-set", blockId: selEl.blockId, el: selEl.el, text: patch.text, href: patch.href, style: patch.style, breakpoint: device }, "*");
  };
  // Interaction-state edit (links/buttons): generated :hover / :active rule, stored in the overrides layer.
  const patchState = (layer: "hover" | "active", style: Partial<ElStyle>) => {
    if (!selEl) return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-elem-set", blockId: selEl.blockId, el: selEl.el, style, breakpoint: layer }, "*");
    const cur = selEl[layer] ?? { color: "", background: "", over: { color: false, background: false } };
    const next = { color: cur.color, background: cur.background, over: { ...cur.over } };
    if (style.color != null) { next.color = String(style.color); next.over.color = true; }
    if (style.background != null) { next.background = String(style.background); next.over.background = true; }
    setSelEl({ ...selEl, [layer]: next });
  };
  const resetState = (layer: "hover" | "active", key: "color" | "background") => {
    const cur = selEl?.[layer];
    if (!cur) return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-bp-reset", blockId: selEl!.blockId, el: selEl!.el, breakpoint: layer, prop: key }, "*");
    const next = { color: cur.color, background: cur.background, over: { ...cur.over } };
    next[key] = ""; next.over[key] = false;
    setSelEl({ ...selEl!, [layer]: next });
  };
  // Reset a breakpoint override (one property, or all when no key) for the selected element to base.
  const resetBp = (key?: keyof ElStyle) => {
    if (!selEl || device === "desktop") return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-bp-reset", blockId: selEl.blockId, el: selEl.el, breakpoint: device, prop: key }, "*");
    const bpOver = { ...(selEl.bpOver ?? {}) };
    if (key) delete (bpOver as Record<string, boolean>)[key];
    else Object.keys(bpOver).forEach((k) => delete (bpOver as Record<string, boolean>)[k]);
    setSelEl({ ...selEl, bpOver });
  };
  // Open the media picker (upload / gallery / trash) for the selected photo or video. The gallery is
  // COMMON (photo + video) so the client can swap a photo for a video and vice versa.
  const replaceMedia = () => {
    if (!selEl) return;
    setMediaPick({ blockId: selEl.blockId, el: selEl.el, accept: "both" });
  };
  // Figma text-box resize mode + vertical align (routed per-device by the runtime).
  const resizeMode = (mode: "hug" | "fixw" | "fixed") => {
    if (!selEl) return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-resize-mode", blockId: selEl.blockId, el: selEl.el, mode, breakpoint: device }, "*");
  };
  const vAlign = (value: "top" | "center" | "bottom") => {
    if (!selEl) return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-valign", blockId: selEl.blockId, el: selEl.el, value, breakpoint: device }, "*");
  };
  // Delete a single selected element (not the whole section).
  const deleteEl = () => {
    if (!selEl) return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-elem-delete", blockId: selEl.blockId, el: selEl.el }, "*");
  };
  /** Undo everything we ever styled on this element — inline styles AND its rules on every device. */
  const resetEl = () => {
    if (!selEl) return;
    frameRef.current?.contentWindow?.postMessage({ type: "lg-elem-reset", blockId: selEl.blockId, el: selEl.el }, "*");
  };
  // Edit the options of a selected <select> (form dropdown) → write them back to the option elements.
  const setSelectOptions = (options: { value: string; label: string }[]) => {
    if (!selEl) return;
    setSelEl({ ...selEl, selectOptions: options });
    frameRef.current?.contentWindow?.postMessage({ type: "lg-select-options", blockId: selEl.blockId, el: selEl.el, options }, "*");
  };
  // Rich-text: apply a command to the highlighted part of the text.
  const textCmd = (cmd: string, value?: string, newTab?: boolean) =>
    frameRef.current?.contentWindow?.postMessage({ type: "lg-text-cmd", cmd, value, newTab }, "*");
  // Breadcrumb: select any ancestor (container) by id.
  const selectCrumb = (id: string) =>
    frameRef.current?.contentWindow?.postMessage({ type: "lg-select-el", el: id }, "*");

  /** Push a block's HTML into the iframe (assets in preview form) — used by history and by edits. */
  const pushHtmlToFrame = (blockId: string, html: string) =>
    frameRef.current?.contentWindow?.postMessage({ type: "lg-set-html", blockId, html: toPreview(html) }, "*");


  /**
   * Restore one side of a transaction. Writes go straight to the stores: replaying history must NOT
   * be recorded as new history (that is the classic "undo undoes itself" loop), so this deliberately
   * bypasses the transaction gateway and re-renders from the restored state instead.
   */
  const applySnap = (pageId: string, snap: Snap) => {
    for (const blockId of Object.keys(snap.blocks)) {
      const html = snap.blocks[blockId];
      const pageOv = (overrides.current[pageId] ??= {});
      if (html === undefined) delete pageOv[blockId];   // there was no entry here before
      else pageOv[blockId] = html;                      // an override, or a tombstone
      if (!Object.keys(pageOv).length) delete overrides.current[pageId];
      // No override left = back to the site's own markup. Push that directly: reloading the page to
      // get it would throw away the editing state (and used to clear the history along with it).
      const shown = (typeof html === "string" ? html : undefined) ?? mergedOv(pageId)[blockId] ?? baseHtml.current[blockId] ?? "";
      lastHtml.current[blockId] = shown;
      pushHtmlToFrame(blockId, shown);
    }
    if (snap.bp !== undefined) {
      const rules = (snap.bp ?? emptyPageBp()) as PageBp;
      if (snap.bp === null) delete bpOverrides.current[pageId]; else bpOverrides.current[pageId] = rules;
      saveBp(TENANT, SITE, bpOverrides.current);
      frameRef.current?.contentWindow?.postMessage({ type: "lg-bp-init", rules }, "*");
      setBpTick((t) => t + 1);
    }
    saveOverrides(TENANT, SITE, overrides.current);
    scheduleDraft(pageId);
    setSelEl(null); setTextSel(null); setSaveState("saved");
  };

  const undo = () => {
    commitTxn();                                  // close anything still open, so it can be undone
    const s = history.current.pop(); if (!s) return;
    future.current.push(s); setHistLen(history.current.length); setFutLen(future.current.length);
    applySnap(s.pageId, s.before);
  };
  // Kept in refs so the iframe message handler (registered once) always calls the current versions.
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});
  const redo = () => {
    commitTxn();                                  // same as undo: never redo on top of an open gesture
    const s = future.current.pop(); if (!s) return;
    history.current.push(s); setHistLen(history.current.length); setFutLen(future.current.length);
    applySnap(s.pageId, s.after);
  };
  undoRef.current = undo; redoRef.current = redo;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page]);

  // Position of the floating text toolbar in the cabinet, mapping iframe-space → screen (accounts for zoom + scroll).
  const toolbarPos = (() => {
    if (!textSel || !frameRef.current) return null;
    const fr = frameRef.current.getBoundingClientRect();
    const r = textSel.rect;
    return { top: fr.top + r.top * zoom - 46, left: fr.left + (r.left + r.width / 2) * zoom };
  })();

  // Fit the page width into the canvas (Tilda-like default view).
  const fit = useCallback(() => {
    const cw = canvasRef.current?.clientWidth ?? 1100;
    setZoom(clampZoom(Math.min(1, (cw - 40) / frameW)));
  }, [frameW]);
  useEffect(() => { fit(); }, [fit, index]);

  // Measure the real page height so the whole page sits on the stage (no inner iframe scroll).
  // Re-measure after lazy images/webflow layout settle so the footer isn't clipped.
  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc) setFrameH(Math.max(600, doc.documentElement.scrollHeight));
  }, []);
  const onFrameLoad = () => {
    // Re-index media as the page settles: some media (esp. lazy Webflow background <video>) attach a
    // moment after load, so a single pass at load can miss them → the gallery would differ per browser.
    const doIndex = () => { const doc = frameRef.current?.contentDocument; if (doc) indexMediaFromDoc(TENANT, doc); };
    measure(); doIndex();
    // Cancel the previous page's pending passes: clicking through pages otherwise piles up callbacks
    // that re-measure and rebuild the media library against whichever document happens to be loaded.
    settleTimers.current.forEach((t) => window.clearTimeout(t));
    settleTimers.current = [400, 1200, 2500, 5000].map((t) => window.setTimeout(() => { measure(); doIndex(); }, t));
  };
  // Switching device does NOT reload the iframe — tell the runtime the new breakpoint (so edits route
  // correctly + the panel refreshes) and re-measure height, since a narrower page reflows taller.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "lg-device", breakpoint: device }, "*");
    const ids = [0, 300, 900].map((t) => window.setTimeout(measure, t));
    return () => ids.forEach(clearTimeout);
  }, [device, frameW, measure]);
  // Tell the iframe the current zoom so it sizes selection/resize handles to stay grabbable on screen.
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "lg-zoom", zoom }, "*");
  }, [zoom]);

  const scrollToBlock = (id: string) => {
    setSelected(id);
    const doc = frameRef.current?.contentDocument;
    const w = doc?.querySelector(`[data-lg-block="${id}"]`) as HTMLElement | null;
    const el = (w?.firstElementChild as HTMLElement) || w;
    if (!el || !canvasRef.current) return;
    const top = el.getBoundingClientRect().top + (doc?.documentElement.scrollTop || 0);
    canvasRef.current.scrollTo({ top: Math.max(0, top * zoom - 24), behavior: "smooth" });
  };

  // Section delete/restore. A removed section is stored as an EMPTY-STRING override for its block —
  // it renders nothing in the editor and is applied (→ empty) by the publish build, so it flows through
  // the existing overrides pipeline with no schema change. Restore just drops the override (back to base).
  const isRemoved = (blockId: string) => page != null && mergedOv(page.id)[blockId] === "";

  const deleteBlock = (blockId: string) => {
    if (!page) return;
    // No confirmation: this is undoable (Ctrl+Z, or ↩ in the block list). Apple's guidance is to warn
    // only about destructive actions that CANNOT be undone — asking every time teaches people to
    // click through warnings, which is what makes the dangerous ones stop working.
    writeBlock(page.id, blockId, "");
    commitTxn();                       // deleting a section is one deliberate step
    if (selected === blockId) { setSelected(null); setSelEl(null); }
    setSaveState("saved");
    loadPage(activeFile);
  };

  const restoreBlock = (blockId: string) => {
    if (!page) return;
    writeBlock(page.id, blockId, null);   // drop the override → back to the base markup
    commitTxn();
    setSaveState("saved");
    loadPage(activeFile);
  };

  const exportEdits = () => {
    // Both edit layers: content overrides (per-block html) + breakpoint overrides (@media rules).
    const payload = { overrides: allOverrides(), breakpoints: allBp() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    // The anchor has to be in the document, and the URL must outlive the click, or the download
    // silently never starts outside Chromium — and this is the only publish route when the endpoint
    // isn't configured.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "edits.json";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 0);
  };

  if (err) return <div className="se-error">Ошибка загрузки: {err}</div>;
  if (!index) return <div className="se-loading">Загрузка сайта…</div>;

  return (
    <div className="se se--content">
      <div className="se__bar glass">
        <Link to="/app/sites" className="se__back"><ArrowLeft size={16} /> Сайты</Link>
        <span className="se__name">{index.domain}</span>

        <div className="se__devices">
          {([["desktop", Monitor], ["tablet", Tablet], ["mobile", Smartphone]] as const).map(([d, Icon]) => (
            <button key={d} className={"se__icon" + (device === d ? " is-active" : "")} onClick={() => setDevice(d)}
              title={d === "desktop" ? "Компьютер (база)" : d === "tablet" ? "Планшет" : "Телефон"}>
              <Icon size={17} />
              {d !== "desktop" && bpCount(bpOverrides.current[page?.id ?? ""], d) > 0 && <span className="se__bpdot" />}
            </button>
          ))}
          {device === "desktop" && (
            <select className="se__wsel" value={deskW} onChange={(e) => setDeskW(Number(e.target.value))} title="Ширина холста (масштабируется под окно)">
              {DESK_WIDTHS.map((w) => <option key={w} value={w}>{w}px</option>)}
            </select>
          )}
        </div>

        <div className="se__zoom">
          <button className="se__icon" onClick={() => setZoom((z) => clampZoom(z - 0.1))} title="Меньше"><ZoomOut size={16} /></button>
          <button className="se__zoomval" onClick={() => setZoom(1)} title="100%">{Math.round(zoom * 100)}%</button>
          <button className="se__icon" onClick={() => setZoom((z) => clampZoom(z + 0.1))} title="Больше"><ZoomIn size={16} /></button>
          <button className="se__icon" onClick={fit} title="По ширине"><Scan size={16} /></button>
        </div>

        <div className="se__undo">
          <button className="se__icon" disabled={!histLen} title="Отменить (Ctrl+Z)" onClick={undo}><Undo2 size={16} /></button>
          <button className="se__icon" disabled={!futLen} title="Повторить (Ctrl+Shift+Z)" onClick={redo}><Redo2 size={16} /></button>
        </div>
        <button className={"se__toggle" + (edit ? " is-on" : "")} onClick={() => setEdit((v) => !v)}>
          {edit ? <><Pencil size={15} /> Правка</> : <><Eye size={15} /> Просмотр</>}
        </button>
        <span className="se__save" role="status" aria-live="polite">{saveState === "saving" ? "сохраняю…" : saveState === "saved" ? <><Check size={14} /> сохранено</> : ""}</span>
        {/* Shared-draft status: makes it visible that edits are synced between the client and the
            agency (live editing), instead of silently living in one browser. */}
        {draftState !== "off" && (
          <span role="status" aria-live="polite" className={"se__draft se__draft--" + draftState} title={
            draftState === "conflict" ? "Эту страницу изменили в другом окне. Мы подтянули общую версию — ваши несохранённые правки остались поверх неё."
              : draftState === "error" ? "Нет связи с сервером — правки сохранены в этом браузере и уйдут позже"
              : draftWho ? `Последним правил: ${draftWho}` : "Черновик виден и вам, и клиенту"}>
            {draftState === "syncing" ? "синхронизирую…"
              : draftState === "conflict" ? `страницу изменил${conflictBy ? " " + conflictBy : "и"} — показана общая версия`
              : draftState === "error" ? "нет синхронизации"
              : <>общий черновик{draftWho ? ` · ${draftWho}` : ""}</>}
          </span>
        )}
        <button className="se__publish" onClick={() => setPublishing(true)}>
          <Rocket size={15} /> Опубликовать{totalEdited ? ` (${totalEdited})` : ""}
        </button>
      </div>

      <div className="se__body">
        <aside className="se__panel glass">
          <button className="se__section se__section--toggle" onClick={() => setPagesOpen((v) => !v)}>
            <ChevronDown size={13} className={"se__chev" + (pagesOpen ? "" : " is-collapsed")} />
            Страницы · {index.pages.length}
          </button>
          {pagesOpen && (
            <>
              {index.locales.length > 1 && (
                <div className="se__locales">
                  {index.locales.map((loc) => (
                    <button key={loc} className={"se__locale" + (locale === loc ? " is-active" : "")} onClick={() => setLocale(loc)}>{loc.toUpperCase()}</button>
                  ))}
                </div>
              )}
              <ul className="se__pages">
                {localePages.map((p) => (
                  <li key={p.file}>
                    {/* a real button: the page list was unreachable by keyboard entirely */}
                    <button type="button" aria-current={activeFile === p.file ? "page" : undefined}
                      className={"se__page" + (activeFile === p.file ? " is-active" : "")}
                      onClick={() => setActiveFile(p.file)}>
                      <span className="se__page-name">{p.title.replace(/ [—|].*$/, "")}</span>
                      <span className="se__page-slug">{p.slug}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button className="se__section se__section--toggle" onClick={() => setBlocksOpen((v) => !v)}>
            <ChevronDown size={13} className={"se__chev" + (blocksOpen ? "" : " is-collapsed")} />
            Блоки{edit ? " · клик = к блоку" : ""}
          </button>
          {blocksOpen && (
          <ul className="se__outline">
            {(activeEntry?.blocks ?? []).map((b) => {
              const removed = isRemoved(b.id);
              const region = page?.blocks.find((pb) => pb.id === b.id)?.content.region;
              const canDelete = edit && region !== "header" && region !== "footer";
              const edited = !removed && overrides.current[page?.id ?? ""]?.[b.id] != null;
              return (
                <li key={b.id}
                  className={"se__block" + (selected === b.id ? " is-selected" : "") + (removed ? " is-removed" : "")}>
                  {/* the label itself is the control, so the list is reachable by keyboard */}
                  <button type="button" className="se__block-label" disabled={removed}
                    onClick={() => !removed && scrollToBlock(b.id)}>{b.label}{removed ? " · удалён" : ""}</button>
                  {edited && <span className="se__dot" title="изменён" />}
                  {removed ? (
                    <button className="se__block-btn" title="Вернуть секцию"
                      onClick={(e) => { e.stopPropagation(); restoreBlock(b.id); }}><RotateCcw size={14} /></button>
                  ) : canDelete ? (
                    <button className="se__block-btn se__block-btn--del" title="Удалить секцию"
                      onClick={(e) => { e.stopPropagation(); deleteBlock(b.id); }}><Trash2 size={14} /></button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          )}

          {edit && selEl?.tree && selEl.tree.length > 0 && (
            <>
              <div className="se__section">Слои · внутри блока</div>
              <LayersTree
                tree={selEl.tree}
                selectedId={selEl.el}
                onSelect={selectCrumb}
                onToggleHide={(id, hidden) => frameRef.current?.contentWindow?.postMessage({ type: "lg-elem-hide", blockId: selEl.blockId, el: id, hidden }, "*")}
                onMove={(id, refId, before) => frameRef.current?.contentWindow?.postMessage({ type: "lg-elem-move", blockId: selEl.blockId, el: id, refId, before }, "*")}
              />
            </>
          )}
        </aside>

        <main className="se__canvas" ref={canvasRef}>
          {srcDoc ? (
            <div className="se__sizer" style={{ width: frameW * zoom, height: frameH * zoom }}>
              <div className="se__stage" style={{ width: frameW, height: frameH, transform: `scale(${zoom})` }}>
                <iframe
                  ref={frameRef}
                  key={activeFile + String(edit)}
                  className="se__frame"
                  title="Страница сайта — редактируемый холст"
                  style={{ width: frameW, height: frameH }}
                  srcDoc={srcDoc}
                  onLoad={onFrameLoad}
                />
              </div>
            </div>
          ) : null}
        </main>

        <aside className="se__panel glass se__inspector">
          {selEl ? (
            <>
              <div className="se__insp-head"><span className="se__insp-kind">{KIND_LABEL[selEl.kind]}</span></div>
              {selEl.crumbs && selEl.crumbs.length > 1 && (
                <div className="se__crumbs" title="Выбрать родительский элемент">
                  {selEl.crumbs.map((c, i) => (
                    <React.Fragment key={c.id}>
                      {i > 0 && <span className="se__crumb-sep">›</span>}
                      <button className={"se__crumb" + (c.id === selEl.el ? " is-active" : "")} onClick={() => selectCrumb(c.id)}>{c.label}</button>
                    </React.Fragment>
                  ))}
                </div>
              )}
              <ElementInspector sel={selEl} patch={patchEl} onReplaceImage={replaceMedia} breakpoint={device as Breakpoint} onResetBp={resetBp} onState={patchState} onResetState={resetState} onResizeMode={resizeMode} onVAlign={vAlign} />
              {edit && selEl.kind === "select" && selEl.selectOptions && (
                <OptionsEditor options={selEl.selectOptions} onChange={setSelectOptions} />
              )}
              {edit && (
                <div className="se__insp-actions">
                  {/* Works on every device, unlike «Сбросить экран» which only clears the current
                      breakpoint — a desktop experiment used to have no way back. */}
                  <button className="se__insp-reset" title="Вернуть элементу исходное оформление на всех экранах"
                    onClick={resetEl}>
                    <RotateCcw size={15} /> Сбросить оформление
                  </button>
                  <button className="se__insp-del se__insp-del--el" title="Удалить только этот элемент"
                    onClick={deleteEl}>
                    <Trash2 size={15} /> Удалить элемент
                  </button>
                  {(() => {
                    const region = page?.blocks.find((pb) => pb.id === selEl.blockId)?.content.region;
                    if (region === "header" || region === "footer") return null;
                    const label = activeEntry?.blocks.find((b) => b.id === selEl.blockId)?.label;
                    return (
                      <button className="se__insp-del" title="Удалить всю эту секцию (можно вернуть в списке «Блоки»)"
                        onClick={() => deleteBlock(selEl.blockId)}>
                        <Trash2 size={15} /> Удалить секцию{label ? ` «${label}»` : ""}
                      </button>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <div className="se__empty">
              <p>Кликните по тексту, кнопке или картинке на сайте — здесь появятся настройки. Выделите часть текста, чтобы поменять цвет только у неё.</p>
              <div className="se__legend">
                <div className="se__legend-t">Горячие клавиши</div>
                <ul>
                  <li><span className="se__keys"><kbd>Ctrl</kbd><kbd>Z</kbd></span> <span>отменить</span></li>
                  <li><span className="se__keys"><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Z</kbd></span> <span>повторить</span></li>
                  <li><span className="se__keys"><kbd>Ctrl</kbd><kbd>B</kbd></span> <span>жирный (в выделенном тексте)</span></li>
                </ul>
              </div>
            </div>
          )}
        </aside>
      </div>

      {textSel && toolbarPos && (
        <div className="rtb glass" style={{ top: toolbarPos.top, left: toolbarPos.left }} onMouseDown={(e) => e.preventDefault()}>
          <button className={"rtb__btn" + (textSel.state.bold ? " is-active" : "")} title="Жирный (Ctrl+B)" onClick={() => textCmd("bold")}><Bold size={15} /></button>
          <button className={"rtb__btn" + (textSel.state.italic ? " is-active" : "")} title="Курсив (Ctrl+I)" onClick={() => textCmd("italic")}><Italic size={15} /></button>
          <button className={"rtb__btn" + (textSel.state.underline ? " is-active" : "")} title="Подчёркнутый" onClick={() => textCmd("underline")}><Underline size={15} /></button>
          <span className="rtb__sep" />
          <label className="rtb__btn rtb__color" title="Цвет выделенного текста">
            <span className="rtb__swatch" />
            <input type="color" onChange={(e) => textCmd("color", e.target.value)} />
          </label>
          <button className={"rtb__btn" + (textSel.state.link ? " is-active" : "")} title="Ссылка (Ctrl+K)"
            onClick={() => setLinkPop((p) => (p ? null : { url: textSel.state.href || "https://", newTab: textSel.state.newTab }))}><Link2 size={15} /></button>
          <span className="rtb__sep" />
          <button className="rtb__btn" title="Убрать форматирование" onClick={() => textCmd("removeFormat")}><Eraser size={15} /></button>
        </div>
      )}

      {mediaPick && (
        <MediaPicker
          tenant={TENANT}
          accept={mediaPick.accept}
          onPick={(url, type) => {
            // Library urls are canonical; the iframe needs the preview form to actually show them.
            // (The runtime's save then round-trips it back to canonical, so publishing stays correct.)
            frameRef.current?.contentWindow?.postMessage({ type: "lg-media-set", blockId: mediaPick.blockId, el: mediaPick.el, src: toPreview(url), mediaType: type }, "*");
            setMediaPick(null);
          }}
          onClose={() => setMediaPick(null)}
        />
      )}

      {publishing && (
        <PublishDialog
          index={index}
          dataBase={DATA}
          publishedBy={session?.name || ""}
          overrides={allOverrides()}
          bp={allBp()}
          onDownload={exportEdits}
          onClose={() => setPublishing(false)}
        />
      )}

      {textSel && toolbarPos && linkPop && (
        <div className="rtb-link glass" style={{ top: toolbarPos.top + 44, left: toolbarPos.left }}>
          <input
            className="rtb-link__url"
            autoFocus
            value={linkPop.url}
            placeholder="https://…  или  #book  или  tel:+373…"
            onChange={(e) => setLinkPop({ ...linkPop, url: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") { textCmd("link", linkPop.url, linkPop.newTab); setLinkPop(null); }
              else if (e.key === "Escape") setLinkPop(null);
            }}
          />
          <label className="rtb-link__nt">
            <input type="checkbox" checked={linkPop.newTab} onChange={(e) => setLinkPop({ ...linkPop, newTab: e.target.checked })} />
            Открывать в новой вкладке
          </label>
          <div className="rtb-link__row">
            {textSel.state.link && <button className="rtb-link__rm" onClick={() => { textCmd("unlink"); setLinkPop(null); }}>Убрать ссылку</button>}
            <button className="rtb-link__apply" onClick={() => { textCmd("link", linkPop.url, linkPop.newTab); setLinkPop(null); }}>Применить</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Edit the options of a form <select> (e.g. the book-cleaning dropdowns): rename / add / remove /
 * reorder the answer choices. The visible label is also the submitted value, so what the client picks
 * reads clearly in the CRM. */
function OptionsEditor({ options, onChange }: { options: SelectOption[]; onChange: (o: SelectOption[]) => void }) {
  const commit = (next: SelectOption[]) => onChange(next);
  const rename = (i: number, label: string) => commit(options.map((o, j) => (j === i ? { value: label, label } : o)));
  const remove = (i: number) => commit(options.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= options.length) return;
    const next = options.slice(); const t = next[i]; next[i] = next[j]; next[j] = t; commit(next);
  };
  const add = () => commit([...options, { value: "Новый вариант", label: "Новый вариант" }]);
  return (
    <div className="se__opts">
      <div className="se__opts-h">Варианты ответа</div>
      {options.map((o, i) => (
        <div className="se__opt" key={i}>
          <input className="se__opt-in" value={o.label} onChange={(e) => rename(i, e.target.value)} placeholder="Текст варианта" />
          <button className="se__opt-b" title="Выше" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp size={14} /></button>
          <button className="se__opt-b" title="Ниже" onClick={() => move(i, 1)} disabled={i === options.length - 1}><ChevronDown size={14} /></button>
          <button className="se__opt-b se__opt-b--del" title="Удалить вариант" onClick={() => remove(i)}><X size={14} /></button>
        </div>
      ))}
      <button className="se__opt-add" onClick={add}><Plus size={14} /> Добавить вариант</button>
    </div>
  );
}
