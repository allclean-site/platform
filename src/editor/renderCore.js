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

/**
 * Repairs for responsive bugs that came WITH the imported site.
 *
 * The site's CSS is baked into every page's head, so there is no stylesheet to patch — and these are
 * not edits a client could make: they are one-line CSS defects in the original markup. Injected on
 * every render, which means the editor's device preview and the published page show the same repair.
 *
 * · .right_home-features — a grid item with the default `min-width:auto` refuses to shrink below its
 *   content, so on a tablet the feature cards kept their desktop width (1020px inside a 770px column)
 *   and ran off the right edge of the screen. Measured on the live page at 834px before and after.
 */
export const SITE_FIXES = "@media screen and (max-width:991px){.right_home-features{min-width:0}}";

/**
 * WYSIWYG repair: legacy CSS that depended on the exact ancestor chain.
 *
 * Seven imported pages still carry a `<style id="lg-overrides">` written by the site's PREVIOUS
 * editor. Every rule in it addresses one element by spelling out the whole path from the page root:
 *
 *   div.page-wrapper:nth-of-type(1) > main.main-wrapper:nth-of-type(1) > section.section_hero-home…
 *
 * Our editor wraps each block in a `<div data-lg-block style="display:contents">` marker. That div is
 * invisible to layout — but NOT to selectors: it sits between `main.main-wrapper` and the section, so
 * every one of those `>` chains stops matching inside the canvas while it keeps matching on the
 * published page. Measured on the home page at 1920px: the hero H1 words render at 88px live and at
 * 60px in the editor, i.e. different line breaks — exactly the "the editor shows one thing, the site
 * another" report.
 *
 * The fix is to make the legacy CSS independent of that one hop: the two combinators the wrapper can
 * ever cross (page-wrapper → block, main-wrapper → block) are relaxed from child to descendant. A
 * descendant match is a superset of the child match, so the published page renders exactly as before;
 * the canvas now matches too. Combinators carry no specificity, so nothing else in the cascade moves.
 *
 * Applied by BOTH render paths (publisher and editing canvas) so they cannot drift apart.
 */
export function relaxLegacyChains(html) {
  if (!html || html.indexOf("lg-overrides") < 0) return html;
  return html
    .split("div.page-wrapper:nth-of-type(1) > ").join("div.page-wrapper:nth-of-type(1) ")
    .split("main.main-wrapper:nth-of-type(1) > ").join("main.main-wrapper:nth-of-type(1) ");
}

/**
 * Video that actually plays — on every page, for every video, whoever put it there.
 *
 * The imported markup carried a one-off inline script on a single section, and it only re-tried on
 * `load`. Anything else — a video the client adds from the gallery, a tab that was in the background
 * while the page loaded, a browser that refuses the first `play()` before any interaction, a mobile
 * Safari that cannot decode the only source on offer — left a still poster frame. This runs on every
 * rendered page instead, and covers all of those:
 *
 *  · the attributes autoplay needs (muted + playsinline + preload) are GUARANTEED, not assumed;
 *  · the source list is repaired from the wrapper's own `data-video-urls` when the page lost a format.
 *    An earlier version of "replace video" wrote the picked url over EVERY <source>, so the hero ended
 *    up offering `hero.webm` twice and the mp4 was gone — invisible in Chrome, a dead video on iOS.
 *    Only a list that is still a subset of the original variants is rebuilt, so a video the client
 *    genuinely swapped is never touched;
 *  · play() is retried when the data arrives, when the tab becomes visible, when the video scrolls
 *    into view, and once on the first user gesture (the only moment a blocking browser will allow it).
 *
 * A video with `controls` is the visitor's to drive and is left alone.
 */
