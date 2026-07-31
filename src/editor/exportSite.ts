/**
 * Clean export of an imported page — what actually gets PUBLISHED.
 *
 * The editor stamps live-editing attributes onto the DOM (data-lg-id, contenteditable, spellcheck,
 * data-lg-el, the transient `lg-selected` class) and those leak into a block's saved HTML. We DON'T
 * strip them at save time (the runtime needs them to keep editing), so they are stripped here.
 *
 * The actual implementation lives in ./renderCore.js — ONE copy shared by this typed export path, the
 * in-iframe editing runtime, and the Node publisher (scripts/build-site.mjs). Keeping a second copy
 * here is what used to make the editor and the live site drift apart, so this file is now a thin
 * typed re-export and nothing more.
 */

export { cleanHtml, overridesCss, exportPageHtml, keptIds, fluidFont } from "./renderCore.js";
