/**
 * Auth store — session model + a local-demo authenticator.
 *
 * Roles: "agency" = our staff (see the agency console, can enter any client's cabinet);
 *        "client" = a single tenant editing their own site.
 *
 * This is a MOCK adapter for development: accounts live in-file and "passwords" are demo-only. The real
 * backend is Supabase Auth — swap `signIn` for a Supabase call and derive role/tenant from a `members`
 * table when the realm is chosen (see memory: master-registry projects table). Everything above this
 * module (context, Login, console, shell) is realm-agnostic, so only this file changes.
 */

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

/** Demo accounts. Passwords are placeholders for the mock — real auth uses Supabase. */
const DEMO: DemoAccount[] = [
  { userId: "a1", name: "Sergiu", email: "dev@leadgenium.pro", role: "agency", password: "agency" },
  { userId: "c1", name: "AllClean", email: "info@allclean.md", role: "client", tenantId: "allclean", password: "client" },
];

const KEY = "leadgenium:session";
const LEGACY_GATE = "leadgenium:auth"; // old shared-password flag

/** Public demo hints shown on the Login screen (never the real password once Supabase is wired). */
export const DEMO_HINTS = [
  { role: "agency" as Role, label: "Сотрудник агентства", email: "dev@leadgenium.pro", password: "agency" },
  { role: "client" as Role, label: "Клиент (AllClean)", email: "info@allclean.md", password: "client" },
];

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
}

export interface SignInResult {
  ok: boolean;
  session?: Session;
  error?: string;
}

/** Local-demo authenticator. Replace with a Supabase Auth call when the realm is chosen. */
export function signIn(email: string, password: string): SignInResult {
  const acc = DEMO.find((d) => d.email.toLowerCase() === email.trim().toLowerCase());
  if (!acc || acc.password !== password) {
    return { ok: false, error: "Неверный email или пароль" };
  }
  const s = stripPw(acc);
  setSession(s);
  return { ok: true, session: s };
}
