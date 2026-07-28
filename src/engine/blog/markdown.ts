/**
 * Minimal, safe Markdown → HTML for article bodies.
 *
 * Deliberately small (no dependency): headings, bold/italic, links, inline code,
 * unordered/ordered lists, blockquotes and paragraphs. Everything is HTML-escaped
 * BEFORE inline syntax is applied, so authored text can never inject markup — the
 * exported article stays clean and indexable.
 */

import { esc } from "../lib/html";

/** Inline formatting on already-escaped text. Order matters (code before emphasis). */
function inline(text: string): string {
  return text
    // `code`
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    // [label](href) — only http(s), mailto, tel, relative (/…, #…) to avoid javascript: URLs
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const safe = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href) ? href : "#";
      const ext = /^https?:/i.test(safe) ? ` target="_blank" rel="noopener"` : "";
      return `<a href="${safe}"${ext}>${label}</a>`;
    })
    // **bold**
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // *italic* (avoid matching bold leftovers)
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

export function markdownToHtml(md: string): string {
  const lines = (md || "").replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const flushList = (tag: "ul" | "ol", items: string[]) =>
    out.push(`<${tag}>${items.map((t) => `<li>${inline(esc(t))}</li>`).join("")}</${tag}>`);

  while (i < lines.length) {
    const line = lines[i];

    // blank line
    if (!line.trim()) { i++; continue; }

    // standalone image → figure with caption (caption doubles as alt for SEO)
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(line.trim());
    if (img) {
      const url = /^(https?:\/\/|\/|data:image\/)/i.test(img[2]) ? img[2] : "";
      if (url) {
        const cap = img[1].trim();
        out.push(`<figure class="blog-figure"><img src="${esc(url)}" alt="${esc(cap)}" loading="lazy">${cap ? `<figcaption>${inline(esc(cap))}</figcaption>` : ""}</figure>`);
      }
      i++;
      continue;
    }

    // horizontal rule
    if (/^(---|\*\*\*|___)$/.test(line.trim())) { out.push("<hr>"); i++; continue; }

    // heading (## .. ####)
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length; // ## → h2
      out.push(`<h${level}>${inline(esc(h[2].trim()))}</h${level}>`);
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote><p>${inline(esc(buf.join(" ")))}</p></blockquote>`);
      continue;
    }

    // unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      flushList("ul", items);
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      flushList("ol", items);
      continue;
    }

    // paragraph (gather until blank / block start)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,4}\s|>|[-*]\s|\d+\.\s|!\[)/.test(lines[i].trim()) &&
      !/^(---|\*\*\*|___)$/.test(lines[i].trim())
    ) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(esc(buf.join(" ")))}</p>`);
  }

  return out.join("\n");
}

/** Plain-text of a Markdown body (for excerpts / meta descriptions). */
export function markdownToText(md: string): string {
  return (md || "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
