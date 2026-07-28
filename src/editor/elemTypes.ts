/** Shared types for the element-editing panel (kept separate so components don't circular-import). */

export interface ElStyle {
  fontSize: number; color: string; bold: boolean; weight: number; align: string;
  lineHeight: number; letterSpacing: number; width: string; height: string; background: string;
  padTop: number; padRight: number; padBottom: number; padLeft: number;
  marTop: number; marRight: number; marBottom: number; marLeft: number;
  // Layout (per-breakpoint via @media — "adaptive layout per device"): container arrangement + visibility.
  display: string; flexDir: string; flexWrap: string; justify: string; alignItems: string; gap: number;
}

export interface Crumb { id: string; label: string }

/** Interaction states for links/buttons (generated :hover / :active rules, not inline). */
export type StateLayer = "hover" | "active";
export interface StateStyle { color: string; background: string; over: { color: boolean; background: boolean } }

/** One node in the layers tree (a real element in the selected block's DOM). */
export interface LayerNode {
  id: string;
  label: string;
  tag: string;
  hidden: boolean;
  more?: boolean; // deeper children exist but were pruned (depth/budget cap)
  children: LayerNode[];
}

/** One <option> of a form <select>, editable in the panel. */
export interface SelectOption { value: string; label: string }

export interface SelectedEl {
  type: "lg-elem-select";
  blockId: string;
  el: string;
  kind: "text" | "link" | "image" | "container" | "select";
  text: string;
  href: string;
  /** For a <select>: its current options (edited in the panel → written back to the option elements). */
  selectOptions?: SelectOption[] | null;
  /** true when a text/link field wraps child elements → panel hides "replace all text" (would flatten it). */
  structured?: boolean;
  crumbs: Crumb[];
  style: ElStyle;
  /** ElStyle keys overridden for this element at the CURRENT breakpoint (drives the orange dots). */
  bpOver?: Partial<Record<keyof ElStyle, boolean>>;
  /** Hover-state overrides (links/buttons): current values + which are set. */
  hover?: StateStyle;
  /** Active (pressed) state overrides (links/buttons). */
  active?: StateStyle;
  /** DOM tree of the selected element's block (top-level nodes), for the layers panel. */
  tree?: LayerNode[];
}

export type ElPatch = { text?: string; href?: string; style?: Partial<ElStyle> };

/** Editor breakpoints. "desktop" = base (inline styles); others → generated @media rules. */
export type Breakpoint = "desktop" | "tablet" | "mobile";
