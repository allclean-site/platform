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

/** Сборка сообщения — отдельно от отправки, чтобы её можно было проверить: scripts/check-notify-lead.mjs */
export function buildMessage(body, phone) {
  const ro = String(body.locale || "").indexOf("ro") === 0;
  const L = ro
    ? { head: "Cerere nouă de pe site", name: "Nume", phone: "Telefon", service: "Serviciu", rooms: "Camere", notes: "Comentariu", page: "Pagina", estimate: "Estimare", photos: "Fotografii", calc: "Calculator" }
    : { head: "Новая заявка с сайта", name: "Имя", phone: "Телефон", service: "Услуга", rooms: "Комнат", notes: "Комментарий", page: "Страница", estimate: "Предварительно", photos: "Фотографии", calc: "Калькулятор" };

  // Заявка из калькулятора приходит подписанной «Калькулятор: carpet» — по-русски и с английским
  // слагом, одинаково на обоих языках. Разворачиваем в название услуги на языке страницы.
  const УСЛУГИ = {
    "home-cleaning": ["Уборка квартир и домов", "Curățenie apartamente și case"],
    "office": ["Уборка офисов", "Curățenie birouri"],
    "windows": ["Мойка окон и фасадов", "Spălarea geamurilor și fațadelor"],
    "post-construction": ["Уборка после ремонта", "Curățenie după renovare"],
    "carpet": ["Чистка ковров и ковролина", "Curățare covoare și mochetă"],
    "upholstery": ["Чистка мягкой мебели", "Curățare mobilă tapițată"],
    "warehouse": ["Уборка складов", "Curățenie depozite"],
    "retail": ["Уборка магазинов", "Curățenie magazine"],
    "floor-restoration": ["Реставрация полов", "Restaurare pardoseli"],
    "disinfection": ["Дезинфекция производств", "Dezinfecție producție"],
  };
  const услуга = (raw) => {
    const s = field(raw, 80);
    const m = /^(?:Калькулятор|Calculator)\s*:\s*(.+)$/i.exec(s);
    if (!m) return s;
    const слаг = m[1].trim();
    const пара = УСЛУГИ[слаг];
    return `${L.calc}: ${пара ? пара[ro ? 1 : 0] : слаг}`;
  };

  const lines = [`🧹 <b>${esc(L.head)}</b>`, ""];
  const add = (label, value, max) => { const v = field(value, max); if (v) lines.push(`<b>${esc(label)}:</b> ${esc(v)}`); };
  add(L.name, body.name, 80);
  lines.push(`<b>${esc(L.phone)}:</b> ${esc(phone)}`);
  add(L.service, услуга(body.service), 120);
  add(L.rooms, body.bedrooms, 40);
  // Калькулятор присылает смету, ответы по шагам, комментарий и фотографии — и всё это до сих пор
  // никуда не выводилось: менеджер получал имя, телефон и слаг услуги, а за остальным шёл в CRM.
  add(L.estimate, body.estimate, 60);
  const выбор = body.selections;
  if (выбор && typeof выбор === "object") {
    for (const [ключ, знач] of Object.entries(выбор).slice(0, 20)) {
      add(ключ, Array.isArray(знач) ? знач.join(", ") : знач, 200);
    }
  }
  add(L.notes, body.comment || body.notes, 700);
  const фото = Array.isArray(body.photos) ? body.photos.filter((u) => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 10) : [];
  if (фото.length) {
    lines.push(`<b>${esc(L.photos)}:</b> ${фото.length}`);
    for (const u of фото) lines.push(esc(field(u, 300)));
  }
  const url = field(body.source_url, 200);
  if (url) { lines.push("", `<b>${esc(L.page)}:</b> ${esc(url)}`); }

  return lines.join("\n");
}

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

  const text = buildMessage(body, phone);

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
