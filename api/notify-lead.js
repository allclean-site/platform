// Lead notification — the half of lead capture that was missing.
//
// The site saves every booking into Supabase `site_leads` and then calls THIS endpoint so a human
// hears about it within seconds instead of whenever someone next opens the CRM. It did not exist
// (404), and the site's call sits inside a .catch() — so every lead landed in the database and
// nobody was told. Measured on the live site before this was written.
//
//   POST /api/notify-lead { name, phone, service, bedrooms, notes, locale, source_url } -> { ok }
//
// Env (Vercel → the SITE project `allclean`): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
// Both are server-only — never VITE_-prefixed, so they can never reach a visitor's bundle.
//
// Deliberately forgiving: with no token configured, or if Telegram is down, this answers 200 and
// says so in the payload. Notification is a courtesy on top of the lead; it must never be the
// reason a booking looks failed to the person who just made it.

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const CHAT = (process.env.TELEGRAM_CHAT_ID || "").trim();

// The endpoint takes no key (the visitor's browser calls it), so it only answers requests coming
// from the site itself. That stops a stray script from ringing the client's phone all night; a
// determined forger can set any Origin, which is why the message is also length-capped below.
const ALLOWED = /^https?:\/\/(www\.)?allclean\.md$|^https?:\/\/localhost(:\d+)?$|^https?:\/\/127\.0\.0\.1(:\d+)?$/;

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** One field, trimmed to something a chat message can hold. */
const field = (v, max = 200) => {
  const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const origin = req.headers.origin || "";
  const referer = req.headers.referer || "";
  const from = origin || (referer ? new URL(referer).origin : "");
  if (from && !ALLOWED.test(from)) return res.status(403).json({ error: "forbidden" });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); }
  catch { return res.status(400).json({ error: "invalid JSON" }); }

  // A booking without a phone number is not a booking — and it is the shape a spam script sends.
  const phone = field(body.phone, 40);
  if (!phone || (phone.match(/\d/g) || []).length < 8) return res.status(400).json({ error: "phone required" });

  if (!TOKEN || !CHAT) {
    // Nothing to notify with. The lead itself is already saved; say so rather than failing.
    return res.status(200).json({ ok: true, notified: false, reason: "notifications not configured" });
  }

  const ro = String(body.locale || "").indexOf("ro") === 0;
  const L = ro
    ? { head: "Cerere nouă de pe site", name: "Nume", phone: "Telefon", service: "Serviciu", rooms: "Camere", notes: "Comentariu", page: "Pagina" }
    : { head: "Новая заявка с сайта", name: "Имя", phone: "Телефон", service: "Услуга", rooms: "Комнат", notes: "Комментарий", page: "Страница" };

  const lines = [`🧹 <b>${esc(L.head)}</b>`, ""];
  const add = (label, value, max) => { const v = field(value, max); if (v) lines.push(`<b>${esc(label)}:</b> ${esc(v)}`); };
  add(L.name, body.name, 80);
  lines.push(`<b>${esc(L.phone)}:</b> ${esc(phone)}`);
  add(L.service, body.service, 80);
  add(L.rooms, body.bedrooms, 40);
  add(L.notes, body.notes, 700);
  const url = field(body.source_url, 200);
  if (url) { lines.push("", `<b>${esc(L.page)}:</b> ${esc(url)}`); }

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!r.ok) {
      // Telegram's reply can quote the request — never let it reach the client, and never log the token.
      const detail = (await r.text()).slice(0, 200).split(TOKEN).join("***");
      console.error("notify-lead: telegram refused", r.status, detail);
      return res.status(200).json({ ok: true, notified: false, reason: "telegram error" });
    }
  } catch (e) {
    console.error("notify-lead: telegram unreachable", String(e).split(TOKEN).join("***"));
    return res.status(200).json({ ok: true, notified: false, reason: "telegram unreachable" });
  }
  return res.status(200).json({ ok: true, notified: true });
}
