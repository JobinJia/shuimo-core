/**
 * PaintingGenerator - Unified interface for generating Chinese paintings
 *
 * Supports:
 * - Landscape paintings (山水画) using SceneManager
 * - Flower-bird paintings (花鸟画) with procedural flowers
 * - Optional Xuan paper (宣纸) background with full customization
 * - Configurable blank space (留白) positioning - affects element generation
 */

import {
  MountPlanner,
  type BlankArea,
  type LandscapePlacementOptions,
  type PlanItem,
  type PlanTag,
} from "./MountPlanner";
import { Mount, type LayeredMountSVG } from "../elements/natural/Mount";
import { water } from "../elements/natural/Water";
import { Arch } from "../elements/objects/Arch";
import { randChoice } from "../utils/random";
import { prng } from "../foundation/random";
import { generateFlower } from "../drawing/Flower";
import { XuanPaperColors, GoldFleckColors } from "../elements/natural/XuanPaper";
import { buildXuanPaperScene } from "../elements/natural/xuan-paper/model";
import { renderXuanPaperSVGParts } from "../elements/natural/xuan-paper/svg-renderer";

/**
 * Blank space position for composition
 * Controls where the painting leaves empty space (no elements generated)
 */
export type BlankPosition =
  | "topLeft" // 左上留白
  | "top" // 上方留白
  | "topRight" // 右上留白
  | "left" // 左侧留白
  | "center" // 中心留白
  | "right" // 右侧留白
  | "bottomLeft" // 左下留白
  | "bottom" // 下方留白
  | "bottomRight" // 右下留白
  | "none"; // 无留白

/**
 * Painting type
 */
export type PaintingType =
  | "landscape" // 山水画
  | "flowerBird"; // 花鸟画

export type RenderElementControls = Partial<Record<PlanTag, boolean>>;
export type { LandscapePlacementOptions };

/**
 * Xuan paper configuration for painting
 */
export interface PaintingXuanPaperOptions {
  /** Base color [r, g, b] in range 0-255 */
  baseColor?: [number, number, number];
  /** Texture intensity (0-1, default: 0.3) */
  textureIntensity?: number;
  /** Age effect - adds yellowing and spots (0-1, default: 0) */
  age?: number;
  /** Whether to add gold flecks (撒金效果) */
  goldFlecks?: boolean;
  /** Gold fleck density (0-1, default: 0.5) */
  goldDensity?: number;
  /** Gold color [r, g, b] */
  goldColor?: [number, number, number];
  /** Fiber density (default: 1.0) */
  fiberDensity?: number;
  /** Grain density (0-1, default: 0.5) */
  grainDensity?: number;
}

/**
 * Options for generating a painting
 */
export interface PaintingOptions {
  /** Painting type: 'landscape' (山水画) or 'flowerBird' (花鸟画) */
  type: PaintingType;

  /** Canvas width in pixels */
  width?: number;

  /** Canvas height in pixels */
  height?: number;

  /** Whether to render on Xuan paper (宣纸) background */
  onXuanPaper?: boolean;

  /** Xuan paper options (only used when onXuanPaper is true) */
  xuanPaperOptions?: PaintingXuanPaperOptions;

  /**
   * Emit an SVG whose root `<svg>` omits `style="mix-blend-mode:multiply"`.
   *
   * Use when the caller applies its own `mix-blend-mode: multiply` at a higher
   * layer (e.g. wrapping the rasterized output), so the blend mode isn't
   * doubled. Internal `fill:white` occlusions are preserved — they keep the
   * layered mountain composition intact; the outer multiply makes them
   * transparent over paper while leaving ink strokes to multiply normally.
   *
   * Defaults to `false`, preserving the historical opaque behavior.
   */
  transparent?: boolean;

  /** Blank space position for composition (留白位置) - affects element generation */
  blankPosition?: BlankPosition;

  /** Random seed for reproducible generation */
  seed?: number;

  /**
   * Landscape detail multiplier for procedural ink texture.
   *
   * Defaults to `1`, which keeps the historical dense texture. Lower values
   * are opt-in and trade texture density for faster generation.
   */
  detail?: number;

  /**
   * Optional per-tag minimum counts for landscape planning.
   *
   * After the natural planner runs and blank-area filtering removes items,
   * shortfalls for any tag listed here are filled with jittered positions
   * that still pass distance and blank-area checks. Useful for guaranteeing
   * a non-empty scene regardless of seed.
   */
  minCounts?: Partial<Record<PlanTag, number>>;

  /**
   * Optional per-element render switch for landscape output.
   *
   * All known element tags render by default. Set a tag to `false` to keep it
   * in the generated plan but omit its SVG output, preserving seed/layout
   * stability while letting callers hide selected visual classes.
   */
  renderElements?: RenderElementControls;

