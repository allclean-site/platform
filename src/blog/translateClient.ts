/**
 * Client for /api/translate — sends the authored article to the server (Claude) and gets back the
 * translation + SEO/GEO/AEO metadata for both languages. Endpoint is derived from the publish endpoint
 * (…/api/publish → …/api/translate) and gated by the same EDIT_KEY (Настройки → Публикация).
 */

import { postSiteApi, siteApiConfigured } from "../editor/siteApi";
import type { Locale } from "../engine/blog/types";

export interface SideMeta { slug: string; excerpt: string; seo_title: string; seo_description: string; faq: { question: string; answer: string }[]; takeaways: string[]; tags: string[] }
export interface TargetSide extends SideMeta { title: string; body: string }
export interface TranslateResult { source: SideMeta; target: TargetSide }

export function translateConfigured(): boolean {
  return siteApiConfigured();
}

export async function translateArticle(title: string, body: string, sourceLocale: Locale, targetLocale: Locale): Promise<TranslateResult> {
  if (!siteApiConfigured()) throw new Error("Публикация/перевод не настроены (Настройки → Публикация).");
  const r = await postSiteApi<TranslateResult>("translate", { title, body, sourceLocale, targetLocale, brand: "All Clean", city: "Chișinău" });
  if (!r.ok || !r.data) throw new Error(r.error ? `Ошибка перевода: ${r.error}` : `Ошибка сервера (${r.status}).`);
  return r.data;
}
