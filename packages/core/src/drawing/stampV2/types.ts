export type SealMode = "yin" | "yang";

export type SealShape =
  | { kind: "auto" }
  | { kind: "square" }
  | { kind: "rect"; aspect?: number }
  | { kind: "circle" }
  | { kind: "ellipse"; aspect?: number }
  | {
      kind: "polygon";
      /** Number of sides; ≥3 (3 → triangle). 6 / 8 are the common 篆刻 cases. */
      sides: number;
      /**
       * Vertex orientation:
       *   - `"flat-top"` (default): one edge horizontal at the top. Better for
       *     even-sided regulars (6/8) — visually grounds the seal.
       *   - `"point-top"`: a vertex points straight up. Better for triangles
       *     and odd-sided forms.
       */
      orientation?: "flat-top" | "point-top";
      /** Width-to-height aspect; default 1 (regular polygon in a square box). */
      aspect?: number;
    };

/**
 * Seal-script style (篆体). Controls **glyph geometry** — angularize grid /
 * jitter / pull and a baseline `carving.intensity`. **Does NOT switch fonts**:
 * the user is still responsible for supplying a font that matches the era
 * (e.g. a 金文 font for `"jinwen"`); this option only re-shapes whatever
 * commands fontkit returns.
 *
 *   - `jinwen` (金文): bronze-inscription, most rounded, lowest intensity
 *   - `dazhuan` (大篆): pre-Qin large seal, moderate angularity
 *   - `xiaozhuan` (小篆): Qin small seal — V2's stone-cut baseline
 *   - `jiudiezhuan` (九叠篆): "9-fold" extreme angularity; auto-enables
 *     `layout.stretch`
 *   - `custom`: zero baseline; user controls intensity via `carving.intensity`
 *
 * `carving.intensity` (when set) always wins as the final intensity value.
 */
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
  /**
   * How row heights are apportioned within the inner content area:
   *   - `"uniform"` (default): every row is `innerH / rows` tall, matching V1
   *     behavior. Glyph fontSize is normalized to the tallest glyph anywhere
   *     in the seal, so short-ink chars (e.g. "下") render smaller than their
   *     row and leave visible vertical padding inside their cell.
   *   - `"fit"`: each row's height is proportional to the tallest ink
   *     bounding-box height *in that row*. Short-char rows shrink, tall-char
   *     rows grow — eliminating the empty space under short glyphs while
   *     keeping every glyph at the same em scale (no per-glyph stretching).
   *
   * Incompatible with `stretch: true` (which would re-introduce per-glyph
   * deformation); when `cellHeightMode === "fit"` is set, stretch is forced
   * off regardless of the `stretch` field or shape default.
   */
  cellHeightMode?: "uniform" | "fit";
}

export type SealCorner = "none" | "round" | "stone";

export interface SealBorderOptions {
  thickness?: number;
  corner?: SealCorner;
  cornerRadius?: number;
  /**
   * 0..1; rim wobble / 缺角 intensity for `border/erosion.ts`.
   *
   * @since 2.0.4-beta.1 Visual intensity is now anchored to a reference seal
   * size (REF_SIZE = 480 px). The amplitude and noise wavelength both scale
   * proportionally with the seal so the rim looks equally "chewed" at 200 px
   * and at 600 px under the same `roughness` value. Old behaviour (absolute
   * pixel amplitude / wavelength) is recoverable by multiplying the input
   * by 480 / size at the call site.
   */
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
  /**
   * 0..1; 刀刻 intensity for both the angularize pass (glyph jitter / pull)
   * and the SVG text filter (edge displacement, chip / grain cutoffs).
   *
   * @since 2.0.4-beta.1 Visual intensity is now size-adaptive: the angularize
   * jitter amplitude and the text-filter edge displacement both scale by
   * `size / 480`, and the feTurbulence wavelengths scale by `480 / size`, so
   * the same `intensity` value reads as the same "cut depth" at 200 px and
   * 600 px. Previously, a value tuned for ~480 px would "eat" 200 px strokes
   * because the displacement was absolute. See `internal/visualScale.ts` for
   * the full rationale.
   */
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
