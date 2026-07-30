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

/** JS injected into the iframe. Makes text editable inline AND drives a clean per-element panel
 *  (select any element → the parent shows labeled Текст/Ссылка/Фото/Стиль controls; changes apply
 *  back here). No raw JSON — the client edits understandable properties on the real site. */
export const EDIT_RUNTIME = `
(function(){
  var W = "[data-lg-block]";
  var seq = 0, selected = null, lastRange = null;
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
  var MQ = { tablet:"(max-width: 991px)", mobile:"(max-width: 479px)" };
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
  var CASCADE = { "color":1, "font-size":1, "font-weight":1, "line-height":1, "letter-spacing":1, "text-align":1, "font-style":1, "text-transform":1, "text-decoration":1, "font-family":1 };
  function cascadeDesc(el, prop, val){
    var kids = el.querySelectorAll("*");
    for (var i=0;i<kids.length;i++){
      var t = kids[i].tagName; if (t==="SCRIPT"||t==="STYLE") continue;
      if (val === "") kids[i].style.removeProperty(prop);
      else kids[i].style.setProperty(prop, val, "important");
    }
  }
  function renderOverrides(){
    // NOTE: id is "lgcms-overrides", NOT "lg-overrides" — the real allclean home page already ships a
    // <style id="lg-overrides"> (its own live responsive edits); reusing it would WIPE them. Ours is
    // appended after, so it wins conflicts by source order + !important while theirs stays intact.
    var sheet = document.getElementById("lgcms-overrides");
    if (!sheet){ sheet = document.createElement("style"); sheet.id = "lgcms-overrides"; document.head.appendChild(sheet); }
    var css = "";
    // Specificity boost: :not(#lgcmsx) adds ID-level weight (no real element has that id), so our rules
    // (1,x,0) beat Webflow's class-based !important responsive rules (0,x,0) — otherwise mobile @media
    // width/size edits silently lose to the site's own @media rules and "don't apply".
    var B = ":not(#lgcmsx)";
    // Hover + active rules first (base pseudo-states, no media query).
    [["hover",":hover"],["active",":active"]].forEach(function(pair){
      var layer = bp[pair[0]] || {};
      for (var pid in layer){
        var pp = layer[pid], pdecl = "";
        for (var pk in pp){ if (pp[pk] !== "") pdecl += pk+":"+pp[pk]+" !important;"; }
        if (pdecl) css += '[data-lg-id="'+pid+'"]'+B+pair[1]+'{'+pdecl+'}';
      }
    });
    // Base desktop cascade (no media query) → forces inheritable props onto nested spans at ALL widths.
    // Emitted BEFORE the @media blocks so tablet/mobile (later source order, same specificity) win.
    var baseLayer = bp.base || {};
    for (var bid in baseLayer){
      var bprops = baseLayer[bid], bdecl = "";
      for (var bk in bprops){ if (bprops[bk] !== "") bdecl += bk+":"+bprops[bk]+" !important;"; }
      if (bdecl) css += '[data-lg-id="'+bid+'"] *'+B+'{'+bdecl+'}';
    }
    // tablet first, then mobile, so mobile wins by source order at ≤479px (desktop-first cascade).
    ["tablet","mobile"].forEach(function(dev){
      var elems = bp[dev] || {}, body = "";
      for (var id in elems){
        var props = elems[id], decl = "", cdecl = "";
        // !important is REQUIRED: base edits are inline styles, and only !important beats inline.
        for (var p in props){
          if (props[p] === "") continue;
          var pv2 = props[p];
          // Never let a phone/tablet width overflow the viewport (even a stale wide value from an old
          // resize) — cap to the VIEWPORT (100vw), NOT 100% (= the PARENT). 100% blocked widening a
          // text box past its container on tablet/mobile ("не тянется вправо", while desktop does),
          // since desktop has no cap. 100vw still stops a stale value overflowing the device screen.
          if (p === "width" && /px$/.test(pv2)) pv2 = "min("+pv2+",100vw)";
          decl += p+":"+pv2+" !important;";
          if (CASCADE[p]) cdecl += p+":"+props[p]+" !important;"; // also override nested spans
        }
        if (decl) body += '[data-lg-id="'+id+'"]'+B+'{'+decl+'}';
        if (cdecl) body += '[data-lg-id="'+id+'"] *'+B+'{'+cdecl+'}';
      }
      if (body) css += "@media "+MQ[dev]+"{"+body+"}";
    });
    sheet.textContent = css;
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
  function makeCE(el){ el.setAttribute("contenteditable","true"); el.setAttribute("spellcheck","false"); tag(el); }
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
  function kindOf(el){
    if (el.tagName==="IMG") return "image";
    if (el.tagName==="VIDEO") return "video";
    if (el.tagName==="SELECT") return "select";
    if (el.tagName==="A" || el.tagName==="BUTTON") return "link";
    // A contenteditable field is a TEXT unit even if it wraps word-divs/spans (structured heading).
    if (el.getAttribute("contenteditable")==="true") return "text";
    return el.children && el.children.length ? "container" : "text";
  }
  // Stamp every element with a stable id so ANY element (incl. containers) can be selected/edited.
  // Ids are BLOCK-SCOPED (blockId + "~" + index-within-block): deterministic across reloads and
  // collision-free between blocks, so per-breakpoint @media rules keyed to data-lg-id stay stable
  // regardless of which other blocks were edited.
  function stampIds(root, blockId){
    var all = root.querySelectorAll("*");
    for (var i=0;i<all.length;i++){ if (!all[i].getAttribute("data-lg-id")) all[i].setAttribute("data-lg-id", blockId + "~" + i); }
  }
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
    selBox.style.display = "block";
    selBox.style.top = (r.top + window.scrollY) + "px"; selBox.style.left = (r.left + window.scrollX) + "px";
    selBox.style.width = r.width + "px"; selBox.style.height = r.height + "px";
    // Counter-scale the frame + handles so they stay ~9px on screen at any canvas zoom.
    var z = curZoom || 1;
    selBox.style.setProperty("--hs", (9 / z) + "px");
    selBox.style.setProperty("--ow", (1.5 / z) + "px");
  }
  function hideSelBox(){ if (selBox) selBox.style.display = "none"; }
  // Set a CSS prop on an element, routed to the current breakpoint (inline base OR @media rule).
  function setStyleProp(el, prop, val, prio){
    var id = el.getAttribute("data-lg-id");
    if (curBp === "desktop"){ el.style.setProperty(prop, val, prio || ""); }
    else {
      var store = bp[curBp] || (bp[curBp] = {}), rec = store[id] || (store[id] = {});
      if (val === "") delete rec[prop]; else rec[prop] = val;
      if (!Object.keys(rec).length) delete store[id];
      renderOverrides();
    }
  }
  function commitStyle(el){
    var wblk = el.closest(W);
    if (curBp === "desktop"){ if (wblk) save(wblk.getAttribute("data-lg-block")); }
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
  function startResize(e){
    e.preventDefault(); e.stopPropagation();
    var el = selected; if (!el) return;
    var dir = e.currentTarget.getAttribute("data-dir");
    var r = el.getBoundingClientRect(), startX = e.clientX, startY = e.clientY, startW = r.width, startH = r.height;
    isDragging = true; hideHover();
    function move(ev){
      var dw = ev.clientX - startX, dh = ev.clientY - startY, w = startW, h = startH;
      if (dir.indexOf("e") >= 0) w = Math.max(20, startW + dw);
      if (dir.indexOf("w") >= 0) w = Math.max(20, startW - dw);
      if (dir.indexOf("s") >= 0) h = Math.max(16, startH + dh);
      if (dir.indexOf("n") >= 0) h = Math.max(16, startH - dh);
      if (dir.indexOf("e") >= 0 || dir.indexOf("w") >= 0){
        // Never let the box grow past the frame edge — on ANY device. Otherwise it overflows the page
        // and its resize handles land off the visible canvas where they can't be grabbed ("уходит за
        // холст"). The frame width is the device viewport (desktop = the selected canvas width), so
        // this still allows growing well beyond a narrow parent, just not off the page.
        var vpW = document.documentElement.clientWidth || 390;
        var maxW = vpW - Math.max(0, r.left) - 6;
        if (maxW < 40) maxW = vpW - 12;
        if (w > maxW) w = maxW;
        setStyleProp(el, "width", Math.round(w) + "px");
        unclampWidth(el);
      }
      if (dir.indexOf("s") >= 0 || dir.indexOf("n") >= 0){ setStyleProp(el, "height", Math.round(h) + "px"); setStyleProp(el, "flex-shrink", "0", "important"); }
      positionSelBox(el);
    }
    function up(){
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      isDragging = false; commitStyle(el); select(el); // refresh panel (width/height changed)
    }
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function select(el){
    if (selected) selected.classList.remove("lg-selected");
    selected = el; el.classList.add("lg-selected");
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
      // structured = the text field wraps child elements (word-divs/spans) → panel must NOT offer
      // "replace all text" (it would flatten the structure); inline editing is the way.
      structured: (kind==="text"||kind==="link") && !!(el.children && el.children.length),
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
      ".lg-selected,.lg-hoverbox,.lg-hovertag,.lg-handle,.lg-dropline,.lg-selbox," +
      "[contenteditable],[spellcheck],[data-lg-el],[data-lg-id],[style*='outline'],[style*='Outline']");
    for (var i=0;i<dirty.length;i++){
      var e = dirty[i];
      e.classList.remove("lg-selected","lg-hoverbox","lg-hovertag","lg-handle","lg-dropline","lg-selbox");
      e.removeAttribute("contenteditable"); e.removeAttribute("spellcheck");
      e.removeAttribute("data-lg-el"); e.removeAttribute("data-lg-id");
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
        wb.innerHTML = d.html;
        cleanBlock(wb); stampIds(wb, d.blockId); editableWithin(wb);
        if (selected){ selected = null; hideSelBox(); hideHover(); if (handle) handle.style.display = "none"; }
      }
      return;
    }
    // Canvas zoom changed → resize the overlay handles so they stay grabbable on screen.
    if (d.type === "lg-zoom"){ curZoom = d.zoom || 1; if (selected) positionSelBox(selected); return; }
    // Device switch: remember the active breakpoint + refresh the panel (computed values change with width).
    if (d.type === "lg-device"){ curBp = d.breakpoint || "desktop"; if (selected) select(selected); return; }
    // Load persisted per-breakpoint rules and build the overrides stylesheet.
    if (d.type === "lg-bp-init"){
      bp = { base:(d.rules&&d.rules.base)||{}, tablet:(d.rules&&d.rules.tablet)||{}, mobile:(d.rules&&d.rules.mobile)||{}, hover:(d.rules&&d.rules.hover)||{}, active:(d.rules&&d.rules.active)||{} };
      renderOverrides(); if (selected) select(selected); return;
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
      ed.parentNode && ed.parentNode.removeChild(ed);
      if (wbd) save(wbd.getAttribute("data-lg-block"));
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
      img.setAttribute("src", d.src); img.removeAttribute("srcset"); img.removeAttribute("loading");
      save(d.blockId); return;
    }
    // Replace media from the gallery/upload — handles <img> and <video> (with a <source> child).
    if (d.type === "lg-media-set"){
      var mel = findEl(d.blockId, d.el); if (!mel) return;
      if (mel.tagName === "VIDEO"){
        var vs = mel.querySelector("source");
        if (vs) vs.setAttribute("src", d.src); else mel.setAttribute("src", d.src);
        try { mel.load(); } catch(e){}
      } else {
        mel.setAttribute("src", d.src); mel.removeAttribute("srcset"); mel.removeAttribute("loading");
      }
      save(d.blockId); return;
    }
    if (d.type === "lg-elem-set"){
      var el = findEl(d.blockId, d.el); if (!el) return;
      var elId = d.el, bpMode = d.breakpoint && d.breakpoint !== "desktop";
      var contentChg = false;
      // Content (text / alt / href) is shared across breakpoints → always applied to the base.
      if (d.text != null){ if (kindOf(el)==="image") el.setAttribute("alt", d.text); else el.textContent = d.text; contentChg = true; }
      if (d.href != null && el.hasAttribute("href")){ el.setAttribute("href", d.href); contentChg = true; }
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
          // Desktop base: the ELEMENT gets an inline style (reversible, beats the foreign stylesheet).
          // For inheritable props we ALSO force nested spans — but via the BASE stylesheet layer
          // ([data-lg-id] *{…!important}), NOT inline !important, so tablet/mobile @media can override.
          var baseChg = false;
          decls(d.style).forEach(function(pv){
            el.style.setProperty(pv[0], pv[1]);
            if (CASCADE[pv[0]]){
              cascadeDesc(el, pv[0], ""); // heal legacy edits: drop any inline !important left on descendants for this prop
              var bstore = bp.base || (bp.base = {}), brec = bstore[elId] || (bstore[elId] = {});
              if (pv[1] === "") delete brec[pv[0]]; else brec[pv[0]] = pv[1];
              if (!Object.keys(brec).length) delete bstore[elId];
              baseChg = true;
            }
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
      if (lastRange){
        try {
          (lastRange.startContainer.nodeType===1 ? lastRange.startContainer : lastRange.startContainer.parentElement).closest('[contenteditable="true"]').focus();
        } catch(_){}
        var s0 = document.getSelection(); s0.removeAllRanges(); s0.addRange(lastRange);
      }
      try { document.execCommand("styleWithCSS", false, "true"); } catch(_){}
      if (d.cmd === "color") document.execCommand("foreColor", false, d.value);
      else if (d.cmd === "link"){
        document.execCommand("createLink", false, d.value);
        // execCommand can't set target — find the anchor we just made and set/clear "open in new tab".
        var selL = document.getSelection(), ndL = selL && selL.anchorNode;
        var aL = ndL && (ndL.nodeType===1?ndL:ndL.parentElement).closest("a");
        if (aL){ if (d.newTab){ aL.setAttribute("target","_blank"); aL.setAttribute("rel","noopener"); } else { aL.removeAttribute("target"); aL.removeAttribute("rel"); } }
      }
      else if (d.cmd === "unlink") document.execCommand("unlink");
      else if (d.cmd === "removeFormat") document.execCommand("removeFormat");
      else document.execCommand(d.cmd); // bold | italic | underline
      var an = document.getSelection() && document.getSelection().anchorNode;
      var w = an && (an.nodeType===1?an:an.parentElement).closest(W);
      if (w) parent.postMessage({ type:"lg-edit", id:w.getAttribute("data-lg-block"), html:w.innerHTML }, "*");
      return;
    }
  });
  function init(){
    var blocks = document.querySelectorAll(W);
    for (var i=0;i<blocks.length;i++) wire(blocks[i]);
    var st = document.createElement("style");
    st.textContent =
      ".lg-selected{outline:2px solid #7c3aed !important; outline-offset:2px; cursor:pointer;}" +
      "[data-lg-block] img{cursor:pointer;}" +
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
      // Prefer the whole editable field (block text / standalone link) over a word-div inside it.
      var ce = e.target.closest && e.target.closest('[contenteditable="true"]');
      var el = ce || (e.target.closest && e.target.closest("[data-lg-id]"));
      if (el) select(el);
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

const wrap = (b: ImportedBlock) =>
  `<div data-lg-block="${b.id}" style="display:contents">${b.content.html}</div>`;

export function reassembleForEdit(p: ImportedPage): string {
  let body: string;
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
  return p.prefix + body + `<script>${EDIT_RUNTIME}</script>` + p.suffix;
}
