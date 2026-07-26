/** Image picking + client-side downscale.
 *
 * Opens a file picker, downscales large images in-browser (matching the platform's
 * existing "downscale before upload" rule — see the 4.5MB publish limit note), and
 * returns a usable src. If Supabase Storage is configured this is where an upload
 * would go; for now it returns a data URL so image swaps work with zero backend. */

const MAX_W = 1600;
const QUALITY = 0.82;

export function pickImage(): Promise<{ src: string; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const src = await downscaleToDataUrl(file);
      resolve({ src, name: file.name });
    };
    input.click();
  });
}

function downscaleToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_W / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(reader.result as string);
        ctx.drawImage(img, 0, 0, w, h);
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        resolve(canvas.toDataURL(type, QUALITY));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
