/**
 * Pull real site leads into the CRM. The public site inserts leads into Supabase `site_leads`; anon
 * can't read them back, so the cabinet fetches them through the site's /api/leads endpoint (service_role,
 * gated by EDIT_KEY). The endpoint + key are the same ones configured for publish (Настройки → Публикация);
 * we derive /api/leads from the /api/publish URL so there's nothing extra to configure.
 */

import { publishConfig } from "../settings/store";
import type { SiteLead } from "./store";

function leadsEndpoint(): string | null {
  const ep = publishConfig().endpoint;
  if (!ep) return null;
  // …/api/publish → …/api/leads (fall back to appending if the shape is unexpected)
  return /\/api\/publish\/?$/.test(ep) ? ep.replace(/\/api\/publish\/?$/, "/api/leads") : ep.replace(/\/$/, "") + "/../leads";
}

export function leadsConfigured(): boolean {
  return !!publishConfig().endpoint;
}

export async function fetchSiteLeads(): Promise<{ ok: boolean; leads?: SiteLead[]; message: string }> {
  const p = publishConfig();
  const ep = leadsEndpoint();
  if (!ep) return { ok: false, message: "Не настроено (Настройки → Публикация)." };
  try {
    const res = await fetch(ep, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey: p.editKey, project: "allclean" }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) return { ok: false, message: data.error ? `Ошибка: ${data.error}` : `Ошибка сервера (${res.status}).` };
    return { ok: true, leads: Array.isArray(data.leads) ? data.leads : [], message: "ok" };
  } catch {
    return { ok: false, message: "Не удалось связаться с сервером заявок." };
  }
}
