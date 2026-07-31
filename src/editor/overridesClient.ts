/**
 * Pull the PUBLISHED edits from the site (Supabase, via /api/overrides) so the editor shows the shared
 * state — the agency sees the client's published edits, and the editor matches the live site. Endpoint +
 * key come from publishConfig (Настройки → Публикация / build env). Graceful: returns null when not
 * configured or on any error, so the editor falls back to localStorage-only (previous behaviour).
 */

import { callSiteApi } from "./siteApi";
import type { SiteOverrides } from "./realStore";
import type { SiteBp } from "./bpStore";

export async function fetchPublishedOverrides(project = "allclean"): Promise<{ overrides: SiteOverrides; breakpoints: SiteBp } | null> {
  const d = await callSiteApi<{ overrides?: SiteOverrides; breakpoints?: SiteBp }>("overrides", { project });
  if (!d) return null;
  return { overrides: d.overrides || {}, breakpoints: d.breakpoints || {} };
}
