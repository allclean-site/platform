/**
 * Minimal, safe Markdown → HTML for article bodies.
 *
 * Deliberately small (no dependency): headings, bold/italic, links, inline code,
 * unordered/ordered lists, blockquotes and paragraphs. Everything is HTML-escaped
 * BEFORE inline syntax is applied, so authored text can never inject markup — the
 * exported article stays clean and indexable.
 */

// Один разборщик на кабинет и сборку сайта (scripts/build-site.mjs импортирует этот файл): у сборки
// был свой, и «цитата» из редактора выходила на сайт строкой «> текст», а строки абзаца — отдельными
// абзацами. Поэтому файл на чистом JS (как renderCore.js), типы — в markdown.d.ts.
const ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPE[c]);

/** Inline formatting on already-escaped text. Order matters (code before emphasis). */
function inline(text) {
  return text
    // `code`
    .replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`)
    // [label](href) — only http(s), mailto, tel, relative (/…, #…) to avoid javascript: URLs
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const safe = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href) ? href : "#";
      const ext = /^https?:/i.test(safe) ? ` target="_blank" rel="noopener"` : "";
      return `<a href="${safe}"${ext}>${label}</a>`;
    })
    // **bold**
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // *italic* (avoid matching bold leftovers)
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
}

export function markdownToHtml(md) {
  const lines = (md || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let i = 0;

  const flushList = (tag, items) =>
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
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote><p>${inline(esc(buf.join(" ")))}</p></blockquote>`);
      continue;
    }

    // table: | a | b |, then |---|---|, then rows. Ответ «таблицей» — то, что цитируют ответы поиска.
    if (/^\|.*\|\s*$/.test(line.trim()) && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test((lines[i + 1] || "").trim())) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(esc(c.trim())));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i].trim())) { rows.push(cells(lines[i])); i++; }
      out.push(`<table><thead><tr>${head.map((c) => `<th>${c}</th>`).join("")}</tr></thead>` +
        `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }

    // unordered list
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, "")); i++; }
      flushList("ul", items);
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, "")); i++; }
      flushList("ol", items);
      continue;
    }

    // paragraph (gather until blank / block start)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{2,4}\s|>|[-*]\s|\d+\.\s|!\[|\|)/.test(lines[i].trim()) &&
      !/^(---|\*\*\*|___)$/.test(lines[i].trim())
    ) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(esc(buf.join(" ")))}</p>`);
  }

  return out.join("\n");
}

// ---- тело, уже написанное HTML (старые статьи) ---------------------------------------------------
// Раньше такое тело уходило на сайт как есть (аудит QA, A7): <script>, onerror=, javascript: в ссылке.
// Оставляем список безопасных тегов и атрибутов, значения атрибутов экранируем заново, ссылки —
// только http(s), mailto, tel и относительные.
const ALLOWED = {
  p: [], br: [], hr: [], h2: [], h3: [], h4: [], ul: [], ol: [], li: [], blockquote: [], strong: [], b: [], em: [], i: [],
  code: [], span: [], div: [], figure: [], figcaption: [], table: [], thead: [], tbody: [], tr: [],
  th: ["colspan", "rowspan"], td: ["colspan", "rowspan"], a: ["href", "title"], img: ["src", "alt", "width", "height", "loading"],
};
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|template|noscript|svg|math|form|textarea|select)\b[\s\S]*?<\/\1\s*>/gi;
// Ссылка: http(s), mailto, tel или относительная (без «:» и не «//чужой-домен»).
const safeHref = (u) => /^(https?:\/\/|mailto:|tel:)/i.test(u) || (!u.includes(":") && !u.startsWith("//"));
const safeSrc = (u) => /^https?:\/\//i.test(u) || (u.startsWith("/") && !u.startsWith("//"));

export function sanitizeArticleHtml(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROP_WITH_CONTENT, "")
    // Атрибуты в кавычках могут содержать «>»: тег заканчивается только вне кавычек.
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>|<|>/g, (whole, tag, attrs) => {
      if (!tag) return whole === "<" ? "&lt;" : "&gt;";
      const name = tag.toLowerCase();
      if (!ALLOWED[name]) return "";
      if (whole.startsWith("</")) return `</${name}>`;
      const keep = [];
      for (const m of String(attrs || "").matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
        const attr = m[1].toLowerCase();
        if (!ALLOWED[name].includes(attr)) continue;
        // Сущности в значении раскрываем, иначе «javascript&#58;» прошёл бы мимо проверки схемы.
        const raw = (m[3] ?? m[4] ?? m[5] ?? "").replace(/&#(x[0-9a-f]+|\d+);?/gi, (_e, n) =>
          String.fromCodePoint(n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n)))
          .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/[\u0000-\u001f\s]+/g, (s) => (attr === "href" || attr === "src" ? "" : " "));
        if (attr === "href" && !safeHref(raw)) continue;
        if (attr === "src" && !safeSrc(raw)) continue;
        keep.push(`${attr}="${esc(raw)}"`);
      }
      if (name === "img" && !keep.some((k) => k.startsWith("src="))) return "";
      if (name === "a" && keep.some((k) => /^href="https?:/i.test(k))) keep.push('target="_blank"', 'rel="noopener"');
      return `<${name}${keep.length ? " " + keep.join(" ") : ""}>`;
    });
}

/** Plain-text of a Markdown body (for excerpts / meta descriptions). */
export function markdownToText(md) {
  return (md || "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
