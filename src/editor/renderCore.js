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
 * Repairs for defects that came WITH the imported site. Kept DELIBERATELY SMALL and targeted — broad
 * heading rules (blanket max-width, word-break, auto font-fit) were tried and removed: they fixed one
 * thing and quietly broke another (they stopped the client from resizing headings). What remains only
 * touches the exact elements that are actually defective.
 *
 * · .right_home-features — a grid item with the default `min-width:auto` refuses to shrink below its
 *   content, so on a tablet the feature cards kept their desktop width and ran off the screen edge.
 * · .page-wrapper overflow-x:clip — decorative bits the import positions off-canvas (a hover underline
 *   starting at `left:-111px`) otherwise add a phantom horizontal scrollbar. `clip`, not `hidden`, so
 *   vertical scroll and sticky positioning are untouched, and it never clips normal in-page content.
 * · background video fills its wrapper — it is position:absolute and meant to cover the box, never to
 *   be sized on its own. A stray resize once saved `width:20px` onto the hero video; this heals it.
 */
export const SITE_FIXES =
  "@media screen and (max-width:991px){.right_home-features{min-width:0}}" +
  ".page-wrapper{overflow-x:clip;}" +
  ".w-background-video video:not(#lgcmsx),.w-background-video-atom video:not(#lgcmsx){width:100% !important;height:100% !important;}" +
  // The testimonials marquee, finished. The import lost the template's animation wiring, so the
  // "3 scrolling columns" block rendered as a static 3600-4400px wall of reviews at EVERY width.
  // This gives the block its designed shape back on desktop AND tablet: a window the height of a
  // screen, and columns that drift slowly inside it. Pure CSS on the two marquee classes only — no
  // clones, no inline styles, so the canvas and the published page render the same DOM and the
  // editor's motion freeze (animation-play-state) pauses it while editing.
  // translateY(min(0px, 840px - 100%)) = a column shorter than the window simply does not move.
  // The window's edges FADE instead of chopping a card mid-sentence: a hard clip read as "блок
  // обрезан", a fade reads as a window with more content drifting through it — which it is.
  "@media screen and (min-width:768px){" +
    ".marquee-thirds{max-height:840px;overflow:hidden;" +
      "-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 28px,#000 calc(100% - 96px),transparent 100%);" +
      "mask-image:linear-gradient(180deg,transparent 0,#000 28px,#000 calc(100% - 96px),transparent 100%);}" +
    ".marquee-thirds>.marquee-vertical{animation:lgcms-marq 64s ease-in-out infinite alternate;}" +
    ".marquee-thirds>.marquee-vertical:nth-child(2){animation-duration:81s;}" +
    ".marquee-thirds>.marquee-vertical:nth-child(3){animation-duration:55s;}" +
  "}" +
  "@keyframes lgcms-marq{from{transform:translateY(0)}to{transform:translateY(min(0px,calc(840px - 100%)))}}" +
  "@media (prefers-reduced-motion:reduce){.marquee-thirds>.marquee-vertical{animation:none !important;}}" +
  // Phones used to get NO reviews at all: the import hides the whole marquee below 768px and offers
  // only the "Все отзывы" Google link. The block now shows its first five review cards in one
  // column (MARQUEE_FIX ranks them; the ones beyond five carry data-lgcms-extra and stay hidden —
  // the rest live behind the existing Google-reviews button, which already says exactly that).
  // :not(#lgcmsx) lifts specificity over the site's own `.marquee-vertical.first._2nd` hiding rules.
  "@media screen and (max-width:767px){" +
    ".marquee-thirds:not(#lgcmsx){display:grid;grid-template-columns:1fr;max-height:none;overflow:visible;}" +
    ".marquee-thirds>.marquee-vertical:not(#lgcmsx){display:block;animation:none;}" +
    ".single-marquee-testimonials[data-lgcms-extra],.card_testimonial-marquee[data-lgcms-extra]{display:none !important;}" +
  "}" +
  // Heading TYPOGRAPHY only — deliberately nothing about size. The broad layer that once lived here
  // also capped max-width and auto-fitted fonts, and that is what froze resizing; these two rules
  // change how TEXT WRAPS and nothing else, and the harness's resize probes now stand guard over
  // that distinction. (1) On desktop widths a heading never breaks inside a word: the site ships
  // word-break:break-word + hyphens:auto, which split "Профессиональные" wherever the line happens
  // to end — inside legacy span towers even when there is room. Whole-word wrapping is what a
  // heading is expected to do; on phones (<768px) the site's own hyphenation stays. (2) Below the
  // desktop breakpoint a heading cannot be wider than its container: the import pins several
  // headings to 920/924px in the site's OWN stylesheet, which overflowed every tablet. Media-guarded,
  // so desktop editing (and the client's freedom to drag a heading wider) is untouched; a client's
  // own tablet edit still wins — it is written at id-level specificity with !important.
  "@media screen and (min-width:768px){" +
    "h1:not(#lgcmsx),h2:not(#lgcmsx),h3:not(#lgcmsx),h4:not(#lgcmsx),h5:not(#lgcmsx),h6:not(#lgcmsx)," +
    "[class*=heading-style]:not(#lgcmsx)," +
    "h1 :not(#lgcmsx),h2 :not(#lgcmsx),h3 :not(#lgcmsx),h4 :not(#lgcmsx),h5 :not(#lgcmsx),h6 :not(#lgcmsx)," +
    "[class*=heading-style] :not(#lgcmsx)" +
    "{hyphens:manual;overflow-wrap:normal;word-break:normal;}" +
  "}" +
  "@media screen and (max-width:991px){" +
    "h1:not(#lgcmsx),h2:not(#lgcmsx),h3:not(#lgcmsx),h4:not(#lgcmsx),h5:not(#lgcmsx),h6:not(#lgcmsx){max-width:100%;}" +
  "}" +
  // Client's call (2026-08-02): the dark gradient band the template lays over each services card's
  // photo, under the title, reads as an ugly подложка — off, on every card of that collection. A
  // soft text shadow keeps the white title readable on light photos.
  ".card_scroll-service .content_nav-service:not(#lgcmsx){background-image:none;}" +
  ".card_scroll-service .content_nav-service :is(h1,h2,h3,h4,h5,h6){text-shadow:0 1px 14px rgba(6,20,44,.55);}";

