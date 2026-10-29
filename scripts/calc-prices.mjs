// Цены калькуляторов — по прайсу клиента от 29.10.2026 (константы калькулятора).
//
// Калькуляторы живут в 36 страницах: в зеркале (public/import) и в правках клиента в базе (RU-главная,
// RU-цены). Цены там разъехались: после ремонта 50/65 вместо 65/100 лей/м², этажи 1–5/6–10/10–17
// вместо пяти ступеней, душевая кабина 350 вместо 750. Править каждую копию — значит снова разъехаться
// при следующей правке, поэтому цены ставит слой сборки (site-privacy.mjs, как остальные починки):
// и сайт, и холст кабинета видят одно и то же.
//
// Калькулятор узнаём по полям, а не по id: на страницах услуг он «calc», в переключателе — «cp-…».
// Настройки (JSON) переписываются целиком по прайсу, кнопки этажей — из настроек, новые плитки
// (занавески, кондиционер) добавляются один раз. Повторный проход ничего не меняет.
import { closeOf } from "./seo-fixes.mjs";

const L = (ru, ro) => ({ ru, ro });
const opt = (value, add, ru, ro) => ({ add, label: L(ru, ro), value });
const NONE = (add = 0) => opt("none", add, "Не нужно", "Nu este nevoie");

// Этаж: надбавка за весь заказ.
const FLOORS = [["1-2", 0], ["3-5", 300], ["6-8", 500], ["9-12", 800], ["13-17", 1000]]
  .map(([v, add]) => ({ add, label: L(v.replace("-", "–"), v.replace("-", "–")), value: v }));

// Квартиры и дома (поддерживающая, генеральная, после ремонта): поле → варианты.
const HOME = {
  furn: [{ rate: 65, label: L("Без мебели", "Fără mobilă"), value: "no" }, { rate: 100, label: L("С мебелью", "Cu mobilă"), value: "yes" }],
  surfaces: [NONE(), opt("avail", 500, "Доступные поверхности", "Suprafețe accesibile"), opt("all", 1000, "Все поверхности", "Toate suprafețele"),
    opt("all_furn", 1800, "Все + мебель внутри", "Toate + interiorul mobilei")],
  kitchen: [NONE(), opt("light", 500, "Лёгкая уборка", "Curățenie ușoară"), opt("light_tech", 1000, "Лёгкая + кухонная техника", "Ușoară + electrocasnice"),
    opt("deep", 1000, "Глубокая уборка", "Curățenie profundă"), opt("deep_tech", 1800, "Глубокая + кухонная техника", "Profundă + electrocasnice")],
  dishes: [NONE(), opt("some", 150, "Немного", "Puțin"), opt("lots", 400, "Много", "Mult")],
  dishes_m: [NONE(), opt("some", 150, "Немного", "Puțin"), opt("lots", 400, "Много", "Mult")],
  bath: [NONE(), opt("basic", 250, "Ванна", "Cadă"), opt("shower", 750, "Душевая кабина", "Cabină de duș")],
  ironing: [NONE(), opt("some", 250, "Немного", "Puțin"), opt("lots", 450, "Много", "Mult")],
};
// Поверхности стоят столько же и после ремонта (отдельный калькулятор ремонта их уже показывает).
const SHOW = { surfaces: ["general", "reno"] };
// Новые допуслуги из прайса: плитка + поле.
const EXTRA = [
  { key: "curtains", ico: "🪟", label: L("Занавески", "Perdele"), showIf: { in: ["maint", "general"], field: "type" },
    options: [NONE(), opt("steam", 350, "Отпарить", "Călcare cu abur"), opt("wash", 750, "Снять, постирать и повесить", "Scoatem, spălăm și le punem la loc")] },
  { key: "ac", ico: "❄️", label: L("Кондиционер", "Aer condiționat"), showIf: { in: ["maint", "general"], field: "type" },
    options: [NONE(), opt("1", 350, "1 кондиционер", "1 aparat"), opt("2", 700, "2 кондиционера", "2 aparate"), opt("3", 1050, "3 кондиционера", "3 aparate")] },
];

let fixed = 0;
export const calcPricesReport = () => fixed;

