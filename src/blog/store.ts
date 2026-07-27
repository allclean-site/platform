/**
 * Blog store — the client's articles. Reuses the ported `Article` model (src/engine/blog/types.ts)
 * so a published article can expand into a first-class page with auto-SEO. localStorage for now;
 * a Supabase adapter (per-tenant) slots in later with the same shape.
 *
 * "Auto-SEO" here is a local, no-AI enrichment on publish: derive slug/excerpt/seoTitle/seoDescription
 * from the title + Markdown body. The AI adapter (/api/translate) can replace enrich() later.
 */

import type { Article } from "../engine/blog/types";
import { slugify } from "../engine/blog/slug";
import { markdownToText } from "../engine/blog/markdown";

const KEY = "leadgenium:articles";
const uid = () => "a" + Math.random().toString(36).slice(2, 9);
// Article groups map to Supabase `articles.group_id` (a uuid) — generate a real uuid so a published
// pair upserts cleanly on (group_id, locale).
const newGroupId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : uid());
const nowISO = () => new Date().toISOString();

function seed(): Article[] {
  const mk = (title: string, body: string, tags: string[], daysAgo: number): Article => {
    const a = enrich({
      id: uid(), group: uid(), locale: "ru", slug: "", title, body,
      author: "Команда AllClean", status: "published",
      datePublished: new Date(Date.now() - daysAgo * 864e5).toISOString(),
      dateModified: new Date(Date.now() - daysAgo * 864e5).toISOString(),
    });
    a.meta = { tags };
    return a;
  };
  return [
    mk(
      "Как подготовить квартиру к генеральной уборке",
      "## Зачем готовиться\nНебольшая подготовка ускоряет уборку и повышает результат.\n\n### Шаги\n- Уберите мелкие вещи с поверхностей\n- Освободите доступ к окнам\n- Отметьте проблемные зоны для клинера\n\nПрофессиональная бригада сделает остальное — от кухни до санузла.",
      ["Уборка", "Советы"], 2,
    ),
    mk(
      "Сколько стоит уборка после ремонта в Кишинёве",
      "## Что влияет на цену\nПлощадь, степень загрязнения и наличие строительной пыли.\n\n### Ориентиры\n- Квартира 60 м² — от 2 500 MDL\n- Дом 120 м² — от 4 500 MDL\n\nТочную стоимость посчитает наш калькулятор или менеджер.",
      ["Цены", "После ремонта"], 6,
    ),
  ];
}

export function loadArticles(): Article[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    return JSON.parse(raw) as Article[];
  } catch {
    return seed();
  }
}

export function saveArticles(list: Article[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function getArticle(id: string): Article | undefined {
  return loadArticles().find((a) => a.id === id);
}

export function upsertArticle(a: Article): Article[] {
  const list = loadArticles();
  const next = { ...a, dateModified: nowISO() };
  const i = list.findIndex((x) => x.id === a.id);
  if (i >= 0) list[i] = next; else list.unshift(next);
  saveArticles(list);
  return list;
}

export function removeArticle(id: string): Article[] {
  const list = loadArticles().filter((a) => a.id !== id);
  saveArticles(list);
  return list;
}

export function newArticle(locale: string = "ro"): Article {
  return {
    id: uid(), group: newGroupId(), locale, slug: "", title: "", body: "",
    author: "", status: "draft", datePublished: nowISO(), dateModified: nowISO(), meta: {},
    sourceLocale: locale,
  };
}

/** Both locale versions of an article, keyed by locale (a bilingual group shares `group`). */
export function getGroup(groupId: string): Record<string, Article> {
  const out: Record<string, Article> = {};
  for (const a of loadArticles()) if (a.group === groupId) out[a.locale] = a;
  return out;
}

/** A fresh translation counterpart (same group, other locale), empty until translated. */
export function newCounterpart(source: Article, locale: string): Article {
  return {
    id: uid(), group: source.group, locale, slug: "", title: "", body: "",
    author: source.author, status: source.status, datePublished: source.datePublished, dateModified: nowISO(),
    meta: {}, autoTranslated: true, sourceLocale: source.sourceLocale || source.locale,
    coverUrl: source.coverUrl, coverAlt: source.coverAlt,
  };
}

/** Local auto-SEO: fill slug/excerpt/seoTitle/seoDescription from the title + body when missing. */
export function enrich(a: Article): Article {
  const text = markdownToText(a.body).trim();
  const excerpt = a.excerpt || text.slice(0, 165).trim() + (text.length > 165 ? "…" : "");
  return {
    ...a,
    slug: a.slug || slugify(a.title) || a.id,
    excerpt,
    seoTitle: a.seoTitle || a.title,
    seoDescription: a.seoDescription || excerpt,
  };
}

export function publishArticle(a: Article): Article[] {
  return upsertArticle({ ...enrich(a), status: "published", datePublished: a.datePublished || nowISO() });
}
