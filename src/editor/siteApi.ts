/**
 * One place that knows how to reach the site's API.
 *
 * Everything the cabinet asks the live site to do — read the published edits, sync the shared draft,
 * list and restore versions, publish, pull leads, translate an article, upload a photo — is a POST to
 * a sibling of the single address the agency configures (Настройки → Публикация → …/api/publish),
 * gated by the same EDIT_KEY.
 *
 * Every client used to derive that address and repeat the fetch/JSON/error dance itself, in versions
 * that had quietly drifted apart: some anchored the match on `/api/publish`, others on `/publish`, so
 * an endpoint of an unexpected shape worked for one feature and silently failed for the next. One
 * derivation, one call, one place to fix.
 */

import { publishConfig } from "../settings/store";

/** …/api/publish → …/api/<name>. null when publishing isn't configured at all. */
export function siteApiEndpoint(name: string): string | null {
  const ep = (publishConfig().endpoint || "").trim();
  if (!ep) return null;
  const m = /^(.*\/)publish\/?$/.exec(ep);           // the usual shape: …/api/publish
  if (m) return m[1] + name;
  return ep.replace(/\/$/, "") + "/../" + name;      // anything else: resolve as a sibling
}

/** An address is set (the deploy may still reject us without a key). */
export function siteApiConfigured(): boolean {
  return Boolean((publishConfig().endpoint || "").trim());
}

/** Address AND key present — everything server-side is gated by the key, so this is "can we call?". */
export function siteApiReady(): boolean {
  const p = publishConfig();
  return Boolean(p.endpoint && p.editKey);
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;             // 0 = never reached the server
  data: T | null;
  raw: string;
  /** Server-provided message, or the start of a non-JSON body. Empty on success. */
  error: string;
  endpoint: string;
  /** The request itself failed (offline, DNS, CORS) rather than the server answering with an error. */
  offline?: boolean;
}

/**
 * Raw call — for the places that must tell the user exactly what went wrong (publish, leads,
 * translate). Never throws.
 */
export async function postSiteApi<T = unknown>(name: string, payload: Record<string, unknown>): Promise<ApiResponse<T>> {
  const endpoint = siteApiEndpoint(name);
  if (!endpoint) {
    return { ok: false, status: 0, data: null, raw: "", endpoint: "", error: "Не настроено (Настройки → Публикация)." };
  }
  const { editKey } = publishConfig();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ editKey, ...payload }),
    });
    const raw = await res.text();
    let data: T | null = null;
    try { data = raw ? (JSON.parse(raw) as T) : null; } catch { /* non-JSON body stays in raw */ }
    const err = (data as { error?: string } | null)?.error;
    return { ok: res.ok, status: res.status, data, raw, endpoint, error: res.ok ? "" : err || raw.slice(0, 300) };
  } catch (e) {
    return { ok: false, status: 0, data: null, raw: "", endpoint, offline: true, error: String((e as Error)?.message || e) };
  }
}

/**
 * Graceful call — `null` means "not configured, unreachable, or the server said no", and the caller
 * falls back to working offline. Used by everything that must never break the editor.
 */
export async function callSiteApi<T = Record<string, unknown>>(name: string, payload: Record<string, unknown>): Promise<T | null> {
  if (!siteApiReady()) return null;
  const r = await postSiteApi<{ ok?: boolean }>(name, payload);
  if (!r.ok || !r.data || r.data.ok !== true) return null;
  return r.data as T;
}

/**
 * Last-chance send when the tab is closing. A normal fetch is abandoned as the page goes away;
 * sendBeacon is queued by the browser and survives the unload.
 */
export function beaconSiteApi(name: string, payload: Record<string, unknown>): boolean {
  const endpoint = siteApiEndpoint(name);
  const { editKey } = publishConfig();
  if (!endpoint || !editKey || typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  try {
    const body = JSON.stringify({ editKey, ...payload });
    return navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
  } catch {
    return false;
  }
}
