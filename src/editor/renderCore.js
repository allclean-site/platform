/**
 * RENDER CORE — the single source of truth for turning a page + its edits into HTML.
 *
 * This used to exist in THREE hand-synced copies: the TS export path (exportSite.ts), the editor's
 * in-iframe runtime (editRuntime.ts, as a string), and the publisher (scripts/build-site.mjs, a Node
 * port). Any fix had to be applied three times, and whichever copy was forgotten produced exactly the
 * bug class this project kept hitting: the editor showing one thing and the published site another.
 *
 * Now all three consume THIS file:
 *   · exportSite.ts        — typed wrapper (editor «Просмотр» + the publish package)
 *   · scripts/build-site.mjs — imports it directly (what actually builds allclean.md)
 *   · editRuntime.ts       — injects these functions into the iframe runtime by source, so the live
 *                            editing canvas generates byte-identical CSS to the published page.
 *
 * Plain ESM JavaScript on purpose: Node (the publisher) and Vite (the app) can both load it as-is.
 * Types live next to it in renderCore.d.ts, so TypeScript callers keep full type safety.
 */

export const MQ = { tablet: "(max-width: 991px)", mobile: "(max-width: 479px)" };

/** Inheritable text props are also forced onto descendants so nested-span headings actually restyle. */
export const CASCADE = {
  "color": 1, "font-size": 1, "font-weight": 1, "line-height": 1, "letter-spacing": 1,
  "text-align": 1, "font-style": 1, "text-transform": 1, "text-decoration": 1, "font-family": 1,
};

/**
 * Fluid desktop type. A client picks a font size while looking at ONE canvas width; a flat `px`
 * then applies unchanged from a laptop to a 4K screen and overflows the narrow end (this is what
 * broke the live hero). We emit the chosen size as the size at a WIDE screen and let it scale down.
 */
export function fluidFont(v) {
  const m = /^(\d+(?:\.\d+)?)px$/.exec(v);
  if (!m) return v;
  const V = parseFloat(m[1]);
  if (V <= 28) return v;                             // small text: leave as-is
  let F = Math.round(V * 0.62); if (F < 16) F = 16;  // floor ~62% (≈ the tablet size) at 992px
  const slope = (V - F) / 736;                       // interpolate 992px → 1728px
  const a = Math.round((F - slope * 992) * 100) / 100;
  const b = Math.round(slope * 100 * 100) / 100;
  return `clamp(${F}px, calc(${a}px + ${b}vw), ${V}px)`;
}

/**
 * A link the client typed, made safe to publish.
 *
 * The URL field and the link popover take free text and the result is written straight into the live
 * page, so `javascript:` (or `data:`, or `vbscript:`) would ship as stored XSS on the client's own
 * site — running for every visitor. Anything that is not a known navigation scheme becomes "#": the
 * link stays where it is and simply goes nowhere, which is visible and fixable, unlike a silent drop.
 *
 * Control characters are stripped before the check because `java&#9;script:` still executes.
 */
export function safeHref(v) {
  const s = String(v == null ? "" : v);
  const probe = s.replace(/[\u0000-\u0020\u007F-\u00A0]/g, "").toLowerCase();
  if (!probe) return s;                                     // empty href: nothing to exploit
  if (!/^[a-z][a-z0-9+.-]*:/.test(probe)) return s;         // relative path, /path, #anchor, ?query
  return /^(?:https?|mailto|tel|sms|callto|viber|whatsapp|geo):/.test(probe) ? s : "#";
}

/**
 * Strip editor-only attributes from a block's HTML. `keepIds` = the data-lg-id values still needed as
 * `@media` selector hooks (kept); every other data-lg-id is removed.
 *
 * Invariant: on an UNEDITED block this is a no-op byte-for-byte — every pattern only matches markup
 * the editor itself injected, which never appears in the original Webflow output.
 */
