/**
 * Cross-platform text measurement for stamps using pre-computed font metrics.
 *
 * Uses fontkit-extracted glyph data so layout is identical on every OS,
 * and works in Node.js / SSR without any DOM dependency.
 */

import { YISHANBEIZHUANTI_METRICS, type FontMetrics } from "./stamp-font-metrics";

export type { FontMetrics } from "./stamp-font-metrics";

export interface StampTextMetrics {
  width: number;
  height: number;
  columnWidths: number[];
  columnHeights: number[];
}

/** Registered font metrics tables (built-in + user-registered) */
const fontMetricsRegistry = new Map<string, FontMetrics>();

// Register the built-in seal script font
fontMetricsRegistry.set("峄山碑篆体", YISHANBEIZHUANTI_METRICS);

/**
 * Register a custom font metrics table for cross-platform measurement.
 */
export function registerFontMetrics(fontFamily: string, metrics: FontMetrics): void {
  fontMetricsRegistry.set(fontFamily, metrics);
}

/**
 * Look up metrics for a font family. Checks both exact match and substring.
 */
export function findFontMetrics(fontFamily: string): FontMetrics | undefined {
  const exact = fontMetricsRegistry.get(fontFamily);
  if (exact) return exact;
  for (const [key, metrics] of fontMetricsRegistry) {
    if (fontFamily.includes(key)) return metrics;
  }
  return undefined;
}

/**
 * Pure-computation text measurement using pre-computed font metrics.
 *
 * In vertical upright CJK layout:
 * - Column width = advanceWidth * fontSize (how wide each column is)
 * - Character cell height = 1.0 * fontSize (full em-square, CJK chars are square)
 * - Column height = numChars * cellHeight + (numChars-1) * spacing
 */
export function calculateStampTextMetrics(
  text: string[],
  fontSize: number,
  options?: {
    fontFamily?: string;
    characterSpacing?: number;
    columnSpacing?: number;
  },
): StampTextMetrics {
  const fontFamily = options?.fontFamily ?? "serif";
  const characterSpacing = options?.characterSpacing ?? 0.05;
  const columnSpacing = options?.columnSpacing ?? 0.02;

  const metrics = findFontMetrics(fontFamily);

  let columnWidths: number[];
  let columnHeights: number[];

  if (metrics) {
    // In vertical upright CJK, each character occupies a full em-square cell
    // (both width and height = 1.0 * fontSize), regardless of advanceWidth.
    // advanceWidth only affects horizontal typesetting.
    const cellSize = 1.0 * fontSize;
    columnWidths = text.map(() => cellSize);

    columnHeights = text.map((line) => {
      const charCount = [...line].length;
      return charCount * cellSize + (charCount - 1) * fontSize * characterSpacing;
    });
  } else {
    const estimatedWidth = fontSize * 1.0;
    columnWidths = text.map(() => estimatedWidth);
    columnHeights = text.map((line) => {
      const chars = [...line].length;
      return chars * fontSize * 1.0 + (chars - 1) * fontSize * characterSpacing;
    });
  }

  const totalWidth =
    columnWidths.reduce((sum, w) => sum + w, 0) + (text.length - 1) * fontSize * columnSpacing;
  const totalHeight = Math.max(...columnHeights);

  return {
    width: totalWidth,
    height: totalHeight,
    columnWidths,
    columnHeights,
  };
}

export interface CharacterPosition {
  char: string;
  /** X offset within column (0 = column center) */
  x: number;
  /** Y offset: top of this character's cell */
  y: number;
}

/**
 * Calculate per-character positions for a single column in vertical layout.
 * Each cell is 1.0 * fontSize tall (full em-square for CJK).
 */
export function calculateColumnCharPositions(
  line: string,
  fontSize: number,
  options?: {
    fontFamily?: string;
    characterSpacing?: number;
  },
): CharacterPosition[] {
  const characterSpacing = options?.characterSpacing ?? 0.05;
  // In vertical upright CJK, each character cell = full em-square
  const cellSize = 1.0 * fontSize;

  const chars = [...line];
  return chars.map((char, i) => ({
    char,
    x: 0,
    y: i * (cellSize + fontSize * characterSpacing),
  }));
}

/**
 * Check if a font family has registered metrics for cross-platform measurement.
 */
export function hasFontMetrics(fontFamily: string): boolean {
  return findFontMetrics(fontFamily) !== undefined;
}
