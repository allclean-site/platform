/**
 * Self-check for liftImages.ts — the thing that keeps base64 photos out of saved edits.
 * The uploader is stubbed (esbuild alias), so this runs offline: node scripts/check-lift-images.mjs
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert";
import * as esbuild from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "lift-"));
let uploads = 0, failNext = false;
globalThis.__stub = {
  putToStorage: async () => (failNext ? null : `https://storage/photo-${++uploads}.jpg`),
};
writeFileSync(join(tmp, "image.ts"), "export const putToStorage = (...a) => globalThis.__stub.putToStorage(...a);");
const out = join(tmp, "b.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "src/editor/liftImages.ts")], bundle: true, format: "esm", platform: "node",
  outfile: out, logLevel: "error",
  // the real uploader talks to the network; swap it for the stub above
  plugins: [{ name: "stub-image", setup: (b) => b.onResolve({ filter: /^\.\/image$/ }, () => ({ path: join(tmp, "image.ts") })) }],
});
const { liftDataUris, liftOverrides } = await import(pathToFileURL(out).href);

const b64 = Buffer.from("fake-jpeg-bytes").toString("base64");
const uri = `data:image/jpeg;base64,${b64}`;

// the same photo used twice is uploaded once, and both places get the URL
const html = await liftDataUris(`<img src="${uri}"><div style="background:url(${uri})">x</div>`, "allclean");
assert.equal(uploads, 1, "same image uploaded twice");
assert.ok(!html.includes("data:image"), "data URI left in html");
assert.equal(html.match(/https:\/\/storage\/photo-1\.jpg/g).length, 2);

// html without images is returned untouched, and nothing is uploaded
const plain = "<p>без картинок</p>";
assert.equal(await liftDataUris(plain, "allclean"), plain);

// a failed upload keeps the edit exactly as it was — never lose the client's work
failNext = true;
const other = `data:image/png;base64,${Buffer.from("other").toString("base64")}`;
assert.equal(await liftDataUris(`<img src="${other}">`, "allclean"), `<img src="${other}">`);
failNext = false;

// page level: only blocks that changed come back, tombstones survive
const ov = { "sec-1": `<img src="${uri}">`, "sec-2": "<p>clean</p>", "sec-3": null };
const lifted = await liftOverrides(ov, "allclean");
assert.ok(lifted && !lifted["sec-1"].includes("data:image"));
assert.equal(lifted["sec-2"], "<p>clean</p>");
assert.equal(lifted["sec-3"], null);
assert.equal(await liftOverrides({ a: "<p>clean</p>", b: null }, "allclean"), null, "no-op must report no change");

rmSync(tmp, { recursive: true, force: true });
console.log("lift-images: PASS");
