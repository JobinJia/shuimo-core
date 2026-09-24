import { Polygon } from "../foundation/geometry";

export interface PolyOptions {
  /** X offset */
  xof?: number;
  /** Y offset */
  yof?: number;
  /** Fill color */
  fil?: string;
  /** Stroke color */
  str?: string;
  /** Stroke width */
  wid?: number;
  /** SVG filter reference */
  filter?: string;
}

/**
 * Format a coordinate with one decimal, dropping a trailing ".0".
 *
 * Numerically equivalent to `Number(v.toFixed(1))` (ties round away from
 * zero, like `toFixed`) but several times faster, because it stays on the
 * integer path instead of going through the generic decimal formatter. The
 * sign is taken from `v`, not from the rounded integer part, so values in
 * (-1, -0.05] keep their minus sign ("-0.3", not "0.3").
 */
export function fmt1(v: number): string {
  const r = (v < 0 ? -v : v) * 10;
  if (r !== r || r === Infinity) return String(v); // NaN / Infinity passthrough
  let a = Math.round(r);
  // `r` lands exactly on .5 only for (near-)ties such as 0.15, where the
  // multiplication rounded away the digit that `toFixed` decides on. Defer to
  // `toFixed` for that rare case so both formatters agree exactly.
  if (a - r === 0.5) a = Math.round(Number((v < 0 ? -v : v).toFixed(1)) * 10);
  const i = Math.floor(a / 10);
  const f = a - i * 10;
  const s = f === 0 ? String(i) : i + "." + f;
  return v < 0 && a !== 0 ? "-" + s : s;
}

// ── Style scope ─────────────────────────────────────────────────────
//
// A full landscape emits ~10k polylines whose inline `style` attributes only
// take ~1k distinct values. While a scope is active, `poly()` emits a short
// class name instead and the scope collects one CSS rule per distinct style,
// which the caller writes into a `<style>` element. Outside a scope `poly()`
// keeps emitting self-contained inline styles, so standalone element calls
// (Mount.mountain, Tree.tree01, ...) are unaffected.
//
// A scope also carries two painting-level colour adjustments:
// - `paper`: the literal fill "white" (used by elements as an occlusion
//   mask) is replaced with the paper colour, so masks blend into the paper
//   instead of leaving white cut-outs.
// - ink depth (`setInkDepth`): neutral grey ink is paled for distant
//   elements and deepened for near ones (far = light, near = dark).

/** Number of quantised ink-depth tiers (0 = farthest, TIERS - 1 = nearest). */
const INK_TIERS = 5;

interface StyleScope {
  prefix: string;
  paper: string | null;
  tier: number;
  /** tier + 1 → fill → stroke → width → class (nested to avoid key strings). */
  byTier: Map<string, Map<string, Map<number, string>>>[];
  byCss: Map<string, string>;
  rules: string[];
}

let activeScope: StyleScope | null = null;

export interface SvgStyleScopeOptions {
  /**
   * Class-name prefix. CSS in an inline SVG is document-global, so it must be
   * unique per painting (two paintings in one page must not share names
   * unless their styles are identical).
   */
  prefix: string;
  /** Colour substituted for the "white" occlusion fill. Omit to keep white. */
  paper?: string;
}

/**
 * Run `fn` with a style scope active and return its result together with
 * the CSS rules for every class `poly()` emitted inside it.
 */
export function runInSvgStyleScope<T>(
  options: SvgStyleScopeOptions,
  fn: () => T,
): { result: T; css: string } {
  const previous = activeScope;
  const scope: StyleScope = {
    prefix: options.prefix,
    paper: options.paper ?? null,
    tier: -1,
    byTier: Array.from({ length: INK_TIERS + 1 }, () => new Map()),
    byCss: new Map(),
    rules: [],
  };
  activeScope = scope;
  try {
    const result = fn();
    return { result, css: scope.rules.join("") };
  } finally {
    activeScope = previous;
  }
}

/**
 * Set the ink depth used for subsequent `poly()` calls in the active scope.
 * `depth` is 0 for the farthest element and 1 for the nearest; `null`
 * disables tonal adjustment. No-op outside a scope.
 */
export function setInkDepth(depth: number | null): void {
  if (!activeScope) return;
  if (depth === null || !Number.isFinite(depth)) {
    activeScope.tier = -1;
    return;
  }
  const d = depth < 0 ? 0 : depth > 1 ? 1 : depth;
  activeScope.tier = Math.round(d * (INK_TIERS - 1));
}

const RGBA_RE = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/;

function roundAlpha(a: number): string {
  const v = Math.round(Math.min(1, Math.max(0, a)) * 100) / 100;
  return String(v);
}

/** Apply the scope's paper substitution and ink-depth tone to one colour. */
function resolveColor(scope: StyleScope, col: string): string {
  if (col === "white" && scope.paper) return scope.paper;
  const m = RGBA_RE.exec(col);
  if (!m) return col;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  if (scope.tier < 0 || r !== g || g !== b) {
    return m[4] === undefined ? col : `rgba(${r},${g},${b},${roundAlpha(a)})`;
  }
  // Neutral grey ink: interpolate from pale/thin (far) to dark/dense (near).
  const t = scope.tier / (INK_TIERS - 1);
  const greyMul = 1.3 + (0.62 - 1.3) * t;
  const alphaMul = 0.62 + (1.15 - 0.62) * t;
  const grey = Math.round(Math.min(235, r * greyMul));
  return `rgba(${grey},${grey},${grey},${roundAlpha(a * alphaMul)})`;
}