/**
 * Repairs that exist ONLY inside the editing canvas — never published.
 *
 * The canvas stretches its iframe to the height of the whole page (so the page shows without an
 * inner scrollbar), which turns every `min-height:100vh` hero into "as tall as the whole page" and
 * spirals (/about once rendered a 48000px empty block). Neutralising min-height on hero boxes in the
 * canvas keeps them content-tall THERE; the published page keeps its real 100vh.
 *
 * Lives in the render core so the regression harness can build a canvas-twin of a page with exactly
 * the CSS the canvas uses — if this rule and the runtime ever disagree, the harness fails visibly.
 */
export const EDITOR_ONLY_CSS = "[class*=hero]:not(#lgcmsx){min-height:auto !important;}";

/**
 * The canvas wraps each section block in a marker div: zero layout box (display:contents), but a
 * stable handle for selection, saving and per-block updates. One definition for the editor runtime
 * AND the harness's canvas-twin, so "editor DOM" means the same thing everywhere.
 */
export function wrapBlockForEdit(html, id) {
  return '<div data-lg-block="' + id + '" style="display:contents">' + dropHeadingFontPins(html) + "</div>";
}

/**
 * Stamp every element of a block with a stable id (blockId + "~" + index): deterministic across
 * reloads, collision-free between blocks — the key every per-element override rule hangs off.
 * Allocates ABOVE whatever ids the markup already carries, so an id is assigned once and keeps
 * pointing at the same element for the life of the block. In the core (not the runtime) because the
 * harness stamps its canvas-twin with the same function the editor uses.
 */
