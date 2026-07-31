/**
 * Shared DRAFT client — the live-editing layer.
 *
 * Before this, edits lived only in the authoring browser's localStorage until someone published, so
 * the agency and the client saw different states. Now every edit is mirrored to `site_drafts` via
 * /api/draft (debounced) and read back on open / on window focus, so both cabinets show the same
 * work-in-progress.
 *
 * Graceful by design: with no endpoint/key configured every call is a no-op returning null, and the
 * editor falls back to localStorage-only (exactly the previous behaviour) — an offline client keeps
 * editing, their local cache is pushed as soon as the connection works again.
 */

import { publishConfig } from "../settings/store";
import type { SiteOverrides, PageOverrides } from "./realStore";
import type { SiteBp, PageBp } from "./bpStore";

export interface DraftMeta { updatedAt: string; updatedBy: string }
export interface DraftState {
  overrides: SiteOverrides;
  breakpoints: SiteBp;
  meta: Record<string, DraftMeta>;
}

/** The draft endpoint sits next to /api/publish (same deployment, same EDIT_KEY gate). */
function endpointFor(publishEndpoint: string): string {
  return /\/api\/publish\/?$/.test(publishEndpoint)
    ? publishEndpoint.replace(/\/api\/publish\/?$/, "/api/draft")
    : publishEndpoint.replace(/\/$/, "") + "/../draft";
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
    const data = await res.json().catch(() => null);
    if (res.status === 409 && data) return { ...data, conflict: true };   // someone else changed it
    if (!res.ok) return null;
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

/** True when a shared draft is reachable (endpoint + key configured). */
export function draftConfigured(): boolean {
  const p = publishConfig();
  return Boolean(p.endpoint && p.editKey);
}

/** Read the whole project's shared draft. null = not configured / unreachable. */
export async function fetchDraft(project = "allclean"): Promise<DraftState | null> {
  const d = await call({ project, action: "read" });
  if (!d) return null;
  return { overrides: d.overrides || {}, breakpoints: d.breakpoints || {}, meta: d.meta || {} };
}

/** Push one page's current state to the shared draft. Returns the server timestamp, or null. */
export interface DraftSaveResult {
  /** Server timestamp of the saved row. */
  updatedAt?: string;
  /** Someone else changed this page since `expectedAt` — nothing was written. */
  conflict?: boolean;
  conflictBy?: string;
}

/**
 * @param expectedAt the `updated_at` this browser last saw for the page. When it no longer matches,
 * the server refuses rather than overwriting the other session's work.
 */
export async function saveDraftPage(
  project: string,
  pageId: string,
  overrides: PageOverrides,
  breakpoints: PageBp | undefined,
  by: string,
  expectedAt?: string
): Promise<DraftSaveResult | null> {
  const d = await call({ project, action: "save", pageId, overrides, breakpoints: breakpoints || {}, by, expectedAt });
  if (!d) return null;
  if (d.conflict) return { conflict: true, conflictBy: d.updatedBy || "", updatedAt: d.updatedAt };
  return { updatedAt: d.updatedAt as string };
}

/**
 * Last-chance send when the tab is closing. A normal fetch is abandoned as the page goes away, so a
 * client who types and immediately closes the tab loses whatever the debounce had not yet pushed;
 * sendBeacon is queued by the browser and survives the unload.
 */
export function beaconDraftPage(
  project: string,
  pageId: string,
  overrides: PageOverrides,
  breakpoints: PageBp | undefined,
  by: string
): boolean {
  const p = publishConfig();
  if (!p.endpoint || !p.editKey || typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  const body = JSON.stringify({
    editKey: p.editKey, project, action: "save", pageId, overrides, breakpoints: breakpoints || {}, by,
  });
  try {
    return navigator.sendBeacon(endpointFor(p.endpoint), new Blob([body], { type: "application/json" }));
  } catch {
    return false;
  }
}

/** Drop the shared draft (whole project, or one page) — used after a successful publish. */
export async function clearDraft(project: string, pageId?: string): Promise<boolean> {
  return Boolean(await call({ project, action: "clear", ...(pageId ? { pageId } : {}) }));
}