  /**
   * Optional placement tuning for explicit shortfall-driven landscape elements
   * such as guaranteed water bands / boats.
   */
  placement?: LandscapePlacementOptions;

  // Flower-bird specific options
  /** Flower type: 'woody', 'herbal', or 'random' */
  flowerType?: "woody" | "herbal" | "random";
}

function shouldRenderElement(tag: string, controls?: RenderElementControls): boolean {
  return controls?.[tag as PlanTag] !== false;
}

function wrapPlanLayer(tag: string, layer: "underlay" | "base" | "overlay", svg: string): string {
  return svg ? `<g data-shuimo-element="${tag}" data-shuimo-layer="${layer}">${svg}</g>` : "";
}

/**
 * Result of painting generation
 */
export interface PaintingResult {
  /** Generated SVG string */
  svg: string;

  /** Width of the painting */
  width: number;

  /** Height of the painting */
  height: number;

  /** Seed used for generation */
  seed: number;
}

/**
 * Get blank area bounds based on position
 * Returns normalized coordinates (0-1) with margin for smoother transitions
 */
function getBlankArea(position: BlankPosition): BlankArea | null {
  // Blank area takes about 40% of the canvas for better visibility
  const size = 0.4;
  // Extra margin to prevent elements from appearing right at the edge
  const margin = 0.08;

  switch (position) {
    case "topLeft":
      return { xMin: -0.1, xMax: size + 0.05, yMin: -0.1, yMax: size + 0.15, margin };

    case "top":
      return { xMin: 0.1, xMax: 0.9, yMin: -0.1, yMax: size, margin };

    case "topRight":
      return { xMin: 1 - size - 0.05, xMax: 1.1, yMin: -0.1, yMax: size + 0.15, margin };

    case "left":
      return { xMin: -0.1, xMax: size, yMin: 0.1, yMax: 0.9, margin };

    case "center":
      return { xMin: 0.25, xMax: 0.75, yMin: 0.25, yMax: 0.75, margin };

    case "right":
      return { xMin: 1 - size, xMax: 1.1, yMin: 0.1, yMax: 0.9, margin };

    case "bottomLeft":
      return { xMin: -0.1, xMax: size + 0.05, yMin: 1 - size - 0.15, yMax: 1.1, margin };

    case "bottom":
      return { xMin: 0.1, xMax: 0.9, yMin: 1 - size, yMax: 1.1, margin };

    case "bottomRight":
      return { xMin: 1 - size - 0.05, xMax: 1.1, yMin: 1 - size - 0.15, yMax: 1.1, margin };

    case "none":
    default:
      return null;
  }
}

/**
 * Filter plan items based on blank area
 */
function filterPlanByBlankArea(
  plan: PlanItem[],
  width: number,
  height: number,
  blankArea: BlankArea | null,
): PlanItem[] {
  if (!blankArea) return plan;

  return plan.filter((item) => {
    return !MountPlanner.isInBlankArea(item.x, item.y, width, height, blankArea);
  });
}

/**
 * Render a plan item to SVG string
 */
