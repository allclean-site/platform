/**
 * Обработчики, работающие service_role-ключом, обязаны отказывать при НЕзаданном EDIT_KEY.
 *
 * Проверка стояла под условием «если ключ настроен»: пропадала переменная — и /api/leads начинал
 * отдавать имена и телефоны всех заявок кому угодно. Сайт передаётся клиенту вместе с панелью
 * Vercel, то есть ровно в ту ситуацию, где переменную легко потерять при переносе.
 *
 *   node scripts/check-api-auth.mjs
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API = join(dirname(fileURLToPath(import.meta.url)), "..", "api");
const беды = [];

for (const f of readdirSync(API)) {
  if (!f.endsWith(".js")) continue;
  const s = readFileSync(join(API, f), "utf8");
  if (!/\bEDIT_KEY\b/.test(s)) continue;
  if (f === "login.js") continue;                       // он сам выдаёт ключ, а не проверяет его

  const отказ = s.indexOf("if (!EDIT_KEY) return");
  const сравнение = s.search(/String\(body\.editKey[^\n]*!==\s*EDIT_KEY/);
  if (сравнение < 0) { беды.push(`${f}: нет сравнения с EDIT_KEY`); continue; }
  if (отказ < 0) { беды.push(`${f}: нет отказа при незаданном EDIT_KEY`); continue; }
  if (отказ > сравнение) беды.push(`${f}: отказ при незаданном ключе стоит ПОСЛЕ сравнения`);
  if (/if \(EDIT_KEY &&/.test(s)) беды.push(`${f}: осталась проверка «если ключ настроен»`);
}

if (беды.length) { беды.forEach((b) => console.error("  ⚠ " + b)); process.exitCode = 1; }
else console.log("[check-api-auth] ок: все обработчики отказывают без EDIT_KEY");
