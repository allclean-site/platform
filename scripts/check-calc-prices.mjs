// Отдельным файлом: calc-prices.mjs собирается и в кабинет (холст), там нет node:fs и await верхнего уровня.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FLOORS } from "./calc-prices.mjs";

// Проверка собранного сайта: node scripts/check-calc-prices.mjs (после build-site.mjs). Каждый калькулятор
// с этажами — пять ступеней прайса и в настройках, и в кнопках; у квартирного — новые плитки.
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory()
  ? (e.name.startsWith("__") ? [] : walk(join(d, e.name))) : e.name.endsWith(".html") ? [join(d, e.name)] : []);
const want = FLOORS.map((o) => o.value).join("/");
let n = 0, bad = [];
for (const f of walk("out")) {
  const h = readFileSync(f, "utf8");
  for (const m of h.matchAll(/<script type="application\/json" id="([a-z0-9-]+)-cfg">([\s\S]*?)<\/script>/g)) {
    const cfg = JSON.parse(m[2]), floor = cfg.fields.find((x) => x.key === "floor");
    if (!floor && !cfg.fields.some((x) => x.key === "furn")) continue;
    n++;
    const part = h.slice(h.lastIndexOf(`id="${m[1]}"`, m.index), m.index);
    const btns = (part.match(/data-key="floor"[\s\S]*?class="calc-opts"[\s\S]*?<\/div>/g) || []).join("").match(/data-val="[^"]+"/g)?.map((x) => x.slice(10, -1)).join("/");
    if (floor && (floor.options.map((o) => o.value).join("/") !== want || btns !== want)) bad.push(`${f} ${m[1]}: этажи ${btns}`);
    const furn = cfg.fields.find((x) => x.key === "furn");
    if (furn && (furn.options.map((o) => o.rate).join("/") !== "65/100" || !part.includes('data-key="curtains"') || !part.includes('data-key="ac"'))) bad.push(`${f} ${m[1]}: квартиры`);
  }
}
if (bad.length) { console.error("[calc-prices] не по прайсу:\n  " + bad.join("\n  ")); process.exit(1); }
console.log(`[calc-prices] по прайсу: ${n} калькуляторов`);
