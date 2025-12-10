/**
 * PaintingGenerator - Unified interface for generating Chinese paintings
 *
 * Supports:
 * - Landscape paintings (山水画) using SceneManager
 * - Flower-bird paintings (花鸟画) with procedural flowers
 * - Optional Xuan paper (宣纸) background
 * - Configurable blank space (留白) positioning - affects element generation
 */

import { MountPlanner, type PlanItem } from './MountPlanner';
import { Mount } from '../elements/natural/Mount';
import { water } from '../elements/natural/Water';
import { Arch } from '../elements/objects/Arch';
import { randChoice } from '../utils/random';
import { prng } from '../foundation/random';
import { generateFlower } from '../drawing/Flower';
import type { XuanPaperOptions } from '../elements/natural/XuanPaper';

/**
 * Blank space position for composition
 * Controls where the painting leaves empty space (no elements generated)
 */
export type BlankPosition =
  | 'topLeft'      // 左上留白
  | 'top'          // 上方留白
  | 'topRight'     // 右上留白
  | 'left'         // 左侧留白
  | 'center'       // 中心留白
  | 'right'        // 右侧留白
  | 'bottomLeft'   // 左下留白
  | 'bottom'       // 下方留白
  | 'bottomRight'  // 右下留白
  | 'none';        // 无留白

/**
 * Painting type
 */
export type PaintingType =
  | 'landscape'    // 山水画
  | 'flowerBird';  // 花鸟画

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
  xuanPaperOptions?: Partial<XuanPaperOptions>;

  /** Blank space position for composition (留白位置) - affects element generation */
  blankPosition?: BlankPosition;

  /** Random seed for reproducible generation */
  seed?: number;

  // Flower-bird specific options
  /** Flower type: 'woody', 'herbal', or 'random' */
  flowerType?: 'woody' | 'herbal' | 'random';
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
 * Blank area definition
 */
interface BlankArea {
  xMin: number;  // 0-1 normalized
  xMax: number;
  yMin: number;
  yMax: number;
}

/**
 * Get blank area bounds based on position
 * Returns normalized coordinates (0-1)
 */
function getBlankArea(position: BlankPosition): BlankArea | null {
  // Blank area takes about 35% of the canvas
  const size = 0.35;

  switch (position) {
    case 'topLeft':
      return { xMin: 0, xMax: size + 0.1, yMin: 0, yMax: size + 0.1 };

    case 'top':
      return { xMin: 0.2, xMax: 0.8, yMin: 0, yMax: size };

    case 'topRight':
      return { xMin: 1 - size - 0.1, xMax: 1, yMin: 0, yMax: size + 0.1 };

    case 'left':
      return { xMin: 0, xMax: size, yMin: 0.15, yMax: 0.85 };

    case 'center':
      return { xMin: 0.3, xMax: 0.7, yMin: 0.3, yMax: 0.7 };

    case 'right':
      return { xMin: 1 - size, xMax: 1, yMin: 0.15, yMax: 0.85 };

    case 'bottomLeft':
      return { xMin: 0, xMax: size + 0.1, yMin: 1 - size - 0.1, yMax: 1 };

    case 'bottom':
      return { xMin: 0.2, xMax: 0.8, yMin: 1 - size, yMax: 1 };

    case 'bottomRight':
      return { xMin: 1 - size - 0.1, xMax: 1, yMin: 1 - size - 0.1, yMax: 1 };

    case 'none':
    default:
      return null;
  }
}

/**
 * Check if a point is in the blank area
 */
function isInBlankArea(
  x: number,
  y: number,
  width: number,
  height: number,
  blankArea: BlankArea | null
): boolean {
  if (!blankArea) return false;

  const normalizedX = x / width;
  const normalizedY = y / height;

  return (
    normalizedX >= blankArea.xMin &&
    normalizedX <= blankArea.xMax &&
    normalizedY >= blankArea.yMin &&
    normalizedY <= blankArea.yMax
  );
}

/**
 * Filter plan items based on blank area
 */
function filterPlanByBlankArea(
  plan: PlanItem[],
  width: number,
  height: number,
  blankArea: BlankArea | null
): PlanItem[] {
  if (!blankArea) return plan;

  return plan.filter(item => {
    // Convert x position to be relative to canvas (plan uses absolute x)
    // For static painting, we center the content
    const relativeX = item.x;
    return !isInBlankArea(relativeX, item.y, width, height, blankArea);
  });
}

/**
 * Render a plan item to SVG string
 */
