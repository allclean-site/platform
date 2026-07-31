/**
 * Pull real site leads into the CRM. The public site inserts leads into Supabase `site_leads`; anon
 * can't read them back, so the cabinet fetches them through the site's /api/leads endpoint (service_role,
 * gated by EDIT_KEY). The endpoint + key are the same ones configured for publish (Настройки → Публикация);
 * we derive /api/leads from the /api/publish URL so there's nothing extra to configure.
 */

import { postSiteApi, siteApiConfigured } from "../editor/siteApi";
import type { SiteLead } from "./store";

export function leadsConfigured(): boolean {
  return siteApiConfigured();
}

export async function fetchSiteLeads(): Promise<{ ok: boolean; leads?: SiteLead[]; message: string }> {
  if (!siteApiConfigured()) return { ok: false, message: "Не настроено (Настройки → Публикация)." };
  const r = await postSiteApi<{ leads?: SiteLead[] }>("leads", { project: "allclean" });
  if (r.offline) return { ok: false, message: "Не удалось связаться с сервером заявок." };
  if (!r.ok) return { ok: false, message: r.error ? `Ошибка: ${r.error}` : `Ошибка сервера (${r.status}).` };
  return { ok: true, leads: Array.isArray(r.data?.leads) ? r.data.leads : [], message: "ok" };
}
