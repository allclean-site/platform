/**
 * Скрипт холста живёт в шаблонной строке (EDIT_RUNTIME в src/editor/editRuntime.ts). Одиночная
 * обратная косая черта там съедается: `\/` становится `/`, `\s` — буквой `s`. 28.09 так
 * `/^(\/|https?:)/` превратилось в `/^(//|https?:)/`, скрипт перестал разбираться целиком, и холст
 * два дня показывал зеркало вместо сайта: опубликованные правки доставляет именно он, и без него
 * в холсте нет ни одного редактируемого узла. Ни одна проверка этого не видела.
 *
 *   node scripts/check-edit-runtime.mjs   → exit 1, если скрипт не разбирается или есть одиночный «\»
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCabinet } from "./cabinet-bundle.mjs";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "editor", "editRuntime.ts");
const BS = "\\";
const lines = readFileSync(FILE, "utf8").split(/\r?\n/);
const from = lines.findIndex((l) => l.startsWith("export const EDIT_RUNTIME = `"));
const to = lines.findIndex((l, i) => i > from && l.startsWith("`;"));
const bad = [];
for (let n = from + 1; n < to; n++) {
  const l = lines[n].split(BS + BS).join("");
  for (let i = 0; i < l.length; i++) {
    if (l[i] === BS && l[i + 1] !== "`" && l[i + 1] !== "$") bad.push(`${n + 1}: ${BS}${l[i + 1]}  ${lines[n].trim().slice(0, 90)}`);
  }
}

const { EDIT_RUNTIME } = await loadCabinet();
let parseErr = "";
try { new Function(EDIT_RUNTIME); } catch (e) { parseErr = String(e); }   // компилирует, не выполняя

if (bad.length) console.log("одиночный «\\» в шаблонной строке (удвойте):\n  " + bad.join("\n  "));
if (parseErr) console.log("скрипт холста не разбирается: " + parseErr);
if (bad.length || parseErr) process.exit(1);
console.log("edit-runtime: PASS (" + EDIT_RUNTIME.length + " символов)");
