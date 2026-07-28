/**
 * Clean export of an imported page — what actually gets PUBLISHED.
 *
 * The editor stamps live-editing attributes onto the DOM (data-lg-id, contenteditable, spellcheck,
 * data-lg-el, the transient `lg-selected` class) and those leak into a block's saved HTML. We DON'T
 * strip them at save time (the runtime needs them to keep editing), so we strip them here, on export.
 *
 * Per-breakpoint edits live separately (bpStore) as generated `@media` rules keyed to data-lg-id, so
 * export must (a) KEEP data-lg-id on the few elements those rules target, and (b) inline the rules as
 * a `<style id="lg-overrides">`. Everything else is stripped.
 *
 * Invariant: on an UNEDITED block this is a no-op byte-for-byte — every pattern below only matches
 * attributes/classes the editor itself injected, which never appear in the original Webflow markup.
 */

import { reassemble, type ImportedPage } from "./reassemble";
import { applyOverrides, type PageOverrides } from "./realStore";
import type { PageBp } from "./bpStore";

const MQ: Record<"tablet" | "mobile", string> = { tablet: "(max-width: 991px)", mobile: "(max-width: 479px)" };
// Inheritable text props are also forced onto descendants so nested-span headings actually restyle.
const CASCADE: Record<string, 1> = { "color": 1, "font-size": 1, "font-weight": 1, "line-height": 1, "letter-spacing": 1, "text-align": 1, "font-style": 1, "text-transform": 1, "text-decoration": 1, "font-family": 1 };

/** Strip editor-only attributes from a block's HTML. `keepIds` = data-lg-id values still needed as
 *  `@media` selector hooks (kept); every other data-lg-id is removed. */
export function cleanHtml(html: string, keepIds?: Set<string>): string {
  return html
    .replace(/\s+contenteditable="true"/g, "")
    .replace(/\s+spellcheck="false"/g, "")
    .replace(/\s+data-lg-el="[^"]*"/g, "")
    .replace(/\s+data-lg-id="([^"]*)"/g, (m, id) => (keepIds && keepIds.has(id) ? m : ""))
    // Only touch class attributes that actually carry the transient selection class → unedited
    // markup (and its exact whitespace) is left byte-identical.
    .replace(/\sclass="([^"]*lg-selected[^"]*)"/g, (_m, val: string) => {
      const cls = val.split(/\s+/).filter((c) => c && c !== "lg-selected");
      return cls.length ? ` class="${cls.join(" ")}"` : "";
    });
}

/** Build the `@media` CSS for a page's breakpoint overrides (empty string when there are none). */
export function overridesCss(pageBp?: PageBp): string {
  if (!pageBp) return "";
  let css = "";
  // Specificity boost (see editRuntime): :not(#lgcmsx) lifts our rules to ID-level so they beat
  // Webflow's class-based !important responsive rules — else mobile @media edits lose and don't apply.
  const B = ":not(#lgcmsx)";
  // Hover + active rules first (base pseudo-states, no media query).
  for (const [layer, sel] of [["hover", ":hover"], ["active", ":active"]] as const) {
    const els = pageBp[layer] || {};
    for (const id of Object.keys(els)) {
      const props = els[id];
      let decl = "";
      for (const p of Object.keys(props)) if (props[p] !== "") decl += `${p}:${props[p]} !important;`;
      if (decl) css += `[data-lg-id="${id}"]${B}${sel}{${decl}}`;
    }
  }
  // Base desktop cascade (no media query): force inheritable props onto nested spans. Emitted BEFORE
  // the @media blocks so tablet/mobile (later source order) override it.
  const baseLayer = pageBp.base || {};
  for (const id of Object.keys(baseLayer)) {
    const props = baseLayer[id];
    let bdecl = "";
    for (const p of Object.keys(props)) if (props[p] !== "") bdecl += `${p}:${props[p]} !important;`;
    if (bdecl) css += `[data-lg-id="${id}"] *${B}{${bdecl}}`;
  }
  (["tablet", "mobile"] as const).forEach((dev) => {
    const elems = pageBp[dev] || {};
    let body = "";
    for (const id of Object.keys(elems)) {
      const props = elems[id];
      let decl = "", cdecl = "";
      for (const p of Object.keys(props)) {
        if (props[p] === "") continue;
        // Cap phone/tablet width to the container so a stale wide value can't overflow the viewport.
        const v = p === "width" && /px$/.test(props[p]) ? `min(${props[p]},100vw)` : props[p];
        decl += `${p}:${v} !important;`;
        if (CASCADE[p]) cdecl += `${p}:${props[p]} !important;`;
      }
      if (decl) body += `[data-lg-id="${id}"]${B}{${decl}}`;
      if (cdecl) body += `[data-lg-id="${id}"] *${B}{${cdecl}}`;
    }
    if (body) css += `@media ${MQ[dev]}{${body}}`;
  });
  return css;
}

/** Ids referenced by any override rule → they keep their data-lg-id on export. */
function keptIds(pageBp?: PageBp): Set<string> {
  const s = new Set<string>();
  if (pageBp) (["base", "tablet", "mobile", "hover", "active"] as const).forEach((d) => Object.keys(pageBp[d] || {}).forEach((id) => s.add(id)));
  return s;
}

/**
 * Produce the final published HTML for one page.
 * @param overrides content overrides to apply (pass undefined if `page.blocks` already have them).
 */
export function exportPageHtml(page: ImportedPage, overrides: PageOverrides | undefined, pageBp?: PageBp): string {
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
