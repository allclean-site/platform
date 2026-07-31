/**
 * Build the iframe document for a page. AllClean's markup uses root asset paths (/images, /fonts,
 * /video, /js, /logo.svg) which would collide with the platform's own root assets — so for the
 * PREVIEW only we rewrite them to /site-assets/*. Stored blocks and the static export keep the real
 * paths (the deployed site serves them from its own root); see ./assetPaths for that boundary.
 */

import { type ImportedPage } from "./reassemble";
import { reassembleForEdit } from "./editRuntime";
import { exportPageHtml } from "./exportSite";
import { toPreview } from "./assetPaths";
import type { PageBp } from "./bpStore";

export function previewDoc(page: ImportedPage, edit: boolean, pageBp?: PageBp): string {
  // Edit mode = live runtime (breakpoint rules come in via lg-bp-init). Preview mode = the CLEAN
  // published output: editor attrs stripped + breakpoint @media inlined. page.blocks already carry
  // content overrides (applied on load), so we don't re-apply them here.
  return toPreview(edit ? reassembleForEdit(page) : exportPageHtml(page, undefined, pageBp));
}
