/**
 * PaintingGenerator - Unified interface for generating Chinese paintings
 *
 * Supports:
 * - Landscape paintings (山水画) using SceneManager
 * - Flower-bird paintings (花鸟画) with procedural flowers
 * - Optional Xuan paper (宣纸) background with full customization
 * - Configurable blank space (留白) positioning - affects element generation
 */

import { MountPlanner, type PlanItem } from "./MountPlanner";
import { Mount } from "../elements/natural/Mount";
import { water } from "../elements/natural/Water";
import { Arch } from "../elements/objects/Arch";
import { randChoice } from "../utils/random";
import { prng } from "../foundation/random";
import { generateFlower } from "../drawing/Flower";
import { XuanPaper, XuanPaperColors, GoldFleckColors } from "../elements/natural/XuanPaper";

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

  /** Blank space position for composition (留白位置) - affects element generation */
  blankPosition?: BlankPosition;

  /** Random seed for reproducible generation */
  seed?: number;

  // Flower-bird specific options
  /** Flower type: 'woody', 'herbal', or 'random' */
  flowerType?: "woody" | "herbal" | "random";
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
 * Blank area definition with margin
 */
interface BlankArea {
  xMin: number; // 0-1 normalized
  xMax: number;
  yMin: number;
  yMax: number;
  margin: number; // Extra margin for elements near the edge
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
 * Check if a point is in the blank area (with margin consideration)
 */
function isInBlankArea(
  x: number,
  y: number,
  width: number,
  height: number,
  blankArea: BlankArea | null,
): boolean {
  if (!blankArea) return false;

  const normalizedX = x / width;
  const normalizedY = y / height;

  // Check if in core blank area
  const inCore =
    normalizedX >= blankArea.xMin &&
    normalizedX <= blankArea.xMax &&
    normalizedY >= blankArea.yMin &&
    normalizedY <= blankArea.yMax;

  if (inCore) return true;

  // Check margin area with probability-based filtering
  const margin = blankArea.margin;
  const inMargin =
    normalizedX >= blankArea.xMin - margin &&
    normalizedX <= blankArea.xMax + margin &&
    normalizedY >= blankArea.yMin - margin &&
    normalizedY <= blankArea.yMax + margin;

  if (inMargin) {
    // Calculate distance from blank area
    const distX = Math.max(0, blankArea.xMin - normalizedX, normalizedX - blankArea.xMax);
    const distY = Math.max(0, blankArea.yMin - normalizedY, normalizedY - blankArea.yMax);
    const dist = Math.sqrt(distX * distX + distY * distY);

    // Probability increases as we get closer to blank area
    const probability = 1 - dist / margin;
    return prng.random() < probability * 0.8;
  }

  return false;
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
    return !isInBlankArea(item.x, item.y, width, height, blankArea);
  });
}

/**
 * Render a plan item to SVG string
 */
function renderPlanItem(item: PlanItem, seed: number): string {
  const randomSeed = seed + item.x + item.y;

  switch (item.tag) {
    case "mount":
      // ret defaults to 0, which returns string
      return Mount.mountain(item.x, item.y, randomSeed * prng.random()) as string;

    case "flatmount":
      return Mount.flatMount(item.x, item.y, randomSeed * Math.PI, {
        wid: 600 + prng.random() * 400,
        hei: 100,
        cho: 0.5 + prng.random() * 0.2,
      });

    case "distmount":
      return Mount.distMount(item.x, item.y, randomSeed, {
        hei: 150,
        len: randChoice([500, 1000, 1500]),
      });

    case "boat":
      return Arch.boat01(item.x, item.y, prng.random(), {
        sca: item.y / 800,
        fli: randChoice([true, false]),
      });

    case "arch01":
      return Arch.arch01(item.x, item.y, randomSeed, {
        hei: 60 + prng.random() * 40,
        wid: 80 + prng.random() * 40,
        per: 3 + prng.random() * 2,
      });

    case "arch02":
      return Arch.arch02(item.x, item.y, randomSeed, {
        wid: 40 + prng.random() * 30,
        sto: 2 + Math.floor(prng.random() * 3),
      });

    case "arch03":
      return Arch.arch03(item.x, item.y, randomSeed, {
        wid: 40 + prng.random() * 30,
        sto: 5 + Math.floor(prng.random() * 4),
      });

    case "arch04":
      return Arch.arch04(item.x, item.y, randomSeed, {
        sto: 1 + Math.floor(prng.random() * 3),
      });

    case "tower":
      return Arch.transmissionTower01(item.x, item.y, randomSeed, {
        hei: 150 + prng.random() * 100,
      });

    default:
      return "";
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

  // Sort by y coordinate (painter's algorithm - far to near)
  plan.sort((a, b) => a.y - b.y);

  // Render all items
  let content = "";

  // Add water for mounts (filter by blank area too)
  for (const item of plan) {
    if (item.tag === "mount") {
      if (!isInBlankArea(item.x, item.y, width, height, blankArea)) {
        content += water(item.x, item.y, seed + item.x);
      }
    }
  }

  // Add all other elements
  for (const item of plan) {
    content += renderPlanItem(item, seed);
  }

  return content;
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

  // Generate Xuan paper SVG
  const paperSvg = XuanPaper.generateSVG({
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
  });

  // Extract defs and content from generated SVG
  const defsElement = paperSvg.querySelector("defs");
  const defs = defsElement ? defsElement.innerHTML : "";

  // Get all content except defs
  let background = "";
  for (const child of Array.from(paperSvg.children)) {
    if (child.tagName.toLowerCase() !== "defs") {
      background += child.outerHTML;
    }
  }

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
      paintingContent = generateLandscapeContent(width, height, seed, blankPosition);
    } else if (type === "flowerBird") {
      paintingContent = generateFlowerBirdContent(width, height, seed, options);
    }

    // Assemble final SVG
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="mix-blend-mode:multiply;">
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
