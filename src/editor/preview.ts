/**
 * Build the iframe document for a page. AllClean's markup uses root asset paths (/images, /fonts,
 * /video, /js, /logo.svg) which would collide with the platform's own root assets — so for the
 * PREVIEW only we rewrite them to /site-assets/*. The stored blocks and the static export keep the
 * real paths (the deployed site serves them from its own root).
 */

import { type ImportedPage } from "./reassemble";
import { reassembleForEdit } from "./editRuntime";
import { exportPageHtml } from "./exportSite";
import type { PageBp } from "./bpStore";

const BASE = "/site-assets";

function rewriteAssets(html: string): string {
  return html
    .split("/logo.svg").join(`${BASE}/logo.svg`)
    .split("/images/").join(`${BASE}/images/`)
    .split("/video/").join(`${BASE}/video/`)
    .split("/fonts/").join(`${BASE}/fonts/`)
    .split("/js/").join(`${BASE}/js/`);
}

export function previewDoc(page: ImportedPage, edit: boolean, pageBp?: PageBp): string {
  // Edit mode = live runtime (breakpoint rules come in via lg-bp-init). Preview mode = the CLEAN
  // published output: editor attrs stripped + breakpoint @media inlined. page.blocks already carry
  // content overrides (applied on load), so we don't re-apply them here.
  return rewriteAssets(edit ? reassembleForEdit(page) : exportPageHtml(page, undefined, pageBp));
}
