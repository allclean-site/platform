/**
 * Self-check for the rule that cost a client three days of work: a publish may not erase what it was
 * not told about. Runs the real handler with a stubbed Supabase: node scripts/check-publish-preserve.mjs
 */
import assert from "node:assert";

process.env.SUPABASE_URL = "https://stub.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
process.env.EDIT_KEY = "k";
delete process.env.DEPLOY_HOOK;

const STORED = [
  { page_id: "keeps/index.html", overrides: { "sec-1": "<p>опубликовано</p>" }, breakpoints: { mobile: { a: 1 } } },
  { page_id: "cleared/index.html", overrides: { "sec-1": "<p>старое</p>" }, breakpoints: {} },
];
let upsert = null;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("site_overrides") && (!init || init.method !== "POST")) return json(STORED);
  if (u.includes("site_overrides")) { upsert = JSON.parse(init.body); return json({}); }
  if (u.includes("site_versions")) return json([]);
  return json({});                                        // page warming
};
const json = (v) => ({ ok: true, status: 200, json: async () => v, text: async () => JSON.stringify(v) });

const { default: handler } = await import("../api/publish.js");
const res = () => {
  const r = { code: 0, body: null, setHeader() {}, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; }, end() { return r; } };
  return r;
};
const out = res();
await handler({ method: "POST", headers: {}, body: {
  editKey: "k", project: "allclean",
  overrides: { "sends/index.html": { "sec-1": "<p>новое</p>" }, "cleared/index.html": {} },
  // the page the cabinet knew sizes for but sent no edits for — the exact shape that wiped the site
  breakpoints: { "keeps/index.html": { mobile: { a: 1 } }, "sends/index.html": {} },
  clearPages: ["cleared/index.html"],
} }, out);

assert.equal(out.code, 200, "publish must succeed");
const by = Object.fromEntries(upsert.map((r) => [r.page_id, r]));
assert.deepEqual(by["sends/index.html"].overrides, { "sec-1": "<p>новое</p>" }, "sent edits must be written");
assert.deepEqual(by["keeps/index.html"].overrides, { "sec-1": "<p>опубликовано</p>" }, "a page sent without edits must KEEP what is published");
assert.deepEqual(by["cleared/index.html"].overrides, {}, "a page named in clearPages must actually be cleared");
assert.equal(out.body.preserved, 1, "the answer says how many pages were left as they were");
console.log("publish-preserve: PASS");
