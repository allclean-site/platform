/**
 * Client side of instant publish: POST the editor's saved edits to the site's /api/publish endpoint,
 * which stores them in Supabase and triggers a rebuild. Configured in Настройки → Публикация; when the
 * endpoint is empty the Publish dialog falls back to the edits.json download.
 */

import { loadSettings } from "../settings/store";
import type { SiteOverrides } from "./realStore";
import type { SiteBp } from "./bpStore";

export function publishConfigured(): boolean {
  return !!loadSettings().publish?.endpoint;
}

export async function publishToSite(overrides: SiteOverrides, breakpoints: SiteBp): Promise<{ ok: boolean; message: string }> {
  const p = loadSettings().publish;
  if (!p?.endpoint) return { ok: false, message: "Публикация не настроена (Настройки → Публикация)." };
  try {
    const res = await fetch(p.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey: p.editKey, project: "allclean", overrides, breakpoints }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, message: data.error ? `Ошибка: ${data.error}` : `Ошибка сервера (${res.status}).` };
    return {
      ok: true,
      message: data.rebuild
        ? `Опубликовано (${data.pages} стр.) — сайт пересобирается, изменения появятся через 1–2 минуты.`
        : `Сохранено (${data.pages} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
    };
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером публикации." };
  }
}
