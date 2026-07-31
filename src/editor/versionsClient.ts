/**
 * Published version history — list earlier publishes and put one back.
 *
 * Publishing replaces the live site, so it is the only action here a client cannot take back by
 * pressing Ctrl+Z. Every publish records a snapshot; this is how the cabinet reads them and restores
 * one. Graceful like the rest of the publish family: no endpoint or key configured → null, and the
 * UI simply doesn't offer history.
 */

import { publishConfig } from "../settings/store";

export interface SiteVersion {
  id: string;
  createdAt: string;
  createdBy: string;
  note: string;
  pages: number;
}

function endpointFor(publishEndpoint: string): string {
  return /\/api\/publish\/?$/.test(publishEndpoint)
    ? publishEndpoint.replace(/\/api\/publish\/?$/, "/api/versions")
    : publishEndpoint.replace(/\/$/, "") + "/../versions";
}

async function call(payload: Record<string, unknown>): Promise<any | null> {
  const p = publishConfig();
  if (!p.endpoint || !p.editKey) return null;
  try {
    const res = await fetch(endpointFor(p.endpoint), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey: p.editKey, ...payload }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

export async function listVersions(project = "allclean"): Promise<SiteVersion[] | null> {
  const d = await call({ project, action: "list" });
  return d ? ((d.versions as SiteVersion[]) ?? []) : null;
}

/** Put an earlier published version back and trigger a rebuild. */
export async function restoreVersion(id: string, project = "allclean"): Promise<{ ok: boolean; pages: number }> {
  const d = await call({ project, action: "restore", id });
  return d ? { ok: true, pages: d.pages ?? 0 } : { ok: false, pages: 0 };
}
