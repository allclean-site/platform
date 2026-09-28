/**
 * Self-check for the shared header/footer layer — the one module in this change whose precedence was
 * inverted (a shared patch now wins over the per-page value a past publish expansion left behind).
 * Run: node scripts/check-shared-blocks.mjs
 *
 * It runs against the REAL mirror: the same header block from two different pages, which is exactly
 * the situation that produced 18 pages with the home page's header and a broken language switch.
 */
import assert from "node:assert";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR = join(ROOT, "public", "import", "allclean");

// sharedBlocks is browser code (DOMParser); give it one.
const { parseHTML } = await (async () => {
  try { return await import("linkedom"); } catch { return {}; }
})();
if (!parseHTML) {
  // No DOM available in this environment — check the pure parts only and say so.
  const src = readFileSync(join(ROOT, "src/editor/sharedBlocks.ts"), "utf8");
  assert.ok(/export function isPatchValue/.test(src));
  console.log("shared-blocks: SKIPPED (нет DOM; для полной проверки нужен linkedom)");
  process.exit(0);
}

const tmp = mkdtempSync(join(tmpdir(), "shared-"));
const out = join(tmp, "b.mjs");
await esbuild.build({
  entryPoints: [join(ROOT, "src/editor/sharedBlocks.ts")], bundle: true, format: "esm", platform: "node",
  outfile: out, logLevel: "error",
});
const { parseHTML: ph } = await import("linkedom");
const dom = ph("<!doctype html><html><body></body></html>");
globalThis.DOMParser = dom.window.DOMParser;
globalThis.document = dom.window.document;
const { diffPatches, encodePatches, resolveShared, isPatchValue } = await import(pathToFileURL(out).href);

const page = (file) => JSON.parse(readFileSync(join(MIRROR, file + ".json"), "utf8"));
const blockOf = (p, id) => (p.blocks || []).find((b) => b.id === id)?.content.html || "";

const home = page("index"), about = page("about");
const homeHeader = blockOf(home, "sec-header"), aboutHeader = blockOf(about, "sec-header");
assert.ok(homeHeader && aboutHeader && homeHeader !== aboutHeader, "у страниц свои копии шапки");

// ---- 1. правка на одной странице переносится на другую, НЕ утаскивая ссылки первой ---------------
const edited = homeHeader.replace(">Servicii<", ">Servicii и уборка<");
const patches = diffPatches(homeHeader, edited);
assert.ok(patches && patches.length, "правка текста даёт патч");
const applied = resolveShared(aboutHeader, encodePatches(patches));
assert.ok(applied.html.includes("Servicii и уборка"), "правка доехала до другой страницы");
const langOf = (h) => [...String(h).matchAll(/href="(\/ru[^"]*)"/g)].map((m) => m[1]);
assert.deepEqual(langOf(applied.html), langOf(aboutHeader), "ссылки этой страницы (в т.ч. на другой язык) не подменены");

// ---- 2. готовый HTML в общем слое — это не патч, и его нельзя разносить по страницам -------------
assert.equal(isPatchValue(homeHeader), false, "сырой HTML не считается патчем");
assert.equal(isPatchValue(encodePatches(patches)), true);
const asHtml = resolveShared(aboutHeader, homeHeader);
assert.equal(asHtml.html, homeHeader, "resolveShared отдаёт такой HTML как есть — поэтому вызывающий обязан его отсеять");
assert.equal(asHtml.missed, 0, "и НЕ сообщает о промахе — почему проверка обязана быть снаружи");

// ---- 3. патч, которому нет места, сообщает о промахе и не выдумывает ------------------------------
const alien = resolveShared("<section><p>совсем другая вёрстка</p></section>", encodePatches(patches));
assert.ok(alien.missed > 0, "непоместившийся патч посчитан");

rmSync(tmp, { recursive: true, force: true });
console.log("shared-blocks: PASS");