function renderPlanItem(
  item: PlanItem,
  seed: number,
  detail: number,
  renderElements?: RenderElementControls,
): LayeredMountSVG {
  const randomSeed = seed + item.x + item.y;
  const textureDetail = Math.max(0.25, Math.min(1, detail));
  const inkOnly = (svg: string): LayeredMountSVG => ({ base: svg, overlay: "" });
  const visible = shouldRenderElement(item.tag, renderElements);

  switch (item.tag) {
    case "mount": {
      // ret defaults to 0, which returns string
      const rendered = Mount.mountain(item.x, item.y, randomSeed * prng.random(), {
        tex: Math.round(200 * textureDetail),
        layers: true,
      }) as LayeredMountSVG;
      return visible ? rendered : inkOnly("");
    }

    case "flatmount": {
      const rendered = Mount.flatMount(item.x, item.y, randomSeed * Math.PI, {
        wid: 600 + prng.random() * 400,
        hei: 100,
        tex: Math.round(80 * textureDetail),
        cho: 0.5 + prng.random() * 0.2,
        layers: true,
      }) as LayeredMountSVG;
      return visible ? rendered : inkOnly("");
    }

    case "distmount": {
      const svg = Mount.distMount(item.x, item.y, randomSeed, {
        hei: 150,
        len: randChoice([500, 1000, 1500]),
      });
      return inkOnly(visible ? svg : "");
    }

    case "water": {
      const svg = water(item.x, item.y, randomSeed, { len: item.h || 360, clu: 8 });
      return inkOnly(visible ? svg : "");
    }

    case "boat": {
      const ripple = water(item.x, item.y + 18, randomSeed, { len: 260, clu: 5 });
      const boat = Arch.boat01(item.x, item.y, prng.random(), {
        sca: item.y / 800,
        fli: randChoice([true, false]),
      });
      return inkOnly(
        visible ? (shouldRenderElement("water", renderElements) ? ripple : "") + boat : "",
      );
    }

    case "arch01": {
      const svg = Arch.arch01(item.x, item.y, randomSeed, {
        hei: 60 + prng.random() * 40,
        wid: 80 + prng.random() * 40,
        per: 3 + prng.random() * 2,
      });
      return inkOnly(visible ? svg : "");
    }

    case "arch02": {
      const svg = Arch.arch02(item.x, item.y, randomSeed, {
        wid: 40 + prng.random() * 30,
        sto: 2 + Math.floor(prng.random() * 3),
      });
      return inkOnly(visible ? svg : "");
    }

    case "arch03": {
      const svg = Arch.arch03(item.x, item.y, randomSeed, {
        wid: 40 + prng.random() * 30,
        sto: 5 + Math.floor(prng.random() * 4),
      });
      return inkOnly(visible ? svg : "");
    }

    case "arch04": {
      const svg = Arch.arch04(item.x, item.y, randomSeed, {
        sto: 1 + Math.floor(prng.random() * 3),
      });
      return inkOnly(visible ? svg : "");
    }

    case "tower": {
      const svg = Arch.transmissionTower01(item.x, item.y, randomSeed, {
        hei: 150 + prng.random() * 100,
      });
      return inkOnly(visible ? svg : "");
    }

    default:
      return inkOnly("");
  }
}

/**
 * Generate landscape painting (山水画) content
 */
function generateLandscapeContent(
  width: number,
  height: number,
  seed: number,
  blankPosition: BlankPosition,
  minCounts?: Partial<Record<PlanTag, number>>,
  detail: number = 1,
  renderElements?: RenderElementControls,
  placement?: LandscapePlacementOptions,
): string {
  // Initialize PRNG
  prng.seed(seed);

  const blankArea = getBlankArea(blankPosition);

  // Generate plan for the visible area
  const planmtx: number[] = [];
  const xmin = 0;
  const xmax = width;

  // Get raw plan from MountPlanner
  let plan = MountPlanner.plan(xmin, xmax, planmtx);

  // Filter plan based on blank area
  plan = filterPlanByBlankArea(plan, width, height, blankArea);

  // Fill any requested tag shortfalls (safety net for empty-scene seeds).
  if (minCounts) {
    plan = MountPlanner.fillShortfall(plan, {
      xmin,
      xmax,
      planmtx,
      minCounts,
      blankArea,
      width,
      height,
      placement,
    });
  }

  // Sort by y coordinate (painter's algorithm - far to near)
  plan.sort((a, b) => a.y - b.y);

  // Render water underneath terrain, then terrain bodies, then vegetation and
  // mount decorations. Keeping tree ink out of mountain body chunks prevents
  // a later mountain's white occlusion polygon from erasing foreground trees.
  let underlay = "";
  let base = "";
  let overlay = "";

  // Add water for mounts (filter by blank area too)
  for (const item of plan) {
    if (item.tag === "mount") {
      if (!MountPlanner.isInBlankArea(item.x, item.y, width, height, blankArea)) {
        const mountWater = water(item.x, item.y, seed + item.x);
        if (shouldRenderElement("water", renderElements)) {
          underlay += wrapPlanLayer("water", "underlay", mountWater);
        }
      }
    }
  }

  // Add all other elements
  for (const item of plan) {
    const rendered = renderPlanItem(item, seed, detail, renderElements);
    base += wrapPlanLayer(item.tag, "base", rendered.base);
    overlay += wrapPlanLayer(item.tag, "overlay", rendered.overlay);
  }

  return `${underlay}<g data-shuimo-layer="terrain-base">${base}</g><g data-shuimo-layer="terrain-overlay">${overlay}</g>`;
}

/**
 * Generate flower-bird painting (花鸟画) content
 */
function generateFlowerBirdContent(
  width: number,
  height: number,
  seed: number,
  options: PaintingOptions,
): string {
  const flowerType = options.flowerType ?? "random";

  // Generate flower using the existing flower generator
  const flowerSvg = generateFlower({
    seed: seed.toString(),
    type: flowerType,
    width: width,
    height: height,
    background: "none",
  });

  // Extract inner content from SVG element
  return flowerSvg.innerHTML;
}

/**
 * Generate Xuan paper background as SVG string
 */
