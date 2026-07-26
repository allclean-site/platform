/**
 * Per-breakpoint style overrides for the imported (real) site.
 *
 * Base (desktop) edits live as inline styles inside the block HTML (see realStore.ts). Tablet/mobile
 * edits are DIFFERENT: they are generated `@media` rules keyed to `data-lg-id`, so they never touch
 * the base markup. This store keeps them separate — a per-page map of breakpoint → element → CSS
 * props — and the iframe rebuilds its `<style id="lg-overrides">` from it. localStorage for now;
 * a Supabase adapter can slot in later (same shape), scoped per tenant.
 */

export type BpProps = Record<string, string>;        // cssProp -> value  e.g. { "font-size": "24px" }
export type BpElems = Record<string, BpProps>;        // elementId (data-lg-id) -> props
/** tablet/mobile → generated @media rules; hover/active → generated :hover / :active rules. All keyed to data-lg-id. */
export interface PageBp { tablet: BpElems; mobile: BpElems; hover: BpElems; active: BpElems }
export type SiteBp = Record<string, PageBp>;          // pageId -> { tablet, mobile, hover, active }

const key = (tenant: string, site: string) => `editor-v2:real-bp:${tenant}:${site}`;

export const emptyPageBp = (): PageBp => ({ tablet: {}, mobile: {}, hover: {}, active: {} });

export function loadBp(tenant: string, site: string): SiteBp {
  try {
    const raw = localStorage.getItem(key(tenant, site));
    return raw ? (JSON.parse(raw) as SiteBp) : {};
  } catch {
    return {};
  }
}

export function saveBp(tenant: string, site: string, all: SiteBp): void {
  localStorage.setItem(key(tenant, site), JSON.stringify(all));
}

/** Count of elements with any override at a given breakpoint on a page (for the device-tab dots). */
export function bpCount(page: PageBp | undefined, dev: "tablet" | "mobile"): number {
  return page ? Object.keys(page[dev] ?? {}).length : 0;
}
