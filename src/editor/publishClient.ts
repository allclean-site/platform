/**
 * Client side of instant publish: POST the editor's saved edits to the site's /api/publish endpoint,
 * which stores them in Supabase and triggers a rebuild. Configured in Настройки → Публикация; when the
 * endpoint is empty the Publish dialog falls back to the edits.json download.
 */

import { publishConfig } from "../settings/store";
import { isStale } from "../app/version";
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

/**
 * Vercel refuses a request body over ~4.5MB at the EDGE, and that refusal carries no CORS headers —
 * so the browser never sees the 413, it just throws "Failed to fetch". That is what a client with a
 * 4.1MB draft saw instead of a published site. The edits are stored one row per page anyway, so they
 * are sent a few pages at a time and the deploy is fired once, on the last call.
 * (The draft is that big because replaced photos are inlined as base64 when Supabase Storage has no
 * key — 18 of them, 3.1MB, in one section. Configuring Storage is the cure; this is the seatbelt.)
 */
const CHUNK_LIMIT = 3 * 1024 * 1024;

const sizeOf = (v: unknown) => new Blob([JSON.stringify(v)]).size;

/** Page ids grouped so each group stays under the limit; a single oversized page goes alone. */
function chunkPages(ids: string[], size: (id: string) => number): string[][] {
  const out: string[][] = [];
  let cur: string[] = [], curSize = 0;
  for (const id of ids) {
    const s = size(id);
    if (cur.length && curSize + s > CHUNK_LIMIT) { out.push(cur); cur = []; curSize = 0; }
    cur.push(id); curSize += s;
  }
  if (cur.length) out.push(cur);
  return out;
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
    detail: `endpoint: ${p.endpoint}
editKey: пусто (сессия без ключа). Если после повторного входа ключа всё ещё нет — на сайтовом проекте не задан EDIT_KEY.`,
  };

  // Old code in an old tab is how the size limit was hit five days after it was fixed: the cabinet
  // had been redeployed, the client's tab had not. Publishing is the one action worth stopping for.
  if (await isStale()) return {
    ok: false,
    message: "Кабинет обновился — эта вкладка ещё работает на старой версии. Обновите страницу (Ctrl+Shift+R) и нажмите «Опубликовать» снова.",
    detail: "running bundle != served bundle (src/app/version.ts)",
  };

  const ids = [...new Set([...Object.keys(overrides), ...Object.keys(breakpoints)])];
  const chunks = chunkPages(ids, (id) => sizeOf(overrides[id]) + sizeOf(breakpoints[id]));
  let pages = 0, rebuilt = false, instant = false;

  for (let i = 0; i < chunks.length; i++) {
    const last = i === chunks.length - 1;
    const ov: SiteOverrides = {}, bp: SiteBp = {};
    for (const id of chunks[i]) {
      if (overrides[id]) ov[id] = overrides[id];
      if (breakpoints[id]) bp[id] = breakpoints[id];
    }
    const r = await postSiteApi<{ rebuild?: boolean; pages?: number; instant?: boolean }>(
      "publish", { project: "allclean", overrides: ov, breakpoints: bp, by, finish: last }
    );
    if (r.offline) {
      // One page too heavy for a single request — name it, because the fix is on that page.
      const heavy = chunks[i].length === 1 ? chunks[i][0] : "";
      const mb = (sizeOf(ov) / 1048576).toFixed(1);
      return {
        ok: false,
        message: heavy
          ? `Страница «${heavy}» слишком тяжёлая для публикации (${mb} МБ) — скорее всего, фото на ней вставлены прямо в страницу. Замените их загрузкой файла (Настройки → Интеграции → Хранилище картинок).`
          : `Не удалось связаться с сервером публикации (${r.error}). Проверьте интернет и адрес в Настройках → Публикация.`,
        detail: `endpoint: ${r.endpoint}
network error: ${r.error}
часть ${i + 1}/${chunks.length}, ${mb} МБ`,
      };
    }
    if (!r.ok) {
      const hint = r.status === 401 || r.status === 403 ? " Похоже, неверный ключ публикации — проверьте Настройки → Публикация." : "";
      return {
        ok: false,
        message: `Ошибка публикации: HTTP ${r.status}.${hint}${r.error ? " " + r.error : ""}`,
        detail: `endpoint: ${r.endpoint}
HTTP ${r.status}
часть ${i + 1}/${chunks.length}
${r.raw.slice(0, 600)}`,
      };
    }
    pages += r.data?.pages ?? 0;
    rebuilt = rebuilt || !!r.data?.rebuild;
    instant = instant || !!r.data?.instant;
  }

  // Pages are rendered on demand from what was just stored, so "published" means published — no
  // rebuild to wait out. The old copy promised 1–2 minutes because publishing used to run the whole
  // deploy pipeline for a changed word.
  return {
    ok: true,
    message: instant && !rebuilt
      ? `Опубликовано (${pages} стр.) — изменения уже на сайте.`
      : rebuilt
        ? `Опубликовано (${pages} стр.) — сайт пересобирается, изменения появятся через 1–2 минуты.`
        : `Сохранено (${pages} стр.), но авто-пересборка не настроена (нет Deploy Hook).`,
  };
}