export function stampIds(root, blockId) {
  const all = root.querySelectorAll("*");
  let next = 0;
  const pre = "" + blockId + "~";
  for (let j = 0; j < all.length; j++) {
    const cur = all[j].getAttribute("data-lg-id");
    if (cur && cur.indexOf(pre) === 0) { const n = parseInt(cur.slice(pre.length), 10); if (n >= next) next = n + 1; }
  }
  for (let i = 0; i < all.length; i++) { if (!all[i].getAttribute("data-lg-id")) all[i].setAttribute("data-lg-id", pre + (next++)); }
}

/**
 * THE RULE: a size measured on one screen may never be applied unchanged on another.
 *
 * The legacy layer was written by dragging boxes on one monitor, and it froze the result as absolute
 * pixels: `grid-template-columns: minmax(0,676.4px) minmax(0,756.4px)` on the hero row, `width:920px`
 * on a heading, and so on. That is a layout that is only correct at the width it was made at.
 * Measured on the Russian home page: at a 1920 screen the hero row is handed 1800px of container and
 * fills 1433 of it, so the text column is ~370px too narrow and the heading breaks mid-word; at
 * narrower widths the same pins squeeze the columns unevenly. The Romanian home page has fewer of
 * these pins, which is exactly why one locale looked fine and the other did not.
 *
 * Rather than editing 30 rules by hand on one page — the fix that would be undone by the next import —
 * every absolute size in that layer is rewritten into one that carries the same intent at any width:
 *
 *   · a fixed grid track list becomes the SAME NUMBERS as fractions, so the row keeps the proportion
 *     it was designed with and always fills its container (only when every track is a fixed px value —
 *     a deliberate `200px 1fr` split is left alone);
 *   · a fixed `width`/`max-width` is capped at the container: `min(920px, 100%)`. It stays 920px
 *     wherever there is room and can no longer stick out where there is not.
 *
 * Font sizes are deliberately NOT touched: measured at 390px, the site's own mobile rules already win
 * over the pinned ones, so rewriting them would change pages that render correctly today.
 */
function rewriteLegacyCss(css) {
  const relaxed = css
    // The editor wraps each block in a marker div. It has no layout box, but it IS in the selector
    // tree, so it breaks these `>` chains inside the canvas while they keep matching on the published
    // page — the editor then showed one thing and the site another (hero words 60px vs 88px).
    // Descendant matches what child matched, so the published rendering is unchanged.
    .split("div.page-wrapper:nth-of-type(1) > ").join("div.page-wrapper:nth-of-type(1) ")
    .split("main.main-wrapper:nth-of-type(1) > ").join("main.main-wrapper:nth-of-type(1) ");

  return relaxed
    .replace(/grid-template-columns\s*:\s*([^;}!]+)/gi, (whole, value) => {
      const fr = pxTracksToFr(value);
      return fr ? "grid-template-columns:" + fr : whole;
    })
    .replace(/(^|[;{])(\s*)(max-width|width)\s*:\s*(\d+(?:\.\d+)?)px/gi,
      (_m, pre, sp, prop, n) => `${pre}${sp}${prop}:min(${n}px,100%)`);
}

const PX_TRACK = /^(?:minmax\(\s*0(?:px)?\s*,\s*)?(\d+(?:\.\d+)?)px\s*\)?$/;
/**
 * A grid track list that is ALL fixed pixels, rewritten to the same numbers as fractions — same
 * proportion, but the row now fills whatever container it lands in instead of freezing at one width.
 * Returns null when any track is not a fixed px value (a deliberate `200px 1fr` is left as the author
 * meant it). One definition, used both for the imported legacy CSS and for a client's own column drag.
 *
 * Every track is emitted as minmax(0, Nfr) — a bare `Nfr` keeps `auto` as its minimum, which means
 * any child with its own width becomes the column's floor and the track list silently stops
 * governing the row. That is exactly how "потяни границу колонок — ничего не двигается" happened:
 * an old drag had saved width:735px onto the video column's box, and from then on no track rule,
 * however correct, could move that boundary. minmax(0, …) makes the split the single authority.
 */