function fixCfg(cfg) {
  const has = (k) => cfg.fields.some((f) => f.key === k);
  for (const f of cfg.fields) if (f.key === "floor") f.options = FLOORS;
  if (!(has("furn") && has("type"))) return cfg;
  for (const f of cfg.fields) {
    if (HOME[f.key]) f.options = HOME[f.key];
    if (SHOW[f.key] && f.showIf) f.showIf = { ...f.showIf, in: SHOW[f.key] };
  }
  const at = cfg.fields.findIndex((f) => f.key === "ironing") + 1 || cfg.fields.length;
  const add = EXTRA.filter((e) => !has(e.key)).map(({ key, label, showIf, options }) => ({ key, type: "select", label, showIf, options }));
  cfg.fields.splice(at, 0, ...add);
  return cfg;
}

function fixMarkup(html, start, end, cfg, lang) {
  let part = html.slice(start, end);
  const cid = (part.match(/ data-astro-cid-[a-z0-9]+=""/) || [""])[0];
  // Кнопки этажей — из настроек.
  const fl = part.search(/<div class="calc-field" data-key="floor"/);
  const floor = cfg.fields.find((f) => f.key === "floor");
  if (fl >= 0 && floor) {
    const opts = part.indexOf('<div class="calc-opts"', fl);
    const close = opts >= 0 && closeOf(part, opts, "div");
    if (close) {
      const open = part.slice(opts, part.indexOf(">", opts) + 1);
      const btns = floor.options.map((o, i) => `<button type="button" class="calc-opt${i ? "" : " on"}" data-val="${o.value}"${cid}> <span${cid}>${o.label[lang]}</span> </button>`).join("");
      part = part.slice(0, opts) + open + " " + btns + " </div>" + part.slice(close[1]);
    }
  }
  // Плитки новых допуслуг — после «Глажки».
  const iron = part.match(/<button type="button" class="calc-tile" data-key="ironing"[\s\S]*?<\/button>/);
  if (iron) {
    const tap = (iron[0].match(/data-tap="[^"]*"/) || ['data-tap=""'])[0];
    const tiles = EXTRA.filter((e) => cfg.fields.some((f) => f.key === e.key) && !part.includes(`data-key="${e.key}"`))
      .map((e) => `<button type="button" class="calc-tile" data-key="${e.key}"${cid}> <span class="calc-tile-ico"${cid}>${e.ico}</span> ` +
        `<span class="calc-tile-name"${cid}>${e.label[lang]}</span> <span class="calc-tile-sel" ${tap}${cid}></span> ` +
        `<span class="calc-tile-check" aria-hidden=""${cid}>✓</span> </button>`).join("");
    if (tiles) part = part.replace(iron[0], iron[0] + tiles);
  }
  return html.slice(0, start) + part + html.slice(end);
}

// Проверка собранного сайта: node scripts/calc-prices.mjs (после build-site.mjs). Каждый калькулятор
// с этажами — пять ступеней прайса и в настройках, и в кнопках; у квартирного — новые плитки.
if (process.argv[1] && process.argv[1].endsWith("calc-prices.mjs")) {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
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
}

/** Все калькуляторы страницы — по прайсу. `lang` — 'ru' или 'ro'. */
export function applyCalcPrices(html, lang) {
  const found = [...html.matchAll(/<script type="application\/json" id="([a-z0-9-]+)-cfg">([\s\S]*?)<\/script>/g)];
  // С конца: правка калькулятора не сдвигает позиции тех, что выше.
  for (const m of found.reverse()) {
    let cfg;
    try { cfg = JSON.parse(m[2]); } catch { continue; }
    if (!Array.isArray(cfg.fields) || !cfg.fields.some((f) => f.key === "floor" || f.key === "furn")) continue;
    const before = JSON.stringify(cfg), json = JSON.stringify(fixCfg(cfg));
    if (json !== before) {
      fixed++;
      html = html.slice(0, m.index) + `<script type="application/json" id="${m[1]}-cfg">${json}</script>` + html.slice(m.index + m[0].length);
    }
    // Разметка калькулятора — между его корнем и настройками.
    const root = html.lastIndexOf(`id="${m[1]}"`, m.index);
    if (root >= 0) html = fixMarkup(html, root, m.index, cfg, lang);
  }
  return html;
}
