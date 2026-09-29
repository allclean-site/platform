/**
 * Код кабинета в Node — ровно те модули, которыми холст строит страницу (без пересказа).
 * esbuild собирает TS; `?raw` отдаёт файл строкой, как это делает Vite; DOMParser даёт linkedom
 * (sharedBlocks разбирает шапку и подвал через него).
 */
import * as esbuild from "esbuild";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const raw = {
  name: "raw",
  setup(b) {
    b.onResolve({ filter: /\?raw$/ }, (a) => ({ path: resolve(a.resolveDir, a.path.replace(/\?raw$/, "")), namespace: "raw" }));
    b.onLoad({ filter: /.*/, namespace: "raw" }, (a) => ({ contents: readFileSync(a.path, "utf8"), loader: "text" }));
  },
};

export async function loadCabinet() {
  const tmp = mkdtempSync(join(tmpdir(), "cabinet-"));
  const entry = join(tmp, "entry.ts"), out = join(tmp, "b.mjs");
  const src = (f) => JSON.stringify(join(ROOT, f).replace(/\\/g, "/"));
  writeFileSync(entry, [
    `export { previewDoc } from ${src("src/editor/preview.ts")};`,
    `export { pageOverrides, canvasBlocks } from ${src("src/editor/canvasPage.ts")};`,
    `export { mergeOverrideLayers } from ${src("src/editor/realStore.ts")};`,
    `export { canonicalizeOverrides, toCanonical } from ${src("src/editor/assetPaths.ts")};`,
    `export { sharedKey } from ${src("src/editor/sharedBlocks.ts")};`,
    `export { EDIT_RUNTIME } from ${src("src/editor/editRuntime.ts")};`,
    `export { MEDIA_KEY, decodeMedia } from ${src("src/editor/renderCore.js")};`,
  ].join("\n"));
  await esbuild.build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile: out, plugins: [raw], logLevel: "error" });
  const { parseHTML } = await import("linkedom");
  const dom = parseHTML("<!doctype html><html><body></body></html>");
  globalThis.DOMParser ??= dom.window.DOMParser;
  globalThis.document ??= dom.window.document;
  const mod = await import(pathToFileURL(out).href);
  rmSync(tmp, { recursive: true, force: true });
  return mod;
}
