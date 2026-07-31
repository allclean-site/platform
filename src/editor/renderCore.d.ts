/**
 * Types for renderCore.js — the single render source shared by the editor, the export path and the
 * Node publisher. The implementation is plain ESM JS so Node can run it without a build step; this
 * declaration file keeps TypeScript callers fully typed.
 */

import type { PageBp } from "./bpStore";

/** Structural page/block shapes — `ImportedPage`/`ImportedBlock` in reassemble.ts satisfy these. */
export interface CoreBlock {
  id: string;
  content: { html: string; label?: string; region?: string };
}
export interface CorePage {
  prefix: string;
  suffix: string;
  bodyPrefix: string;
  pwOpen: string;
  mainOpen: string;
  pwClose: string;
  mainClose: string;
  tailScripts: string;
  blocks: CoreBlock[];
  wrapped: boolean;
}

export declare const MQ: Record<"tablet" | "mobile", string>;
export declare const CASCADE: Record<string, 1>;

export declare function fluidFont(v: string): string;
export declare function cleanHtml(html: string, keepIds?: Set<string>): string;
export declare function overridesCss(pageBp?: PageBp): string;
export declare function keptIds(pageBp?: PageBp): Set<string>;

export declare function applyOverrides<T extends { id: string; content: { html: string } }>(
  blocks: T[],
  overrides?: Record<string, string>
): T[];

export declare function reassemble<T extends CorePage>(page: T): string;
export declare function exportPageHtml<T extends CorePage>(
  page: T,
  overrides: Record<string, string> | undefined,
  pageBp?: PageBp
): string;
