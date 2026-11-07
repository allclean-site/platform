/**
 * Проверка статей перед публикацией: node scripts/check-new-articles.mjs <файл.json> [...]
 * Те же правила, что у черновиков конвейера (checkArticle): цифры только из паспорта фактов, первый
 * абзац 40–60 слов, таблица, шаги, раздел «Сколько это стоит у нас» со ссылкой на свою услугу, ссылки
 * только на существующие страницы — в том числе на уже вышедшие статьи (берутся из content/articles).
 * Ненулевой код — есть ошибки.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkArticle, articlePath } from "../src/engine/blog/article-pipeline.js";

const ROOT = process.cwd();
const facts = JSON.parse(readFileSync(join(ROOT, "data", "allclean-facts.json"), "utf8"));
const dir = join(ROOT, "content", "articles");
const all = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));
const known = new Set([...Object.keys(facts.pages.ru), ...Object.keys(facts.pages.ro),
  "/ru/blog/generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya", "/blog/curatenia-generala-si-cea-de-mentinere-care-sunt-diferentele",
  ...all.map((a) => articlePath(a.locale, a.slug))]);

let bad = 0;
for (const f of process.argv.slice(2)) {
  const a = JSON.parse(readFileSync(f, "utf8"));
  const r = checkArticle(a, { facts, servicePath: a.meta && a.meta.service_page, knownPaths: known, existing: all.filter((x) => !f.endsWith(x.file)) });
  if (r.errors.length) bad++;
  console.log(`${r.errors.length ? "ОШИБКИ" : "ок"} ${f.split(/[\\/]/).pop()}` +
    (r.errors.length ? "\n  - " + r.errors.join("\n  - ") : "") + (r.warnings.length ? "\n  · " + r.warnings.join("\n  · ") : ""));
}
process.exit(bad ? 1 : 0);
