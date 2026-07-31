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
/** A link made safe to publish: anything but a known navigation scheme becomes "#". */
export declare function safeHref(v: string): string;
export declare function cleanHtml(html: string, keepIds?: Set<string>): string;
export declare function overridesCss(pageBp?: PageBp): string;

/** The page's own title/description, edited by the client and stored under this key in the overrides. */
export interface PageMeta { title?: string; description?: string }
export declare const META_KEY: string;
export declare function encodeMeta(meta: PageMeta): string;
export declare function decodeMeta(value: string | null | undefined): PageMeta | null;
/** What the page's head says today (prefills the editor). */
export declare function readMeta(html: string): { title: string; description: string };
export declare function applyMeta(html: string, meta: PageMeta | null): string;
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
