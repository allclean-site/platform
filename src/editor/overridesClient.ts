/**
 * Pull the PUBLISHED edits from the site (Supabase, via /api/overrides) so the editor shows the shared
 * state — the agency sees the client's published edits, and the editor matches the live site. Endpoint +
 * key come from publishConfig (Настройки → Публикация / build env).
 *
 * ⚠️ ОШИБКУ НЕЛЬЗЯ ГЛОТАТЬ. Раньше здесь стояло «graceful: при любой ошибке возвращаем null, редактор
 * откатится на localStorage». На деле это значило вот что: ключ в браузере устарел, `/api/overrides`
 * ответил 401 — и клиент увидел в редакторе ЗЕРКАЛО вместо своего сайта. Заголовок главной на сайте
 * «Curățenie profesională în Chișinău și în toată Moldova», а в редакторе «CURĂȚENIE PENTRU OAMENI
 * OCUPAȚI ÎN CHIȘINĂU» — исходный текст шаблона, которого нет нигде. Хуже того: правка поверх такой
 * страницы публикуется и затирает на сайте настоящий текст.
 *
 * Поэтому возвращаем причину, а вызывающий обязан на ней остановиться.
 */

import { postSiteApi } from "./siteApi";
import type { SiteOverrides } from "./realStore";
import type { SiteBp } from "./bpStore";

export type PublishedPull =
  | { ok: true; overrides: SiteOverrides; breakpoints: SiteBp }
  | { ok: false; reason: string };

export async function fetchPublishedOverrides(project = "allclean"): Promise<PublishedPull> {
  const r = await postSiteApi<{ overrides?: SiteOverrides; breakpoints?: SiteBp }>("overrides", { project });
  if (!r.ok || !r.data) {
    const reason = r.status === 401
      ? "сайт не принял ключ доступа — войдите в кабинет заново"
      : r.status === 0 || !r.endpoint
        ? "адрес сайта не настроен (Настройки → Публикация)"
        : `сайт ответил ${r.status}${r.error ? ": " + r.error : ""}`;
    return { ok: false, reason };
  }
  return { ok: true, overrides: r.data.overrides || {}, breakpoints: r.data.breakpoints || {} };
}
