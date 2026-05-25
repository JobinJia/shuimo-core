export type SealMode = "yin" | "yang";

export type SealShape =
  | { kind: "auto" }
  | { kind: "square" }
  | { kind: "rect"; aspect?: number }
  | { kind: "circle" }
  | { kind: "ellipse"; aspect?: number }
  | { kind: "polygon"; sides: number }
  | { kind: "irregular"; roughness?: number };

export type SealScript = "xiaozhuan" | "dazhuan" | "jinwen" | "jiudiezhuan" | "custom";

export type SealLayoutDirection = "ttb-rtl" | "circular";

export interface SealLayoutOptions {
  direction?: SealLayoutDirection;
  columns?: number;
  /**
   * Shared default spacing applied to both inter-row (within a column) and
   * inter-column. Overridden per-axis by `rowGap` / `columnGap` when those
   * are set explicitly.
   */
  gap?: number;
  /** Override for inter-row spacing (between characters in the same column). */
  rowGap?: number;
  /** Override for inter-column spacing (between columns). */
  columnGap?: number;
  padding?: number;
  /**
   * Stretch each glyph non-uniformly so it fills its cell (九叠篆 style).
   * When undefined, defaults to true for shape-forced layouts (square,
   * circle, rect with aspect, ellipse with aspect) and false for adaptive
   * layouts (auto, rect/ellipse without aspect). Set explicitly to override.
   */
  stretch?: boolean;
  /** Horizontal text offset within border. -1 = flush right, 0 = center, +1 = flush left. */
  offsetX?: number;
  /** Vertical text offset within border. -1 = flush top, 0 = center, +1 = flush bottom. */
  offsetY?: number;
}

export type SealCorner = "none" | "round" | "stone";

export interface SealBorderOptions {
  thickness?: number;
  corner?: SealCorner;
  cornerRadius?: number;
  roughness?: number;
}

export type SealNotchStrategy = "auto" | "manual" | "none";

export interface SealNotchSpec {
  strategy: SealNotchStrategy;
  charIndex?: number;
  strokeHint?: "longest" | "nearest";
  jitter?: number;
}

export interface SealInkOptions {
  color?: string;
  density?: number;
  bleed?: number;
  grain?: number;
  aging?: number;
}

export interface SealCarvingOptions {
  intensity?: number;
  breakage?: number;
}

export interface SealPressingOptions {
  rotate?: number;
  pressure?: number;
  partialLoss?: number;
  offset?: [number, number];
}

export interface SealOutputOptions {
  format?: "svg" | "canvas" | "both";
  pixelRatio?: number;
}

export type SealFontInput = ArrayBuffer | Uint8Array | string;

export interface SealOptions {
  /**
   * Seal text. Pass a flat string (auto column layout) OR an array of strings
   * where each element = one column read top-to-bottom, columns read
   * right-to-left — per traditional 篆刻 convention.
   *
   * Example: `["水墨", "丹青"]` → 2 columns: right col "水墨", left col "丹青".
   */
  text: string | string[];
  size: number;
  mode?: SealMode;
  shape?: SealShape;
  seed?: number;
  script?: SealScript;
  font?: SealFontInput;
  /**
   * Pre-fetched font buffer alternative to `font` URL. Useful when the caller
   * already has the bytes (e.g. cached / bundled) or wants to hand off via
   * transferable to a `fontWorker` without a second fetch.
   */
  fontData?: ArrayBuffer | Uint8Array;
  /**
   * Off-main-thread font decoder. When set, the woff2 / TTF decode + glyph
   * extraction happens in this Worker (entry point shipped at
   * `@jobinjia/shuimo-core/stamp-font-worker`). Saves ~2s of main-thread
   * blocking on first paint for large CJK fonts.
   */
  fontWorker?: Worker;
  /**
   * URL of a full TTF/OTF used to subset-supplement the primary `font` when
   * it doesn't ship every character in `text`. Pairs with
   * `harfbuzzSubsetWasmUrl` for the runtime subsetting step.
   */
  fontFallbackUrl?: string;
  /** URL of the harfbuzz-subset WASM. Required only when `fontFallbackUrl` is set. */
  harfbuzzSubsetWasmUrl?: string;
  layout?: SealLayoutOptions;
  border?: SealBorderOptions;
  notch?: SealNotchSpec;
  ink?: SealInkOptions;
  carving?: SealCarvingOptions;
  pressing?: SealPressingOptions;
  output?: SealOutputOptions;
}

export interface SealResultLayers {
  background: string;
  text: string;
  border: string;
}

export interface SealResult {
  svg?: string;
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  seed: number;
  layers: SealResultLayers;
}
