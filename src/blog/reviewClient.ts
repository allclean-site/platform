/**
 * Статьи на проверке: черновики конвейера лежат в базе (articles, status review/approved/rejected),
 * а не в браузере — владелец видит их с любого устройства. Всё через /api/articles-review (EDIT_KEY).
 */

import { postSiteApi } from "../editor/siteApi";
import { loadArticles, upsertArticle } from "./store";
import type { Article, ArticleFaq } from "../engine/blog/types";

export interface ReviewChecks { errors?: string[]; warnings?: string[]; at?: string }
export interface ReviewRow {
  id: string; group_id: string; locale: string; slug: string; title: string; excerpt?: string | null; body?: string | null;
  cover_url?: string | null; seo_title?: string | null; seo_description?: string | null;
  status: "review" | "approved" | "rejected"; publish_at?: string | null; review_note?: string | null;
  created_at?: string; updated_at?: string;
  meta?: {
    faq?: ArticleFaq[]; takeaways?: string[]; tags?: string[]; coverAlt?: string; author?: string;
    checks?: ReviewChecks; service_page?: string; queue?: { id?: string; query?: string; question?: string };
  } | null;
}

/** Время выхода в день публикации: 05:00 UTC (как SLOT_HOUR_UTC в src/engine/blog/article-pipeline.js). */
export const slotIso = (day: string) => `${day}T05:00:00.000Z`;

export async function loadReview(): Promise<{ ok: boolean; rows: ReviewRow[]; suggested: Record<string, string>; error: string }> {
  const r = await postSiteApi<{ articles?: ReviewRow[]; suggested?: Record<string, string> }>("articles-review", { op: "list" });
  if (!r.ok) return { ok: false, rows: [], suggested: {}, error: r.offline ? "Нет связи с сайтом." : r.error || `Ошибка ${r.status}` };
  return { ok: true, rows: r.data?.articles || [], suggested: r.data?.suggested || {}, error: "" };
}

export async function reviewOp(op: "approve" | "unapprove" | "reject" | "save", payload: Record<string, unknown>) {
  const r = await postSiteApi<{ publish_at?: string; checks?: ReviewChecks; error?: string }>("articles-review", { op, ...payload });
  return { ok: r.ok, data: r.data, error: r.ok ? "" : r.offline ? "Нет связи с сайтом." : r.error || `Ошибка ${r.status}` };
}

/**
 * «Поправить»: строка базы → статья редактора (локальная копия с reviewId). Если локальная копия
 * новее строки базы, открываем её: правки, ещё не отправленные на проверку, не теряются.
 */
export function openForEdit(row: ReviewRow): Article {
  const mine = loadArticles().find((a) => a.reviewId === row.id);
  if (mine && Date.parse(mine.dateModified || "") > Date.parse(row.updated_at || "")) return mine;
  const a: Article = {
    id: mine?.id || "r" + row.id.replace(/-/g, "").slice(0, 10), group: row.group_id, locale: row.locale, slug: row.slug,
    title: row.title || "", body: row.body || "", excerpt: row.excerpt || "", seoTitle: row.seo_title || "",
    seoDescription: row.seo_description || "", coverUrl: row.cover_url || "", coverAlt: row.meta?.coverAlt || "",
    author: row.meta?.author || "", status: "draft", datePublished: row.publish_at || undefined, dateModified: row.updated_at,
    meta: { faq: row.meta?.faq || [], takeaways: row.meta?.takeaways || [], tags: row.meta?.tags || [] },
    sourceLocale: row.locale, reviewId: row.id,
  };
  upsertArticle(a);
  return a;
}

/** «Сохранить на проверку» из редактора: правка уходит в строку базы, проверка запускается заново. */
export async function saveForReview(a: Article) {
  return reviewOp("save", {
    id: a.reviewId,
    article: {
      title: a.title, body: a.body, excerpt: a.excerpt, seo_title: a.seoTitle, seo_description: a.seoDescription,
      cover_url: a.coverUrl, slug: a.slug,
      meta: { faq: a.meta?.faq || [], takeaways: a.meta?.takeaways || [], tags: a.meta?.tags || [], coverAlt: a.coverAlt || "", author: a.author || "" },
    },
  });
}
