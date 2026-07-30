/**
 * Publish both language versions of an article to the live site: POST to /api/publish-article, which
 * saves them to Supabase `articles` and triggers a rebuild (build-site.mjs regenerates the blog pages).
 * Endpoint + key come from Настройки → Публикация (same EDIT_KEY as page publishing).
 */

import { publishConfig } from "../settings/store";
import type { Article } from "../engine/blog/types";

export async function publishArticlesToSite(articles: Article[]): Promise<{ ok: boolean; message: string; urls?: string[] }> {
  const p = publishConfig();
  if (!p.endpoint) return { ok: false, message: "Публикация не настроена (Настройки → Публикация)." };
  const endpoint = p.endpoint.replace(/\/publish\/?$/, "/publish-article");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey: p.editKey, articles }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, message: data.error ? `Ошибка: ${data.error}` : `Ошибка сервера (${res.status}).` };
    return {
      ok: true,
      urls: data.urls,
      message: data.rebuild
        ? `Опубликовано на сайт (${data.published} стр.) — пересборка запущена, появится через 1–2 минуты.`
        : `Сохранено (${data.published} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
    };
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером публикации." };
  }
}
