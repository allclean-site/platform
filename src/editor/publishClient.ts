/**
 * Client side of instant publish: POST the editor's saved edits to the site's /api/publish endpoint,
 * which stores them in Supabase and triggers a rebuild. Configured in Настройки → Публикация; when the
 * endpoint is empty the Publish dialog falls back to the edits.json download.
 */

import { publishConfig } from "../settings/store";
import { postSiteApi, siteApiConfigured } from "./siteApi";
import type { SiteOverrides } from "./realStore";
import type { SiteBp } from "./bpStore";

export function publishConfigured(): boolean {
  return siteApiConfigured();
}

export interface PublishResult { ok: boolean; message: string; detail?: string }

/** `by` is recorded with the restore point so the history says who published what. */
export async function publishToSite(overrides: SiteOverrides, breakpoints: SiteBp, by = ""): Promise<PublishResult> {
  const p = publishConfig();
  if (!p.endpoint) return { ok: false, message: "Публикация не настроена (Настройки → Публикация)." };
  if (!p.editKey) return {
    ok: false,
    message: "Публикация ещё не настроена агентством (нет ключа в сборке кабинета). Напишите в поддержку — или временно вставьте ключ в Настройки → Публикация.",
    detail: `endpoint: ${p.endpoint}\neditKey: (пусто — не задан ни VITE_PUBLISH_KEY в сборке, ни в Настройках)`,
  };
  const r = await postSiteApi<{ rebuild?: boolean; pages?: number }>("publish", { project: "allclean", overrides, breakpoints, by });
  if (r.offline) {
    return {
      ok: false,
      message: `Не удалось связаться с сервером публикации (${r.error}). Проверьте интернет и адрес в Настройках → Публикация.`,
      detail: `endpoint: ${r.endpoint}\nnetwork error: ${r.error}`,
    };
  }
  if (!r.ok) {
    const hint = r.status === 401 || r.status === 403 ? " Похоже, неверный ключ публикации — проверьте Настройки → Публикация." : "";
    return {
      ok: false,
      message: `Ошибка публикации: HTTP ${r.status}.${hint}${r.error ? " " + r.error : ""}`,
      detail: `endpoint: ${r.endpoint}\nHTTP ${r.status}\n${r.raw.slice(0, 600)}`,
    };
  }
  return {
    ok: true,
    message: r.data?.rebuild
      ? `Опубликовано (${r.data.pages} стр.) — сайт пересобирается, изменения появятся через 1–2 минуты.`
      : `Сохранено (${r.data?.pages} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
  };
}
