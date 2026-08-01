/**
 * "Am I looking at the current cabinet?" — answered by the cabinet itself.
 *
 * A client reported the cabinet serving an old version even in a private window; only a different
 * browser helped. Whatever held the stale copy — a proxy on the way, an edge entry, a service worker
 * left over from the previous site — the app cannot see it and cannot purge it. What it CAN do is
 * notice, because the running bundle's file name is a content hash: fetch the entry document with
 * caching switched off, read the hash the server is handing out right now, and compare.
 *
 * Mismatch means this tab is running yesterday's code, which is the failure the client hit. We say so
 * and offer the reload, rather than reloading under someone who is mid-edit.
 *
 * The check costs one ~900-byte request, on load and when the tab regains focus.
 */

const ASSET = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

/** The bundle hash this tab is actually running. */
export function runningVersion(): string {
  const tags = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="/assets/"]'));
  for (const t of tags) {
    const m = ASSET.exec(t.getAttribute("src") || "");
    if (m) return m[0];
  }
  return "";
}

/** The bundle hash the server is serving right now, or "" if it could not be determined. */
export async function servedVersion(): Promise<string> {
  try {
    // The query defeats any cache that ignores the header; `no-store` defeats the ones that don't.
    const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) return "";
    const m = ASSET.exec(await res.text());
    return m ? m[0] : "";
  } catch {
    return "";
  }
}

/**
 * Watch for the cabinet being updated under this tab. Calls `onStale` once, when we are provably
 * behind. Returns an unsubscribe.
 */
export function watchVersion(onStale: () => void): () => void {
  const mine = runningVersion();
  if (!mine) return () => {};                 // dev server: no hashed bundle to compare
  let done = false;
  const check = async () => {
    if (done || document.hidden) return;
    const theirs = await servedVersion();
    if (!theirs || theirs === mine) return;
    done = true;
    onStale();
  };
  void check();
  const onFocus = () => void check();
  window.addEventListener("focus", onFocus);
  const timer = window.setInterval(check, 5 * 60 * 1000);
  return () => { window.removeEventListener("focus", onFocus); window.clearInterval(timer); };
}

/** Short human-readable build id, for the "which version am I on?" line in Настройки. */
export function versionLabel(): string {
  const m = /index-([A-Za-z0-9_-]+)\.js/.exec(runningVersion());
  return m ? m[1] : "dev";
}
