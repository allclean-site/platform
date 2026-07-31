/**
 * The edit key this browser received when its user signed in.
 *
 * Deliberately a leaf module with no imports: both the auth store (which puts the key here after a
 * successful sign-in) and the settings store (which resolves it for every API call) depend on it, and
 * anything shared between those two must not create an import cycle.
 */

const KEY = "leadgenium:editkey";

export function setEditKey(key: string): void {
  try {
    if (key) localStorage.setItem(KEY, key);
    else localStorage.removeItem(KEY);
  } catch { /* private mode: the session simply cannot publish */ }
}

export function getEditKey(): string {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function clearEditKey(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