function pxTracksToFr(value) {
  const tracks = splitTopLevel(value);
  if (tracks.length < 2 || !tracks.every((t) => PX_TRACK.test(t))) return null;
  return tracks.map((t) => `minmax(0,${PX_TRACK.exec(t)[1]}fr)`).join(" ");
}

/** Split a CSS value on top-level whitespace (never inside parentheses). */
function splitTopLevel(value) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0 && /\s/.test(ch)) { if (cur) { out.push(cur); cur = ""; } continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Per-word font pins inside headings, left by the previous editor, are removed.
 *
 * That editor grew a heading by wrapping its text in one more `<span style="font-size:NNpx !important">`
 * per click; the Russian home page carries twenty of them, nested, stepping 60px → 84px. An inline
 * `!important` sits at the very top of the cascade — above any stylesheet, including ours — so while
 * they are there the size is frozen for good: our repairs cannot reach it, and the client's own change
 * in the panel applies to the heading while the text keeps rendering at whatever the innermost span
 * says. Measured on that page: the column is 571px, the pins draw at 80px, and the single word
 * "Профессиональные" needs more room than the column has, so it is chopped whatever we do.
 *
 * Removing them hands the heading back to the site's own typography — and to the client, whose panel
 * then actually governs the size. Deliberately narrow: only a fixed-length `font-size` marked
 * `!important`, only on elements INSIDE a heading, never on the heading itself (that one can be the
 * client's own edit), and every other declaration on the element is kept.
 */
const FONT_PIN = "font-size\\s*:\\s*[\\d.]+(?:px|pt|em|rem)\\s*!important\\s*;?";

export function dropHeadingFontPins(html) {
  if (!html || html.indexOf("!important") < 0) return html;
  return html.replace(/(<(h[1-6])\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (whole, open, _tag, body, close) => {
    if (body.indexOf("!important") < 0) return whole;
    const cleaned = body.replace(/\sstyle="([^"]*)"/gi, (attr, decls) => {
      // Only style attributes that actually carry a pin are rewritten. Touching the others would
      // rewrite markup we have no business changing — even tidying a stray leading ";" shows up as a
      // diff against the mirror, and that invariant is what proves an unedited block is untouched.
      if (!new RegExp(FONT_PIN, "i").test(decls)) return attr;
      const left = decls.replace(new RegExp(FONT_PIN, "gi"), "").replace(/^[\s;]+/, "").trim();
      return left ? ' style="' + left + '"' : "";
    });
    return open + cleaned + close;
  });
}

