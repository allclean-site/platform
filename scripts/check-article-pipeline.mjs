/**
 * Конвейер статей: черновик → проверка → одобрение → публикация по графику. Настоящие обработчики
 * api/draft-article.js, api/articles-review.js, api/publish-scheduled.js, api/publish-article.js поверх
 * поддельного Supabase в памяти; ответ модели подделан потоком SSE, Telegram/IndexNow/хук сборки
 * только записываются. Наружу не уходит ничего.
 *
 *   node scripts/check-article-pipeline.mjs           — быстрые проверки (меньше секунды)
 *   node scripts/check-article-pipeline.mjs --build   — плюс сборка сайта из статей всех статусов:
 *     на сайт и в карту сайта попадают только published. ⚠ перезаписывает out/ — после неё
 *     соберите сайт заново перед остальными воротами.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  checkArticle, duePicks, nextSlot, numbersIn, parseCsv, queueRowFromPlan, planWindow, authorNode, PROJECT_ID,
} from "../src/engine/blog/article-pipeline.js";
import { markdownToHtml, sanitizeArticleHtml } from "../src/engine/blog/markdown.js";
import { withRelatedArticles, relatedArticles } from "./blog-cards.mjs";

const ROOT = process.cwd();
const facts = JSON.parse(readFileSync(join(ROOT, "data", "allclean-facts.json"), "utf8"));
const files = readdirSync(join(ROOT, "content", "articles")).filter((f) => f.endsWith(".json")).sort();
const ARTS = files.map((f) => JSON.parse(readFileSync(join(ROOT, "content", "articles", f), "utf8")));
const EXISTING = ["/ru/blog/generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya", "/blog/curatenia-generala-si-cea-de-mentinere-care-sunt-diferentele"];
const known = new Set([...Object.keys(facts.pages.ru), ...Object.keys(facts.pages.ro), ...EXISTING]);
const ctx = (a) => ({ facts, servicePath: a.meta.service_page, knownPaths: known, existing: ARTS });

// ---- 1. проверка черновика ----------------------------------------------------------------------
for (const a of ARTS) assert.deepEqual(checkArticle(a, ctx(a)).errors, [], `статья ${a.slug} должна проходить проверку`);
const base = ARTS.find((a) => a.meta.queue.id === "R03");
const variant = (patch) => checkArticle({ ...base, group_id: "other", ...patch }, { ...ctx(base), existing: [] }).errors.join(" | ");
assert.match(variant({ body: base.body.replace("до 7 часов", "до 6 часов") }), /числа не из паспорта фактов: 6/);
assert.match(variant({ body: base.body + "\n\nМы лучший клининг." }), /«лучший»/);
assert.match(variant({ body: base.body + "\n\nРаботаем 24/7." }), /24\/7/);
assert.match(variant({ body: base.body + "\n\nТекст подготовлен нейросетью." }), /ИИ/);
assert.match(variant({ body: base.body.replace("](/ru/services/deep-cleaning)", "](/ru/services/windows)") }), /ровно одна/);
assert.match(variant({ body: base.body + "\n\nЕщё раз про [генеральную](/ru/services/deep-cleaning)." }), /ровно одна/);
assert.match(variant({ body: base.body.replace("](/ru/pricing)", "](/ru/ceny)") }), /несуществующую страницу \/ru\/ceny/);
assert.match(variant({ body: base.body.replace(/^\|.*\n/gm, "") }), /нет таблицы/);
assert.match(variant({ seo_title: "x".repeat(61) }), /title 61/);
assert.match(variant({ seo_description: "коротко" }), /description/);
assert.match(variant({ title: "Генеральная уборка" }), /вопросом/);
assert.match(checkArticle({ ...base, group_id: "other" }, ctx(base)).errors.join(), /уже занят|уже написана/);
assert.equal(variant({ body: base.body + "\n\nТак будет лучше." }), "", "«лучше» — не «лучший»");
assert.deepEqual(numbersIn("с 8:00 до 21:00, 2–3 дня, 4,7 в Google, +373 79 955 044, [x](/media/1790843184888.webp)\n1. шаг"), ["8:00", "21:00", "2", "3", "4.7"]);

// ---- 2. разметка, очистка, таблицы ----------------------------------------------------------------
assert.equal(authorNode({ author: "Echipa All Clean" })["@type"], "Organization");
assert.equal(authorNode({})["@type"], "Organization");
assert.deepEqual(authorNode({ author: "Мария Иванова", authorJobTitle: "Бригадир" }), { "@type": "Person", name: "Мария Иванова", jobTitle: "Бригадир", worksFor: { "@id": "https://allclean.md/#org" } });
const dirty = '<p onclick="x()">a<script>alert(1)</script><a href="javascript&#58;alert(1)">j</a><a href="//evil.example">p</a><img src=x onerror=alert(1)><iframe src="https://x"></iframe><a href="/ru/pricing" title=\'"><b>\'>ok</a></p>';
const clean = sanitizeArticleHtml(dirty);
assert.ok(!/script|onclick|onerror|javascript|iframe|evil\.example/i.test(clean), clean);
assert.match(clean, /<a href="\/ru\/pricing" title="&quot;&gt;&lt;b&gt;">ok<\/a>/);
assert.match(markdownToHtml("| a | b |\n|---|---|\n| 1 | [x](/ru/pricing) |"), /<table><thead><tr><th>a<\/th><th>b<\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td><a href="\/ru\/pricing">x<\/a><\/td><\/tr><\/tbody><\/table>/);
assert.match(markdownToHtml("[x](//evil.example)"), /href="#"/);

// ---- 3. очередь, график, «Полезные статьи» ----------------------------------------------------------
assert.deepEqual(planWindow("нед. 1, до 15.11.2026"), { from: "2026-11-02", to: "2026-11-15" });
assert.deepEqual(planWindow("до 10.03.2027"), { from: "2027-01-27", to: "2027-03-10" });
const csv = parseCsv('id,lang,priority,cluster,intent,target_query,title,service_page,aeo_question,publish_window,facts_from_owner\nR03,ru,P1,Г,сезон,уборка,"Т, т",https://allclean.md/ru/services/deep-cleaning,"Когда?","нед. 1, до 15.11.2026",x\n');
assert.equal(queueRowFromPlan(csv[0]).service_page, "/ru/services/deep-cleaning");
assert.equal(queueRowFromPlan(csv[0]).pair_id, "O08");
const tue = new Date("2026-11-02T10:00:00Z"); // понедельник
assert.equal(nextSlot("ru", [], tue), "2026-11-03T05:00:00.000Z");
assert.equal(nextSlot("ru", [{ locale: "ru", publish_at: "2026-11-03T05:00:00Z" }], tue), "2026-11-06T05:00:00.000Z");
assert.equal(nextSlot("ro", [{ locale: "ru", publish_at: "2026-11-03T05:00:00Z" }], tue), "2026-11-03T05:00:00.000Z");
const now = new Date("2026-11-06T06:00:00Z");
const picks = duePicks([
  { id: 1, locale: "ru", status: "approved", publish_at: "2026-11-03T05:00:00Z" },
  { id: 2, locale: "ru", status: "approved", publish_at: "2026-11-06T05:00:00Z" },
  { id: 3, locale: "ro", status: "approved", publish_at: "2026-11-07T05:00:00Z" },
  { id: 4, locale: "ro", status: "review", publish_at: "2026-11-03T05:00:00Z" },
  { id: 5, locale: "ro", status: "rejected", publish_at: "2026-11-03T05:00:00Z" },
], now);
assert.deepEqual(picks.map((p) => p.id), [1], "одна на язык в день, review/rejected и будущие — нет");
assert.deepEqual(duePicks([{ id: 6, locale: "ru", status: "published", publish_at: "2026-11-06T05:00:00Z" },
  { id: 7, locale: "ru", status: "approved", publish_at: "2026-11-05T05:00:00Z" }], now).map((p) => p.id), [], "сегодня RU уже выходила");
const svcPage = '<main><section class="a">x</section><section class="section_faq"><div class="faq-block">q</div></section></main>';
const rel = [{ locale: "ru", slug: "s1", title: "T1", status: "published", meta: { service_page: "/ru/services/deep-cleaning" } },
  { locale: "ru", slug: "s2", title: "T2", status: "review", meta: { service_page: "/ru/services/deep-cleaning" } },
  { locale: "ro", slug: "s3", title: "T3", status: "published", meta: { service_page: "/services/deep-cleaning" } }];
const list = relatedArticles("/ru/services/deep-cleaning", "ru", rel);
assert.deepEqual(list.map((a) => a.slug), ["s1"]);
const once = withRelatedArticles(svcPage, list, "ru");
assert.ok(once.indexOf("Полезные статьи") < once.indexOf("section_faq") && once.includes('href="/ru/blog/s1"'));
assert.equal(withRelatedArticles(once, list, "ru"), once, "повторный вызов не дублирует блок");
assert.equal(withRelatedArticles(once, [], "ru"), svcPage, "без статей блок снимается");

// ---- 4. обработчики поверх поддельной базы -----------------------------------------------------------
const FAKE = "https://fake-supabase.test";
Object.assign(process.env, { SUPABASE_URL: FAKE, SUPABASE_SERVICE_ROLE_KEY: "svc", EDIT_KEY: "k", DEPLOY_HOOK: "https://deploy-hook.test/h",
  ANTHROPIC_API_KEY: "test", CRON_SECRET: "cron-s", TELEGRAM_BOT_TOKEN: "tg", TELEGRAM_CHAT_ID: "1" });
delete process.env.ARTICLE_CRON;
const db = { articles: [], content_queue: [] };
const external = [];
const modelCalls = [];
let modelOutputs = [];

function match(row, params) {
  for (const [k, v] of params) {
    if (["select", "order", "limit", "on_conflict"].includes(k)) continue;
    if (k === "or") {
      const m = /window_from\.is\.null,window_from\.lte\.([\d-]+)/.exec(v);
      if (m && row.window_from && row.window_from > m[1]) return false;
      continue;
    }
    const [op, ...rest] = v.split("."); const val = rest.join(".");
    const cell = row[k] == null ? "" : String(row[k]);
    if (op === "eq" && cell !== val) return false;
    if (op === "neq" && cell === val) return false;
    if (op === "lt" && !(Number(cell) < Number(val))) return false;
    if (op === "in" && !val.replace(/^\(|\)$/g, "").split(",").includes(cell)) return false;
  }
  return true;
}
const sel = (row, s) => (!s || s === "*" ? { ...row } : Object.fromEntries(s.split(",").map((c) => [c, row[c] ?? null])));
const json = (status, body) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function sse(text) {
  const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const body = ev("message_start", { message: { id: "msg_t", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 1 } } }) +
    ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) +
    ev("content_block_delta", { index: 0, delta: { type: "text_delta", text } }) +
    ev("content_block_stop", { index: 0 }) +
    ev("message_delta", { delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 2000 } }) +
    ev("message_stop", {});
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url instanceof Request ? url.url : url));
  const method = String(init.method || (url instanceof Request ? url.method : "GET")).toUpperCase();
  if (u.host === "api.anthropic.com") {
    const body = JSON.parse(init.body || (url instanceof Request ? await url.text() : "{}"));
    modelCalls.push(body);
    return sse(JSON.stringify(modelOutputs.shift()));
  }
  if (u.origin !== FAKE) { external.push({ url: u.href, method, body: init.body ? String(init.body) : "" }); return json(200, { ok: true }); }
  const table = u.pathname.replace("/rest/v1/", "");
  const rows = db[table] || (db[table] = []);
  const p = [...u.searchParams];
  if (method === "GET") {
    let out = rows.filter((r) => match(r, p));
    const lim = +u.searchParams.get("limit"); if (lim) out = out.slice(0, lim);
    return json(200, out.map((r) => sel(r, u.searchParams.get("select"))));
  }
  if (method === "POST") {
    const list = [].concat(JSON.parse(init.body));
    const keys = (u.searchParams.get("on_conflict") || "").split(",").filter(Boolean);
    const out = [];
    for (const row of list) {
      const hit = keys.length ? rows.find((r) => keys.every((k) => String(r[k]) === String(row[k]))) : null;
      if (hit) { Object.assign(hit, row); out.push(hit); }
      else { const r = { id: randomUUID(), created_at: new Date().toISOString(), ...row }; rows.push(r); out.push(r); }
    }
    return /return=representation/.test(init.headers?.Prefer || "") ? json(201, out) : new Response(null, { status: 201 });
  }
  if (method === "PATCH") {
    const patch = JSON.parse(init.body); const hit = rows.filter((r) => match(r, p));
    for (const r of hit) Object.assign(r, patch);
    return /return=representation/.test(init.headers?.Prefer || "") ? json(200, hit) : new Response(null, { status: 204 });
  }
  return json(400, { error: "fake" });
};

const call = async (name, { body, headers = {}, method = "POST" } = {}) => {
  const h = (await import(`../api/${name}.js`)).default;
  const out = { code: 0, body: null };
  const res = { setHeader() {}, status(c) { out.code = c; return res; }, json(b) { out.body = b; return res; }, end() { return res; } };
  await h({ method, headers, body: body ? { editKey: "k", ...body } : undefined }, res);
  return out;
};

// очередь: R03 и пара O08 из плана; опубликованная статья-образец для ссылок
for (const r of csv) db.content_queue.push({ ...queueRowFromPlan(r), status: "queued", attempts: 0 });
db.content_queue.push({ ...queueRowFromPlan({ ...csv[0], id: "O08", lang: "ro", service_page: "https://allclean.md/services/deep-cleaning" }), status: "queued", attempts: 0 });
db.articles.push({ id: randomUUID(), project_id: PROJECT_ID, group_id: randomUUID(), locale: "ru", status: "published",
  slug: "generalnaya-i-podderzhivayushchaya-uborka-chem-otlichayutsya", title: "Генеральная и поддерживающая уборка", meta: {} });
db.articles.push({ id: randomUUID(), project_id: PROJECT_ID, group_id: randomUUID(), locale: "ro", status: "published",
  slug: "curatenia-generala-si-cea-de-mentinere-care-sunt-diferentele", title: "Curățenia generală și cea de menținere", meta: {} });

// расписание без ARTICLE_CRON ничего не делает; чужой ключ — 401; без ключа сервер не работает
assert.equal((await call("draft-article", { method: "GET", headers: { authorization: "Bearer cron-s" } })).body.skipped !== undefined, true);
assert.equal((await call("publish-scheduled", { method: "GET", headers: { authorization: "Bearer cron-s" } })).body.skipped !== undefined, true);
assert.equal((await call("draft-article", { body: { editKey: "bad" } })).code, 401);
assert.equal((await call("articles-review", { body: { editKey: "bad", op: "list" } })).code, 401);
assert.equal((await call("publish-scheduled", { method: "GET" })).code, 405, "GET без секрета расписания");
assert.equal(modelCalls.length, 0);

// черновик по расписанию: первая версия с выдуманной цифрой → модель исправляет → review
process.env.ARTICLE_CRON = "1";
const out = (a) => ({ title: a.title, slug: a.slug, seo_title: a.seo_title, seo_description: a.seo_description, excerpt: a.excerpt, body: a.body,
  faq: a.meta.faq, takeaways: a.meta.takeaways, tags: a.meta.tags, sources: a.meta.sources });
modelOutputs = [out({ ...base, body: base.body.replace("до 7 часов", "до 6 часов") }), out(base)];
const d = await call("draft-article", { method: "GET", headers: { authorization: "Bearer cron-s" } });
assert.equal(d.code, 200, JSON.stringify(d.body));
assert.deepEqual(d.body.checks.errors, []);
assert.equal(modelCalls.length, 2, "одна попытка исправить");
assert.equal(modelCalls[0].model, "claude-opus-5-5");
assert.deepEqual(modelCalls[0].thinking, { type: "adaptive" });
assert.equal(modelCalls[0].output_config.format.type, "json_schema");
assert.equal(modelCalls[0].fallbacks, "default");
assert.match(modelCalls[1].messages.at(-1).content, /числа не из паспорта фактов: 6/);
const drafted = db.articles.find((a) => a.meta?.queue?.id === "R03");
assert.equal(drafted.status, "review");
assert.equal(db.content_queue.find((q) => q.id === "R03").status, "review");
const tg = external.find((e) => e.url.includes("api.telegram.org"));
assert.match(JSON.parse(tg.body).text, /Статья ждёт проверки \(RU\)/);

// пара O08 пишется в ту же группу (hreflang)
const ro = ARTS.find((a) => a.meta.queue.id === "O08");
modelOutputs = [out(ro)];
const d2 = await call("draft-article", { body: { queueId: "O08" } });
assert.equal(d2.code, 200, JSON.stringify(d2.body));
assert.equal(d2.body.group, drafted.group_id, "пара RO/RU в одной группе");
assert.equal((await call("draft-article", { body: {} })).body.idle, true, "очередь пуста");

// «На проверке»: список, правка, одобрение, отклонение
const listR = await call("articles-review", { body: { op: "list" } });
assert.equal(listR.body.articles.length, 2);
const ruId = drafted.id, roId = db.articles.find((a) => a.meta?.queue?.id === "O08").id;
assert.ok(listR.body.suggested[ruId]);
const bad = await call("articles-review", { body: { op: "save", id: ruId, article: { body: drafted.body + "\n\nЛучший сервис." } } });
assert.ok(bad.body.checks.errors.some((e) => /лучший/.test(e)));
assert.equal((await call("articles-review", { body: { op: "approve", id: ruId } })).code, 422, "с ошибками не одобрить");
assert.equal((await call("articles-review", { body: { op: "save", id: ruId, article: { body: base.body } } })).body.checks.errors.length, 0);
assert.equal((await call("articles-review", { body: { op: "approve", id: ruId, publishAt: "2020-01-01T05:00:00Z" } })).code, 400, "дата в прошлом");
const ap = await call("articles-review", { body: { op: "approve", id: ruId, publishAt: "2099-11-03T05:00:00.000Z" } });
assert.equal(ap.code, 200, JSON.stringify(ap.body));
assert.equal(db.articles.find((a) => a.id === ruId).status, "approved");
assert.equal(db.content_queue.find((q) => q.id === "R03").status, "approved");
const rj = await call("articles-review", { body: { op: "reject", id: roId, note: "Слишком общо" } });
assert.equal(rj.code, 200);
assert.equal(db.content_queue.find((q) => q.id === "O08").last_note, "Слишком общо");

// публикация по графику: дата не наступила — ничего; наступила — одна RU, rejected не трогается
external.length = 0;
assert.equal((await call("publish-scheduled", { method: "GET", headers: { authorization: "Bearer cron-s" } })).body.published, 0);
db.articles.find((a) => a.id === ruId).publish_at = new Date(Date.now() - 60e3).toISOString();
const extra = { ...db.articles.find((a) => a.id === ruId), id: randomUUID(), group_id: randomUUID(), slug: "vtoraya", title: "Вторая?", publish_at: new Date(Date.now() - 30e3).toISOString() };
db.articles.push(extra);
const ps = await call("publish-scheduled", { method: "GET", headers: { authorization: "Bearer cron-s" } });
assert.equal(ps.code, 200, JSON.stringify(ps.body));
assert.equal(ps.body.published, 1, "не больше одной статьи на язык в день");
const pub = db.articles.find((a) => a.id === ruId);
assert.equal(pub.status, "published");
assert.equal(pub.jsonld["@graph"][0].datePublished, pub.publish_at);
assert.ok(pub.jsonld["@graph"].some((n) => n["@type"] === "FAQPage"));
assert.equal(extra.status, "approved", "вторая RU ждёт следующего дня");
assert.equal(db.articles.find((a) => a.id === roId).status, "rejected");
assert.equal(db.content_queue.find((q) => q.id === "R03").status, "published");
assert.ok(external.some((e) => e.url.includes("indexnow")) && external.some((e) => e.url.includes("deploy-hook.test")), "IndexNow и пересборка");

console.log("[check-article-pipeline] ок: проверка черновика, очистка HTML, график, «На проверке», публикация по расписанию");

// ---- 5. --build: на сайт и в карту сайта — только published ------------------------------------------
if (process.argv.includes("--build")) {
  const rows = ARTS.map((a, i) => ({ ...a, project_id: PROJECT_ID, id: randomUUID(), created_at: "2026-10-28T10:00:00Z",
    status: ["published", "review", "approved", "rejected"][i % 4] }));
  // пара для hreflang: обе версии R03/O08 опубликованы
  for (const r of rows) if (["R03", "O08"].includes(r.meta.queue.id)) r.status = "published";
  const env = { ...process.env, MOCK_ARTICLES: JSON.stringify(rows), ALLOW_CLEAN_MIRROR: "1" };
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "PUBLIC_SUPABASE_ANON"]) delete env[k];
  const b = spawnSync(process.execPath, ["scripts/build-site.mjs"], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(b.status, 0, b.stdout + b.stderr);
  const sitemap = readFileSync(join(ROOT, "out", "sitemap.xml"), "utf8");
  const path = (a) => (a.locale === "ro" ? `blog/${a.slug}` : `ru/blog/${a.slug}`);
  for (const a of rows) {
    const on = existsSync(join(ROOT, "out", path(a), "index.html"));
    const inMap = sitemap.includes(`https://allclean.md/${path(a)}<`);
    if (a.status === "published") { assert.ok(on && inMap, `опубликованная ${a.slug} должна быть на сайте и в карте`); }
    else { assert.ok(!on && !inMap, `${a.status} ${a.slug} не должна попасть на сайт`); }
  }
  const ruPage = readFileSync(join(ROOT, "out", "ru/blog/kogda-zakazyvat-generalnuyu-uborku-pered-novym-godom/index.html"), "utf8");
  assert.match(ruPage, /hreflang="ro-MD" href="https:\/\/allclean\.md\/blog\/cand-rezervi-curatenia-generala-inainte-de-sarbatori"/);
  assert.match(sitemap, /<loc>https:\/\/allclean\.md\/ru\/blog\/kogda-zakazyvat-generalnuyu-uborku-pered-novym-godom<\/loc><lastmod>[^<]+<\/lastmod><xhtml:link rel="alternate" hreflang="ro-MD"/);
  assert.match(ruPage, /<table>/);
  const graph = [...ruPage.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1])).find((o) => o["@graph"])?.["@graph"] || [];
  const art = graph.find((n) => n["@type"] === "Article");
  assert.ok(art && graph.some((n) => n["@type"] === "FAQPage"), "Article + FAQPage в разметке");
  assert.equal(art.author["@type"], "Organization", "без имени автора — компания");
  assert.match(ruPage, /3 ноября 2026/, "дата статьи — дата выхода по графику");
  assert.match(ruPage, /href="https:\/\/allclean\.md\/blog\/cand-rezervi-curatenia-generala-inainte-de-sarbatori" class="lang-toggle/, "переключатель — на свою пару");
  const single = rows.find((a) => a.status === "published" && !rows.some((b) => b.group_id === a.group_id && b.locale !== a.locale && b.status === "published"));
  if (single) {
    const sp = readFileSync(join(ROOT, "out", path(single), "index.html"), "utf8");
    assert.ok(!sp.includes(`hreflang="${single.locale === "ro" ? "ru" : "ro"}-MD"`), "у статьи без пары нет hreflang на чужой язык");
  }
  const svc = readFileSync(join(ROOT, "out", "ru/services/deep-cleaning/index.html"), "utf8");
  assert.match(svc, /Полезные статьи[\s\S]*kogda-zakazyvat-generalnuyu-uborku-pered-novym-godom/);
  console.log("[check-article-pipeline --build] ок: на сайте и в карте сайта только published, пара hreflang, таблица, «Полезные статьи»");
}