function renderPlanItem(item: PlanItem, seed: number): string {
  const randomSeed = seed + item.x + item.y;

  switch (item.tag) {
    case 'mount':
      // ret defaults to 0, which returns string
      return Mount.mountain(item.x, item.y, randomSeed * Math.random()) as string;

    case 'flatmount':
      return Mount.flatMount(item.x, item.y, randomSeed * Math.PI, {
        wid: 600 + Math.random() * 400,
        hei: 100,
        cho: 0.5 + Math.random() * 0.2,
      });

    case 'distmount':
      return Mount.distMount(item.x, item.y, randomSeed, {
        hei: 150,
        len: randChoice([500, 1000, 1500]),
      });

    case 'boat':
      return Arch.boat01(item.x, item.y, Math.random(), {
        sca: item.y / 800,
        fli: randChoice([true, false]),
      });

    case 'arch01':
      return Arch.arch01(item.x, item.y, randomSeed, {
        hei: 60 + Math.random() * 40,
        wid: 80 + Math.random() * 40,
        per: 3 + Math.random() * 2,
      });

    case 'arch02':
      return Arch.arch02(item.x, item.y, randomSeed, {
        wid: 40 + Math.random() * 30,
        sto: 2 + Math.floor(Math.random() * 3),
      });

    case 'arch03':
      return Arch.arch03(item.x, item.y, randomSeed, {
        wid: 40 + Math.random() * 30,
        sto: 5 + Math.floor(Math.random() * 4),
      });

    case 'arch04':
      return Arch.arch04(item.x, item.y, randomSeed, {
        sto: 1 + Math.floor(Math.random() * 3),
      });

    case 'tower':
      return Arch.transmissionTower01(item.x, item.y, randomSeed, {
        hei: 150 + Math.random() * 100,
      });

    default:
      return '';
  }
}

/**
 * Generate landscape painting (山水画) content
 */
function generateLandscapeContent(
  width: number,
  height: number,
  seed: number,
  blankPosition: BlankPosition
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
  let content = '';

  // Add water for mounts
  for (const item of plan) {
    if (item.tag === 'mount') {
      content += water(item.x, item.y, seed + item.x);
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
  options: PaintingOptions
): string {
  const flowerType = options.flowerType ?? 'random';

  // Generate flower using the existing flower generator
  const flowerSvg = generateFlower({
    seed: seed.toString(),
    type: flowerType,
    width: width,
    height: height,
    background: 'none',
  });

  // Extract inner content from SVG element
  return flowerSvg.innerHTML;
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
   * });
   * document.body.innerHTML = result.svg;
   *
   * // Generate flower-bird painting
   * const result = PaintingGenerator.generate({
   *   type: 'flowerBird',
   *   width: 600,
   *   height: 600,
   *   onXuanPaper: true,
   *   flowerType: 'woody',
   * });
   * ```
   */
  static generate(options: PaintingOptions): PaintingResult {
    const {
      type,
      width = 1200,
      height = 800,
      onXuanPaper = true,
      xuanPaperOptions = {},
      blankPosition = 'none',
      seed = Date.now(),
    } = options;

    // SVG defs
    const svgDefs: string[] = [];

    // Generate Xuan paper background if requested
    let paperBackground = '';
    if (onXuanPaper) {
      const filterId = `xuan-filter-${seed}`;
      const baseColor = xuanPaperOptions.baseColor ?? [252, 250, 240];
      const textureIntensity = xuanPaperOptions.textureIntensity ?? 0.3;
      const intensity = textureIntensity * 0.12;

      svgDefs.push(`
        <filter id="${filterId}" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.08" numOctaves="4" seed="${seed}" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="
            0 0 0 0 ${1 - intensity}
            0 0 0 0 ${1 - intensity}
            0 0 0 0 ${1 - intensity}
            0 0 0 1 0
          " result="monoNoise" />
          <feFlood flood-color="rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})" result="baseColor" />
          <feBlend in="baseColor" in2="monoNoise" mode="multiply" result="paper" />
        </filter>
      `);

      paperBackground = `
        <rect width="${width}" height="${height}" fill="rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})" filter="url(#${filterId})" />
      `;
    }

    // Generate painting content based on type
    let paintingContent = '';
    if (type === 'landscape') {
      paintingContent = generateLandscapeContent(width, height, seed, blankPosition);
    } else if (type === 'flowerBird') {
      paintingContent = generateFlowerBirdContent(width, height, seed, options);
    }

    // Assemble final SVG
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="mix-blend-mode:multiply;">
      <defs>
        ${svgDefs.join('\n')}
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
  static landscape(options: Omit<PaintingOptions, 'type'> = {}): PaintingResult {
    return this.generate({ ...options, type: 'landscape' });
  }

  /**
   * Generate a flower-bird painting (花鸟画)
   * Convenience method for generating flower-bird paintings
   */
  static flowerBird(options: Omit<PaintingOptions, 'type'> = {}): PaintingResult {
    return this.generate({ ...options, type: 'flowerBird' });
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
    return new Blob([result.svg], { type: 'image/svg+xml' });
  }
}

// Convenience function exports
export function generatePainting(options: PaintingOptions): PaintingResult {
  return PaintingGenerator.generate(options);
}

export function generateLandscape(options: Omit<PaintingOptions, 'type'> = {}): PaintingResult {
  return PaintingGenerator.landscape(options);
}

export function generateFlowerBird(options: Omit<PaintingOptions, 'type'> = {}): PaintingResult {
  return PaintingGenerator.flowerBird(options);
}
