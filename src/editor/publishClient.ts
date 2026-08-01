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

export interface PublishResult {
  ok: boolean;
  message: string;
  detail?: string;
  /** The session predates server-side sign-in and carries no key — signing in again is the fix. */
  needsRelogin?: boolean;
}

/** `by` is recorded with the restore point so the history says who published what. */
export async function publishToSite(overrides: SiteOverrides, breakpoints: SiteBp, by = ""): Promise<PublishResult> {
  const p = publishConfig();
  if (!p.endpoint) return { ok: false, message: "Публикация не настроена (Настройки → Публикация)." };
  // The right to publish now arrives WITH the session. A session opened before that change (or one
  // restored from an older browser tab) has none, and the old wording sent people to support over
  // something one sign-in fixes.
  if (!p.editKey) return {
    ok: false,
    needsRelogin: true,
    message: "Похоже, вы вошли в кабинет давно — сессия устарела и права на публикацию у неё нет. Войдите заново, и кнопка заработает.",
    detail: `endpoint: ${p.endpoint}\neditKey: пусто (сессия без ключа). Если после повторного входа ключа всё ещё нет — на сайтовом проекте не задан EDIT_KEY.`,
  };
  const r = await postSiteApi<{ rebuild?: boolean; pages?: number; instant?: boolean }>("publish", { project: "allclean", overrides, breakpoints, by });
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
  // Pages are rendered on demand from what was just stored, so "published" means published — no
  // rebuild to wait out. The old copy promised 1–2 minutes because publishing used to run the whole
  // deploy pipeline for a changed word.
  const pages = r.data?.pages ?? 0;
  return {
    ok: true,
    message: r.data?.instant && !r.data?.rebuild
      ? `Опубликовано (${pages} стр.) — изменения уже на сайте.`
      : r.data?.rebuild
        ? `Опубликовано (${pages} стр.) — сайт пересобирается, изменения появятся через 1–2 минуты.`
        : `Сохранено (${pages} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
  };
}
