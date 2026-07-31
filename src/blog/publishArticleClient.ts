/**
 * Publish both language versions of an article to the live site: POST to /api/publish-article, which
 * saves them to Supabase `articles` and triggers a rebuild (build-site.mjs regenerates the blog pages).
 * Endpoint + key come from Настройки → Публикация (same EDIT_KEY as page publishing).
 */

import { postSiteApi, siteApiConfigured } from "../editor/siteApi";
import type { Article } from "../engine/blog/types";

export async function publishArticlesToSite(articles: Article[]): Promise<{ ok: boolean; message: string; urls?: string[] }> {
  if (!siteApiConfigured()) return { ok: false, message: "Публикация не настроена (Настройки → Публикация)." };
  const r = await postSiteApi<{ urls?: string[]; rebuild?: boolean; published?: number }>("publish-article", { articles });
  if (r.offline) return { ok: false, message: "Не удалось связаться с сервером публикации." };
  if (!r.ok) return { ok: false, message: r.error ? `Ошибка: ${r.error}` : `Ошибка сервера (${r.status}).` };
  return {
    ok: true,
    urls: r.data?.urls,
    message: r.data?.rebuild
      ? `Опубликовано на сайт (${r.data.published} стр.) — пересборка запущена, появится через 1–2 минуты.`
      : `Сохранено (${r.data?.published} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
  };
}
