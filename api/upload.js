// Image upload for the cabinet (Vercel serverless). Uploads to Supabase Storage `article-images` with
// the service_role key (server only — the bucket allows authed writes) and returns the public URL.
//   POST { editKey, file: { name, type, dataBase64 } } → { url }
// Gated by EDIT_KEY. CORS * (cabinet is a different origin).

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EDIT_KEY = process.env.EDIT_KEY;
const BUCKET = "article-images";

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
  if (EDIT_KEY && body.editKey !== EDIT_KEY) return res.status(401).json({ error: "unauthorized" });

  const f = body.file;
  if (!f || !f.dataBase64) return res.status(400).json({ error: "no file" });
  const ext = (String(f.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `allclean/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  let bytes;
  try { bytes = Buffer.from(f.dataBase64, "base64"); }
  catch { return res.status(400).json({ error: "invalid base64" }); }

  const up = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "content-type": f.type || "application/octet-stream", "x-upsert": "true", "cache-control": "31536000" },
    body: bytes,
  });
  if (!up.ok) return res.status(502).json({ error: "upload failed: " + (await up.text()).slice(0, 200) });
  return res.status(200).json({ url: `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET}/${path}` });
}
