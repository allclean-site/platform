/**
 * Edit-mode rendering for the iframe canvas.
 *
 * `reassembleForEdit` wraps every section block in a marker `<div data-lg-block style="display:contents">`
 * (display:contents = zero layout box, so grid/flex layout is untouched) and injects a small runtime.
 * The runtime makes text-bearing elements contentEditable and posts the block's new innerHTML back to
 * the parent on edit — so the client edits content in place while structure/markup stay intact.
 *
 * The wrappers exist ONLY in the editor iframe. The static export uses `reassemble()` on the (edited)
 * blocks, so it never contains these markers.
 */

import type { ImportedBlock, ImportedPage } from "./reassemble";
// The iframe runs as a plain script and cannot import modules, so the shared render core is injected
// by SOURCE (`?raw` = the real file text, unminified even in a production build). That makes the CSS
// the editing canvas generates literally the same code the publisher runs — the drift this project
// kept hitting is impossible by construction, not by remembering to patch three copies.
import renderCoreSrc from "./renderCore.js?raw";
import { relaxLegacyChains, withSiteRuntime, wrapBlockForEdit } from "./renderCore.js";

/** The core, ready to paste inside the runtime IIFE (module `export` keywords removed). */
const CORE_INLINE = renderCoreSrc.replace(/^export\s+/gm, "");

/** JS injected into the iframe. Makes text editable inline AND drives a clean per-element panel
 *  (select any element → the parent shows labeled Текст/Ссылка/Фото/Стиль controls; changes apply
 *  back here). No raw JSON — the client edits understandable properties on the real site. */
