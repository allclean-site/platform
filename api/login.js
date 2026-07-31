/**
 * Cabinet sign-in.
 *
 * Until now the cabinet authenticated itself: the accounts and their passwords were compiled into the
 * JavaScript bundle, and the login screen offered them as one-click chips. Anyone who found the
 * cabinet's address was inside it — and since the publish key shipped in the same bundle, inside with
 * the right to publish to the live site and to read the client's leads.
 *
 * Credentials now live in the deployment's environment and are checked here. A successful sign-in is
 * what hands the browser the edit key, so an anonymous visitor has neither an account nor a key.
 *
 * Configure on the SITE project (the one that serves /api/*):
 *   CABINET_USERS  — JSON array, the full form:
 *       [{"email":"info@allclean.md","name":"AllClean","role":"client","tenantId":"allclean",
 *         "sha256":"<sha256 of the password>"}]
 *     `password` is accepted instead of `sha256` if you would rather not hash it yourself.
 *   CABINET_CLIENT_PASSWORD / CABINET_AGENCY_PASSWORD — the short form, when there is one account of
 *     each kind (emails default to CABINET_CLIENT_EMAIL / CABINET_AGENCY_EMAIL).
 *   EDIT_KEY — unchanged; it is now returned to authenticated users instead of being built into the
 *     cabinet.
 *
 * Note what this is not: there is no session store and no expiry — the key the browser receives is the
 * same shared EDIT_KEY the API already trusts. It closes the "anyone can walk in" hole; per-user
 * tokens and revocation belong with the real auth realm.
 */

import { createHash, timingSafeEqual } from "node:crypto";

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

/** Compare without leaking, through timing, how much of the value was right. */
function sameSecret(a, b) {
  const ba = Buffer.from(String(a), "utf8"), bb = Buffer.from(String(b), "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function accounts() {
  const out = [];
  const raw = process.env.CABINET_USERS;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        for (const u of list) {
          if (!u || !u.email) continue;
          out.push({
            email: String(u.email),
            name: String(u.name || u.email),
            role: u.role === "agency" ? "agency" : "client",
            tenantId: u.tenantId ? String(u.tenantId) : undefined,
            sha256: u.sha256 ? String(u.sha256).toLowerCase() : u.password ? sha256(u.password) : "",
          });
        }
      }
    } catch { /* a malformed list must not lock everyone out of the short form below */ }
  }
  const short = [
    ["client", process.env.CABINET_CLIENT_PASSWORD, process.env.CABINET_CLIENT_EMAIL, process.env.CABINET_CLIENT_NAME, process.env.CABINET_CLIENT_TENANT],
    ["agency", process.env.CABINET_AGENCY_PASSWORD, process.env.CABINET_AGENCY_EMAIL, process.env.CABINET_AGENCY_NAME, undefined],
  ];
  for (const [role, pw, email, name, tenant] of short) {
    if (!pw || !email) continue;
    if (out.some((a) => a.email.toLowerCase() === String(email).toLowerCase())) continue;
    out.push({
      email: String(email),
      name: String(name || email),
      role,
      tenantId: tenant ? String(tenant) : role === "client" ? "allclean" : undefined,
      sha256: sha256(pw),
    });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Введите email и пароль" });

  const users = accounts();
  if (!users.length) {
    // Nothing configured: say so plainly rather than letting anyone in or claiming "wrong password".
    return res.status(503).json({ error: "Вход ещё не настроен на сервере (CABINET_USERS)." });
  }

  const user = users.find((u) => u.email.toLowerCase() === email);
  const given = sha256(password);
  // Always compare against something, so a missing account and a wrong password take the same path.
  const expected = user?.sha256 || sha256(`no-such-user:${email}`);
  const ok = Boolean(user) && sameSecret(given, expected);
  // A small constant delay blunts online guessing; serverless has nowhere to keep a rate-limit counter.
  await new Promise((r) => setTimeout(r, 250));
  if (!ok) return res.status(401).json({ error: "Неверный email или пароль" });

  return res.status(200).json({
    ok: true,
    session: {
      userId: sha256(user.email).slice(0, 12),
      name: user.name,
      email: user.email,
      role: user.role,
      ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    },
    // What lets this browser publish. It is handed out only after a correct password.
    editKey: process.env.EDIT_KEY || "",
  });
}
