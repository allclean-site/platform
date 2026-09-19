/**
 * Image picking + upload for the editor.
 *
 * Two modes, chosen automatically:
 *  • Supabase Storage (when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set): the picked image is
 *    downscaled client-side, then uploaded via the Storage REST API and its PUBLIC URL is returned.
 *    No SDK dependency — a plain `fetch` to `/storage/v1/object/<bucket>/<path>` does it.
 *  • The SITE's own /api/upload (service_role, server-side) when no browser key is configured — the
 *    cabinet is already signed in to it, so a photo becomes a URL without anyone pasting a key.
 *  • Data-URL fallback (nothing reachable): the downscaled image is inlined as a data: URL, so the
 *    editor keeps working locally with zero configuration. ⚠️ This is a LAST resort: an inlined photo
 *    is ~200KB of base64 inside the block's HTML, and eighteen of them grew one section to 3.1MB —
 *    past the 4.5MB body limit, which is what made "Опубликовать" fail with "Failed to fetch".
 *
 * Same public shape either way: `pickImage()` opens the file dialog and resolves to a usable `src`.
 */

import { loadSettings } from "../settings/store";
import { postSiteApi, siteApiReady } from "./siteApi";

const ENV_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const ENV_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const ENV_BUCKET = (import.meta.env.VITE_SUPABASE_MEDIA_BUCKET as string | undefined) || "site-media";

interface StorageCfg { url: string; key: string; bucket: string }

/** Resolve the active Supabase Storage config: cabinet Settings first (agency can fill it without a
 *  rebuild), then build-time env. Returns null when nothing is configured → uploads fall back to data URLs. */
function storageCfg(): StorageCfg | null {
  try {
    const s = loadSettings().storage;
    if (s?.url && s?.anonKey) return { url: s.url.replace(/\/$/, ""), key: s.anonKey, bucket: s.bucket || "site-media" };
  } catch { /* settings unavailable */ }
  if (ENV_URL && ENV_ANON) return { url: ENV_URL, key: ENV_ANON, bucket: ENV_BUCKET };
  return null;
}

/** True when Supabase Storage is configured — uploads go to the bucket instead of inlining data URLs. */
export const storageConfigured = (): boolean => !!storageCfg();

const MAX_W = 1600; // downscale wide photos so uploads/data-URLs stay light

/** Downscale an image File to a Blob (keeps aspect ratio; JPEG for photos, PNG for PNGs). */
export function downscale(file: File): Promise<{ blob: Blob; ext: string; type: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_W / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("no canvas ctx"));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        const png = file.type === "image/png";
        const type = png ? "image/png" : "image/jpeg";
        c.toBlob(
          (blob) => (blob ? resolve({ blob, ext: png ? "png" : "jpg", type }) : reject(new Error("toBlob failed"))),
          type,
          0.82
        );
      };
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

/** Upload a blob/file to storage → public URL, or null when nothing is reachable. Used by the media
 *  library for both images and video. */
export async function putToStorage(tenant: string, blob: Blob, ext: string, type: string): Promise<string | null> {
  const cfg = storageCfg();
  const direct = cfg ? await uploadToSupabase(cfg, blob, ext, type, tenant) : null;
  return direct ?? uploadViaSite(blob, ext, type);
}

/**
 * The site uploads it for us. /api/upload holds the service_role key server-side and is gated by the
 * same EDIT_KEY the cabinet already signed in with, so this works with nothing configured in the
 * browser — and it is what keeps replaced photos out of the page HTML.
 */
async function uploadViaSite(blob: Blob, ext: string, type: string): Promise<string | null> {
  if (!siteApiReady()) return null;
  try {
    const dataUrl = await blobToDataUrl(blob);
    const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const r = await postSiteApi<{ url?: string }>("upload", { file: { name: `photo.${ext}`, type, dataBase64 } });
    return r.ok && r.data?.url ? r.data.url : null;
  } catch {
    return null;
  }
}

/** Upload a Blob to Supabase Storage and return its public URL, or null on failure. */
async function uploadToSupabase(cfg: StorageCfg, blob: Blob, ext: string, type: string, tenant: string): Promise<string | null> {
  const path = `${tenant}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": type,
        "x-upsert": "true",
        "cache-control": "31536000",
      },
      body: blob,
    });
    if (!res.ok) return null;
    return `${cfg.url}/storage/v1/object/public/${cfg.bucket}/${path}`;
  } catch {
    return null;
  }
}

/**
 * Open the file dialog, downscale the chosen image, and resolve to a usable `src`:
 * a Supabase public URL when configured (falls back to a data URL if the upload fails), else a data URL.
 * Resolves to null if the user cancels.
 */
export function pickImage(tenant = "tenant"): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const { blob, ext, type } = await downscale(file);
        const url = await putToStorage(tenant, blob, ext, type);
        if (url) return resolve(url);
        return resolve(await blobToDataUrl(blob));
      } catch {
        // Last-ditch: raw data URL of the original file.
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => resolve(null);
        r.readAsDataURL(file);
      }
    };
    input.click();
  });
}
