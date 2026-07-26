/**
 * Editor v2 — core data model.
 *
 * Single source of truth: one JSON tree (`Site → Page → Block`) is both rendered
 * in the editor (React preview) AND exported to static HTML. Because both renderers
 * consume the SAME block declaration, preview and published output cannot drift.
 *
 * See EDITOR_V2_PLAN.md §3 (data model) and §4 (two-renderer contract).
 */

/** Design tokens for a site (colors, fonts, spacing). Blocks reference these instead of hardcoding. */
export interface ThemeTokens {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  space: Record<string, string>;
}

export interface Theme {
  tokens: ThemeTokens;
}

/** A tenant's site: a collection of pages under one domain. */
export interface Site {
  siteId: string;
  tenantId: string; // Supabase RLS scope — a client only sees their own sites
  domain: string;
  theme: Theme;
  pages: Page[];
  /** Available languages, e.g. ["ru","ro"]. First/`defaultLocale` publishes at the root. */
  locales?: string[];
  defaultLocale?: string;
  /** Blog articles (content records). On publish each is expanded into its own Page. */
  articles?: import("./blog/types").Article[];
}

/** Per-page SEO metadata. Auto-SEO pipeline regenerates the exported <head> from these fields. */
export interface PageMeta {
  title: string;
  description: string;
  og?: { title?: string; description?: string; image?: string };
  /** JSON-LD objects, assembled on publish. */
  schema?: Record<string, unknown>[];
}

export interface Page {
  id: string;
  slug: string;
  lang: string;
  /** Links translations of the same page across locales (e.g. home-ru & home-ro share "home"). */
  group?: string;
  meta: PageMeta;
  blocks: Block[];
}

/** Responsive breakpoints. Layout is expressed in GRID terms (columns/rows), never pixels,
 *  so export becomes CSS grid/flex — not position:absolute. */
export type Breakpoint = "desktop" | "tablet" | "mobile";

export interface BlockLayout {
  grid?: { cols: number };
  breakpoints?: Partial<Record<Breakpoint, unknown>>;
}

/** A block instance on a page. `content` shape depends on `type` (see each block's schema). */
export interface Block<C = any> {
  id: string;
  type: string;
  content: C;
  style?: Record<string, unknown>;
  layout?: BlockLayout;
}

// ---- Renderer contract (shared by preview + static export) -------------------

/** Context passed to a block's renderers. */
export interface BlockRenderContext<C> {
  block: Block<C>;
  theme: Theme;
  /** true inside the editor (may add handles/affordances); false for static export & round-trip. */
  editing: boolean;
  /** Present only in the editor: commit an inline-edited value at a content path.
   *  When absent (static export / round-trip), editable text renders as plain text. */
  onEdit?: (path: (string | number)[], value: unknown) => void;
  /** The editor's current device preview — lets a block edit the matching breakpoint. */
  device?: Breakpoint;
}

/** A block definition: the ONE place that declares how a block type behaves.
 *  `renderStatic` and `Preview` both derive their output from `block.content`,
 *  which is what guarantees preview/export parity. */
export interface BlockDefinition<C = any> {
  type: string;
  meta: { name: string; icon: string; category: string };
  /** Interactive blocks (e.g. calculator) ship runtime JS in their static export, so their
   *  preview and static markup intentionally differ — the round-trip parity check skips them. */
  interactive?: boolean;
  /** Factory for a fresh block's default content (used when adding from the palette). */
  defaults: () => C;
  /** JSON content → semantic HTML string (static export). */
  renderStatic: (ctx: BlockRenderContext<C>) => string;
  /** JSON content → React node (editor preview). */
  Preview: (props: { ctx: BlockRenderContext<C> }) => any;
}
