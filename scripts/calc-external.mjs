// Скрипт калькулятора — одним кешируемым файлом вместо копии в каждом калькуляторе.
//
// Замер 27.10.2026: на / и /ru десять одинаковых встроенных копий по 16 КБ (164 КБ разбора на
// каждой загрузке), различаются только константы в начале: язык, услуга, тексты, число шагов.
// Последний проход по out/, после всех правок (site-privacy уже наложил свои замены на встроенный
// код): тело каждой копии становится функцией в /js/calc/<хеш>.js, на месте копии остаётся
// JSON с её константами. Имя файла от содержимого — кеш на год (vercel.json).
// Копия, чьё начало не совпало с ожидаемым, остаётся встроенной как есть: работать будет и так.
// Холст кабинета этот проход не видит и держит встроенные копии — правка блока их и сохраняет.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const OUT = "out";
const HEAD = /^\(function\(\)\{const SUPABASE_URL = ("[^"]*");\nconst SUPABASE_KEY = ("[^"]*");\nconst PROJECT_ID = ("[^"]*");\nconst locale = ("[^"]*");\nconst slug = ("[^"]*");\nconst t = (\{[^\n]*\});\nconst totalSteps = (\d+);\nconst detailsStep = (\d+);\nconst uid = ("[^"]*");\n([\s\S]*)\}\)\(\);\s*$/;
const ALT = /" alt="([^"'\\]*)" style="width:100%;height:100%;object-fit:cover/g;

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(f)));
    else if (e.name.endsWith(".html")) out.push(f);
  }
  return out;
}

export async function externalizeCalc() {
  const bodies = [];          // нормализованные тела, индекс = номер функции в файле
  const pages = new Map();
  for (const f of await walk(OUT)) {
    const html = await readFile(f, "utf8");
    if (html.indexOf("const SUPABASE_URL = ") < 0) continue;
    let n = 0;
    const next = html.replace(/<script>(\(function\(\)\{const SUPABASE_URL = [\s\S]*?)<\/script>/g, (whole, code) => {
      const m = code.match(HEAD);
      if (!m) return whole;
      let alt = "";
      const body = m[10].replace(ALT, (x, a) => { alt = a; return `" alt="' + PHOTO_ALT + '" style="width:100%;height:100%;object-fit:cover`; });
      let v = bodies.indexOf(body);
      if (v < 0) v = bodies.push(body) - 1;
      const P = { v, u: JSON.parse(m[1]), k: JSON.parse(m[2]), p: JSON.parse(m[3]), l: JSON.parse(m[4]), s: JSON.parse(m[5]),
        t: JSON.parse(m[6]), n: +m[7], d: +m[8], id: JSON.parse(m[9]), a: alt };
      n++;
      return `<script type="application/json" data-lg-calc>${JSON.stringify(P).replace(/</g, "\\u003c")}</script>`;
    });
    if (n) pages.set(f, next);
  }
  if (!bodies.length) return "встроенных калькуляторов нет";

  const fns = bodies.map((b) => "function(P){const SUPABASE_URL=P.u,SUPABASE_KEY=P.k,PROJECT_ID=P.p,locale=P.l,slug=P.s,t=P.t," +
    "totalSteps=P.n,detailsStep=P.d,uid=P.id,PHOTO_ALT=P.a;\n" + b + "\n}");
  const js = "(function(){var T=[" + fns.join(",\n") + "];\n" +
    "function run(){var s=document.querySelectorAll('script[data-lg-calc]');for(var i=0;i<s.length;i++){if(s[i].lgDone)continue;s[i].lgDone=1;" +
    "try{var P=JSON.parse(s[i].textContent);T[P.v](P);}catch(e){console.error('calc',e);}}}\n" +
    "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();\n";
  const name = `/js/calc/${createHash("sha1").update(js).digest("hex").slice(0, 10)}.js`;
  await mkdir(join(OUT, "js", "calc"), { recursive: true });
  await writeFile(join(OUT, name), js);
  const tag = `<script src="${name}" defer></script>`;
  let count = 0;
  for (const [f, html] of pages) {
    count += (html.match(/data-lg-calc>/g) || []).length;
    await writeFile(f, html.includes("</body>") ? html.replace(/<\/body>(?![\s\S]*<\/body>)/, tag + "</body>") : html + tag);
  }
  return `${count} калькуляторов на ${pages.size} стр. → ${name} (${Math.round(js.length / 1024)} КБ, вариантов ${bodies.length})`;
}
