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

  const parts: string[] = ["<polyline points='"];
  for (let i = 0; i < plist.length; i++) {
    parts.push(" ", (plist[i][0] + xof).toFixed(1), ",", (plist[i][1] + yof).toFixed(1));
  }
  parts.push("' style='fill:", fil, ";stroke:", str, ";stroke-width:", String(wid), "'");
  if (filter) {
    parts.push(" filter='", filter, "'");
  }
  parts.push("/>");
  return parts.join("");
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