export const EDIT_RUNTIME = `
(function(){
  // ---- shared render core (same source the publisher imports) -----------------------------------
${CORE_INLINE}
  // -----------------------------------------------------------------------------------------------
  var W = "[data-lg-block]";
  var seq = 0, selected = null, lastRange = null;
  // The stale-pin heal (see lg-bp-init) must run once per page load, never on undo/redo restores.
  var bpHealed = false;
  // THE RULE (пока правишь - ничего не движется) has a third motion engine to cover: a Webflow
  // slider auto-advances on its own setTimeout, which neither the CSS animation pause nor the GSAP
  // freeze can reach - on the phone canvas the services slide moved away from under the caret every
  // three seconds, so the section read as "нельзя редактировать". The engine reads its config from
  // data-autoplay when it initialises, so the config is flipped SYNCHRONOUSLY here - this script
  // runs before any DOMContentLoaded handler, Webflow's included. Canvas-only by construction: the
  // original value rides in data-lg-autoplay0 and cleanHtml restores it on the way to publish, so
  // the live site keeps auto-playing exactly as built. Arrows and swipes still work while editing.
  (function(){
    var sl = document.querySelectorAll(".w-slider"), i;
    for (i = 0; i < sl.length; i++){
      var v = sl[i].getAttribute("data-autoplay");
      if (v === "true" || v === "1"){
        sl[i].setAttribute("data-lg-autoplay0", v);
        sl[i].setAttribute("data-autoplay", "false");
      }
    }
  })();
  // A desktop edit touched the base rule layer → the host has to be told when the drag is committed.
  var baseDirty = false;
  // ---- Per-breakpoint overrides ----------------------------------------------------------------
  // curBp = which device the editor is showing. Edits on desktop stay INLINE on the node (base);
  // edits on tablet/mobile are written as generated @media rules in <style id="lg-overrides">
  // keyed to data-lg-id, so they only apply at that width and never touch the base markup.
  var curBp = "desktop";
  var curZoom = 1; // canvas scale — overlay handles are sized 1/zoom so they stay grabbable on screen
  // Layers of generated overrides keyed to data-lg-id.
  //  base           → descendant cascade for DESKTOP inheritable props ([data-lg-id] * {…}, no media)
  //  tablet/mobile  → @media rules   ·   hover/active → :hover/:active rules
  // base is a STYLESHEET rule (not inline !important on descendants) so tablet/mobile @media rules —
  // later in source order — can still override it. Inline !important could never be overridden.
  var bp = { base:{}, tablet:{}, mobile:{}, hover:{}, active:{} };   // layer -> { elId -> { cssProp -> value } }
  // MQ / CASCADE / fluidFont / overridesCss all come from the injected render core above.
  // ElStyle key -> CSS property. bold & weight both map to font-weight.
  var KEY2CSS = { fontSize:"font-size", color:"color", weight:"font-weight", bold:"font-weight",
    align:"text-align", lineHeight:"line-height", letterSpacing:"letter-spacing", width:"width", height:"height", background:"background",
    padTop:"padding-top", padRight:"padding-right", padBottom:"padding-bottom", padLeft:"padding-left",
    marTop:"margin-top", marRight:"margin-right", marBottom:"margin-bottom", marLeft:"margin-left",
    display:"display", flexDir:"flex-direction", flexWrap:"flex-wrap", justify:"justify-content", alignItems:"align-items", gap:"gap" };
  var CSS2KEY = {}; for (var _k in KEY2CSS) CSS2KEY[KEY2CSS[_k]] = _k;
  function styleVal(k, v){
    if (k==="fontSize") return v+"px";
    if (k==="bold") return v?"700":"";
    if (k==="weight") return String(v);
    if (k==="lineHeight") return v?String(v):"";
    if (k==="letterSpacing") return v?(v+"px"):"";
    if (/^(pad|mar)/.test(k)) return v+"px";
    if (k==="gap") return v?(v+"px"):"";
    return String(v);
  }
  // Turn a partial ElStyle patch into [cssProp, cssValue] pairs (empty value = clear).
  function decls(s){
    var out = [];
    for (var k in s){ if (!KEY2CSS[k]) continue; out.push([KEY2CSS[k], styleVal(k, s[k])]); }
    return out;
  }
  // Inheritable TEXT props: nested spans in a heading (esp. Webflow split-text widgets) often carry
  // their OWN letter-spacing/font-size/etc from a class, which beats inheritance — so styling the
  // heading does nothing visible. For these props we also force every descendant (inline !important),
  // so "change the whole heading's look" actually applies.
  // CASCADE + fluidFont + overridesCss come from the injected render core (top of this IIFE).
  function cascadeDesc(el, prop, val){
    var kids = el.querySelectorAll("*");
    for (var i=0;i<kids.length;i++){
      var t = kids[i].tagName; if (t==="SCRIPT"||t==="STYLE") continue;
      if (val === "") kids[i].style.removeProperty(prop);
      else { stashOriginal(kids[i]); kids[i].style.setProperty(prop, val, "important"); }
    }
  }
  function renderOverrides(){
    // id is "lgcms-overrides", NOT "lg-overrides" — the real allclean home page ships its own
    // <style id="lg-overrides">; reusing that id would WIPE it. Ours is appended after, so it wins
    // conflicts by source order + !important while theirs stays intact.
    var sheet = document.getElementById("lgcms-overrides");
    if (!sheet){ sheet = document.createElement("style"); sheet.id = "lgcms-overrides"; document.head.appendChild(sheet); }
    // ONE implementation, shared with the publisher → the canvas and the live page cannot disagree.
    sheet.textContent = overridesCss(bp);
  }
  // Which ElStyle keys are overridden for this element at the CURRENT breakpoint (for panel dots).
  function bpKeysFor(elId){
    var o = {}; if (curBp==="desktop") return o;
    var rec = (bp[curBp]||{})[elId]; if (!rec) return o;
    for (var p in rec) o[CSS2KEY[p]] = true;
    return o;
  }
  // Current state overrides (hover/active) for an element — drives the "Состояния" section of the panel.
  function stateInfo(elId, layer){
    var rec = (bp[layer]||{})[elId] || {};
    return { color: rec["color"]||"", background: rec["background"]||"",
             over: { color: !!rec["color"], background: !!rec["background"] } };
  }
  function tag(el){ if(!el.getAttribute("data-lg-el")) el.setAttribute("data-lg-el", "e"+(seq++)); }
  function hex(rgb){
    var m = (rgb||"").match(/\\d+/g); if(!m) return "#000000";
    return "#" + m.slice(0,3).map(function(x){ return ("0"+(+x).toString(16)).slice(-2); }).join("");
  }
  // A text element is edited as ONE Tilda-like field. Block text (h1-h6/p/li/…) becomes a single
  // contenteditable — its inner word-divs/spans are NOT separately editable. Standalone links/buttons
  // (a CTA, not inside a paragraph) are their own field. Loose text (a div with direct text and no
  // text-tag ancestor) falls back to its parent.
  var BLOCK_TEXT = "h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,dt,dd";
  // spellcheck stays ON: the client writes the site's selling copy in Russian and Romanian here, and
  // switching the browser's spell checker off (it was off) took away the one thing that catches a typo
  // before it is published. The attribute never ships — cleanHtml strips it on export.
  function makeCE(el){ el.setAttribute("contenteditable","true"); el.setAttribute("spellcheck","true"); tag(el); }
  function editableWithin(root){
    // 1) block-level text containers → one editable field each
    var blocks = root.querySelectorAll(BLOCK_TEXT);
    for (var i=0;i<blocks.length;i++){
      var b = blocks[i];
      if (b.closest("script,style")) continue;
      if (b.parentElement && b.parentElement.closest('[contenteditable="true"]')) continue; // nested (e.g. <li> in <li>)
      makeCE(b);
    }
    // 2) standalone links / buttons that are NOT part of a block-text field
    var links = root.querySelectorAll("a,button");
    for (var j=0;j<links.length;j++){
      var l = links[j];
      if (l.closest("script,style") || l.closest(BLOCK_TEXT)) continue;
      if (l.closest('[contenteditable="true"]')) continue;
      makeCE(l);
    }
    // 3) loose text not covered by the above
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
    while ((n = walker.nextNode())){
      if (!n.textContent.trim()) continue;
      var p = n.parentElement;
      if (!p || p.closest("script,style") || p.isContentEditable) continue;
      if (p.closest('[contenteditable="true"]') || p.closest(BLOCK_TEXT) || p.closest("a,button")) continue;
      makeCE(p);
    }
  }
  // ---- structured text: the panel edits it piece by piece ----------------------------------------
  // A site heading is often built as one element per word or line (Webflow "split text"), so replacing
  // the whole textContent would collapse those children and take the site's own classes with them.
  // That is why the panel used to offer nothing but a hint — which reads as "editing is broken".
  // Instead we expose the field's TEXT RUNS: one input per run, written back into that run's own node,
  // so the markup is untouched and the client still gets real fields to type in.
  function textRuns(el){
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false), n;
    // A line the page does not show must not appear in the field: this heading ships with a word the
    // site itself hides (display:none), and listing it would show five lines against four on screen.
    function visible(node){
      for (var p = node.parentNode; p && p !== el && p.nodeType === 1; p = p.parentNode){
        if (getComputedStyle(p).display === "none") return false;
      }
      return true;
    }
    while ((n = w.nextNode())){
      // A run that is only spacing between the word elements is layout, not content — never editable.
      if (!n.nodeValue || n.nodeValue.replace(/[\\s\\u00a0]+/g, "") === "") continue;
      if (visible(n)) out.push(n);
    }
    return out;
  }
  // What the client sees: non-breaking spaces read as ordinary ones and the edges are trimmed, so a
  // field never shows stray whitespace the client cannot see but would delete by accident.
  function runText(node){
    return node.nodeValue.replace(/\\u00a0/g, " ").replace(/\\s+/g, " ").replace(/^ +| +$/g, "");
  }
  function textParts(el){
    var ns = textRuns(el), out = [], i;
    for (i = 0; i < ns.length; i++) out.push(runText(ns[i]));
    // Everything was deleted: still offer ONE empty line. Returning nothing left the panel with a hint
    // and no field at all, so a heading the client had just cleared could not be written again.
    if (!out.length) out.push("");
    return out;
  }
  /** Where text goes when the element has no run left to write into: the innermost empty element that
   *  still carries the site's styling (a word/line box), or the field itself. */
  function textHome(el){
    var kids = el.children, i;
    for (i = 0; i < kids.length; i++){
      if (!kids[i].children.length && kids[i].tagName !== "BR") return kids[i];
    }
    return el;
  }
  /** Write edited lines back, one per run. Unchanged lines are not touched at all, so a block that the
   *  client did not really change stays byte-identical to what the site shipped. A line the client
   *  added or removed becomes a real line break, added or removed in the same element — never a
   *  rebuild of the heading. */
  function setParts(el, parts){
    var ns = textRuns(el), i, changed = false;
    var both = Math.min(ns.length, parts.length);
    for (i = 0; i < both; i++){
      if (runText(ns[i]) !== parts[i]){ ns[i].nodeValue = parts[i]; changed = true; }
    }
    // A line was removed: empty its run and take the break in front of it away too. When the run WAS
    // the whole of its own element (a per-word heading), emptying is not enough — an empty element
    // still occupies a line and leaves a visible gap. It gets hidden instead, the same way the site's
    // own markup hides a word it does not use, and is marked so re-adding a line can bring it back.
    for (i = parts.length; i < ns.length; i++){
      var gone = ns[i], before = gone.previousSibling, own = gone.parentNode;
      if (gone.nodeValue !== ""){ gone.nodeValue = ""; changed = true; }
      if (before && before.nodeType === 1 && before.tagName === "BR" && before.parentNode){
        before.parentNode.removeChild(before); changed = true;
      }
      if (own && own !== el && own.nodeType === 1 && !textRuns(own).length){
        own.setAttribute("data-lg-hid", "1");
        own.style.setProperty("display", "none", "important");
        changed = true;
      }
    }
    // A line was added. If we hid a line earlier, that one comes back first — the heading keeps the
    // elements it was designed with. Otherwise it is a real break plus its own text node INSIDE the
    // same element, so the heading's styling covers the new line like the lines already there.
    if (parts.length > ns.length){
      var after = ns.length ? ns[ns.length - 1] : null;
      // Nothing left to write into — the client cleared the field and is typing it again. The text
      // goes back into the element that used to hold it, so the site's own styling still applies and
      // the field is usable from then on. Without this the new text had nowhere to land and simply
      // never appeared on the page, while the panel showed it as if it had.
      if (!after){
        var home = textHome(el);
        var seed = document.createTextNode(parts[0]);
        home.appendChild(seed);
        after = seed; changed = true;
        if (parts.length === 1) return changed;
        ns = [seed];
      }
      for (i = ns.length; i < parts.length; i++){
        var revive = el.querySelector("[data-lg-hid]");
        if (revive){
          revive.removeAttribute("data-lg-hid");
          revive.style.removeProperty("display");
          if (revive.firstChild && revive.firstChild.nodeType === 3) revive.firstChild.nodeValue = parts[i];
          else revive.textContent = parts[i];
          after = textRuns(revive)[0] || after;
          changed = true;
          continue;
        }
        if (!after) break;                       // nothing to hang a new line off yet
        var host = after.parentNode;
        var br = document.createElement("br");
        host.insertBefore(br, after.nextSibling);
        var tn = document.createTextNode(parts[i]);
        host.insertBefore(tn, br.nextSibling);
        after = tn; changed = true;
      }
    }
    return changed;
  }
  // ---- split-text flattening ---------------------------------------------------------------------
  // A heading the previous editors touched is often not text at all: its words live in per-line divs
  // (Webflow split text) or under a tower of nested spans (the RU hero carries eighteen). Words can
  // never move between those boxes, so dragging the field wider leaves the lines exactly where they
  // were - "слова не встают по размеру контейнера". Dissolving the wrappers into one natural flow is
  // what makes width mean width again. It happens ONLY on the client's own horizontal resize of that
  // field (taking the handle IS saying "let the text follow the box"), never as a page-wide pass -
  // an untouched heading keeps its designed frozen lines to the pixel.
  function lineWrapsOnly(el){
    var i, n;
    if (!el.children || !el.children.length) return false;
    // a single flat child is already one flow - nothing to dissolve
    if (el.children.length === 1 && !el.children[0].children.length) return false;
    for (i = 0; i < el.childNodes.length; i++){
      n = el.childNodes[i];
      if (n.nodeType === 3){ if (n.nodeValue.replace(/[\\s\\u00a0]+/g, "") !== "") return false; }
      else if (n.nodeType === 1){
        if (n.tagName === "BR") continue;
        if (n.tagName !== "DIV" && n.tagName !== "SPAN" && !/^H[1-6]$/.test(n.tagName)) return false;
        // anything beyond pure text inside means this is a composed widget, not split text - keep out
        if (n.querySelector("img,video,a,button,input,select,ul,ol,table,iframe,svg")) return false;
      } else if (n.nodeType !== 8) return false;
    }
    return true;
  }
  /** Merge a split-text field into ONE text flow inside its first visible line element (that element
   *  keeps the site's typography classes). Explicit br breaks the client typed are kept; hidden
   *  legacy lines (display:none leftovers of older editors) are dropped for good. */
  function flattenTextFlow(el){
    if (!lineWrapsOnly(el)) return false;
    var parts = [], first = null, k, q, kids = [].slice.call(el.children);
    function hidden(e){ return getComputedStyle(e).display === "none"; }
    function collect(node, out){
      for (var i = 0; i < node.childNodes.length; i++){
        var n = node.childNodes[i];
        if (n.nodeType === 3){ out.push({ t: n.nodeValue.replace(/[\\s\\u00a0]+/g, " ") }); }
        else if (n.nodeType === 1){
          if (n.tagName === "BR") out.push({ br: 1 });
          else if (!hidden(n)) collect(n, out);
        }
      }
    }
    for (k = 0; k < kids.length; k++){
      if (hidden(kids[k])) continue;
      if (!first) first = kids[k];
      var seg = []; collect(kids[k], seg);
      var has = false;
      for (q = 0; q < seg.length; q++){ if (seg[q].br || seg[q].t.replace(/ /g, "") !== ""){ has = true; break; } }
      if (!has) continue;
      if (parts.length) parts.push({ t: " " });      // separate lines become a normal word gap
      for (q = 0; q < seg.length; q++) parts.push(seg[q]);
    }
    if (!first || !parts.length) return false;
    while (el.firstChild) el.removeChild(el.firstChild);
    while (first.firstChild) first.removeChild(first.firstChild);
    for (k = 0; k < parts.length; k++){
      if (parts[k].br) first.appendChild(document.createElement("br"));
      else first.appendChild(document.createTextNode(parts[k].t));
    }
    first.normalize();
    el.appendChild(first);
    return true;
  }
  function kindOf(el){
    if (el.tagName==="IMG") return "image";
    if (el.tagName==="VIDEO") return "video";
    if (el.tagName==="SELECT") return "select";
    if (el.tagName==="A" || el.tagName==="BUTTON") return "link";
    // A contenteditable field is a TEXT unit even if it wraps word-divs/spans (structured heading).
    if (el.getAttribute("contenteditable")==="true") return "text";
    return el.children && el.children.length ? "container" : "text";
  }
  // stampIds now lives in the injected render core (top of this IIFE): the regression harness stamps
  // its canvas-twin pages with the SAME function, so per-element ids mean the same thing in both.
  function label(el){
    var t = el.tagName;
    if (/^H[1-6]$/.test(t)) return "Заголовок";
    if (t==="P") return "Абзац";
    if (t==="A") return "Ссылка"; if (t==="BUTTON") return "Кнопка"; if (t==="IMG") return "Фото"; if (t==="VIDEO") return "Видео";
    if (t==="UL"||t==="OL") return "Список"; if (t==="LI") return "Пункт";
    if (t==="SECTION") return "Секция"; if (t==="SPAN") return "Текст";
    var c = (el.getAttribute("class")||"").split(" ")[0];
    return c ? ("." + c).slice(0, 18) : "Блок";
  }
  function crumbs(el){
    var out = [], cur = el;
    while (cur && !cur.hasAttribute("data-lg-block")){
      if (cur.getAttribute("data-lg-id")) out.unshift({ id: cur.getAttribute("data-lg-id"), label: label(cur) });
      cur = cur.parentElement;
    }
    return out.slice(-6); // deepest 6
  }
  function px(v){ return Math.round(parseFloat(v)) || 0; }
  // ---- Layers tree (DOM subtree of a block, for the left panel) ----
  function isHidden(el){ return el.style.display === "none"; }
  function buildTree(el, depth, budget){
    var node = { id: el.getAttribute("data-lg-id"), label: label(el), tag: el.tagName, hidden: isHidden(el), children: [] };
    budget.n++;
    var ch = el.children;
    if (depth < 7 && ch.length){
      for (var i=0;i<ch.length;i++){
        var c = ch[i], t = c.tagName;
        if (t==="SCRIPT"||t==="STYLE"||t==="BR") continue;
        if (budget.n >= 320){ node.more = true; break; }
        node.children.push(buildTree(c, depth+1, budget));
      }
    } else if (ch.length) node.more = true;
    return node;
  }
  function blockTree(w){
    var budget = { n:0 }, out = [], ch = w.children;
    for (var i=0;i<ch.length;i++){ var t = ch[i].tagName; if (t==="SCRIPT"||t==="STYLE") continue; out.push(buildTree(ch[i], 0, budget)); }
    return out;
  }
  // ---- Hover highlight (1px accent outline + faint fill + label chip on the hovered element) ----
  var isDragging = false, hoverBox = null, hoverTag = null;
  function ensureHover(){
    if (hoverBox) return;
    hoverBox = document.createElement("div"); hoverBox.className = "lg-hoverbox"; document.body.appendChild(hoverBox);
    hoverTag = document.createElement("div"); hoverTag.className = "lg-hovertag"; document.body.appendChild(hoverTag);
  }
  function showHover(el){
    ensureHover();
    var r = el.getBoundingClientRect();
    hoverBox.style.display = "block";
    hoverBox.style.top = (r.top + window.scrollY) + "px"; hoverBox.style.left = (r.left + window.scrollX) + "px";
    hoverBox.style.width = r.width + "px"; hoverBox.style.height = r.height + "px";
    hoverTag.style.display = "block"; hoverTag.textContent = label(el);
    hoverTag.style.top = Math.max(0, r.top + window.scrollY - 17) + "px"; hoverTag.style.left = (r.left + window.scrollX) + "px";
    // Show the ⠿ reorder grip on the reorderable card under the cursor; hide it otherwise (the
    // selected element shows the resize box instead).
    var item = autoItem(el);
    if (item) positionHandle(item);
    else if (handle) handle.style.display = "none";
  }
  function hideHover(){
    if (hoverBox){ hoverBox.style.display = "none"; hoverTag.style.display = "none"; }
    if (handle && !isDragging) handle.style.display = "none";
  }
  // ---- Flow drag (reorder among siblings; moves the real node, never position:absolute) ----
  var handle = null, dropLine = null, handleEl = null;
  function overlays(){
    if (!handle){
      handle = document.createElement("div"); handle.className = "lg-handle"; handle.textContent = "⠿";
      handle.title = "Перетащите, чтобы поменять местами"; document.body.appendChild(handle);
      handle.addEventListener("pointerdown", startDrag);
    }
    if (!dropLine){ dropLine = document.createElement("div"); dropLine.className = "lg-dropline"; document.body.appendChild(dropLine); }
  }
  function positionHandle(el){
    overlays(); handleEl = el;
    var r = el.getBoundingClientRect(), z = curZoom || 1, s = 22 / z;
    handle.style.width = s + "px"; handle.style.height = s + "px";
    handle.style.margin = (-s / 2) + "px 0 0 " + (-s / 2) + "px";
    handle.style.fontSize = (12 / z) + "px";
    handle.style.display = "flex";
    handle.style.top = (r.top + window.scrollY) + "px";
    handle.style.left = (r.left + window.scrollX) + "px";
  }
  // The nearest "auto-layout item" ancestor: a direct child of a flex/grid container that has ≥2
  // visible item-siblings (e.g. a service card in the marquee row). These are the reorderable units.
  function autoItem(el){
    var cur = el;
    while (cur && cur.parentElement && !cur.hasAttribute("data-lg-block")){
      var par = cur.parentElement, d = getComputedStyle(par).display;
      if (d==="flex"||d==="grid"||d==="inline-flex"||d==="inline-grid"){
        var sibs = 0, ch = par.children;
        for (var i=0;i<ch.length;i++){ if (ch[i].nodeType===1 && ch[i].getAttribute("data-lg-id") && getComputedStyle(ch[i]).display!=="none") sibs++; }
        if (sibs>=2) return cur;
      }
      cur = par;
    }
    return null;
  }
  // ---- auto layout ---------------------------------------------------------------------------
  // Elements sitting side by side belong together: shrinking the text tile must shrink the video
  // next to it, and everything below should follow, keeping its spacing — auto layout, like Figma.
  // Sizing one box in isolation is what tore the hero apart (a 400px column beside a 656px one).
  // rowGroup finds that shared row: the nearest ancestor that is a grid/flex item sharing its row
  // with at least one visible sibling, together with the container holding them.
  function rowGroup(el){
    var cur = el;
    while (cur && cur.parentElement && !cur.hasAttribute("data-lg-block")){
      var par = cur.parentElement;
      if (par.hasAttribute("data-lg-block")) break;
      var dsp = getComputedStyle(par).display;
      if (dsp==="flex"||dsp==="grid"||dsp==="inline-flex"||dsp==="inline-grid"){
        var items = [], ch = par.children, mine = null;
        for (var i=0;i<ch.length;i++){
          var c = ch[i];
          if (c.nodeType !== 1) continue;
          if (String(c.className||"").indexOf("lg-") === 0) continue;  // editor overlay
          if (getComputedStyle(c).display === "none") continue;
          var rr = c.getBoundingClientRect();
          if (rr.width < 2 || rr.height < 2) continue;
          var rec = { el: c, r: rr };
          items.push(rec);
          if (c === cur) mine = rec;
        }
        if (mine && items.length >= 2){
          var row = [];
          for (var k=0;k<items.length;k++){
            var o = items[k];
            var ov = Math.min(o.r.bottom, mine.r.bottom) - Math.max(o.r.top, mine.r.top);
            if (ov > Math.min(o.r.height, mine.r.height) * 0.5) row.push(o);  // shares this row
          }
          if (row.length >= 2) return { parent: par, item: cur, row: row };
        }
      }
      cur = par;
    }
    return null;
  }
  // Write a value into a specific breakpoint layer regardless of which device is being shown.
  function setBpProp(elId, layer, prop, val){
    if (!elId) return;
    var store = bp[layer] || (bp[layer] = {}), rec = store[elId] || (store[elId] = {});
    if (val === "") delete rec[prop]; else rec[prop] = val;
    if (!Object.keys(rec).length) delete store[elId];
  }
  function startDrag(e){
    e.preventDefault(); e.stopPropagation();
    var el = handleEl; if (!el || !el.parentElement) return;
    var parent = el.parentElement, sx = e.clientX, sy = e.clientY, moved = false, ref = null, before = true;
    function move(ev){
      if (!moved && Math.abs(ev.clientX-sx) + Math.abs(ev.clientY-sy) < 4) return;
      if (!moved){ moved = true; isDragging = true; hideHover(); el.classList.add("lg-dragging"); handle.style.cursor = "grabbing"; }
      var sibs = [].slice.call(parent.children).filter(function(c){ return c.nodeType===1 && c!==el && c!==handle && c!==dropLine && c.getBoundingClientRect().height; });
      // Detect row vs stack: if siblings differ more horizontally than vertically → horizontal.
      var horiz = false;
      if (sibs.length >= 2){ var a = sibs[0].getBoundingClientRect(), b = sibs[1].getBoundingClientRect(); horiz = Math.abs(b.left-a.left) > Math.abs(b.top-a.top); }
      var best = null, bb = true;
      for (var i=0;i<sibs.length;i++){
        var r = sibs[i].getBoundingClientRect();
        var mid = horiz ? (r.left + r.width/2) : (r.top + r.height/2);
        var cur = horiz ? ev.clientX : ev.clientY;
        if (cur < mid){ best = sibs[i]; bb = true; break; }
        best = sibs[i]; bb = false;
      }
      ref = best; before = bb;
      if (best){
        var rr = best.getBoundingClientRect();
        dropLine.style.display = "block";
        if (horiz){
          dropLine.style.width = "3px";
          dropLine.style.height = rr.height + "px";
          dropLine.style.left = ((before ? rr.left : rr.right) + window.scrollX - 1) + "px";
          dropLine.style.top = (rr.top + window.scrollY) + "px";
        } else {
          dropLine.style.height = "3px";
          dropLine.style.width = rr.width + "px";
          dropLine.style.left = (rr.left + window.scrollX) + "px";
          dropLine.style.top = ((before ? rr.top : rr.bottom) + window.scrollY - 1) + "px";
        }
      } else dropLine.style.display = "none";
    }
    function up(){
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      isDragging = false;
      el.classList.remove("lg-dragging"); handle.style.cursor = "grab"; dropLine.style.display = "none";
      if (moved && ref){
        parent.insertBefore(el, before ? ref : ref.nextSibling);
        positionHandle(el);
        var w = el.closest(W); if (w) save(w.getAttribute("data-lg-block"));
      }
    }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ---- Figma-style resize box: a frame with 8 handles on the SELECTED element; drag an edge to set
  // width (text reflows live), a corner for width+height. Values route per-breakpoint (desktop=inline,
  // tablet/mobile=@media) via the same override system, so a box has its own width per device. ----
  var selBox = null;
  function ensureSelBox(){
    if (selBox) return;
    selBox = document.createElement("div"); selBox.className = "lg-selbox"; document.body.appendChild(selBox);
    ["nw","n","ne","e","se","s","sw","w"].forEach(function(dir){
      var h = document.createElement("div"); h.className = "lg-rh lg-rh--"+dir; h.setAttribute("data-dir", dir);
      h.addEventListener("pointerdown", startResize); selBox.appendChild(h);
    });
  }
  function positionSelBox(el){
    ensureSelBox();
    var r = el.getBoundingClientRect();
    // A box that extends past the canvas edge (a card parked off-screen by a marquee, a container
    // dragged wider than the frame) must STAY grabbable: the frame is clamped to the viewport, so
    // at least one edge handle is always on screen and the client can always pull the box back.
    // The drag math is relative (dx from where the pointer went down), so a clamped handle resizes
    // exactly like a true-edge one.
    var vw = document.documentElement.clientWidth || 390;
    var left = r.left, right = r.left + r.width;
    if (left < 4) left = 4;
    if (right > vw - 4) right = vw - 4;
    if (right - left < 24){ if (r.left < 4) right = Math.min(vw - 4, left + 24); else left = Math.max(4, right - 24); }
    selBox.style.display = "block";
    selBox.style.top = (r.top + window.scrollY) + "px"; selBox.style.left = (left + window.scrollX) + "px";
    selBox.style.width = (right - left) + "px"; selBox.style.height = r.height + "px";
    // Counter-scale the frame + handles so they stay ~9px on screen at any canvas zoom.
    var z = curZoom || 1;
    selBox.style.setProperty("--hs", (9 / z) + "px");
    selBox.style.setProperty("--ht", (24 / z) + "px");   // grabbable area, WCAG 2.5.8
    selBox.style.setProperty("--ow", (1.5 / z) + "px");
  }
  function hideSelBox(){ if (selBox) selBox.style.display = "none"; }
  // Set a CSS prop on an element, routed to the current breakpoint (inline base OR @media rule).
  // A gesture (a drag, a slider sweep) is ONE undo step. The runtime marks its boundaries so the host
  // can group every change it produces — including ones that land in different stores — into a single
  // transaction. Without this a drag that touches both the markup and the device rules produced two
  // history entries, so one Ctrl+Z only undid half of it and looked like undo was broken.
  function txnBegin(){ parent.postMessage({ type:"lg-txn-begin" }, "*"); }
  function txnEnd(){ parent.postMessage({ type:"lg-txn-end" }, "*"); }

  // Undo/redo from INSIDE the canvas. The editor's shortcuts live on the parent window, but while you
  // are typing in the page the keyboard belongs to this document, so Ctrl+Z never reached them — undo
  // appeared dead exactly when it is needed most. Worse, the browser's own contenteditable undo would
  // run instead and silently pull the DOM out of step with our history, so we suppress it and hand the
  // gesture to the editor.
  document.addEventListener("keydown", function(e){
    var ce = e.target && e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!(e.ctrlKey || e.metaKey)){
      if (!ce) return;
      if (e.key === "Enter"){
        // The browser answers Enter inside foreign markup by SPLITTING the element — a heading becomes
        // two nodes, the second one without the site's classes, and that structure gets published.
        // A line break is what the client actually wants here, and it keeps the block intact.
        e.preventDefault();
        document.execCommand("insertLineBreak");
      } else if (e.key === "Escape"){
        // A way out of a text field that does not need the mouse.
        e.preventDefault();
        ce.blur();
      }
      return;
    }
    var k = (e.key || "").toLowerCase();
    if (k === "z" || k === "y"){
      e.preventDefault();
      var redo = (k === "y") || e.shiftKey;
      parent.postMessage({ type: redo ? "lg-redo" : "lg-undo" }, "*");
    }
  }, true);

  // Remember an element's ORIGINAL inline style the first time we touch it, so "reset" can restore
  // exactly what the site shipped instead of guessing which declarations were ours.
  function stashOriginal(el){
    if (el.hasAttribute("data-lg-style0")) return;
    el.setAttribute("data-lg-style0", el.getAttribute("style") || "");
  }
  /**
   * A desktop style edit is written BOTH inline and as a base-layer rule, on purpose.
   *
   * Inline alone is not enough: it carries no !important, so any rule in the PAGE's own stylesheet
   * that does carries the day and the element simply refuses to move. That is not hypothetical — the
   * pages imported from the site's previous editor pin width/max-width/grid-template-columns with
   * !important on the very elements a client wants to drag, and Webflow's own classes do the same
   * (which is what unclampWidth was already fighting, one property at a time).
   *
   * The base layer is the answer that already exists here: it renders as an
   * [data-lg-id="…"]:not(#lgcmsx){…!important} rule — id-level specificity, so it outranks both of
   * those, while still being emitted BEFORE the tablet/phone blocks, so a per-device rule still wins
   * at its own width. Inline !important could never do that, which is why width was left plain.
   *
   * The inline value stays because it is what the panel reads back and what "Сбросить оформление"
   * restores from data-lg-style0.
   */
  function setStyleProp(el, prop, val, prio){
    var id = el.getAttribute("data-lg-id");
    if (curBp === "desktop"){
      stashOriginal(el);
      el.style.setProperty(prop, val, prio || "");
      if (id){
        var bstore = bp.base || (bp.base = {}), brec = bstore[id] || (bstore[id] = {});
        if (val === "") delete brec[prop]; else brec[prop] = val;
        if (!Object.keys(brec).length) delete bstore[id];
        baseDirty = true;
        renderOverrides();
      }
    }
    else {
      var store = bp[curBp] || (bp[curBp] = {}), rec = store[id] || (store[id] = {});
      if (val === "") delete rec[prop]; else rec[prop] = val;
      if (!Object.keys(rec).length) delete store[id];
      renderOverrides();
    }
  }
  function commitStyle(el){
    var wblk = el.closest(W);
    if (curBp === "desktop"){
      if (wblk) save(wblk.getAttribute("data-lg-block"));
      // The rules changed too, not just the markup — the host stores them separately.
      if (baseDirty){ baseDirty = false; parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*"); }
    }
    else parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*");
  }
  // Remove EVERY constraint that stops a text box from being dragged wider than its current layout
  // size. This is the hero-heading fix (heading_hero-home is a flex item its parent clamped)
  // generalized to ALL text: flex-shrink un-clamps a flex item; max-width/min-width neutralize any cap
  // -- and they're forced important so a foreign Webflow class (e.g. a .max-width-large rule setting
  // max-width with !important, or a min-width class) can't silently win, which is why the box "just
  // won't stretch" on some headings. NOTE: width itself is deliberately NOT important -- it must stay
  // overridable by the per-device media rules (inline important would break tablet/mobile). On
  // breakpoints these land in the media sheet (renderOverrides already forces important there).
  function unclampWidth(el){
    setStyleProp(el, "flex-shrink", "0", "important");
    setStyleProp(el, "max-width", "none", "important");
    setStyleProp(el, "min-width", "0", "important");
  }
  // Auto-height TEXT = a heading/paragraph or any contenteditable field. Its height must FOLLOW its
  // content — never a locked px value, or a client's vertical drag bakes e.g. height:506px that
  // overflows at other widths / font sizes (the live hero bug). Vertical resize on text is a no-op.
  function isAutoText(el){
    return el.isContentEditable || /^(H[1-6]|P|LI|BLOCKQUOTE|FIGCAPTION|DT|DD)$/.test(el.tagName);
  }
  // ---- updating a block in place -------------------------------------------------------------------
  // Every incoming update used to assign the whole innerHTML: every node in the block was rebuilt and
  // rebuilt. That takes the caret with it (so a collaborator's edit, or an undo, interrupted whoever
  // was typing), resets the site's own widgets inside the block (sliders, players, accordions), and
  // re-stamps ids for elements that never changed. Now the incoming markup is compared against the
  // live DOM and only the actual differences are applied.
  //
  // Attributes the EDITOR owns are never taken from the incoming copy — they belong to the live node
  // and removing them would blur the field or drop its identity.
  var OWN_ATTRS = { "data-lg-id":1, "data-lg-el":1, "data-lg-style0":1, "contenteditable":1, "spellcheck":1 };
  function syncAttrs(cur, next){
    var an = cur.attributes, i;
    for (i = an.length - 1; i >= 0; i--){
      var name = an[i].name;
      if (OWN_ATTRS[name]) continue;
      if (!next.hasAttribute(name)) cur.removeAttribute(name);
    }
    var bn = next.attributes;
    for (i = 0; i < bn.length; i++){
      var n2 = bn[i].name;
      if (OWN_ATTRS[n2]) continue;
      var v = bn[i].value;
      if (n2 === "class" && cur.classList.contains("lg-selected")) v = v + " lg-selected";
      if (cur.getAttribute(n2) !== v) cur.setAttribute(n2, v);
    }
  }
  function morph(cur, next){
    if (cur.nodeType === 1 && next.nodeType === 1) syncAttrs(cur, next);
    morphChildren(cur, next);
  }
  /** The block WRAPPER is ours (data-lg-block, display:contents) and is not part of the incoming
   *  markup — syncing its attributes would strip the very thing that identifies the block. */
  function morphChildren(cur, next){
    var a = cur.childNodes, b = next.childNodes, i = 0;
    while (i < b.length){
      var bn = b[i], an = a[i];
      if (!an){ cur.appendChild(document.importNode(bn, true)); i++; continue; }
      var swap = an.nodeType !== bn.nodeType ||
        (an.nodeType === 1 && an.tagName !== bn.tagName) ||
        (an.nodeType === 1 && an.getAttribute("data-lg-id") && bn.nodeType === 1 &&
         bn.getAttribute("data-lg-id") && an.getAttribute("data-lg-id") !== bn.getAttribute("data-lg-id"));
      if (swap){ cur.replaceChild(document.importNode(bn, true), an); i++; continue; }
      if (an.nodeType === 3 || an.nodeType === 8){
        if (an.nodeValue !== bn.nodeValue) an.nodeValue = bn.nodeValue;   // touch text only when it differs
      } else if (an.nodeType === 1){
        morph(an, bn);
      }
      i++;
    }
    while (a.length > b.length) cur.removeChild(a[a.length - 1]);
  }

  // ---- pasting -----------------------------------------------------------------------------------
  // Text pasted from Word, Google Docs or a web page arrives as full markup: foreign fonts and colours,
  // mso-* declarations, <o:p> tags, and images pointing at file:///…/clip_image001.png that exist only
  // on the author's own machine. None of that was ever cleaned, so it went into the client's published
  // site as-is. Keep the meaning of the text — bold, italic, links, lists — and drop the rest.
  var PASTE_KEEP = { B:1, STRONG:1, I:1, EM:1, U:1, BR:1, A:1, UL:1, OL:1, LI:1, P:1, SPAN:1 };
  function sanitizePaste(html){
    var box = document.createElement("div");
    box.innerHTML = html;
    var dropped = 0;
    var junk = box.querySelectorAll("script,style,link,meta,iframe,object,embed,form,input,button,select,textarea,svg,video,audio,img,table");
    for (var j=0;j<junk.length;j++){ if (junk[j].tagName === "IMG" || junk[j].tagName === "TABLE") dropped++; junk[j].remove(); }
    var els = box.querySelectorAll("*");
    for (var i=els.length-1;i>=0;i--){
      var el = els[i];
      if (!PASTE_KEEP[el.tagName]){
        // Unwrap rather than delete: the words inside are what the client actually meant to paste.
        while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
        el.remove();
        continue;
      }
      var names = el.getAttributeNames();
      for (var a=0;a<names.length;a++){
        if (el.tagName === "A" && names[a] === "href") continue;
        el.removeAttribute(names[a]);
      }
      if (el.tagName === "A"){
        var h = safeHref(el.getAttribute("href") || "");
        if (h) el.setAttribute("href", h); else el.removeAttribute("href");
      }
    }
    return { html: box.innerHTML, dropped: dropped };
  }
  function onPaste(e){
    var host = e.target && e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!host) return;
    var dt = e.clipboardData; if (!dt) return;
    e.preventDefault();
    var raw = dt.getData("text/html");
    var clean = raw ? sanitizePaste(raw) : { html: null, dropped: 0 };
    if (clean.html != null && clean.html.replace(/<[^>]*>/g, "").trim()){
      document.execCommand("insertHTML", false, clean.html);
    } else {
      // No usable markup (or a plain-text copy): insert the text, keeping line breaks.
      // NB: this whole runtime lives in a template literal, so every backslash must be DOUBLED —
      // single ones are eaten as escape sequences, and a regex containing a carriage return escape
      // ends up broken across two lines, which stops the entire runtime from parsing.
      var txt = (dt.getData("text/plain") || "").replace(/\\r\\n?/g, "\\n");
      document.execCommand("insertText", false, txt);
    }
    if (clean.dropped) parent.postMessage({ type:"lg-paste-note" }, "*");
  }
  // A file dropped onto the canvas would otherwise NAVIGATE the iframe to it — the page vanishes and
  // looks broken. Dropped text is pasted through the same cleaning path.
  function onDrop(e){
    var host = e.target && e.target.closest && e.target.closest('[contenteditable="true"]');
    if (!host){ if (e.dataTransfer && e.dataTransfer.types && [].indexOf.call(e.dataTransfer.types,"Files")>=0) e.preventDefault(); return; }
    e.preventDefault();
    var dt = e.dataTransfer; if (!dt) return;
    var raw = dt.getData("text/html");
    var clean = raw ? sanitizePaste(raw) : { html: null, dropped: 0 };
    if (clean.html != null && clean.html.replace(/<[^>]*>/g, "").trim()) document.execCommand("insertHTML", false, clean.html);
    else document.execCommand("insertText", false, dt.getData("text/plain") || "");
  }

  // The editable element a Range still lives in, or null when the range is detached — its nodes were
  // replaced (undo, restored section, re-rendered block) and it can no longer be used for anything.
  function rangeHost(r){
    if (!r || !r.startContainer || !r.endContainer) return null;
    if (!r.startContainer.isConnected || !r.endContainer.isConnected) return null;
    var n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    if (!n || !n.closest) return null;
    var host = n.closest('[contenteditable="true"]');
    return host && document.contains(host) ? host : null;
  }
  function startResize(e){
    e.preventDefault(); e.stopPropagation();
    var el = selected; if (!el) return;
    var dir = e.currentTarget.getAttribute("data-dir");
    var r = el.getBoundingClientRect(), startX = e.clientX, startY = e.clientY, startW = r.width, startH = r.height;
    // A vertical drag resizes the whole ROW, so every column follows and the content below moves with
    // it, instead of one box changing height on its own and breaking the alignment.
    var rg = isAutoText(el) ? null : rowGroup(el);
    var vTarget = rg ? rg.parent : el;
    var vStartH = vTarget.getBoundingClientRect().height;
    var vId = vTarget.getAttribute("data-lg-id");
    var touchedBp = false;
    // A horizontal drag inside a GRID row has to re-split the row's columns, or the neighbour keeps
    // its track and the dragged box simply overflows it. Capture the row's real track widths up front.
    var gridPair = null;
    if (rg && /grid/.test(getComputedStyle(rg.parent).display || "")){
      var tpl = getComputedStyle(rg.parent).gridTemplateColumns || "";
      var tracks = tpl.split(" ").map(parseFloat);
      if (tracks.length > 1 && tracks.every(function(t){ return isFinite(t) && t > 0; })){
        // Which track holds the dragged item: walk the row by left edge.
        var pr = rg.parent.getBoundingClientRect();
        var gap = parseFloat(getComputedStyle(rg.parent).columnGap) || 0;
        var x = pr.left + (parseFloat(getComputedStyle(rg.parent).paddingLeft) || 0), idx = -1;
        for (var t2 = 0; t2 < tracks.length; t2++){
          if (rg.item.getBoundingClientRect().left < x + tracks[t2] + gap / 2){ idx = t2; break; }
          x += tracks[t2] + gap;
        }
        // Pair with the neighbour on the side being dragged, so the row's total width never changes.
        var mate = dir.indexOf("e") >= 0 ? idx + 1 : idx - 1;
        if (idx >= 0 && mate >= 0 && mate < tracks.length){
          gridPair = { tracks: tracks.slice(), idx: idx, mate: mate, id: rg.parent.getAttribute("data-lg-id"), el: rg.parent };
        }
      }
    }
    isDragging = true; hideHover(); txnBegin();   // whole drag = one undo step
    // A split-text field cannot re-wrap - dissolve it into one flow the moment the client takes a
    // horizontal handle, so the words actually follow the box being dragged. One undo step with the
    // drag itself; the block is saved by the same commit.
    if ((dir.indexOf("e") >= 0 || dir.indexOf("w") >= 0) && el.isContentEditable && el.children.length){
      flattenTextFlow(el);
    }
    function move(ev){
      var dw = ev.clientX - startX, dh = ev.clientY - startY, w = startW, h = startH;
      if (dir.indexOf("e") >= 0) w = Math.max(20, startW + dw);
      if (dir.indexOf("w") >= 0) w = Math.max(20, startW - dw);
      if (dir.indexOf("s") >= 0) h = Math.max(24, vStartH + dh);
      if (dir.indexOf("n") >= 0) h = Math.max(24, vStartH - dh);
      if (dir.indexOf("e") >= 0 || dir.indexOf("w") >= 0){
        // Never let the box grow past the frame edge — on ANY device. Otherwise it overflows the page
        // and its resize handles land off the visible canvas where they can't be grabbed ("уходит за
        // холст"). The frame width is the device viewport (desktop = the selected canvas width), so
        // this still allows growing well beyond a narrow parent, just not off the page.
        var vpW = document.documentElement.clientWidth || 390;
        var maxW = vpW - Math.max(0, r.left) - 6;
        if (maxW < 40) maxW = vpW - 12;
        if (w > maxW) w = maxW;
        if (gridPair){
          // Move the boundary between two columns: what one gains, the neighbour gives up, so the row
          // keeps its total width and everything below stays put.
          var delta = Math.round(w) - Math.round(startW);
          var own = gridPair.tracks[gridPair.idx] + delta;
          var other = gridPair.tracks[gridPair.mate] - delta;
          if (own >= 40 && other >= 40){
            // From this gesture on, the TRACKS govern the row. A width an old drag once saved onto a
            // column's own box would otherwise sit under the tracks as that column's minimum and veto
            // this very gesture - the boundary drags and nothing moves (the dead подложка bug).
            if (!gridPair.cleared){
              gridPair.cleared = true;
              for (var q3 = 0; q3 < rg.row.length; q3++){
                var it = rg.row[q3].el;
                setStyleProp(it, "width", ""); setStyleProp(it, "max-width", "");
                setStyleProp(it, "min-width", ""); setStyleProp(it, "flex-shrink", "");
              }
            }
            var line = gridPair.tracks.slice();
            line[gridPair.idx] = own; line[gridPair.mate] = other;
            var value = line.map(function(t){ return Math.round(t) + "px"; }).join(" ");
            // Written as a RULE, not an inline style: an inline value would also apply on tablet and
            // phone, where this row stacks and must not keep desktop columns.
            if (curBp === "desktop" && gridPair.id){
              setBpProp(gridPair.id, "base", "grid-template-columns", value);
              setBpProp(gridPair.id, "tablet", "grid-template-columns", "none");
              setBpProp(gridPair.id, "mobile", "grid-template-columns", "none");
              touchedBp = true;
              renderOverrides();
            } else {
              setStyleProp(gridPair.el, "grid-template-columns", value);
            }
          }
        } else {
          setStyleProp(el, "width", Math.round(w) + "px");
          unclampWidth(el);
        }
      }
      if ((dir.indexOf("s") >= 0 || dir.indexOf("n") >= 0) && !isAutoText(el)){
        setStyleProp(vTarget, "height", Math.round(h) + "px");
        if (rg){
          // Let the columns fill the row instead of holding their own heights, so they move together.
          setStyleProp(vTarget, "align-items", "stretch");
          for (var q = 0; q < rg.row.length; q++) setStyleProp(rg.row[q].el, "height", "");
          // A desktop height must not squash the phone, where the same row stacks and needs MORE
          // room: release it below the desktop breakpoints (inline styles otherwise leak downward).
          if (curBp === "desktop" && vId){
            setBpProp(vId, "tablet", "height", "auto");
            setBpProp(vId, "mobile", "height", "auto");
            touchedBp = true;
            renderOverrides();
          }
        } else {
          setStyleProp(el, "flex-shrink", "0", "important");
        }
      }
      positionSelBox(el);
    }
    function up(){
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      isDragging = false;
      commitStyle(el);
      // The auto tablet/mobile release above lives in the breakpoint layers — persist it too.
      if (touchedBp) parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*");
      txnEnd();
      select(el); // refresh panel (width/height changed)
    }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  /**
   * THE RULE: nothing moves while you are editing it.
   *
   * A card in the services marquee cannot be worked on while it is sliding past — the click lands on
   * whatever has drifted under the cursor, and the panel then describes a different card. That is not
   * a marquee problem, it is true of anything in motion, so the freeze is written once and applies to
   * every moving thing on the page: CSS animations and transitions are paused through a class on the
   * document, and GSAP (which is what actually drives this site's marquee — the elements carry no CSS
   * animation at all) has its global timeline paused. Motion resumes the moment the selection goes.
   *
   * Videos are deliberately left running: the client asked for those to always play.
   */
  function freezeMotion(on){
    var root = document.documentElement;
    if (on === !!root.getAttribute("data-lg-frozen")) return;
    if (on) root.setAttribute("data-lg-frozen", "1"); else root.removeAttribute("data-lg-frozen");
    var g = window.gsap || (window.GreenSockGlobals && window.GreenSockGlobals.gsap);
    if (g && g.globalTimeline){
      try { if (on) g.globalTimeline.pause(); else g.globalTimeline.resume(); } catch(e){}
    }
  }

  /**
   * Is the thing that was just selected actually moving? Asked by watching it, not by recognising it:
   * measure where it is, look again two frames later, and if it has travelled, hold the page still.
   * No class names, no list of "marquee-like" components — whatever moves it (CSS, GSAP, a script we
   * have never seen) is caught the same way, and a static element never freezes anything.
   */
  // Clicking a media wrapper should select the MEDIA, not the wrapper. Webflow buries an <img>/<video>
  // under one or more divs (a background-video has its own layers), so the click resolves to the
  // container and the panel offers "Контейнер" with no "replace" button. When the resolved element is
  // essentially a single image or video — one media inside, filling most of the box — select that
  // media instead, so "заменить фото/видео" is always one click away. A section that merely contains a
  // small logo is untouched (the media must cover most of the wrapper).
  function preferMedia(el, x, y){
    var k = kindOf(el);
    if (k === "image" || k === "video") return el;
    var media = el.querySelectorAll ? el.querySelectorAll("img,video") : [];
    if (media.length !== 1) return el;
    var m = media[0];
    // The click landed ON the single media — take it, even inside a card <a> with a caption. This is
    // how a photo click on a services card reaches "заменить фото" instead of selecting the link.
    if (x != null){
      var b = m.getBoundingClientRect();
      if (b.width > 2 && b.height > 2 && x >= b.left - 2 && x <= b.right + 2 && y >= b.top - 2 && y <= b.bottom + 2) return m;
    }
    // A wrapper whose whole point IS the media (no own text — a background-video box, an image tile)
    // selects that media even when it has been collapsed to a sliver by a bad edit, so it can be fixed
    // or replaced. Where the wrapper also has its own text, a plain click keeps editing the text.
    if (!(el.textContent || "").trim()) return m;
    return el;
  }

  function watchMotion(el){
    if (!el || !el.getBoundingClientRect) return;
    var a = el.getBoundingClientRect();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        if (selected !== el || !document.contains(el)) return;
        var b = el.getBoundingClientRect();
        if (Math.abs(a.left - b.left) > 0.5 || Math.abs(a.top - b.top) > 0.5) freezeMotion(true);
      });
    });
  }

  /**
   * THE RULE: change one copy, change every copy.
   *
   * A running strip is built by repeating its content — the services marquee ships the same eleven
   * cards twice so the loop has no seam. Replacing a photo in the copy you can reach leaves the other
   * copy holding the old one, which then slides past a second later: the edit looks like it did not
   * take. Header and footer already work this way ACROSS pages; this is the same idea WITHIN one.
   *
   * A "copy" is proven, not guessed: walking up from the edited element, the first ancestor that has a
   * sibling with the same tag, the same classes AND the same text is a repeated track. Anything that
   * merely looks similar — two different service cards in a grid — has different text and is left alone.
   *
   * Inside the twin, the counterpart is found by ORDINAL among elements of the same tag and classes,
   * not by walking the same child indices: measured here, the two strips are not clones — one card
   * carries an arrow button the other does not, so the paths differ while the eleven photos and the
   * eleven titles line up one for one. The counterpart is only used when the twin holds the same
   * NUMBER of them, which is what proves the two lists are actually parallel.
   */
  function copyTwinsOf(el){
    var wrap = el.closest(W); if (!wrap) return [];
    var norm = function(s){ return (s || "").replace(/[\\s\\u00a0]+/g, " ").trim(); };
    // The transient selection class is ours and is not part of what makes two elements the same kind.
    var cls = (el.getAttribute("class") || "").split(/\\s+/).filter(function(c){ return c && c !== "lg-selected"; });
    var sel = el.tagName.toLowerCase() + (cls.length ? "." + cls.join(".") : "");
    var node = el;
    while (node && node.parentElement && node.parentElement !== wrap && node !== wrap){
      var par = node.parentElement, mine = norm(node.textContent), twins = [], i;
      if (mine){
        for (i = 0; i < par.children.length; i++){
          var s = par.children[i];
          if (s !== node && s.tagName === node.tagName
            && s.getAttribute("class") === node.getAttribute("class")
            && norm(s.textContent) === mine) twins.push(s);
        }
      }
      if (twins.length){
        var here, idx = -1;
        try { here = node.querySelectorAll(sel); } catch(e){ return []; }
        for (i = 0; i < here.length; i++) if (here[i] === el){ idx = i; break; }
        if (idx < 0) return [];
        var out = [];
        for (i = 0; i < twins.length; i++){
          var mates;
          try { mates = twins[i].querySelectorAll(sel); } catch(e){ continue; }
          if (mates.length === here.length && mates[idx]) out.push(mates[idx]);
        }
        return out;
      }
      node = par;
    }
    return [];
  }
  /** Run the same change on the element and on every copy of it inside the block. */
  function onEveryCopy(el, fn){
    var twins = copyTwinsOf(el);
    fn(el);
    for (var i = 0; i < twins.length; i++) fn(twins[i]);
    return twins.length;
  }

  /** Nothing selected: the page is the visitor's again, so let it move. */
  function deselect(){
    if (selected) selected.classList.remove("lg-selected");
    selected = null;
    hideSelBox(); hideHover();
    if (handle) handle.style.display = "none";
    freezeMotion(false);
    parent.postMessage({ type:"lg-elem-deselect" }, "*");
  }

  function select(el){
    if (selected) selected.classList.remove("lg-selected");
    selected = el; el.classList.add("lg-selected");
    // Release any freeze from a previously-selected moving element; watchMotion re-freezes only if
    // THIS element is the one that moves. Without this, selecting the marquee card froze the strip and
    // then selecting anything static left it frozen forever ("замирает, но не отмирает").
    freezeMotion(false);
    watchMotion(el);
    hideHover();
    if (handle) handle.style.display = "none"; // ⠿ reorder grip is hover-driven; selected shows the resize box
    positionSelBox(el);
    var w = el.closest(W), cs = getComputedStyle(el), kind = kindOf(el);
    var fs = parseFloat(cs.fontSize) || 16;
    var lh = cs.lineHeight === "normal" ? 0 : Math.round((parseFloat(cs.lineHeight) / fs) * 100) / 100;
    parent.postMessage({ type:"lg-elem-select", blockId: w && w.getAttribute("data-lg-block"),
      el: el.getAttribute("data-lg-id"), kind: kind, crumbs: crumbs(el),
      text: kind==="image" ? (el.getAttribute("alt")||"") : (el.textContent||"").trim(),
      href: el.getAttribute("href")||"",
      // structured = the text field wraps child elements (word-divs/spans) → "replace all text" would
      // flatten the structure, so the panel edits the pieces instead (see textRuns).
      structured: (kind==="text"||kind==="link") && !!(el.children && el.children.length),
      parts: (kind==="text"||kind==="link") && el.children && el.children.length ? textParts(el) : null,
      bpOver: bpKeysFor(el.getAttribute("data-lg-id")),
      hover: stateInfo(el.getAttribute("data-lg-id"), "hover"),
      active: stateInfo(el.getAttribute("data-lg-id"), "active"),
      // For a <select> (e.g. the book-cleaning form dropdowns) send its options so the panel can edit them.
      selectOptions: el.tagName==="SELECT" ? [].map.call(el.options, function(o){ return { value:o.value, label:(o.textContent||"").trim() }; }) : null,
      tree: w ? blockTree(w) : [],
      style: {
        fontSize: Math.round(fs), color: hex(cs.color),
        weight: parseInt(cs.fontWeight, 10) || 400,
        bold: (parseInt(cs.fontWeight,10)||400) >= 600,
        align: cs.textAlign || "left",
        lineHeight: lh, letterSpacing: cs.letterSpacing === "normal" ? 0 : Math.round((parseFloat(cs.letterSpacing)||0)*10)/10,
        width: el.style.width || "",
        height: el.style.height || "",
        padTop: px(cs.paddingTop), padRight: px(cs.paddingRight), padBottom: px(cs.paddingBottom), padLeft: px(cs.paddingLeft),
        marTop: px(cs.marginTop), marRight: px(cs.marginRight), marBottom: px(cs.marginBottom), marLeft: px(cs.marginLeft),
        background: (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)") ? hex(cs.backgroundColor) : "",
        display: cs.display, flexDir: cs.flexDirection || "row", flexWrap: cs.flexWrap || "nowrap",
        justify: cs.justifyContent || "flex-start", alignItems: cs.alignItems || "stretch",
        gap: cs.gap && cs.gap !== "normal" ? px(cs.gap) : 0
      } }, "*");
  }
  var timers = {};
  // Strip editor state that leaked into a previously-SAVED (dirty) block html — old runtimes stamped
  // contenteditable/data-lg-el/data-lg-id and even the transient lg-selected class onto word-divs,
  // and those persist in localStorage overrides -> stale per-phrase outlines on reload. Clean the slate
  // here; stampIds/editableWithin below re-mark everything fresh.
  function cleanBlock(w){
    // Also catch elements carrying a leaked inline outline / editor helper class even if they have
    // none of the attrs above — old runtimes (incl. the Astro editor.js) left inline outline styles and
    // stray selection classes baked into saved html -> "лишние обводки" on some elements after reload.
    var dirty = w.querySelectorAll(
      ".lg-selected,.lg-hoverbox,.lg-hovertag,.lg-handle,.lg-dropline,.lg-selbox,.lg-dragging," +
      "[contenteditable],[spellcheck],[data-lg-el],[style*='outline'],[style*='Outline']");
    for (var i=0;i<dirty.length;i++){
      var e = dirty[i];
      e.classList.remove("lg-selected","lg-hoverbox","lg-hovertag","lg-handle","lg-dropline","lg-selbox","lg-dragging");
      e.removeAttribute("contenteditable"); e.removeAttribute("spellcheck");
      e.removeAttribute("data-lg-el");
      // data-lg-id is NOT stripped: it is this element's identity, and every per-device rule is keyed
      // to it. Wiping and re-deriving ids from document order meant that deleting or reordering one
      // element shifted every id after it, so the rules silently landed on the wrong nodes.
      // Outline is never a legitimate content style here — strip any leaked inline outline so old
      // editor cruft self-heals on load (keeps every other inline style intact).
      if (e.style){
        e.style.removeProperty("outline"); e.style.removeProperty("outline-offset");
        e.style.removeProperty("outline-width"); e.style.removeProperty("outline-style");
        e.style.removeProperty("outline-color");
      }
      if (e.getAttribute("class") === "") e.removeAttribute("class");
      if (e.getAttribute("style") === "") e.removeAttribute("style");
    }
  }
  function wire(w){
    var id = w.getAttribute("data-lg-block");
    cleanBlock(w);
    stampIds(w, id);
    editableWithin(w);
    // (img cursor:pointer is a CSS rule in the injected <style>, NOT an inline style — keeps block html clean)
    w.addEventListener("input", function(){
      clearTimeout(timers[id]);
      timers[id] = setTimeout(function(){ parent.postMessage({ type:"lg-edit", id:id, html:w.innerHTML }, "*"); }, 450);
    });
  }
  function findEl(blockId, elId){
    var w = document.querySelector('[data-lg-block="'+blockId+'"]');
    return w ? w.querySelector('[data-lg-id="'+elId+'"]') : null;
  }
  function save(blockId){
    var w = document.querySelector('[data-lg-block="'+blockId+'"]');
    if (w) parent.postMessage({ type:"lg-edit", id:blockId, html:w.innerHTML }, "*");
  }
  // Parent -> iframe: image swap + per-element property changes from the panel.
  window.addEventListener("message", function(e){
    var d = e.data; if (!d) return;
    // Breadcrumb / layers → select any element (incl. a container) by id.
    if (d.type === "lg-select-el"){
      var t = document.querySelector('[data-lg-id="'+d.el+'"]'); if (t) select(t); return;
    }
    // Undo/redo: replace a block's inner HTML with a saved version (no reload). Re-wire it afterwards —
    // setting innerHTML drops the runtime attrs (data-lg-id + contenteditable), which would otherwise
    // leave the restored section dead (un-clickable / un-editable). Also drop any stale selection whose
    // node was just detached.
    if (d.type === "lg-set-html"){
      var wb = document.querySelector('[data-lg-block="'+d.blockId+'"]');
      if (wb){
        // Clean the INCOMING copy (old saves can carry leaked editor cruft), never the live one:
        // stripping contenteditable off the node someone is typing in would blur it.
        var box = document.createElement("div");
        box.innerHTML = d.html;
        cleanBlock(box);
        morphChildren(wb, box);
        stampIds(wb, d.blockId); editableWithin(wb);
        // The selection survives unless its element was actually replaced by this update.
        if (selected && !document.contains(selected)){
          selected = null; hideSelBox(); hideHover(); if (handle) handle.style.display = "none";
        } else if (selected && wb.contains(selected)){
          positionSelBox(selected);
        }
      }
      return;
    }
    // Canvas zoom changed → resize the overlay handles so they stay grabbable on screen.
    if (d.type === "lg-zoom"){ curZoom = d.zoom || 1; if (selected) positionSelBox(selected); return; }
    // Device switch: remember the active breakpoint + refresh the panel (computed values change with
    // width). The motion freeze is re-evaluated from scratch: the previously selected element may not
    // even exist at the new width (the desktop marquee is display:none on the phone), and a freeze
    // held for an invisible element reads as "вся страница зависла".
    if (d.type === "lg-device"){
      curBp = d.breakpoint || "desktop";
      if (selected) select(selected);   // select() unfreezes, then re-freezes only what still moves
      else freezeMotion(false);
      return;
    }
    // Load persisted per-breakpoint rules and build the overrides stylesheet.
    if (d.type === "lg-bp-init"){
      bp = { base:(d.rules&&d.rules.base)||{}, tablet:(d.rules&&d.rules.tablet)||{}, mobile:(d.rules&&d.rules.mobile)||{}, hover:(d.rules&&d.rules.hover)||{}, active:(d.rules&&d.rules.active)||{} };
      // Heal a conflict older saves carry: when a grid's column split is governed by an override,
      // its DIRECT children must not be pinned to their own widths - the pin acts as the column's
      // minimum and the split silently stops responding (drag looks dead until the pin dies). The
      // pin is dropped from the DATA, and the host is told so the heal persists past this load.
      // ONLY on the first init of a page: lg-bp-init is also how undo/redo restore breakpoint state,
      // and healing those restores re-recorded history on every step - undo then popped its own
      // heal entries forever and looked completely dead.
      if (!bpHealed){
        bpHealed = true;
        var bs0 = bp.base || {}, healed = false, gid, ci, cid, gel;
        for (gid in bs0){
          if (!bs0[gid] || !bs0[gid]["grid-template-columns"]) continue;
          gel = document.querySelector('[data-lg-id="' + gid + '"]');
          if (!gel) continue;
          for (ci = 0; ci < gel.children.length; ci++){
            cid = gel.children[ci].getAttribute ? gel.children[ci].getAttribute("data-lg-id") : null;
            if (cid && bs0[cid] && bs0[cid]["width"]){
              delete bs0[cid]["width"];
              if (!Object.keys(bs0[cid]).length) delete bs0[cid];
              gel.children[ci].style.removeProperty("width");
              healed = true;
            }
          }
        }
        if (healed) parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*");
      }
      renderOverrides();
      if (selected) select(selected); return;
    }
    // Layers panel: hide/show an element (persisted as inline display:none in the block html).
    if (d.type === "lg-elem-hide"){
      var eh = findEl(d.blockId, d.el); if (!eh) return;
      eh.style.display = d.hidden ? "none" : "";
      save(d.blockId);
      if (selected) select(selected); // refresh tree hidden flags
      return;
    }
    // Delete a single element (not the whole section) — removes the node from the block html + saves.
    if (d.type === "lg-elem-delete"){
      var ed = findEl(d.blockId, d.el); if (!ed) return;
      var wbd = ed.closest(W);
      if (selected === ed){ selected = null; ed.classList.remove("lg-selected"); }
      hideSelBox(); hideHover(); if (handle) handle.style.display = "none";
      // Drop the deleted element's generated rules too — leaving them behind means a stylesheet that
      // keeps growing with rules for nodes that no longer exist.
      txnBegin();
      var gone = [d.el], sub = ed.querySelectorAll("[data-lg-id]");
      for (var gi = 0; gi < sub.length; gi++) gone.push(sub[gi].getAttribute("data-lg-id"));
      var dl = ["base","tablet","mobile","hover","active"], dirtyBp = false;
      for (var di = 0; di < dl.length; di++){
        var st = bp[dl[di]]; if (!st) continue;
        for (var gj = 0; gj < gone.length; gj++) if (st[gone[gj]]){ delete st[gone[gj]]; dirtyBp = true; }
      }
      ed.parentNode && ed.parentNode.removeChild(ed);
      if (dirtyBp){ renderOverrides(); parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*"); }
      if (wbd) save(wbd.getAttribute("data-lg-block"));
      txnEnd();
      parent.postMessage({ type:"lg-elem-deleted", blockId:d.blockId, el:d.el }, "*");
      return;
    }
    // Edit the options of a <select> (form dropdown): rebuild <option>s from the panel + save.
    if (d.type === "lg-select-options"){
      var so = findEl(d.blockId, d.el); if (!so || so.tagName !== "SELECT") return;
      var prev = so.value;
      while (so.firstChild) so.removeChild(so.firstChild);
      (d.options || []).forEach(function(op){
        var o = document.createElement("option");
        var lbl = op.label != null ? op.label : (op.value || "");
        o.value = op.value != null && op.value !== "" ? op.value : lbl; // value = label unless a distinct value was kept
        o.textContent = lbl;
        so.appendChild(o);
      });
      // keep the previously-selected value if it still exists
      if (prev) so.value = prev;
      var wso = so.closest(W); if (wso) save(wso.getAttribute("data-lg-block"));
      if (selected === so) select(so); // refresh the panel's option list
      return;
    }
    // Figma text-box resize mode: hug (width:max-content) / fixed width (auto height) / fixed size.
    if (d.type === "lg-resize-mode"){
      var rm = findEl(d.blockId, d.el); if (!rm) return;
      var rr2 = rm.getBoundingClientRect();
      unclampWidth(rm); // un-clamp from flex/grid parent + any max-width/min-width class
      if (d.mode === "hug"){ setStyleProp(rm, "width", "max-content"); setStyleProp(rm, "height", ""); }
      else if (d.mode === "fixw"){ setStyleProp(rm, "width", Math.round(rr2.width) + "px"); setStyleProp(rm, "height", ""); }
      else if (d.mode === "fixed"){ setStyleProp(rm, "width", Math.round(rr2.width) + "px"); setStyleProp(rm, "height", Math.round(rr2.height) + "px"); }
      commitStyle(rm); select(rm); return;
    }
    // Vertical alignment inside a fixed-height text box (flex column + justify-content).
    if (d.type === "lg-valign"){
      var va = findEl(d.blockId, d.el); if (!va) return;
      if (!d.value){ setStyleProp(va, "display", ""); setStyleProp(va, "flex-direction", ""); setStyleProp(va, "justify-content", ""); }
      else {
        setStyleProp(va, "display", "flex"); setStyleProp(va, "flex-direction", "column");
        setStyleProp(va, "justify-content", d.value === "top" ? "flex-start" : d.value === "center" ? "center" : "flex-end");
      }
      commitStyle(va); select(va); return;
    }
    // Layers panel: reorder an element among its siblings (moves the real node).
    if (d.type === "lg-elem-move"){
      var em = findEl(d.blockId, d.el), ref = findEl(d.blockId, d.refId);
      if (!em || !ref || em === ref || em.parentElement !== ref.parentElement) return;
      ref.parentElement.insertBefore(em, d.before ? ref : ref.nextSibling);
      save(d.blockId);
      if (selected) select(selected);
      return;
    }
    // Reset one property (or all) for an element at a breakpoint back to the desktop base.
    if (d.type === "lg-bp-reset"){
      var st2 = bp[d.breakpoint];
      if (st2 && st2[d.el]){
        if (d.prop && KEY2CSS[d.prop]){ delete st2[d.el][KEY2CSS[d.prop]]; if (!Object.keys(st2[d.el]).length) delete st2[d.el]; }
        else delete st2[d.el];
        renderOverrides();
        parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*");
        if (selected) select(selected);
      }
      return;
    }
    if (d.type === "lg-img-set"){
      var img = findEl(d.blockId, d.el); if (!img) return;
      onEveryCopy(img, function(n){ n.setAttribute("src", d.src); n.removeAttribute("srcset"); n.removeAttribute("loading"); });
      save(d.blockId); return;
    }
    // Replace media from the gallery/upload — handles <img> and <video>, INCLUDING cross-type swap
    // (photo↔video): a mismatching pick replaces the element, keeping its id/class/style so it stays
    // styled + selectable.
    // Reset an element's styling back to what the site originally shipped: restore the stashed inline
    // style AND drop every generated rule keyed to it (base cascade, tablet, phone, hover, active).
    // Previously only tablet/phone had a reset, so a desktop experiment had no way back.
    if (d.type === "lg-elem-reset"){
      var rel = findEl(d.blockId, d.el); if (!rel) return;
      txnBegin();
      var orig = rel.getAttribute("data-lg-style0");
      if (orig !== null){ if (orig) rel.setAttribute("style", orig); else rel.removeAttribute("style"); rel.removeAttribute("data-lg-style0"); }
      else { rel.removeAttribute("style"); }
      // Descendants may carry the forced text cascade from an older edit — clear that too.
      var rk = rel.querySelectorAll("[data-lg-style0]");
      for (var ri = 0; ri < rk.length; ri++){
        var o2 = rk[ri].getAttribute("data-lg-style0");
        if (o2) rk[ri].setAttribute("style", o2); else rk[ri].removeAttribute("style");
        rk[ri].removeAttribute("data-lg-style0");
      }
      var layers = ["base","tablet","mobile","hover","active"];
      for (var li = 0; li < layers.length; li++){
        var st = bp[layers[li]]; if (st && st[d.el]) delete st[d.el];
      }
      renderOverrides();
      parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*");
      save(d.blockId);
      txnEnd();
      select(rel);
      return;
    }
    if (d.type === "lg-media-set"){
      var mel = findEl(d.blockId, d.el); if (!mel) return;
      var isVid = mel.tagName === "VIDEO";
      var want = d.mediaType || (isVid ? "video" : "image");
      if (want === "video" && isVid){
        // Replace ALL sources, not just the first. A Webflow background video ships mp4 + webm
        // fallbacks; setting only one left the other pointing at the previous file, so the browser
        // could still pick the old video (or fail over to it). The old poster has to go too —
        // otherwise the previous frame stays on screen and reads as "the video is broken/white".
        var olds = mel.querySelectorAll("source");
        for (var oi = olds.length - 1; oi >= 0; oi--) olds[oi].parentNode.removeChild(olds[oi]);
        mel.removeAttribute("poster");
        mel.removeAttribute("src");
        var ns = document.createElement("source");
        ns.setAttribute("src", d.src);
        var ext = (d.src.split("?")[0].split(".").pop() || "").toLowerCase();
        if (ext === "mp4" || ext === "webm" || ext === "ogg") ns.setAttribute("type", "video/" + ext);
        mel.appendChild(ns);
        // A background video only looks right if it actually plays: keep it muted+autoplay+loop.
        mel.muted = true;
        mel.setAttribute("muted",""); mel.setAttribute("autoplay",""); mel.setAttribute("loop","");
        mel.setAttribute("playsinline",""); mel.setAttribute("preload","auto");
        try { mel.load(); var pr = mel.play(); if (pr && pr.catch) pr.catch(function(){}); } catch(e){}
        save(d.blockId); return;
      }
      if (want === "image" && !isVid){
        onEveryCopy(mel, function(n){ n.setAttribute("src", d.src); n.removeAttribute("srcset"); n.removeAttribute("loading"); });
        save(d.blockId); return;
      }
      // cross-type swap
      var repl;
      if (want === "video"){
        repl = document.createElement("video");
        repl.setAttribute("autoplay",""); repl.muted = true; repl.setAttribute("muted","");
        repl.setAttribute("loop",""); repl.setAttribute("playsinline",""); repl.setAttribute("preload","auto");
        var so = document.createElement("source"); so.setAttribute("src", d.src); repl.appendChild(so);
      } else {
        repl = document.createElement("img"); repl.setAttribute("src", d.src);
      }
      repl.setAttribute("data-lg-id", mel.getAttribute("data-lg-id") || "");
      if (mel.getAttribute("class")) repl.setAttribute("class", mel.getAttribute("class"));
      if (mel.getAttribute("style")) repl.setAttribute("style", mel.getAttribute("style"));
      if (mel.parentNode) mel.parentNode.replaceChild(repl, mel);
      if (selected === mel){ selected = null; hideSelBox(); }
      save(d.blockId);
      select(repl); // refresh the panel to the new element (Фото↔Видео)
      return;
    }
    if (d.type === "lg-elem-set"){
      var el = findEl(d.blockId, d.el); if (!el) return;
      var elId = d.el, bpMode = d.breakpoint && d.breakpoint !== "desktop";
      var contentChg = false;
      // Content (text / alt / href) is shared across breakpoints → always applied to the base.
      if (d.text != null){
        onEveryCopy(el, function(n){ if (kindOf(n)==="image") n.setAttribute("alt", d.text); else n.textContent = d.text; });
        contentChg = true;
      }
      // Piece-wise text (a split-text heading): each piece goes back into its own node, never through
      // textContent — that is what keeps the word elements and their site classes alive.
      if (d.parts != null){
        var partsChg = false;
        onEveryCopy(el, function(n){ if (setParts(n, d.parts)) partsChg = true; });
        if (partsChg) contentChg = true;
      }
      if (d.href != null && el.hasAttribute("href")){
        // The URL field is free text and lands on the live site: a script scheme would run for every
        // visitor. safeHref is the same check the publisher applies, so both agree.
        var hrefOk = safeHref(d.href);
        if (hrefOk !== d.href) parent.postMessage({ type:"lg-link-blocked", value:d.href }, "*");
        el.setAttribute("href", hrefOk); contentChg = true;
      }
      if (d.style){
        // Alignment on a FLEX container: text-align never moves flex children, so "Выравнивание" looks
        // dead (e.g. the hero H1 is a flex row of word-divs). Map it to justify-content (row) /
        // align-items (column) too, so alignment actually applies. Rides the normal style flow below.
        if (d.style.align != null){
          var _disp = getComputedStyle(el).display;
          if (_disp === "flex" || _disp === "inline-flex"){
            var _col = getComputedStyle(el).flexDirection.indexOf("column") === 0;
            var _map = { left:"flex-start", center:"center", right:"flex-end", justify: _col ? "stretch" : "space-between" };
            var _v = _map[d.style.align] || "";
            if (_col) d.style.alignItems = _v; else d.style.justify = _v;
          }
        }
        // Heal LEGACY edits before applying: the old cascade wrote inline !important on descendants,
        // which blocks @media overrides (inline !important can't be beaten by a stylesheet rule). On ANY
        // edit touching a CASCADE prop, migrate the desktop value to the base stylesheet layer and clear
        // the stuck inline — so a MOBILE tweak alone is enough to un-stick an already-published edit.
        var healed = false;
        decls(d.style).forEach(function(pv){
          var prop = pv[0]; if (!CASCADE[prop]) return;
          var kids = el.querySelectorAll("*"), stuck = false, val = el.style.getPropertyValue(prop);
          for (var i=0;i<kids.length;i++){ if (kids[i].style.getPropertyValue(prop)){ stuck = true; if (!val) val = kids[i].style.getPropertyValue(prop); } }
          if (stuck){
            var bs = bp.base || (bp.base = {}), br = bs[elId] || (bs[elId] = {});
            if (val && !br[prop]) br[prop] = val;
            cascadeDesc(el, prop, "");
            healed = true;
          }
        });
        if (healed){ renderOverrides(); parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*"); contentChg = true; }
        if (bpMode){
          // Non-desktop: write generated @media rules, not inline. Base markup untouched.
          var store = bp[d.breakpoint] || (bp[d.breakpoint] = {});
          var rec = store[elId] || (store[elId] = {});
          decls(d.style).forEach(function(pv){ if (pv[1] === "") delete rec[pv[0]]; else rec[pv[0]] = pv[1]; });
          if (!Object.keys(rec).length) delete store[elId];
          renderOverrides();
          parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*");
        } else {
          // Desktop base: the ELEMENT gets an inline style (reversible, and what the panel reads back)
          // and EVERY declaration is mirrored into the base stylesheet layer
          // ([data-lg-id]:not(#lgcmsx){…!important}). Inline alone loses to any !important rule the
          // page itself ships — which is why a value typed here could look ignored on exactly the
          // elements the site's previous editor had pinned. Base is emitted before the device blocks,
          // so tablet/phone still win at their own widths; inline !important never could.
          // Inheritable props additionally cascade onto nested spans, which is what CASCADE is for.
          var baseChg = false;
          stashOriginal(el);   // keep the site's own inline style so "Сбросить оформление" is exact
          decls(d.style).forEach(function(pv){
            el.style.setProperty(pv[0], pv[1]);
            if (CASCADE[pv[0]]) cascadeDesc(el, pv[0], ""); // drop any inline !important a legacy edit left on descendants
            var bstore = bp.base || (bp.base = {}), brec = bstore[elId] || (bstore[elId] = {});
            if (pv[1] === "") delete brec[pv[0]]; else brec[pv[0]] = pv[1];
            if (!Object.keys(brec).length) delete bstore[elId];
            baseChg = true;
          });
          contentChg = true;
          if (baseChg){ renderOverrides(); parent.postMessage({ type:"lg-bp-changed", rules: bp }, "*"); }
        }
      }
      if (contentChg) save(d.blockId);
      return;
    }
    // Rich inline text: apply a command to the LAST selection (restored, since focus moved to the panel).
    if (d.type === "lg-text-cmd"){
      // The stored range dies whenever its nodes leave the document — an undo, a restored section, a
      // re-render of the block. Restoring a dead range put the caret nowhere, execCommand then styled
      // nothing, and no lg-edit was ever posted: the button looked like it worked and the change was
      // silently lost. Check the range is still attached, fall back to whatever is selected right now,
      // and if neither is usable say so instead of pretending.
      var host = rangeHost(lastRange);
      if (!host){
        var cur = document.getSelection();
        if (cur && cur.rangeCount && !cur.isCollapsed){
          var curR = cur.getRangeAt(0);
          var curHost = rangeHost(curR);
          if (curHost){ lastRange = curR.cloneRange(); host = curHost; }
        }
      }
      if (!host){
        lastRange = null;
        parent.postMessage({ type:"lg-text-stale" }, "*");
        return;
      }
      try { host.focus(); } catch(_){}
      var s0 = document.getSelection(); s0.removeAllRanges(); s0.addRange(lastRange);
      try { document.execCommand("styleWithCSS", false, "true"); } catch(_){}
      if (d.cmd === "color") document.execCommand("foreColor", false, d.value);
      else if (d.cmd === "link"){
        var lv = safeHref(d.value);
        if (lv !== d.value) parent.postMessage({ type:"lg-link-blocked", value:d.value }, "*");
        document.execCommand("createLink", false, lv);
        // execCommand can't set target — find the anchor we just made and set/clear "open in new tab".
        var selL = document.getSelection(), ndL = selL && selL.anchorNode;
        var aL = ndL && (ndL.nodeType===1?ndL:ndL.parentElement).closest("a");
        if (aL){ if (d.newTab){ aL.setAttribute("target","_blank"); aL.setAttribute("rel","noopener"); } else { aL.removeAttribute("target"); aL.removeAttribute("rel"); } }
      }
      else if (d.cmd === "unlink") document.execCommand("unlink");
      else if (d.cmd === "removeFormat") document.execCommand("removeFormat");
      else document.execCommand(d.cmd); // bold | italic | underline
      // The command rebuilt the nodes the old range pointed at, so re-capture it — otherwise a second
      // command on the same highlight (bold, then colour) worked on a range that no longer exists.
      var sN = document.getSelection();
      if (sN && sN.rangeCount && !sN.isCollapsed && rangeHost(sN.getRangeAt(0))) lastRange = sN.getRangeAt(0).cloneRange();
      var an = sN && sN.anchorNode;
      var w = an && (an.nodeType===1?an:an.parentElement).closest(W);
      if (w) parent.postMessage({ type:"lg-edit", id:w.getAttribute("data-lg-block"), html:w.innerHTML }, "*");
      else parent.postMessage({ type:"lg-text-stale" }, "*");   // nothing to save = nothing happened
      return;
    }
  });
  function init(){
    var blocks = document.querySelectorAll(W);
    for (var i=0;i<blocks.length;i++) wire(blocks[i]);
    var st = document.createElement("style");
    st.textContent =
      // The same repairs the published page gets, so the device preview tells the truth about them.
      SITE_FIXES +
      // Canvas-only repairs (the 100vh-hero feedback spiral) - defined in the render core so the
      // regression harness builds its canvas-twins with exactly this CSS.
      EDITOR_ONLY_CSS +
      ".lg-selected{outline:2px solid #7c3aed !important; outline-offset:2px; cursor:pointer;}" +
      "[data-lg-block] img{cursor:pointer;}" +
      // Motion is held still while a moving element is being edited (see freezeMotion). Videos keep
      // playing — those the client asked to always run.
      "[data-lg-frozen] *:not(video),[data-lg-frozen] *::before,[data-lg-frozen] *::after{animation-play-state:paused !important;}" +
      ".lg-hoverbox{position:absolute;z-index:99996;pointer-events:none;border:1px solid rgba(124,58,237,.55);" +
        "background:rgba(124,58,237,.06);border-radius:2px;display:none;}" +
      ".lg-hovertag{position:absolute;z-index:99996;pointer-events:none;background:#7c3aed;color:#fff;" +
        "font:600 10px/1.5 -apple-system,Segoe UI,sans-serif;padding:1px 6px;border-radius:4px 4px 4px 0;display:none;white-space:nowrap;}" +
      ".lg-handle{position:absolute;z-index:99998;background:#7c3aed;color:#fff;" +
        "border-radius:6px;display:none;align-items:center;justify-content:center;line-height:1;cursor:grab;" +
        "box-shadow:0 2px 8px rgba(80,40,160,.4);user-select:none;touch-action:none;}" +
      ".lg-dropline{position:absolute;z-index:99997;height:3px;background:#7c3aed;border-radius:2px;display:none;" +
        "pointer-events:none;box-shadow:0 0 0 1.5px #fff, 0 0 6px rgba(124,58,237,.5);}" +
      ".lg-dragging{opacity:.4 !important;}" +
      ".lg-selbox{position:absolute;z-index:99995;pointer-events:none;outline:var(--ow,1.5px) solid #7c3aed;display:none;}" +
      ".lg-rh{position:absolute;width:var(--hs,9px);height:var(--hs,9px);background:#fff;border:var(--ow,1.5px) solid #7c3aed;" +
        "border-radius:2px;pointer-events:auto;box-sizing:border-box;touch-action:none;}" +
      // The dot stays small so it doesn't cover the design, but the thing you can actually grab is
      // padded out to a comfortable target (WCAG 2.2 asks for at least 24x24 CSS px). Scaled by the
      // canvas zoom like the dot itself, so it is 24px ON SCREEN at any zoom level.
      ".lg-rh::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
        "width:var(--ht,24px);height:var(--ht,24px);}" +
      ".lg-rh--nw{top:calc(var(--hs,9px)/-2);left:calc(var(--hs,9px)/-2);cursor:nwse-resize;}" +
      ".lg-rh--n{top:calc(var(--hs,9px)/-2);left:calc(50% - var(--hs,9px)/2);cursor:ns-resize;}" +
      ".lg-rh--ne{top:calc(var(--hs,9px)/-2);right:calc(var(--hs,9px)/-2);cursor:nesw-resize;}" +
      ".lg-rh--e{top:calc(50% - var(--hs,9px)/2);right:calc(var(--hs,9px)/-2);cursor:ew-resize;}" +
      ".lg-rh--se{bottom:calc(var(--hs,9px)/-2);right:calc(var(--hs,9px)/-2);cursor:nwse-resize;}" +
      ".lg-rh--s{bottom:calc(var(--hs,9px)/-2);left:calc(50% - var(--hs,9px)/2);cursor:ns-resize;}" +
      ".lg-rh--sw{bottom:calc(var(--hs,9px)/-2);left:calc(var(--hs,9px)/-2);cursor:nesw-resize;}" +
      ".lg-rh--w{top:calc(50% - var(--hs,9px)/2);left:calc(var(--hs,9px)/-2);cursor:ew-resize;}";
    document.head.appendChild(st);
    // A <select> opens its native dropdown on mousedown — suppress that in edit mode so a click just
    // SELECTS it (its options are edited in the panel instead).
    document.addEventListener("mousedown", function(e){
      if (e.target.closest && e.target.closest("select")) e.preventDefault();
    }, true);
    // Select on click; block links/buttons from navigating while editing.
    document.addEventListener("click", function(e){
      var nav = e.target.closest && e.target.closest("a,button");
      if (nav) e.preventDefault();
      // A click that lands over an image or video selects that media — even when a link, an overlay, or
      // the card's own <a> sits on top of it (the services cards are <a> wrappers, and a Webflow
      // background video hides its <video> under decorative layers). The whole stack under the cursor is
      // inspected, not just e.target, so the photo/video wins over whatever covers it — that is what
      // brings back "заменить фото/видео". A media element that is not directly hittable is still found
      // below via preferMedia.
      var stack = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
      for (var si = 0; si < stack.length; si++){
        var se = stack[si];
        if ((se.tagName === "IMG" || se.tagName === "VIDEO") && se.getAttribute("data-lg-id")){ select(se); return; }
      }
      // Otherwise prefer the whole editable field (block text / standalone link) over a word-div inside it.
      var ce = e.target.closest && e.target.closest('[contenteditable="true"]');
      var el = ce || (e.target.closest && e.target.closest("[data-lg-id]"));
      // Clicking away from everything editable is how the client says "done" — the selection goes and
      // anything that was held still starts moving again.
      if (el) select(preferMedia(el, e.clientX, e.clientY)); else deselect();
    }, true);
    // Hover highlight: outline + label chip on the element under the cursor (not while dragging/selected).
    document.addEventListener("mouseover", function(e){
      if (isDragging) { hideHover(); return; }
      if (handle && (e.target === handle || handle.contains(e.target))) return; // don't move the handle out from under the cursor
      var ce = e.target.closest && e.target.closest('[contenteditable="true"]');
      var el = ce || (e.target.closest && e.target.closest("[data-lg-id]"));
      if (!el || el === selected) { hideHover(); return; }
      showHover(el);
    }, true);
    document.addEventListener("mouseout", function(e){ if (!e.relatedTarget) hideHover(); }, true);
    // Keyboard: a contenteditable field is a tab stop, but only a CLICK used to open the inspector —
    // so someone working from the keyboard could type into the page and still not reach a single
    // control (size, colour, replace photo).
    //
    // ⚠️ ONLY keyboard focus counts. Treating every focusin as a selection hijacked the mouse: the
    // browser moves focus for reasons of its own — restoring it when the canvas is re-entered, landing
    // on the nearest link — and each of those overwrote whatever the client had just clicked. Clicking
    // a photo showed "Текст", and the panel then stopped following clicks altogether.
    var kbNav = false;
    document.addEventListener("keydown", function(e){ if (e.key === "Tab") kbNav = true; }, true);
    document.addEventListener("pointerdown", function(){ kbNav = false; }, true);
    document.addEventListener("mousedown", function(){ kbNav = false; }, true);
    document.addEventListener("focusin", function(e){
      if (!kbNav) return;
      kbNav = false;
      var el = e.target && e.target.closest && e.target.closest('[contenteditable="true"]');
      if (el && el !== selected) select(el);
    }, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragover", function(e){
      if (e.dataTransfer && e.dataTransfer.types && [].indexOf.call(e.dataTransfer.types,"Files")>=0) e.preventDefault();
    }, true);
    window.addEventListener("scroll", function(){ hideHover(); }, true);
    // Text selection inside an editable element → tell the parent to show the floating text toolbar.
    document.addEventListener("selectionchange", function(){
      var sel = document.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0){ parent.postMessage({ type:"lg-text-sel", rect:null }, "*"); return; }
      var range = sel.getRangeAt(0);
      var node = range.commonAncestorContainer;
      var host = (node.nodeType===1?node:node.parentElement) && (node.nodeType===1?node:node.parentElement).closest('[contenteditable="true"]');
      if (!host){ parent.postMessage({ type:"lg-text-sel", rect:null }, "*"); return; }
      var r = range.getBoundingClientRect();
      if (!r.width && !r.height){ parent.postMessage({ type:"lg-text-sel", rect:null }, "*"); return; }
      lastRange = range.cloneRange();
      var aNode = (node.nodeType===1?node:node.parentElement);
      var anchor = aNode && aNode.closest("a");
      parent.postMessage({ type:"lg-text-sel",
        rect: { top:r.top, left:r.left, width:r.width, height:r.height },
        state: { bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"),
                 underline: document.queryCommandState("underline"),
                 link: !!anchor,
                 href: anchor ? (anchor.getAttribute("href")||"") : "",
                 newTab: anchor ? anchor.getAttribute("target")==="_blank" : false } }, "*");
    });
    parent.postMessage({ type:"lg-ready", count: blocks.length }, "*");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
`;

