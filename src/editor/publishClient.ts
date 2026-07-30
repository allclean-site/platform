/**
 * Client side of instant publish: POST the editor's saved edits to the site's /api/publish endpoint,
 * which stores them in Supabase and triggers a rebuild. Configured in Настройки → Публикация; when the
 * endpoint is empty the Publish dialog falls back to the edits.json download.
 */

import { publishConfig } from "../settings/store";
import type { SiteOverrides } from "./realStore";
import type { SiteBp } from "./bpStore";

export function publishConfigured(): boolean {
  return !!publishConfig().endpoint;
}

export interface PublishResult { ok: boolean; message: string; detail?: string }

export async function publishToSite(overrides: SiteOverrides, breakpoints: SiteBp): Promise<PublishResult> {
  const p = publishConfig();
  if (!p.endpoint) return { ok: false, message: "Публикация не настроена (Настройки → Публикация)." };
  if (!p.editKey) return {
    ok: false,
    message: "Публикация ещё не настроена агентством (нет ключа в сборке кабинета). Напишите в поддержку — или временно вставьте ключ в Настройки → Публикация.",
    detail: `endpoint: ${p.endpoint}\neditKey: (пусто — не задан ни VITE_PUBLISH_KEY в сборке, ни в Настройках)`,
  };
  try {
    const res = await fetch(p.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey: p.editKey, project: "allclean", overrides, breakpoints }),
    });
    const raw = await res.text();
    let data: { error?: string; rebuild?: boolean; pages?: number } = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body kept in raw */ }
    if (!res.ok) {
      const server = data.error || (raw ? raw.slice(0, 300) : "");
      const hint = res.status === 401 || res.status === 403 ? " Похоже, неверный ключ публикации — проверьте Настройки → Публикация." : "";
      return {
        ok: false,
        message: `Ошибка публикации: HTTP ${res.status}.${hint}${server ? " " + server : ""}`,
        detail: `endpoint: ${p.endpoint}\nHTTP ${res.status}\n${raw.slice(0, 600)}`,
      };
    }
    return {
      ok: true,
      message: data.rebuild
        ? `Опубликовано (${data.pages} стр.) — сайт пересобирается, изменения появятся через 1–2 минуты.`
        : `Сохранено (${data.pages} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `Не удалось связаться с сервером публикации (${String((e as Error)?.message || e)}). Проверьте интернет и адрес в Настройках → Публикация.`,
      detail: `endpoint: ${p.endpoint}\nnetwork error: ${String(e)}`,
    };
  }
}
