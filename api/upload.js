// Image upload for the cabinet (Vercel serverless). Uploads to Supabase Storage `article-images` with
// the service_role key (server only — the bucket allows authed writes) and returns the public URL.
//   POST { editKey, file: { name, type, dataBase64 } } → { url }
// Gated by EDIT_KEY. CORS * (cabinet is a different origin).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = (process.env.EDIT_KEY || "").trim();
const BUCKET = "article-images";
const TYPES = /^(image\/(png|jpe?g|webp|gif|avif|svg\+xml)|video\/(mp4|webm))$/;
const EXTS = /^(png|jpe?g|webp|gif|avif|svg|mp4|webm)$/;
const MAX_BYTES = 4 * 1024 * 1024;   // тело запроса Vercel и так ≤ 4,5 МБ с base64

// Подробности ответа базы — в лог функции, клиенту короткое сообщение.
async function fail(what, r) { console.error(what, r.status, (await r.text()).slice(0, 300)); return `${what} (${r.status})`; }

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

  const f = body.file;
  if (!f || !f.dataBase64) return res.status(400).json({ error: "no file" });
  const ext = (String(f.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  // Только фото и ролики библиотеки (видео до ~3 МБ тоже идёт сюда) — не html, js и прочее.
  const type = String(f.type || "").toLowerCase();
  if (!TYPES.test(type) || !EXTS.test(ext)) return res.status(415).json({ error: "only images or mp4/webm video" });
  const path = `allclean/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  let bytes;
  try { bytes = Buffer.from(f.dataBase64, "base64"); }
  catch { return res.status(400).json({ error: "invalid base64" }); }
  if (!bytes.length || bytes.length > MAX_BYTES) return res.status(413).json({ error: "file too large" });

  const up = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": type, "x-upsert": "true", "cache-control": "31536000" },
    body: bytes,
  });
  if (!up.ok) return res.status(502).json({ error: await fail("upload failed", up) });
  return res.status(200).json({ url: `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}` });
}
