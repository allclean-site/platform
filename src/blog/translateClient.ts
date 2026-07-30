/**
 * Client for /api/translate — sends the authored article to the server (Claude) and gets back the
 * translation + SEO/GEO/AEO metadata for both languages. Endpoint is derived from the publish endpoint
 * (…/api/publish → …/api/translate) and gated by the same EDIT_KEY (Настройки → Публикация).
 */

import { publishConfig } from "../settings/store";
import type { Locale } from "../engine/blog/types";

export interface SideMeta { slug: string; excerpt: string; seo_title: string; seo_description: string; faq: { question: string; answer: string }[]; takeaways: string[]; tags: string[] }
export interface TargetSide extends SideMeta { title: string; body: string }
export interface TranslateResult { source: SideMeta; target: TargetSide }

export function translateConfigured(): boolean {
  return !!publishConfig().endpoint;
}

export async function translateArticle(title: string, body: string, sourceLocale: Locale, targetLocale: Locale): Promise<TranslateResult> {
  const p = publishConfig();
  if (!p.endpoint) throw new Error("Публикация/перевод не настроены (Настройки → Публикация).");
  const endpoint = p.endpoint.replace(/\/publish\/?$/, "/translate");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ editKey: p.editKey, title, body, sourceLocale, targetLocale, brand: "All Clean", city: "Chișinău" }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data.error ? `Ошибка перевода: ${data.error}` : `Ошибка сервера (${res.status}).`);
  return data as TranslateResult;
}
