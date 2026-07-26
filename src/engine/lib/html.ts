/** Minimal HTML helpers for the static renderer. Keeps exported markup safe + clean. */

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text for HTML body/attribute contexts. */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

/** Build an attribute string from a map, skipping null/undefined/false values. */
export function attrs(map: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(map)) {
    if (val === null || val === undefined || val === false) continue;
    if (val === true) {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${esc(val)}"`);
  }
  return parts.length ? " " + parts.join(" ") : "";
}
