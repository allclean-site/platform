/**
 * Pick + upload an image for article content. Downscales client-side, then uploads via /api/upload
 * (server, service_role → Supabase `article-images`) and returns the public URL. Falls back to an
 * inline data URL if the endpoint isn't configured or the upload fails, so the editor keeps working.
 */

import { publishConfig } from "../settings/store";
import { downscale } from "../editor/image";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || ""); // strip the data: prefix
    r.readAsDataURL(blob);
  });
}
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(blob); });
}

/** Open the file dialog, upload the chosen image, resolve to a usable src (public URL or data URL). */
export function pickAndUploadImage(): Promise<{ url: string | null; note?: string }> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve({ url: null });
      try {
        const { blob, ext, type } = await downscale(file);
        const p = publishConfig();
        if (p.endpoint) {
          const endpoint = p.endpoint.replace(/\/publish\/?$/, "/upload");
          try {
            const dataBase64 = await blobToBase64(blob);
            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ editKey: p.editKey, file: { name: `cover.${ext}`, type, dataBase64 } }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (res.ok && data.url) return resolve({ url: data.url });
            return resolve({ url: await blobToDataUrl(blob), note: data.error ? `Загружено локально (сервер: ${data.error})` : "Загружено локально (сервер недоступен)" });
          } catch {
            return resolve({ url: await blobToDataUrl(blob), note: "Загружено локально (сервер недоступен)" });
          }
        }
        return resolve({ url: await blobToDataUrl(blob), note: "Загружено локально — настройте публикацию для хранилища" });
      } catch {
        resolve({ url: null });
      }
    };
    input.click();
  });
}
