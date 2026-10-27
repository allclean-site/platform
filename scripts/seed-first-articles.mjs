/**
 * Первые статьи блога (content/articles/*.json) → таблица articles со статусом review и датой выхода.
 *
 *   node --env-file=.env.local scripts/seed-first-articles.mjs [--dry]
 *
 * Запускать после scripts/supabase-articles-pipeline.sql и scripts/seed-content-queue.mjs.
 * Каждая статья сначала проходит ту же проверку, что черновики конвейера (checkArticle). Строки,
 * которые уже есть в базе (та же группа и язык), не трогаются: повторный запуск не вернёт
 * опубликованную статью на проверку. На сайт статьи выходят только после «Одобрить» в кабинете.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_ID, checkArticle, supabase, articlePath } from "../src/engine/blog/article-pipeline.js";

const ROOT = process.cwd();
const dry = process.argv.includes("--dry");
const facts = JSON.parse(readFileSync(join(ROOT, "data", "allclean-facts.json"), "utf8"));
const dir = join(ROOT, "content", "articles");
const arts = readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));

// Ссылки статей — на страницы сайта и уже опубликованные статьи блога (две статьи на 27.10.2026).
const known = new Set([...Object.keys(facts.pages.ru), ...Object.keys(facts.pages.ro),
  "/ru/blog/generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya", "/blog/curatenia-generala-si-cea-de-mentinere-care-sunt-diferentele"]);
let bad = 0;
for (const a of arts) {
  const r = checkArticle(a, { facts, servicePath: a.meta.service_page, knownPaths: known, existing: arts });
  if (r.errors.length) { bad++; console.error(`[seed-articles] ${a.file}: ${r.errors.join("; ")}`); }
}
if (bad) process.exit(1);

const rows = arts.map(({ file, ...a }) => ({
  project_id: PROJECT_ID, group_id: a.group_id, locale: a.locale, slug: a.slug, title: a.title, excerpt: a.excerpt,
  body: a.body, cover_url: a.cover_url, seo_title: a.seo_title, seo_description: a.seo_description,
  meta: { ...a.meta, checks: { errors: [], warnings: [], at: new Date().toISOString() } },
  status: "review", publish_at: a.publish_at, review_note: null, auto_translated: false, source_locale: a.locale,
  updated_at: new Date().toISOString(),
}));

if (dry) {
  for (const r of rows) console.log(r.publish_at.slice(0, 10), r.locale, articlePath(r.locale, r.slug), "|", r.title);
  console.log(`[seed-articles] ${rows.length} статей прошли проверку (сухой прогон, в базу ничего не ушло)`);
  process.exit(0);
}

const URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("[seed-articles] нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const db = supabase(URL, KEY);

const groups = [...new Set(rows.map((r) => r.group_id))];
const existing = await db(`articles?project_id=eq.${PROJECT_ID}&group_id=in.(${groups.join(",")})&select=group_id,locale,status`);
const has = new Set(existing.map((e) => e.group_id + "/" + e.locale));
const fresh = rows.filter((r) => !has.has(r.group_id + "/" + r.locale));
for (const e of existing) console.log(`[seed-articles] уже в базе, пропускаю: ${e.group_id}/${e.locale} (${e.status})`);
if (fresh.length) await db("articles", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(fresh) });

for (const r of fresh) {
  const q = r.meta.queue && r.meta.queue.id;
  if (!q) continue;
  await db(`content_queue?id=eq.${encodeURIComponent(q)}`, {
    method: "PATCH", body: JSON.stringify({ status: "review", article_group_id: r.group_id, updated_at: new Date().toISOString() }),
  }).catch((e) => console.warn(`[seed-articles] очередь ${q} не обновлена: ${e.message}`));
}
console.log(`[seed-articles] записано ${fresh.length} из ${rows.length}, статус review — одобрите в кабинете (Блог → На проверке)`);
