/**
 * Auth store — session model + sign-in.
 *
 * Roles: "agency" = our staff (see the agency console, can enter any client's cabinet);
 *        "client" = a single tenant editing their own site.
 *
 * Sign-in happens on the SERVER (/api/login, credentials in the deployment's environment). It used to
 * happen here, against accounts compiled into the bundle and offered as one-click chips on the login
 * screen — so the deployed cabinet let in anyone who knew its address, with the publish key that also
 * shipped in the bundle. The demo accounts still exist for local development only: `import.meta.env.DEV`
 * decides, so they cannot reach a production build.
 *
 * The edit key now arrives WITH the session, which is what makes an anonymous visitor powerless. Full
 * per-user tokens and revocation come with the real auth realm (Supabase Auth); everything above this
 * module (context, Login, console, shell) stays realm-agnostic.
 */

import { postSiteApi } from "../editor/siteApi";
import { setEditKey, clearEditKey } from "./sessionKey";

export type Role = "agency" | "client";

export interface Session {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** For clients: their own tenant. For agency: unset (they pick a client to enter). */
  tenantId?: string;
}

interface DemoAccount extends Session {
  password: string;
}

/** Local development only — `DEV` is false in every build we ship, so these never reach a real user. */
const DEMO: DemoAccount[] = import.meta.env.DEV
  ? [
      { userId: "a1", name: "Sergiu", email: "dev@leadgenium.pro", role: "agency", password: "agency" },
      { userId: "c1", name: "AllClean", email: "info@allclean.md", role: "client", tenantId: "allclean", password: "client" },
    ]
  : [];

const KEY = "leadgenium:session";
const LEGACY_GATE = "leadgenium:auth"; // old shared-password flag

/** Shown on the Login screen during local development only — never in a shipped build. */
export const DEMO_HINTS = import.meta.env.DEV
  ? [
      { role: "agency" as Role, label: "Сотрудник агентства", email: "dev@leadgenium.pro", password: "agency" },
      { role: "client" as Role, label: "Клиент (AllClean)", email: "info@allclean.md", password: "client" },
    ]
  : [];

function stripPw(a: DemoAccount): Session {
  const { password: _pw, ...s } = a;
  return s;
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Session;
    // Migrate anyone who was let in by the old shared-password gate → a client session (AllClean).
    if (localStorage.getItem(LEGACY_GATE) === "1") {
      const client = DEMO.find((d) => d.role === "client")!;
      const s = stripPw(client);
      setSession(s);
      return s;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_GATE);
  clearEditKey();   // signing out must also take away the right to publish
}

export interface SignInResult {
  ok: boolean;
  session?: Session;
  error?: string;
}

/**
 * Sign in against the server. The response carries the session AND the edit key — that key is what
 * lets this browser publish, and it is handed out only after a correct password.
 *
 * In local development, with no /api/login reachable, the in-file demo accounts stand in.
 */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const r = await postSiteApi<{ session?: Session; editKey?: string }>("login", { email: email.trim(), password });
  if (r.ok && r.data?.session) {
    setEditKey(r.data.editKey || "");
    setSession(r.data.session);
    return { ok: true, session: r.data.session };
  }
  if (r.status === 401 || r.status === 400) return { ok: false, error: r.error || "Неверный email или пароль" };

  if (import.meta.env.DEV) {
    const acc = DEMO.find((d) => d.email.toLowerCase() === email.trim().toLowerCase());
    if (acc && acc.password === password) {
      const s = stripPw(acc);
      setSession(s);
      return { ok: true, session: s };
    }
    return { ok: false, error: "Неверный email или пароль" };
  }
  return {
    ok: false,
    error: r.status === 503
      ? (r.error || "Вход ещё не настроен на сервере.")
      : "Сервер входа недоступен. Проверьте связь и попробуйте ещё раз.",
  };
}