/** Apply the rule above to the page's legacy stylesheet — and to nothing else on the page. */
export function relaxLegacyChains(html) {
  const START = '<style id="lg-overrides">';
  const at = html ? html.indexOf(START) : -1;
  if (at < 0) return html;
  const from = at + START.length;
  const to = html.indexOf("</style>", from);
  if (to < 0) return html;
  return html.slice(0, from) + rewriteLegacyCss(html.slice(from, to)) + html.slice(to);
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


/**
 * The testimonials marquee is put back together.
 *
 * The imported "3 vertical columns" review marquee is broken in the original export: its grid
 * (`.marquee-thirds`, three columns) holds only two of the columns, and the third `.marquee-vertical`
 * plus a stray review card spilled out as full-width siblings AFTER the grid. On the live site this
 * hides far below the fold, but in the editor's whole-page view it reads as a broken block — two
 * columns, then a full-width row of reviews. Verified: the stray column and card belong in the grid;
 * putting them back yields a clean 3×371px marquee and shrinks the section from ~4020px to ~2840px.
 *
 * Done at runtime (no DOM parser needed in the Node publisher) on both the canvas and the published
 * page, so they match. Idempotent: once the strays are inside the grid there is nothing left to move.
 */
// The block's real content is NINE distinct reviews; the export shipped every one of them TWICE
// (seam copies for a loop that never ran — the card unit is .card_testimonial-marquee, sometimes
// wrapped in .single-marquee-testimonials) and scattered them so unevenly that one column stood
// almost empty while another showed the same review twice, side by side. The block is rebuilt from
// its own content on every load: strays back into the grid, cards DEDUPLICATED by their text (our
// ping-pong window needs no seam copies — a visitor must never see one review twice), then dealt
// tallest-first into the shortest column so the three columns come out even. Self-correcting
// whatever state was saved, and what the canvas saves is already the clean arrangement.
export const MARQUEE_FIX = [
  "(function(){function txt(n){return (n.textContent||'').replace(/\\s+/g,' ').trim();}",
  "function fix(){",
  "var grids=document.querySelectorAll('.marquee-thirds'),g,i;",
  "for(g=0;g<grids.length;g++){var grid=grids[g],par=grid.parentElement;if(!par)continue;",
  "var kids=[].slice.call(par.children),k;",
  "for(k=0;k<kids.length;k++){var c=kids[k];if(c===grid)continue;",
  "var cl=c.className||'';",
  "if(/\\bmarquee-vertical\\b/.test(cl)){grid.appendChild(c);continue;}",
  "if(/\\bsingle-marquee-testimonials\\b/.test(cl)){var mt0=grid.querySelector('.marquee_testimonials');if(mt0)mt0.appendChild(c);}}",
  "var lists=[],cols=grid.querySelectorAll('.marquee-vertical'),ci;",
  "for(ci=0;ci<cols.length;ci++){var l=cols[ci].querySelector('.marquee_testimonials');if(l)lists.push(l);}",
  "if(lists.length<2)continue;",
  // The unit is the CARD. The export nested cards in .single-marquee-testimonials GROUPS of two and
  // three (one column ended up holding eleven cards, another one) - a group can never be balanced,
  // and removing a "duplicate" group would take unique reviews with it. Groups and lists stack with
  // the same 16px gap, so dissolving the groups changes nothing visually.
  "var cards=[].slice.call(grid.querySelectorAll('.card_testimonial-marquee')),uniq=[],seen={},cd;",
  "for(cd=0;cd<cards.length;cd++){var key=txt(cards[cd]);if(!key)continue;",
  "if(seen[key]){var p0=cards[cd].parentNode;if(p0)p0.removeChild(cards[cd]);continue;}",
  "seen[key]=1;uniq.push(cards[cd]);}",
  "if(uniq.length<lists.length)continue;",
  // Balanced by TEXT LENGTH, not by measured height: a card's height is proportional to its text at
  // any column width, while offsetHeight depends on the width the page happened to LOAD at (and is
  // zero for cards a narrower layout hides) - dealing by it balanced one width and skewed the rest.
  "function wt(n){return txt(n).length+40;}",
  "uniq.sort(function(a,b){return wt(b)-wt(a);});",
  "var tot=lists.map(function(){return 0;});",
  "for(i=0;i<uniq.length;i++){var best=0,bi;for(bi=1;bi<tot.length;bi++){if(tot[bi]<tot[best])best=bi;}",
  "lists[best].appendChild(uniq[i]);tot[best]+=wt(uniq[i]);}",
  // group shells left empty by the deal are gone for good
  "var shells=grid.querySelectorAll('.single-marquee-testimonials'),sh;",
  "for(sh=shells.length-1;sh>=0;sh--){if(!shells[sh].querySelector('.card_testimonial-marquee'))shells[sh].parentNode.removeChild(shells[sh]);}",
  // Rank the cards so the phone layout shows the first five and keeps the rest for the reviews
  // button. Recomputed on every load and stripped on publish, so it never goes stale.
  "var all=grid.querySelectorAll('.card_testimonial-marquee'),r;",
  "for(r=0;r<all.length;r++){if(r>=5)all[r].setAttribute('data-lgcms-extra','1');else all[r].removeAttribute('data-lgcms-extra');}}}",
  "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fix);else fix();",
  "window.addEventListener('load',fix);",
  "})();",
].join("");

/** The repairs every rendered page gets: site CSS fixes + the video, heading-fit and marquee guarantees. */
export function siteRuntimeTags() {
  return '<style id="lgcms-fixes">' + SITE_FIXES + "</style>" +
    '<script id="lgcms-video">' + VIDEO_BOOT + "</scr" + "ipt>" +
    '<script id="lgcms-marquee">' + MARQUEE_FIX + "</scr" + "ipt>";
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
    // the marker the heading-fit rule keys its stylesheet by — recomputed at runtime, never shipped
    .replace(/\s+data-lg-fit="[^"]*"/g, "")
    // the phone-layout rank MARQUEE_FIX stamps on review cards — recomputed on every load
    .replace(/\s+data-lgcms-extra="[^"]*"/g, "")
    // The canvas switches slider autoplay OFF so a slide cannot steal the field mid-edit, stashing
    // the original value. On the way out the original comes back and the stash is dropped, so the
    // published page auto-plays exactly as the site was built to.
    .replace(/<([a-z][a-z0-9-]*)([^>]*?)\s+data-lg-autoplay0="([^"]*)"([^>]*)>/gi, (_m, tag, pre, orig, post) => {
      const attrs = (pre + post).replace(/\s+data-autoplay="[^"]*"/i, ' data-autoplay="' + orig + '"');
      return "<" + tag + attrs + ">";
    })
    // marks a heading line the client emptied, so the panel can offer it back; the `display:none` that
    // actually hides it is a normal inline style and DOES ship — only the bookkeeping is dropped
    .replace(/\s+data-lg-hid="[^"]*"/g, "")
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

