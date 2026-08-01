/**
 * Pre-publish checks — the auto-SEO gate, surfaced in the Publish dialog.
 *
 * For each page we produce the FINAL published HTML (exportPageHtml: overrides applied, editor cruft
 * stripped, @media/:hover rules inlined) and inspect it the way a search engine would: one <title>,
 * a meta description, exactly one <h1>, a <html lang>, and image alt coverage. This is the same output
 * the Node build (`build:edited`) writes to disk, so what the report shows is what ships.
 */

import { exportPageHtml } from "./exportSite";
import { META_KEY, decodeMeta, readMeta } from "./renderCore.js";
import type { ImportedPage } from "./reassemble";
import type { PageOverrides } from "./realStore";
import type { PageBp } from "./bpStore";

export interface SeoIssue { level: "error" | "warn"; msg: string }
export interface PageReport {
  id: string;
  file: string;
  slug: string;
  lang: string;
  title: string;
  edits: number;
  issues: SeoIssue[];
  /** What actually changed on this page, in the client's own words. */
  changes: BlockChange[];
}

/** Inspect the published HTML of one page and return any SEO problems (empty = clean). */
export function checkSeo(html: string): SeoIssue[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const issues: SeoIssue[] = [];

  const title = doc.querySelector("title")?.textContent?.trim() || "";
  if (!title) issues.push({ level: "error", msg: "Нет заголовка <title>" });
  else if (title.length > 65) issues.push({ level: "warn", msg: `Длинный title — ${title.length} символов (лучше ≤ 60)` });

  const desc = (doc.querySelector('meta[name="description"]')?.getAttribute("content") || "").trim();
  if (!desc) issues.push({ level: "error", msg: "Нет meta description" });
  else if (desc.length > 165) issues.push({ level: "warn", msg: `Длинное описание — ${desc.length} символов (лучше ≤ 160)` });

  const h1 = doc.querySelectorAll("h1");
  if (h1.length === 0) issues.push({ level: "error", msg: "Нет заголовка <h1>" });
  else if (h1.length > 1) issues.push({ level: "warn", msg: `${h1.length} заголовков H1 — нужен ровно один` });

  if (!doc.documentElement.getAttribute("lang")) issues.push({ level: "warn", msg: "Не указан язык страницы (lang)" });

  const imgs = Array.from(doc.querySelectorAll("img"));
  const noAlt = imgs.filter((i) => !(i.getAttribute("alt") || "").trim()).length;
  if (noAlt > 0) issues.push({ level: "warn", msg: `${noAlt} из ${imgs.length} фото без alt-описания` });

  return issues;
}

/**
 * Layout safety check — catches the class of edit that broke the live hero: a text box pinned to a
 * fixed pixel box. A height (or a width with its max-width neutralised) is only correct at the width
 * it was dragged at; on a narrower screen the text overflows its section. The editor no longer creates
 * these, so this mainly flags edits published before that fix.
 */
