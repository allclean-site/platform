/**
 * Очередь тем из content-plan.csv → таблица content_queue (после allclean-marketing/sql/supabase-articles-pipeline.sql).
 *
 *   node --env-file=.env.local scripts/seed-content-queue.mjs [путь к csv] [--dry]
 *
 * По умолчанию csv берётся из ../allclean-marketing/content-plan.csv. Повторный запуск обновляет
 * тексты тем и окна, но не трогает статус и связанные статьи: прогресс не сбрасывается.
 * --dry печатает строки и ничего не пишет.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, queueRowFromPlan, supabase } from "../src/engine/blog/article-pipeline.js";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const csv = args.find((a) => !a.startsWith("--")) || join(process.cwd(), "..", "allclean-marketing", "content-plan.csv");

const rows = parseCsv(readFileSync(csv, "utf8")).filter((r) => r.id && r.lang && r.target_query).map((r) => queueRowFromPlan(r));
const bad = rows.filter((r) => !["ru", "ro"].includes(r.locale) || !/^[RO]\d{2}$/.test(r.id));
if (bad.length) { console.error("[seed-queue] непонятные строки:", bad.map((r) => r.id).join(", ")); process.exit(1); }

if (dry) {
  for (const r of rows) console.log(r.id, r.locale, r.priority, r.window_from || "—", r.window_to || "—", r.service_page || "—", r.pair_id || "", "|", r.title_hint);
  console.log(`[seed-queue] ${rows.length} тем (сухой прогон, в базу ничего не ушло)`);
} else {
  const URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) { console.error("[seed-queue] нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
  const db = supabase(URL, KEY);
  await db("content_queue?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map((r) => ({ ...r, updated_at: new Date().toISOString() }))),
  });
  console.log(`[seed-queue] ${rows.length} тем записано в content_queue`);
}