export const VIDEO_BOOT = [
  "(function(){",
  "var Q='video';",
  "function variants(v){var w=v.closest?v.closest('[data-video-urls]'):null;var a=w&&w.getAttribute('data-video-urls');if(!a)return[];var out=[],p=a.split(','),i;for(i=0;i<p.length;i++){var s=p[i].replace(/^\\s+|\\s+$/g,'');if(s)out.push(s);}return out;}",
  "function mime(u){var e=(u.split('?')[0].split('.').pop()||'').toLowerCase();return (e==='mp4'||e==='webm'||e==='ogg')?'video/'+e:'';}",
  "function heal(v){",
  "var list=variants(v);if(!list.length)return false;",
  "var srcs=v.querySelectorAll('source'),cur=[],i;",
  "for(i=0;i<srcs.length;i++){var s=srcs[i].getAttribute('src');if(s)cur.push(s);}",
  "if(!cur.length)return false;",
  "for(i=0;i<cur.length;i++){if(list.indexOf(cur[i])<0)return false;}",
  "var same=cur.length===list.length;if(same){for(i=0;i<list.length;i++){if(cur[i]!==list[i]){same=false;break;}}}",
  "if(same)return false;",
  "for(i=srcs.length-1;i>=0;i--){srcs[i].parentNode.removeChild(srcs[i]);}",
  "for(i=0;i<list.length;i++){var n=document.createElement('source');n.setAttribute('src',list[i]);var m=mime(list[i]);if(m)n.setAttribute('type',m);v.appendChild(n);}",
  "return true;}",
  "function go(v){try{v.muted=true;v.defaultMuted=true;v.playsInline=true;var p=v.play();if(p&&p['catch'])p['catch'](function(){});}catch(e){}}",
  "function each(fn){var v=document.querySelectorAll(Q),i;for(i=0;i<v.length;i++){if(!v[i].hasAttribute('controls'))fn(v[i]);}}",
  "function resume(){each(function(v){if(v.paused&&!document.hidden)go(v);});}",
  "function arm(v){",
  "if(v.getAttribute('data-lg-vboot'))return;v.setAttribute('data-lg-vboot','1');",
  "v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');v.setAttribute('autoplay','');",
  "if(!v.hasAttribute('preload'))v.setAttribute('preload','auto');",
  "if(!v.hasAttribute('loop'))v.setAttribute('loop','');",
  "if(heal(v)){try{v.load();}catch(e){}}",
  "v.addEventListener('canplay',function(){go(v);});",
  "v.addEventListener('loadeddata',function(){go(v);});",
  "v.addEventListener('pause',function(){if(!document.hidden)setTimeout(function(){if(v.paused&&!document.hidden)go(v);},0);});",
  "if(window.IntersectionObserver){try{new IntersectionObserver(function(es){for(var i=0;i<es.length;i++){if(es[i].isIntersecting)go(v);}}).observe(v);}catch(e){}}",
  "go(v);}",
  "function boot(){each(arm);}",
  "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();",
  "window.addEventListener('load',boot);",
  "document.addEventListener('visibilitychange',resume);",
  "document.addEventListener('pointerdown',resume,{once:true});",
  "document.addEventListener('touchstart',resume,{once:true});",
  "document.addEventListener('keydown',resume,{once:true});",
  // A video the client adds while editing must come to life without a reload. Only ADDED nodes are
  // inspected: re-scanning the whole document on every mutation would tax a page full of widgets.
  "if(window.MutationObserver){try{new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++){var n=a[j];if(n.nodeType!==1)continue;if(n.tagName==='VIDEO'){if(!n.hasAttribute('controls'))arm(n);}else if(n.querySelectorAll){var vs=n.querySelectorAll(Q);for(var k=0;k<vs.length;k++){if(!vs[k].hasAttribute('controls'))arm(vs[k]);}}}}}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}}",
  "})();",
].join("");

/** The repairs every rendered page gets: site CSS fixes + the video guarantee. */
export function siteRuntimeTags() {
  return '<style id="lgcms-fixes">' + SITE_FIXES + "</style>" +
    '<script id="lgcms-video">' + VIDEO_BOOT + "</scr" + "ipt>";
}

/** Put those repairs in the page head — same position for the publisher and the editing canvas. */
export function withSiteRuntime(html) {
  const tags = siteRuntimeTags();
  return html.includes("</head>") ? html.replace("</head>", tags + "</head>") : html.replace(/<body/, tags + "<body");
}

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
    // both values: the editor used to write "false" and now writes "true" (the client's copy deserves
    // a spell checker), and neither belongs in the published page — the source site sets neither
    .replace(/\s+spellcheck="(?:false|true)"/g, "")
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
    let self = "", inherited = "";
    for (const p of Object.keys(props)) {
      if (props[p] === "") continue;
      const sv = safeValue(props[p]); if (!sv) continue;
      const decl = `${p}:${p === "font-size" ? fluidFont(sv) : sv} !important;`;
      // The element ITSELF always gets the declaration: a desktop edit also writes a flat inline px
      // value, and a stylesheet `!important` beats that non-important inline, so a plain <h2> scales
      // fluidly too — not just split-text headings whose visible text sits in children.
      self += decl;
      // Only INHERITABLE text properties are forced onto descendants (that is what the cascade is for).
      // A layout property must not be: `grid-template-columns` pushed onto every nested grid would
      // rewrite layouts the client never touched.
      if (CASCADE[p]) inherited += decl;
    }
    if (self) css += `[data-lg-id="${id}"]${B}{${self}}`;
    if (inherited) css += `[data-lg-id="${id}"] *${B}{${inherited}}`;
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
  p = { ...p, prefix: relaxLegacyChains(p.prefix) };
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
/* ---- page meta ----------------------------------------------------------------------------------
 * The client can rewrite an H1 but not the <title> the search engine shows, so a page's heading and
 * its result in Google drift apart — the "edit, publish, get reindexed" promise was only half wired.
 * The edited meta rides in the SAME overrides map under a reserved key, tagged so it can never be
 * mistaken for block HTML, which means the draft, publish, version and undo paths need no changes.
 */