/**
 * A value the client set, made safe to APPLY AT ANY WIDTH — the one place that guarantee lives.
 *
 * Every size an edit produces passes through here, so the "a size made on one screen is not a layout"
 * rule cannot be forgotten by one code path the way it was: font sizes scale fluidly, and a fixed
 * pixel width is capped at its container with `min(…,100%)` so it can never push past the column it
 * sits in. This used to be spelled out for tablet/mobile and simply missing from the desktop base
 * layer, which is how a heading dragged wide at 1920 shipped an 820px width that overflowed every
 * narrower screen. Height is left alone (tall is not the overflow that breaks a page); min-width too
 * (that is the un-clamp, and capping it would re-clamp the box).
 */
function fitValue(prop, sv) {
  if (prop === "font-size") return fluidFont(sv);
  // A width the client dragged is capped at the VIEWPORT, not the container: it keeps their size (and
  // scales down only when it would exceed the screen, so it never causes a page-wide scrollbar), but
  // it does NOT stop them from making a box wider than its column — capping at 100% did exactly that,
  // so a full-width heading could not be resized at all, which read as "текст не тянется".
  if (prop === "width" && /^\d/.test(sv) && /px$/.test(sv)) return `min(${sv},100vw)`;
  // A column boundary the client dragged writes fixed px tracks — the same freeze, made proportional.
  if (prop === "grid-template-columns") return pxTracksToFr(sv) || sv;
  return sv;
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
      const decl = `${p}:${fitValue(p, sv)} !important;`;
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
        decl += `${p}:${fitValue(p, sv)} !important;`;
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
  // Same block markup the canvas shows (see reassembleForEdit), so a heading is not one size here and
  // another there — and so a block saved from the canvas carries no pins either.
  const bodyOf = (b) => dropHeadingFontPins(b.content.html);
  if (!p.wrapped) {
    return p.prefix + p.blocks.map(bodyOf).join("") + p.suffix;
  }
  const header = p.blocks.find((b) => b.content.region === "header") ;
  const footerB = p.blocks.find((b) => b.content.region === "footer");
  const headerHtml = header ? bodyOf(header) : "";
  const footer = footerB ? bodyOf(footerB) : "";
  const mains = p.blocks.filter((b) => b.content.region === "main").map(bodyOf).join("");
  const body =
    p.bodyPrefix + p.pwOpen + headerHtml + p.mainOpen + mains + p.mainClose + footer + p.pwClose + p.tailScripts;
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
