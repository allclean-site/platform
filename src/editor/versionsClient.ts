/**
 * Published version history — list earlier publishes and put one back.
 *
 * Publishing replaces the live site, so it is the only action here a client cannot take back by
 * pressing Ctrl+Z. Every publish records a snapshot; this is how the cabinet reads them and restores
 * one. Graceful like the rest of the publish family: no endpoint or key configured → null, and the
 * UI simply doesn't offer history.
 */

import { callSiteApi } from "./siteApi";

export interface SiteVersion {
  id: string;
  createdAt: string;
  createdBy: string;
  note: string;
  pages: number;
}

export async function listVersions(project = "allclean"): Promise<SiteVersion[] | null> {
  const d = await callSiteApi<{ versions?: SiteVersion[] }>("versions", { project, action: "list" });
  return d ? (d.versions ?? []) : null;
}

/** Put an earlier published version back and trigger a rebuild. */
export async function restoreVersion(id: string, project = "allclean"): Promise<{ ok: boolean; pages: number }> {
  const d = await callSiteApi<{ pages?: number }>("versions", { project, action: "restore", id });
  return d ? { ok: true, pages: d.pages ?? 0 } : { ok: false, pages: 0 };
}
