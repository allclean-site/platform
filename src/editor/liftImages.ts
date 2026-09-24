/**
 * A photo belongs in storage, never inside the page.
 *
 * The editor can end up with an image inlined as a `data:` URL — when storage was unreachable at the
 * moment it was picked, when it arrives by drag-and-drop or paste, or when it is simply still sitting
 * in this browser's own saved edits from an earlier session. Each one is ~200KB of base64 INSIDE the
 * block's HTML, and that HTML travels with every draft sync and every publish: eighteen of them grew
 * one section to 3.1MB and pushed the publish request past the server's limit, which the client saw
 * as "Не удалось связаться с сервером публикации".
 *
 * So every inlined image is lifted out on its way to the shared draft: uploaded once, replaced by its
 * URL. Cleaning it at the SAVE boundary (rather than where the data URL is created) is what makes it
 * stick — it catches the ones already saved in a browser weeks ago, which is exactly how they came
 * back after the first clean-up.
 *
 * Failure is never fatal: an image that cannot be uploaded stays inlined and the edit is saved as it
 * was. A heavy draft is a problem; a lost edit is a worse one.
 */

import { putToStorage } from "./image";
import type { StoredPageOverrides } from "./realStore";

const DATA_URI = /data:image\/([a-z+]+);base64,([A-Za-z0-9+/=]+)/g;

/** Same image, same URL: an edit re-saved ten times must not upload its photos ten times. */
const lifted = new Map<string, string>();

function toBlob(mime: string, b64: string): Blob | null {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/** One block's HTML with every inlined image replaced by a storage URL. */
export async function liftDataUris(html: string, tenant: string): Promise<string> {
  if (!html || html.indexOf("data:image") < 0) return html;
  let out = html;
  for (const [whole, ext, b64] of [...html.matchAll(DATA_URI)]) {
    let url = lifted.get(whole);
    if (!url) {
      const blob = toBlob(`image/${ext}`, b64);
      if (!blob) continue;
      const got = await putToStorage(tenant, blob, ext === "jpeg" ? "jpg" : ext, `image/${ext}`);
      if (!got) continue;            // offline / storage down → the edit keeps its inlined copy
      lifted.set(whole, (url = got));
    }
    out = out.split(whole).join(url);
  }
  return out;
}

/** A page's overrides, cleaned (tombstones kept as they are). null = nothing was inlined. */
export async function liftOverrides(ov: StoredPageOverrides, tenant: string): Promise<StoredPageOverrides | null> {
  let changed = false;
  const out: StoredPageOverrides = { ...ov };
  for (const [blockId, html] of Object.entries(ov)) {
    if (typeof html !== "string" || html.indexOf("data:image") < 0) continue;
    const next = await liftDataUris(html, tenant);
    if (next !== html) { out[blockId] = next; changed = true; }
  }
  return changed ? out : null;
}
