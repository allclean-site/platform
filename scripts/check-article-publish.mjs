/**
 * Публикация статьи из кабинета: адрес и повторы. Настоящий обработчик api/publish-article.js
 * поверх поддельного Supabase в памяти.
 *
 *   node scripts/check-article-publish.mjs
 *
 * Проверяет: адрес с пробелом/кириллицей/«../» не принимается (400); адрес, занятый статьёй из
 * другой группы, не принимается (409); нормальная пара RO+RU записывается.
 */
import assert from "node:assert";

process.env.SUPABASE_URL = "https://stub.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.EDIT_KEY = "k";
delete process.env.DEPLOY_HOOK;

const rows = [{ group_id: "g-old", locale: "ro", slug: "curatenie-generala", status: "published" }];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  if (u.host !== "stub.supabase.co") return json({});                       // IndexNow и прочее наружу
  const q = Object.fromEntries(u.searchParams);
  const eq = (k) => (q[k] || "").replace(/^(eq|neq)\./, "");
  if ((init.method || "GET") === "GET") {
    return json(rows.filter((r) => (!q.locale || r.locale === eq("locale")) && (!q.slug || r.slug === eq("slug")) &&
      (!q.group_id || (q.group_id.startsWith("neq.") ? r.group_id !== eq("group_id") : r.group_id === eq("group_id")))));
  }
  if (init.method === "POST") { for (const r of JSON.parse(init.body)) rows.push(r); return json(null, 201); }
  if (init.method === "PATCH") { const p = JSON.parse(init.body); for (const r of rows) if (r.group_id === eq("group_id")) Object.assign(r, p); return json(null, 204); }
  return json({});
};
function json(v, status = 200) { return { ok: status < 300, status, json: async () => v, text: async () => JSON.stringify(v) }; }

const { default: handler } = await import("../api/publish-article.js");
async function call(body) {
  const r = { code: 0, body: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } };
  await handler({ method: "POST", body: { editKey: "k", ...body } }, r);
  return r;
}
const art = (p) => ({ group: "g-new", locale: "ro", title: "T", body: "b", ...p });

for (const slug of ["Curățenia de Primăvară!", "весенняя-уборка", "../../etc", "a--b", "-a"]) {
  const r = await call({ articles: [art({ slug })] });
  assert.equal(r.code, 400, `адрес «${slug}» должен быть отклонён, получено ${r.code}`);
}
assert.equal((await call({ articles: [art({ slug: "x", locale: "../ro" })] })).code, 400, "чужая локаль");
const dup = await call({ articles: [art({ slug: "curatenie-generala" })] });
assert.equal(dup.code, 409, "занятый адрес другой статьи → 409");
assert.match(dup.body.error, /занят/);
const ok = await call({ articles: [art({ slug: "curatenia-de-primavara" }), art({ slug: "vesennyaya-uborka", locale: "ru" })] });
assert.equal(ok.code, 200, JSON.stringify(ok.body));
// та же группа может переопубликовать свой адрес
assert.equal((await call({ articles: [art({ slug: "curatenia-de-primavara" })] })).code, 200);

console.log("[check-article-publish] ок: адрес проверяется, повтор адреса не проходит");