export function cleanHtml(html, keepIds) {
  return html
    // Defence in depth: whatever is already stored (or arrives from another editor) is neutralised on
    // its way out, so a build can never publish an executable link. A safe href is returned byte-for-
    // byte, keeping the unedited-mirror invariant.
    .replace(/(<a\b[^>]*?\shref=)(["'])([^"']*)\2/gi, (m, pre, q, url) => {
      const safe = safeHref(url);
      return safe === url ? m : pre + q + safe + q;
    })
    // The editor iframe serves assets under /site-assets/*; an older save path stored that preview
    // prefix into the block (gaining one more on every save) and published a url nothing serves —
    // a 404'd hero video showing as a white box. Collapsing it here means every build self-heals,
    // whatever is already saved in the database.
    .replace(/(?:\/site-assets)+\/(images|video|fonts|js)\//g, "/$1/")
    .replace(/(?:\/site-assets)+\/logo\.svg/g, "/logo.svg")
    .replace(/\s+contenteditable="true"/g, "")
    .replace(/\s+spellcheck="false"/g, "")
    .replace(/\s+data-lg-el="[^"]*"/g, "")
    // the stashed "original inline style" used by the element reset — editor bookkeeping, never shipped
    .replace(/\s+data-lg-style0="[^"]*"/g, "")
    .replace(/\s+data-lg-id="([^"]*)"/g, (m, id) => (keepIds && keepIds.has(id) ? m : ""))
    // Only touch class attributes that actually carry the transient selection class → unedited markup
    // (and its exact whitespace) stays byte-identical.
    .replace(/\sclass="([^"]*lg-selected[^"]*)"/g, (_m, val) => {
      const cls = val.split(/\s+/).filter((c) => c && c !== "lg-selected");
      return cls.length ? ` class="${cls.join(" ")}"` : "";
    });
}

/**
 * Build the CSS for a page's override layers.
 *
 * Order matters and encodes hard-won rules:
 *  · `:not(#lgcmsx)` lifts every selector to ID-level specificity so our rules beat Webflow's own
 *    class-based `!important` responsive rules (without it, mobile edits silently lose).
 *  · the `base` layer is a STYLESHEET rule (`[data-lg-id] *`), never inline `!important`, because
 *    inline `!important` can never be overridden by a later `@media` rule.
 *  · base is emitted BEFORE the media blocks so tablet/mobile win at their widths by source order.
 *  · a phone/tablet `width` is capped with `min(…,100vw)` so a stale wide value can't overflow the
 *    device screen (100vw, not 100%, so a box can still grow past its parent like it does on desktop).
 */
/**
 * Style values reach us from free-text fields in the inspector and are concatenated straight into a
 * stylesheet, so a value containing `}` could close our rule and inject arbitrary CSS into the
 * PUBLISHED page. Values are simple by nature (a length, a colour, a keyword) — anything carrying
 * CSS syntax or a URL is dropped rather than sanitised, so nothing surprising can survive.
 */
export function safeValue(v) {
  const s = String(v);
  if (/[{}<>;@\\]/.test(s)) return "";                  // CSS syntax that could escape our rule
  if (/url\s*\(|expression\s*\(|\/\*/i.test(s)) return "";  // outbound requests / comment tricks
  return s;
}

export function overridesCss(pageBp) {
  if (!pageBp) return "";
  let css = "";
  const B = ":not(#lgcmsx)";
  // Hover + active first (base pseudo-states, no media query).
  for (const [layer, sel] of [["hover", ":hover"], ["active", ":active"]]) {
    const els = pageBp[layer] || {};
    for (const id of Object.keys(els)) {
      const props = els[id];
      let decl = "";
      for (const p of Object.keys(props)) { const sv = safeValue(props[p]); if (sv) decl += `${p}:${sv} !important;`; }
      if (decl) css += `[data-lg-id="${id}"]${B}${sel}{${decl}}`;
    }
  }
  // Base desktop cascade (no media query) → forces inheritable props onto nested spans at all widths.
  const baseLayer = pageBp.base || {};
  for (const id of Object.keys(baseLayer)) {
    const props = baseLayer[id];
    let bdecl = "";
    for (const p of Object.keys(props)) {
      if (props[p] === "") continue;
      const sv = safeValue(props[p]); if (!sv) continue;
      bdecl += `${p}:${p === "font-size" ? fluidFont(sv) : sv} !important;`;
    }
    // Target the element ITSELF as well as its descendants. A desktop edit also writes a flat inline
    // px value on the element; a stylesheet `!important` rule beats that non-important inline, so a
    // plain <h2> scales fluidly too — not just split-text headings whose visible text sits in children.
    if (bdecl) css += `[data-lg-id="${id}"]${B},[data-lg-id="${id}"] *${B}{${bdecl}}`;
  }
  for (const dev of ["tablet", "mobile"]) {
    const elems = pageBp[dev] || {};
    let body = "";
    for (const id of Object.keys(elems)) {
      const props = elems[id];
      let decl = "", cdecl = "";
      for (const p of Object.keys(props)) {
        if (props[p] === "") continue;
        const sv = safeValue(props[p]); if (!sv) continue;
        const v = p === "width" && /px$/.test(sv) ? `min(${sv},100vw)` : sv;
        decl += `${p}:${v} !important;`;
        if (CASCADE[p]) cdecl += `${p}:${sv} !important;`;
      }
      if (decl) body += `[data-lg-id="${id}"]${B}{${decl}}`;
      if (cdecl) body += `[data-lg-id="${id}"] *${B}{${cdecl}}`;
    }
    if (body) css += `@media ${MQ[dev]}{${body}}`;
  }
  return css;
}

/** Ids referenced by any override rule → they keep their data-lg-id on export. */
export function keptIds(pageBp) {
  const s = new Set();
  if (pageBp) for (const d of ["base", "tablet", "mobile", "hover", "active"]) {
    Object.keys(pageBp[d] || {}).forEach((id) => s.add(id));
  }
  return s;
}

/** Apply a page's content overrides onto its blocks (returns copies; `""` = the block was removed). */
export function applyOverrides(blocks, overrides) {
  if (!overrides) return blocks;
  return blocks.map((b) => (overrides[b.id] != null ? { ...b, content: { ...b.content, html: overrides[b.id] } } : b));
}

/**
 * Reassemble an imported page into a full HTML document. With unedited blocks this reproduces the
 * mirrored live site byte-for-byte; the structural pieces around the blocks are kept verbatim.
 */
export function reassemble(p) {
  if (!p.wrapped) {
    return p.prefix + p.blocks.map((b) => b.content.html).join("") + p.suffix;
  }
  const header = p.blocks.find((b) => b.content.region === "header")?.content.html ?? "";
  const footer = p.blocks.find((b) => b.content.region === "footer")?.content.html ?? "";
  const mains = p.blocks.filter((b) => b.content.region === "main").map((b) => b.content.html).join("");
  const body =
    p.bodyPrefix + p.pwOpen + header + p.mainOpen + mains + p.mainClose + footer + p.pwClose + p.tailScripts;
  return p.prefix + body + p.suffix;
}

/** The final published HTML for one page — what the editor previews AND what the publisher writes. */
export function exportPageHtml(page, overrides, pageBp) {
  const keep = keptIds(pageBp);
  const withOv = overrides ? applyOverrides(page.blocks, overrides) : page.blocks;
  const blocks = withOv.map((b) => ({ ...b, content: { ...b.content, html: cleanHtml(b.content.html, keep) } }));
  let doc = reassemble({ ...page, blocks });
  const css = overridesCss(pageBp);
  if (css) {
    // id "lgcms-overrides" avoids colliding with allclean's own <style id="lg-overrides">.
    const tag = `<style id="lgcms-overrides">${css}</style>`;
    doc = doc.includes("</head>") ? doc.replace("</head>", `${tag}</head>`) : doc.replace(/<body/, `${tag}<body`);
  }
  return doc;
}
