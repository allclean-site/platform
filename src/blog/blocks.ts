/**
 * Block model for the article editor + lossless conversion to/from Markdown.
 *
 * The article `body` stays Markdown (so translate + publish + the static build keep working unchanged).
 * The editor works on a friendlier block list; we serialize back to Markdown on every change. Supported
 * blocks map 1:1 to what both Markdown renderers (engine/blog/markdown.ts and scripts/build-site.mjs)
 * can render — including inline images as `![caption](url)`.
 */

export type BlockType = "p" | "h2" | "h3" | "ul" | "ol" | "quote" | "img" | "hr";

export interface Block {
  id: string;
  type: BlockType;
  /** Inline-Markdown text for p/h2/h3/quote. */
  text?: string;
  /** Items (inline-Markdown) for ul/ol. */
  items?: string[];
  /** Image source for img. */
  url?: string;
  /** Image caption — also used as alt (SEO). */
  alt?: string;
}

let counter = 0;
export const blockId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newBlock(type: BlockType): Block {
  if (type === "ul" || type === "ol") return { id: blockId(), type, items: [""] };
  if (type === "img") return { id: blockId(), type, url: "", alt: "" };
  if (type === "hr") return { id: blockId(), type };
  return { id: blockId(), type, text: "" };
}

/* ---------------- inline Markdown ⇄ HTML (bold / italic / link) ---------------- */

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline Markdown → HTML for display inside a contentEditable block. */
export function inlineMdToHtml(md: string): string {
  if (!md) return "";
  return escHtml(md)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, t, u) => {
      const safe = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u) ? u : "#";
      return `<a href="${safe}">${t}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

/** contentEditable HTML → inline Markdown (walks the DOM so execCommand output is handled reliably). */
export function htmlToInlineMd(html: string): string {
  const root = document.createElement("div");
  root.innerHTML = html;
  const walk = (node: Node): string => {
    let out = "";
    node.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) { out += n.textContent || ""; return; }
      if (n.nodeType !== Node.ELEMENT_NODE) return;
      const el = n as HTMLElement;
      const tag = el.nodeName.toLowerCase();
      const inner = walk(el);
      if (tag === "br") { out += "\n"; return; }
      if (!inner.trim() && tag !== "br") { out += inner; return; }
      if (tag === "b" || tag === "strong") out += `**${inner}**`;
      else if (tag === "i" || tag === "em") out += `*${inner}*`;
      else if (tag === "a") { const href = el.getAttribute("href") || ""; out += href ? `[${inner}](${href})` : inner; }
      else out += inner;
    });
    return out;
  };
  return walk(root).replace(/ /g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

/* ---------------- block list ⇄ Markdown ---------------- */

export function blocksToMd(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h2": parts.push(`## ${(b.text || "").trim()}`); break;
      case "h3": parts.push(`### ${(b.text || "").trim()}`); break;
      case "quote": parts.push((b.text || "").split("\n").map((l) => `> ${l}`).join("\n")); break;
      case "ul": parts.push((b.items || []).filter((i) => i.trim()).map((i) => `- ${i}`).join("\n")); break;
      case "ol": parts.push((b.items || []).filter((i) => i.trim()).map((i, n) => `${n + 1}. ${i}`).join("\n")); break;
      case "img": if (b.url) parts.push(`![${(b.alt || "").replace(/[\[\]]/g, "")}](${b.url})`); break;
      case "hr": parts.push("---"); break;
      default: parts.push((b.text || "").trim());
    }
  }
  return parts.filter((p) => p !== "").join("\n\n");
}

const IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

export function mdToBlocks(md: string): Block[] {
  const lines = (md || "").replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  const push = (b: Omit<Block, "id">) => out.push({ id: blockId(), ...b });

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }

    let m: RegExpExecArray | null;
    if ((m = IMG_RE.exec(t))) { push({ type: "img", url: m[2], alt: m[1] }); i++; continue; }
    if (/^(---|\*\*\*|___)$/.test(t)) { push({ type: "hr" }); i++; continue; }
    if ((m = /^(#{2,4})\s+(.*)$/.exec(t))) { push({ type: m[1].length >= 3 ? "h3" : "h2", text: m[2].trim() }); i++; continue; }
    if (/^>\s?/.test(t)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      push({ type: "quote", text: buf.join("\n") });
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, "")); i++; }
      push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, "")); i++; }
      push({ type: "ol", items });
      continue;
    }
    // paragraph: gather until blank / block start
    const buf: string[] = [t];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{2,4}\s|>|[-*]\s|\d+\.\s|!\[|---$|\*\*\*$|___$)/.test(lines[i].trim())) {
      buf.push(lines[i].trim()); i++;
    }
    push({ type: "p", text: buf.join(" ") });
  }

  return out.length ? out : [{ id: blockId(), type: "p", text: "" }];
}
