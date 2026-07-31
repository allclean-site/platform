/**
 * Shared regions — the header and the footer.
 *
 * The imported site carries its own copy of the header and footer inside EVERY page, and overrides are
 * stored per page. So editing the phone number in the header changed it on the page you were looking
 * at and nowhere else: the client published, and 37 pages kept the old number with nothing anywhere
 * warning them. That is the worst shape a bug can take — silent, and live.
 *
 * Copying the edited block's HTML to the other pages would be wrong too. Those copies are not
 * identical: on the AllClean mirror the header differs per page in the language-toggle href
 * (/ru vs /ru/about/) and in the alt text of the menu images, and the footer differs in structure
 * between article and service pages. A blind copy would send every page's language switch to the same
 * URL and wipe the per-page alts.
 *
 * So a shared edit is stored as a PATCH — the elements that actually changed, located by structural
 * path — and applied to each page's own copy. Everything the client did not touch stays as it was on
 * that page.
 *
 * Browser-only (uses DOMParser): the editor resolves patches when it renders a page, and the publish
 * dialog — which already loads every page — expands them into ordinary per-page HTML, so the server
 * and the static build keep working with exactly the format they already understand.
 */

export const SHARED_REGIONS = ["header", "footer"] as const;
export type SharedRegion = (typeof SHARED_REGIONS)[number];

export function isSharedRegion(region: string | undefined): region is SharedRegion {
  return region === "header" || region === "footer";
}

/** Pseudo page id for the shared layer. Rides the existing pageId→blockId→string store unchanged. */
export function sharedKey(lang: string): string {
  return `__shared:${lang}`;
}
export function isSharedKey(pageId: string): boolean {
  return pageId.startsWith("__shared:");
}
export function langOfSharedKey(pageId: string): string {
  return pageId.slice("__shared:".length);
}

/** One element that changed, plus enough to find it again in another page's copy. */
export interface ElemPatch {
  /** Structural path from the block root: tag.class:nth of every ancestor. */
  path: string;
  /** Pre-order position in the source tree — the fast path, always verified against `path`. */
  index: number;
  /** Attribute value, or null when the attribute was removed. */
  attrs?: Record<string, string | null>;
  /** Replacement innerHTML (the element's own content changed). */
  html?: string;
  /** Replacement values for the element's DIRECT text nodes, in order (used when it also has
   *  element children, so their per-page contents are left alone). */
  text?: string[];
}

/** Attributes the editor adds for its own use — never part of what the client changed. */
const SKIP_ATTRS = new Set(["data-lg-id", "data-lg-el", "data-lg-style0", "contenteditable", "spellcheck"]);
/** Transient editor classes that must not read as a change. */
const TRANSIENT_CLASS = /\b(lg-selected|lg-dragging)\b/g;