export function checkLayout(html: string): SeoIssue[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const issues: SeoIssue[] = [];
  const texts = Array.from(doc.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,p,li,blockquote"));

  const label = (el: HTMLElement) => {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    return t ? `«${t.slice(0, 32)}${t.length > 32 ? "…" : ""}»` : `<${el.tagName.toLowerCase()}>`;
  };

  for (const el of texts) {
    const s = el.getAttribute("style") || "";
    if (/(^|;)\s*height\s*:\s*\d/i.test(s)) {
      issues.push({ level: "warn", msg: `Текст ${label(el)} с фиксированной высотой — на узких экранах может переполнить блок` });
    } else if (/(^|;)\s*width\s*:\s*\d/i.test(s) && /max-width\s*:\s*none/i.test(s)) {
      issues.push({ level: "warn", msg: `Текст ${label(el)} с жёсткой шириной — на узких экранах может выйти за край` });
    }
  }
  return issues;
}

/** How many edits landed on this page (content overrides + per-breakpoint/state rules). */
export function countPageEdits(pageId: string, overrides: Record<string, PageOverrides>, bp: Record<string, PageBp>): number {
  const ov = overrides[pageId] ? Object.keys(overrides[pageId]).length : 0;
  const b = bp[pageId];
  const rules = b ? (["tablet", "mobile", "hover", "active"] as const).reduce((n, k) => n + Object.keys(b[k] || {}).length, 0) : 0;
  return ov + rules;
}

/** One human-readable change on a page: what that block said before, and what it says now. */
export interface BlockChange {
  blockId: string;
  label: string;
  before: string;
  after: string;
  /** The header or the footer — one edit that shows on every page of the locale. */
  shared: boolean;
}

/**
 * The words a reader would see — not everything `textContent` returns.
 *
 * A block can carry scripts and JSON configuration: the pricing page holds 21 script tags, one of them
 * a 184 KB calculator config. Taking the raw textContent put that wall of JSON in front of the client
 * as "what changed", which explains nothing and buries the one line that mattered.
 */
const textOf = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll("script,style,noscript,template,svg").forEach((el) => el.remove());
  return (doc.body.textContent || "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
};

/** Show a phrase, not a paragraph: enough to recognise the edit, never enough to flood the dialog. */
const CUT = 70;
const shorten = (s: string): string => (s.length > CUT ? s.slice(0, CUT).trimEnd() + "…" : s);

/** The first place two strings differ, with a few words of context — and never more than a phrase. */
function firstDiff(a: string, b: string): { before: string; after: string } | null {
  if (a === b) return null;
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  // Start at a word boundary so a line never begins mid-word.
  const pad = 16;
  let from = Math.max(0, s - pad);
  const space = a.lastIndexOf(" ", from);
  if (from > 0 && space > from - 12) from = space + 1;
  const cut = (str: string, end: number) => {
    const tail = Math.min(str.length, end + pad);
    return (from > 0 ? "…" : "") + shorten(str.slice(from, tail)) + (tail < str.length ? "…" : "");
  };
  return { before: cut(a, ea), after: cut(b, eb) };
}

/**
 * What a client would recognise as "what I changed on this page".
 *
 * The publish dialog counted edits and checked SEO but never showed the edits themselves, so the only
 * way to know what a number like "37 правок" was about was to publish and look at the live site.
 */
export function changesForPage(
  page: ImportedPage,
  overrides: Record<string, PageOverrides>,
  labels?: Record<string, string | undefined>
): BlockChange[] {
  const ov = overrides[page.id];
  if (!ov) return [];
  const out: BlockChange[] = [];
  // The page's own title/description live in the same map under a reserved key.
  const meta = decodeMeta(ov[META_KEY]);
  if (meta) {
    const was = readMeta(page.prefix);
    if (meta.title && meta.title !== was.title) out.push({ blockId: META_KEY + ":t", label: "Заголовок в поиске", before: was.title, after: meta.title, shared: false });
    if (meta.description && meta.description !== was.description) out.push({ blockId: META_KEY + ":d", label: "Описание в поиске", before: was.description, after: meta.description, shared: false });
  }
  for (const b of page.blocks) {
    const edited = ov[b.id];
    if (edited == null) continue;
    const region = b.content.region;
    const shared = region === "header" || region === "footer";
    const label = labels?.[b.id] || b.content.label || (shared ? (region === "header" ? "Шапка" : "Подвал") : b.id);
    if (edited === "") { out.push({ blockId: b.id, label, before: shorten(textOf(b.content.html)), after: "— секция удалена —", shared }); continue; }
    const d = firstDiff(textOf(b.content.html), textOf(edited));
    // No text difference = the change was visual (size, colour, spacing, a replaced photo).
    out.push(d ? { blockId: b.id, label, ...d, shared } : { blockId: b.id, label, before: "", after: "оформление или фото", shared });
  }
  return out;
}

/** Build the SEO report for a single page from its published HTML. */
export function reportForPage(
  page: ImportedPage,
  overrides: Record<string, PageOverrides>,
  bp: Record<string, PageBp>
): PageReport {
  const html = exportPageHtml(page, overrides[page.id], bp[page.id]);
  return {
    id: page.id,
    file: page.id,
    slug: page.slug,
    lang: page.lang,
    title: page.meta.title,
    edits: countPageEdits(page.id, overrides, bp),
    issues: [...checkSeo(html), ...checkLayout(html)],
    changes: changesForPage(page, overrides),
  };
}