// dropHeadingFontPins runs inside wrapBlockForEdit as well as in reassemble(): the canvas must show
// what the publisher writes, and a block saved from a canvas that never had the pins cannot put them
// back. The wrapper itself is defined in the render core, shared with the regression harness.
const wrap = (b: ImportedBlock) => wrapBlockForEdit(b.content.html, b.id);

export function reassembleForEdit(p: ImportedPage): string {
  let body: string;
  // The canvas gets the SAME repairs the publisher applies, or the two render differently: the legacy
  // `>` chains would die on the wrapper below (measured: hero H1 at 60px here vs 88px live) and videos
  // would only play on the published page. Both live in the shared core.
  const prefix = withSiteRuntime(relaxLegacyChains(p.prefix));
  if (!p.wrapped) {
    body = p.blocks.map(wrap).join("");
  } else {
    const header = p.blocks.find((b) => b.content.region === "header");
    const footer = p.blocks.find((b) => b.content.region === "footer");
    const mains = p.blocks.filter((b) => b.content.region === "main").map(wrap).join("");
    body =
      p.bodyPrefix + p.pwOpen + (header ? wrap(header) : "") + p.mainOpen + mains +
      p.mainClose + (footer ? wrap(footer) : "") + p.pwClose + p.tailScripts;
  }
  return prefix + body + `<script>${EDIT_RUNTIME}</script>` + p.suffix;
}