function parseBlock(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<div id="lg-shared-root">${html}</div>`, "text/html");
  return doc.getElementById("lg-shared-root") as HTMLElement;
}

function normClass(v: string | null): string | null {
  if (v == null) return null;
  return v.replace(TRANSIENT_CLASS, "").replace(/\s+/g, " ").trim();
}

function firstClass(el: Element): string {
  return (normClass(el.getAttribute("class")) || "").split(" ").filter(Boolean)[0] || "";
}

/**
 * One step of an element's path. The sibling index counts only siblings of the SAME tag AND class:
 * counting every same-tag sibling made the step depend on unrelated neighbours, and article pages
 * carry extra <section>s inside the footer — so the footer itself came out as `section.footer:0` on
 * one page and `section.footer:2` on another, and a footer edit landed nowhere.
 */
function step(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const cls = firstClass(el);
  let i = 0;
  for (let sib = el.previousElementSibling; sib; sib = sib.previousElementSibling) {
    if (sib.tagName === el.tagName && firstClass(sib) === cls) i++;
  }
  return `${tag}${cls ? "." + cls : ""}:${i}`;
}

function pathOf(el: Element, root: Element): string {
  const parts: string[] = [];
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) parts.unshift(step(n));
  return parts.join("|");
}

/** Values of the element's DIRECT text-node children, in order. */
function ownText(el: Element): string[] {
  const out: string[] = [];
  for (const n of Array.from(el.childNodes)) if (n.nodeType === 3) out.push(n.nodeValue ?? "");
  return out;
}

function diffAttrs(b: Element, c: Element): Record<string, string | null> | undefined {
  const out: Record<string, string | null> = {};
  const names = new Set([...b.getAttributeNames(), ...c.getAttributeNames()].filter((n) => !SKIP_ATTRS.has(n)));
  for (const n of names) {
    const bv = n === "class" ? normClass(b.getAttribute(n)) : b.getAttribute(n);
    const cv = n === "class" ? normClass(c.getAttribute(n)) : c.getAttribute(n);
    if (bv === cv) continue;
    out[n] = cv;   // null = the client removed it
  }
  return Object.keys(out).length ? out : undefined;
}

function collect(root: Element, out: Element[]): void {
  out.push(root);
  for (const ch of Array.from(root.children)) collect(ch, out);
}

/**
 * What changed between a page's pristine block and the edited one.
 * Returns null when the two cannot be compared at all (different root shape) — the caller then falls
 * back to storing the edit for this page only, and says so.
 */
export function diffPatches(baseHtml: string, editedHtml: string): ElemPatch[] | null {
  let base: HTMLElement, cur: HTMLElement;
  try {
    base = parseBlock(baseHtml);
    cur = parseBlock(editedHtml);
  } catch {
    return null;
  }
  if (base.children.length !== cur.children.length) return null;

  const patches: ElemPatch[] = [];
  const counter = { n: 0 };

  const walk = (b: Element, c: Element): void => {
    const index = counter.n++;
    const attrs = b === base ? undefined : diffAttrs(b, c);
    const path = pathOf(b, base);
    const bKids = Array.from(b.children), cKids = Array.from(c.children);
    const sameShape = bKids.length === cKids.length && bKids.every((k, i) => k.tagName === cKids[i].tagName);

    if (!sameShape) {
      // The client changed the structure here (added a line, bolded part of a sentence). Replace this
      // subtree and stop — nothing below it can be located reliably any more.
      patches.push({ path, index, html: c.innerHTML, ...(attrs ? { attrs } : {}) });
      return;
    }

    const bt = ownText(b), ct = ownText(c);
    const textChanged = bt.length !== ct.length || bt.some((t, i) => t !== ct[i]);
    if (textChanged) {
      // A leaf's text is its whole content; deeper down, replace only the text nodes so the element
      // children (which may hold per-page hrefs and alts) are left exactly as that page has them.
      if (!bKids.length) patches.push({ path, index, html: c.innerHTML, ...(attrs ? { attrs } : {}) });
      else patches.push({ path, index, text: ct, ...(attrs ? { attrs } : {}) });
    } else if (attrs) {
      patches.push({ path, index, attrs });
    }
    for (let i = 0; i < bKids.length; i++) walk(bKids[i], cKids[i]);
  };

  walk(base, cur);
  return patches;
}

/** The single element matching the predicate, or null when there are none or several — a patch is
 *  never applied to a guess. */
function unique(paths: string[], all: Element[], match: (path: string) => boolean): Element | null {
  let found: Element | null = null;
  for (let i = 0; i < paths.length; i++) {
    if (!match(paths[i])) continue;
    if (found) return null;
    found = all[i];
  }
  return found;
}

export interface ApplyResult {
  html: string;
  /** Patches that could not be placed on this page — reported, never applied to a guess. */
  missed: number;
}

/** Apply a shared edit to one page's own copy of the block. */
export function applyPatches(baseHtml: string, patches: ElemPatch[]): ApplyResult {
  if (!patches.length) return { html: baseHtml, missed: 0 };
  let root: HTMLElement;
  try {
    root = parseBlock(baseHtml);
  } catch {
    return { html: baseHtml, missed: patches.length };
  }
  const all: Element[] = [];
  collect(root, all);
  const paths = all.map((el) => pathOf(el, root));
  let missed = 0;

  for (const p of patches) {
    let el: Element | null = paths[p.index] === p.path ? all[p.index] : null;
    if (!el) el = unique(paths, all, (path) => path === p.path);
    if (!el) {
      // The page's own copy differs somewhere ABOVE the edited element (article pages wrap the footer
      // differently). Walk in from the element itself: the longest tail of the path that identifies
      // exactly one element here is the same element, without guessing.
      const parts = p.path.split("|");
      for (let k = 1; k < parts.length && !el; k++) {
        const tail = parts.slice(k).join("|");
        el = unique(paths, all, (path) => path === tail || path.endsWith("|" + tail));
      }
    }
    if (!el) { missed++; continue; }
    if (p.attrs) {
      for (const [name, value] of Object.entries(p.attrs)) {
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
      }
    }
    if (p.text) {
      const nodes = Array.from(el.childNodes).filter((n) => n.nodeType === 3);
      if (nodes.length !== p.text.length) { missed++; continue; }
      nodes.forEach((n, i) => { n.nodeValue = p.text![i]; });
    }
    if (p.html != null) el.innerHTML = p.html;
  }
  return { html: root.innerHTML, missed };
}

/* ---- storage form -------------------------------------------------------------------------------
 * The override store maps pageId → blockId → string, and every layer (localStorage, the shared draft
 * row, the published row, the undo snapshot) moves those strings around without looking inside. A
 * shared edit is therefore stored as a string too, tagged so it can never be mistaken for HTML.
 */

const TAG = "lgshared:1:";

export function encodePatches(patches: ElemPatch[]): string {
  return TAG + JSON.stringify(patches);
}
export function isPatchValue(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(TAG);
}
export function decodePatches(value: string): ElemPatch[] | null {
  if (!isPatchValue(value)) return null;
  try {
    const p = JSON.parse(value.slice(TAG.length));
    return Array.isArray(p) ? (p as ElemPatch[]) : null;
  } catch {
    return null;
  }
}

/** Resolve a stored value for one page: patches → that page's own HTML, plain HTML → unchanged. */
export function resolveShared(baseHtml: string, stored: string): ApplyResult {
  const patches = decodePatches(stored);
  if (!patches) return { html: stored, missed: 0 };
  return applyPatches(baseHtml, patches);
}