export const META_KEY = "__meta";
const META_TAG = "lgmeta:1:";

export function encodeMeta(meta) {
  return META_TAG + JSON.stringify(meta);
}
export function decodeMeta(value) {
  if (typeof value !== "string" || value.indexOf(META_TAG) !== 0) return null;
  try {
    const m = JSON.parse(value.slice(META_TAG.length));
    return m && typeof m === "object" ? m : null;
  } catch {
    return null;
  }
}

const attrEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const textEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unesc = (s) => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** What the page's head says today — used to prefill the editor with the site's own values. */
export function readMeta(html) {
  const head = html.slice(0, Math.max(0, html.indexOf("</head>")) || html.length);
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head);
  const d = /<meta[^>]*name=["']description["'][^>]*>/i.exec(head);
  const dc = d && /content=["']([^"']*)["']/i.exec(d[0]);
  return { title: t ? unesc(t[1].trim()) : "", description: dc ? unesc(dc[1]) : "" };
}

function setMetaTag(head, matcher, value) {
  const re = new RegExp('<meta[^>]*' + matcher + '[^>]*>', "i");
  if (!re.test(head)) return null;
  return head.replace(re, (tag) =>
    /content=["']/i.test(tag)
      ? tag.replace(/content=["'][^"']*["']/i, 'content="' + attrEsc(value) + '"')
      : tag.replace(/\/?>$/, ' content="' + attrEsc(value) + '">')
  );
}

/** Write the client's title/description into the page head (and the social tags that mirror them). */
export function applyMeta(html, meta) {
  if (!meta || (!meta.title && !meta.description)) return html;
  const at = html.indexOf("</head>");
  if (at < 0) return html;
  let head = html.slice(0, at);
  const rest = html.slice(at);
  if (meta.title) {
    head = head.replace(/<title[^>]*>[\s\S]*?<\/title>/i, "<title>" + textEsc(meta.title) + "</title>");
    for (const m of ['property=["\']og:title["\']', 'name=["\']twitter:title["\']']) {
      head = setMetaTag(head, m, meta.title) ?? head;
    }
  }
  if (meta.description) {
    let next = setMetaTag(head, 'name=["\']description["\']', meta.description);
    // A page that never had a description gets one — that is an SEO error the client can now fix.
    if (next == null) next = head + '<meta name="description" content="' + attrEsc(meta.description) + '">';
    head = next;
    for (const m of ['property=["\']og:description["\']', 'name=["\']twitter:description["\']']) {
      head = setMetaTag(head, m, meta.description) ?? head;
    }
  }
  return head + rest;
}

export function exportPageHtml(page, overrides, pageBp) {
  const keep = keptIds(pageBp);
  const withOv = overrides ? applyOverrides(page.blocks, overrides) : page.blocks;
  const blocks = withOv.map((b) => ({ ...b, content: { ...b.content, html: cleanHtml(b.content.html, keep) } }));
  // Repairs first, so a client's own edit can still override them.
  let doc = withSiteRuntime(reassemble({ ...page, blocks }));
  const css = overridesCss(pageBp);
  if (css) {
    // id "lgcms-overrides" avoids colliding with allclean's own <style id="lg-overrides">.
    const tag = `<style id="lgcms-overrides">${css}</style>`;
    doc = doc.includes("</head>") ? doc.replace("</head>", `${tag}</head>`) : doc.replace(/<body/, `${tag}<body`);
  }
  return applyMeta(doc, overrides ? decodeMeta(overrides[META_KEY]) : null);
}