function scopeClass(scope: StyleScope, fil: string, str: string, wid: number): string {
  const byFill = scope.byTier[scope.tier + 1];
  let byStroke = byFill.get(fil);
  if (byStroke === undefined) {
    byStroke = new Map();
    byFill.set(fil, byStroke);
  }
  let byWidth = byStroke.get(str);
  if (byWidth === undefined) {
    byWidth = new Map();
    byStroke.set(str, byWidth);
  }
  let cls = byWidth.get(wid);
  if (cls !== undefined) return cls;
  const css =
    "fill:" +
    resolveColor(scope, fil) +
    ";stroke:" +
    resolveColor(scope, str) +
    ";stroke-width:" +
    wid;
  cls = scope.byCss.get(css);
  if (cls === undefined) {
    cls = scope.prefix + scope.byCss.size.toString(36);
    scope.byCss.set(css, cls);
    scope.rules.push("." + cls + "{" + css + "}");
  }
  byWidth.set(wid, cls);
  return cls;
}

/**
 * Generate an SVG polyline element from a list of points
 * @param plist - Array of points
 * @param options - Styling options
 * @returns SVG polyline string
 */
export function poly(plist: Polygon, options: PolyOptions = {}): string {
  const xof = options.xof ?? 0;
  const yof = options.yof ?? 0;
  const fil = options.fil ?? "rgba(0,0,0,0)";
  const str = options.str ?? fil;
  const wid = options.wid ?? 0;
  const filter = options.filter;

  let s = "<polyline points='";
  for (let i = 0; i < plist.length; i++) {
    const p = plist[i];
    s += " " + fmt1(p[0] + xof) + "," + fmt1(p[1] + yof);
  }
  if (activeScope) {
    s += "' class='" + scopeClass(activeScope, fil, str, wid) + "'";
  } else {
    s += "' style='fill:" + fil + ";stroke:" + str + ";stroke-width:" + wid + "'";
  }
  if (filter) {
    s += " filter='" + filter + "'";
  }
  return s + "/>";
}

// ── Shared loading helpers ──────────────────────────────────────────

export const DEFAULT_LOADING_WIDTH = 160;
export const DEFAULT_LOADING_HEIGHT = 160;
export const DEFAULT_LOADING_SEED = 90813;
export const DEFAULT_LOADING_DURATION = 3.2;
export const DEFAULT_LOADING_INK_COLOR = "#151515";
export const DEFAULT_LOADING_PAPER_COLOR = "#faf8f1";

export function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}

export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeText(value: string): string {
  return escapeAttr(value).replace(/'/g, "&#39;");
}

export function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

export function makeIdSuffix(seed: number | string, width: number, height: number): string {
  const input = `${seed}:${width}:${height}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(hash, 31) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export interface LoadingFilterIDs {
  paperId: string;
  inkFilterId: string;
  edgeFilterId: string;
}

export function makeLoadingFilterIDs(suffix: string, prefix = "shuimo"): LoadingFilterIDs {
  return {
    paperId: `${prefix}-paper-${suffix}`,
    inkFilterId: `${prefix}-ink-${suffix}`,
    edgeFilterId: `${prefix}-edge-${suffix}`,
  };
}

export function makePaperFilter(id: string, seed: number | string): string {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="${escapeAttr(String(seed))}" result="paperNoise"/>
      <feColorMatrix in="paperNoise" type="matrix" values="0 0 0 0 0.96 0 0 0 0 0.93 0 0 0 0 0.86 0 0 0 0.16 0" result="paperTint"/>
      <feBlend in="SourceGraphic" in2="paperTint" mode="multiply"/>
    </filter>`;
}

export function makeInkFilter(id: string, seed: number | string, scale: number): string {
  return `<filter id="${id}" x="-22%" y="-22%" width="144%" height="144%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045 0.1" numOctaves="3" seed="${escapeAttr(String(seed))}" result="inkNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="inkNoise" scale="${fmt(0.65 * scale)}" xChannelSelector="R" yChannelSelector="G" result="softRoughInk"/>
      <feGaussianBlur in="softRoughInk" stdDeviation="${fmt(0.32 * scale)}"/>
    </filter>`;
}

export function makeEdgeFilter(id: string, seed: number | string, scale: number): string {
  return `<filter id="${id}" x="-16%" y="-16%" width="132%" height="132%">
      <feTurbulence type="fractalNoise" baseFrequency="0.038 0.11" numOctaves="3" seed="${escapeAttr(String(seed))}" result="paperEdge"/>
      <feDisplacementMap in="SourceGraphic" in2="paperEdge" scale="${fmt(0.95 * scale)}" xChannelSelector="R" yChannelSelector="G" result="perlinEdge"/>
      <feGaussianBlur in="perlinEdge" stdDeviation="${fmt(0.08 * scale)}"/>
    </filter>`;
}

export interface SharedLoadingDefs {
  filterDefs: string;
  titleId: string;
  paperId: string;
  inkFilterId: string;
  edgeFilterId: string;
}

export function makeLoadingDefs(
  suffix: string,
  seed: number | string,
  scale: number,
  prefix = "shuimo",
): SharedLoadingDefs {
  const ids = makeLoadingFilterIDs(suffix, prefix);
  const titleId = `${prefix}-loading-title-${suffix}`;
  return {
    filterDefs: [
      makePaperFilter(ids.paperId, seed),
      makeInkFilter(ids.inkFilterId, seed, scale),
      makeEdgeFilter(ids.edgeFilterId, seed, scale),
    ].join("\n    "),
    titleId,
    ...ids,
  };
}
