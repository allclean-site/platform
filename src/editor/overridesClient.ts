/**
 * Pull the PUBLISHED edits from the site (Supabase, via /api/overrides) so the editor shows the shared
 * state — the agency sees the client's published edits, and the editor matches the live site. Endpoint +
 * key come from publishConfig (Настройки → Публикация / build env). Graceful: returns null when not
 * configured or on any error, so the editor falls back to localStorage-only (previous behaviour).
 */

import { publishConfig } from "../settings/store";
import type { SiteOverrides } from "./realStore";
import type { SiteBp } from "./bpStore";

export async function fetchPublishedOverrides(project = "allclean"): Promise<{ overrides: SiteOverrides; breakpoints: SiteBp } | null> {
  const p = publishConfig();
  if (!p.endpoint || !p.editKey) return null;
  const endpoint = /\/api\/publish\/?$/.test(p.endpoint)
    ? p.endpoint.replace(/\/api\/publish\/?$/, "/api/overrides")
    : p.endpoint.replace(/\/$/, "") + "/../overrides";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey: p.editKey, project }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || !data.ok) return null;
    return { overrides: data.overrides || {}, breakpoints: data.breakpoints || {} };
  } catch {
    return null;
  }
}
