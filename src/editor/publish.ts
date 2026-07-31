/**
 * Pre-publish checks — the auto-SEO gate, surfaced in the Publish dialog.
 *
 * For each page we produce the FINAL published HTML (exportPageHtml: overrides applied, editor cruft
 * stripped, @media/:hover rules inlined) and inspect it the way a search engine would: one <title>,
 * a meta description, exactly one <h1>, a <html lang>, and image alt coverage. This is the same output
 * the Node build (`build:edited`) writes to disk, so what the report shows is what ships.
 */

import { exportPageHtml } from "./exportSite";
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
  };
}