function generateXuanPaperBackground(
  width: number,
  height: number,
  seed: number,
  options: PaintingXuanPaperOptions,
): { defs: string; background: string } {
  const baseColor = options.baseColor ?? XuanPaperColors.processed;
  const textureIntensity = options.textureIntensity ?? 0.3;
  const age = options.age ?? 0;
  const goldFlecks = options.goldFlecks ?? false;
  const goldDensity = options.goldDensity ?? 0.5;
  const goldColor = options.goldColor ?? GoldFleckColors.gold;
  const fiberDensity = options.fiberDensity ?? 1.0;
  const grainDensity = options.grainDensity ?? 0.5;

  const scene = buildXuanPaperScene({
    width,
    height,
    baseColor,
    textureIntensity,
    age,
    fiberDensity,
    grainDensity,
    seed,
    goldFlecks,
    goldDensity,
    goldColor,
    mode: "svg",
  });

  const { defs, body: background } = renderXuanPaperSVGParts(scene);

  return { defs, background };
}

/**
 * PaintingGenerator - Main class for generating Chinese paintings
 */
export class PaintingGenerator {
  /**
   * Generate a Chinese painting
   *
   * @param options - Painting options
   * @returns PaintingResult containing SVG and metadata
   *
   * @example
   * ```typescript
   * // Generate landscape on Xuan paper with top-left blank
   * const result = PaintingGenerator.generate({
   *   type: 'landscape',
   *   width: 1200,
   *   height: 800,
   *   onXuanPaper: true,
   *   blankPosition: 'topLeft',
   *   xuanPaperOptions: {
   *     baseColor: [252, 248, 230],
   *     goldFlecks: true,
   *   },
   * });
   * document.body.innerHTML = result.svg;
   * ```
   */
  static generate(options: PaintingOptions): PaintingResult {
    const {
      type,
      width = 1200,
      height = 800,
      onXuanPaper = true,
      xuanPaperOptions = {},
      blankPosition = "none",
      seed = Date.now(),
      minCounts,
      detail = 1,
      transparent = false,
      renderElements,
      placement,
    } = options;

    // SVG defs
    let svgDefs = "";
    let paperBackground = "";

    // Generate Xuan paper background if requested
    if (onXuanPaper) {
      const paper = generateXuanPaperBackground(width, height, seed, xuanPaperOptions);
      svgDefs = paper.defs;
      paperBackground = paper.background;
    }

    // Generate painting content based on type
    let paintingContent = "";
    if (type === "landscape") {
      paintingContent = generateLandscapeContent(
        width,
        height,
        seed,
        blankPosition,
        minCounts,
        detail,
        renderElements,
        placement,
      );
    } else if (type === "flowerBird") {
      paintingContent = generateFlowerBirdContent(width, height, seed, options);
    }

    const rootStyleAttr = transparent ? "" : ' style="mix-blend-mode:multiply;"';

    // Assemble final SVG
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${rootStyleAttr}>
      <defs>
        ${svgDefs}
      </defs>
      ${paperBackground}
      <g>
        ${paintingContent}
      </g>
    </svg>`;

    return {
      svg: svgContent,
      width,
      height,
      seed,
    };
  }

  /**
   * Generate a landscape painting (山水画)
   * Convenience method for generating landscape paintings
   */
  static landscape(options: Omit<PaintingOptions, "type"> = {}): PaintingResult {
    return this.generate({ ...options, type: "landscape" });
  }

  /**
   * Generate a flower-bird painting (花鸟画)
   * Convenience method for generating flower-bird paintings
   */
  static flowerBird(options: Omit<PaintingOptions, "type"> = {}): PaintingResult {
    return this.generate({ ...options, type: "flowerBird" });
  }

  /**
   * Generate painting and return as data URL
   * Useful for embedding in images or downloading
   */
  static generateDataURL(options: PaintingOptions): string {
    const result = this.generate(options);
    const encoded = encodeURIComponent(result.svg);
    return `data:image/svg+xml,${encoded}`;
  }

  /**
   * Generate painting and return as Blob
   * Useful for file downloads
   */
  static generateBlob(options: PaintingOptions): Blob {
    const result = this.generate(options);
    return new Blob([result.svg], { type: "image/svg+xml" });
  }
}

// Re-export color presets for convenience
export { XuanPaperColors, GoldFleckColors };

// Convenience function exports
export function generatePainting(options: PaintingOptions): PaintingResult {
  return PaintingGenerator.generate(options);
}

export function generateLandscape(options: Omit<PaintingOptions, "type"> = {}): PaintingResult {
  return PaintingGenerator.landscape(options);
}

export function generateFlowerBird(options: Omit<PaintingOptions, "type"> = {}): PaintingResult {
  return PaintingGenerator.flowerBird(options);
}
