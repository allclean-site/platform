// Read side of lead capture: the cabinet CRM pulls REAL leads submitted through the site forms /
// calculator. The public site inserts leads into Supabase `site_leads` with the anon key, but anon
// can NOT read them back (RLS — see scripts/supabase-leads.sql), so reading is done here with the
// service_role key (server only, never the browser), gated by EDIT_KEY.
//   POST /api/leads  { editKey, project, limit? }  ->  { ok, leads:[...] }
//
// Env (Vercel, same as /api/publish): SUPABASE_URL (or PUBLIC_SUPABASE_URL),
// SUPABASE_SERVICE_ROLE_KEY, EDIT_KEY.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();

// Фотографии помещений лежат в ЗАКРЫТОМ бакете calc-uploads: снимок чужого жилья не
// должен открываться вечной ссылкой у всякого, кто её увидел. Сайт кладёт в заявку ПУТЬ
// файла, а не адрес, поэтому подписываем ссылки здесь — на сервере, где и так есть
// служебный ключ. Часа хватает: панель показывает заявку, пока с ней работают.
// Заявки, созданные до перехода, хранят полный публичный адрес — такие отдаём как есть.
const PHOTO_TTL = 60 * 60;

async function signPhoto(path) {
  const r = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/sign/calc-uploads/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: PHOTO_TTL }),
  });
  if (!r.ok) return null;
  const { signedURL } = await r.json();
  return signedURL ? `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1${signedURL}` : null;
}

/** Заменяет пути фотографий в notes подписанными ссылками. Ошибка подписи одной
 *  фотографии не должна лишать сотрудника всей заявки — такой снимок просто пропадёт. */
async function signLeadPhotos(lead) {
  if (typeof lead?.notes !== "string" || !lead.notes.trim().startsWith("{")) return lead;
  let json;
  try { json = JSON.parse(lead.notes); } catch { return lead; }
  if (!json || !Array.isArray(json.photos) || !json.photos.length) return lead;
  const signed = [];
  for (const p of json.photos.map(String)) {
    if (/^https?:\/\//.test(p)) { signed.push(p); continue; }
    const url = await signPhoto(p).catch(() => null);
    if (url) signed.push(url);
  }
  return { ...lead, notes: JSON.stringify({ ...json, photos: signed }) };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });
  if (!SUPABASE_URL || !SERVICE) return res.status(500).json({ error: "server not configured (SUPABASE_SERVICE_ROLE_KEY)" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "invalid JSON" }); }

  // Незаданный EDIT_KEY означал ОТКРЫТУЮ дверь: проверка стояла под условием «если ключ настроен»,
  // и стоило переменной пропасть при переносе проекта, как этот обработчик начинал отдавать данные
  // кому угодно — service_role-ключом. Теперь без ключа он не работает вовсе.
  if (!EDIT_KEY) return res.status(500).json({ error: "server not configured (EDIT_KEY)" });
  if (String(body.editKey || "").trim() !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  const limit = Math.min(1000, Math.max(1, body.limit || 300));
  // No `order` in the query so we don't depend on a specific timestamp column existing; the CRM sorts
  // client-side. select=* returns every column the row has.
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_leads?select=*&limit=${limit}`;
  const r = await fetch(url, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  if (!r.ok) return res.status(502).json({ error: "read failed: " + (await r.text()) });
  const leads = await r.json();
  const withPhotos = Array.isArray(leads) ? await Promise.all(leads.map(signLeadPhotos)) : leads;
  return res.status(200).json({ ok: true, leads: withPhotos });
}
