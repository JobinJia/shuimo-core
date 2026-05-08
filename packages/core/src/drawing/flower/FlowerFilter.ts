/**
 * Flower Generator - Filter System (Pre-computation Mode)
 * Replicates Canvas pixel filters by applying color adjustments during shape generation
 * Original Canvas version: reference-code/flowers/main.js (Lines 1062-1071, 1092-1105)
 *
 * Strategy: Instead of post-processing like Canvas, we pre-compute color adjustments
 * based on shape position during generation.
 */

import type { LayerType } from "./types";
import { noise } from "./FlowerNoise";
import { mapval } from "./FlowerMath";

// Low-res noise cache. Each flower generation calls noise ~45k times
// from filter lookups. Most coordinates hit the same rounded buckets.
const noiseCache = new Map<number, number>();
const cacheKey = (x: number, y: number, z: number): number =>
  Math.round(x * 10) * 10000 + Math.round(y * 10) * 10 + z;

function cachedNoise(x: number, y: number, z: number = 0): number {
  const k = cacheKey(x, y, z);
  let v = noiseCache.get(k);
  if (v === undefined) {
    v = noise(x, y, z);
    noiseCache.set(k, v);
  }
  return v;
}

export function resetFilterNoiseCache(): void {
  noiseCache.clear();
}

// ============================================================================
// Pre-computation Filter Functions
// ============================================================================

/**
 * Calculate wispy filter color adjustment for a given position
 * Original: Lines 1062-1066
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Color multipliers {r, g, b, a}
 */
export function getWispyAdjustment(
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const n = cachedNoise(x * 0.2, y * 0.2);
  const m = cachedNoise(x * 0.5, y * 0.5, 2);

  return {
    r: 1.0,
    g: mapval(m, 0, 1, 0.95, 1),
    b: mapval(m, 0, 1, 0.9, 1),
    a: mapval(n, 0, 1, 0.5, 1),
  };
}

/**
 * Calculate fade filter alpha adjustment for a given position
 * Original: Lines 1067-1070
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Alpha multiplier (0-1)
 */
export function getFadeAdjustment(x: number, y: number): number {
  const n = cachedNoise(x * 0.01, y * 0.01);
  return Math.min(Math.max(mapval(n, 0, 1, 0, 1), 0), 1);
}

/**
 * Apply wispy adjustment to RGBA values
 *
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @param a - Alpha (0-1)
 * @param x - X coordinate for noise sampling
 * @param y - Y coordinate for noise sampling
 * @returns Adjusted {r, g, b, a}
 */
export function applyWispy(
  r: number,
  g: number,
  b: number,
  a: number,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const adj = getWispyAdjustment(x, y);
  return {
    r: r * adj.r,
    g: g * adj.g,
    b: b * adj.b,
    a: a * adj.a,
  };
}

/**
 * Apply fade adjustment to alpha value
 *
 * @param a - Original alpha (0-1)
 * @param x - X coordinate for noise sampling
 * @param y - Y coordinate for noise sampling
 * @returns Adjusted alpha
 */
export function applyFade(a: number, x: number, y: number): number {
  return a * getFadeAdjustment(x, y);
}

/**
 * Apply both fade and wispy filters (for lay0 in Canvas version)
 * Canvas applies: fade first, then wispy
 *
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @param a - Alpha (0-1)
 * @param x - X coordinate
 * @param y - Y coordinate
 * @returns Adjusted {r, g, b, a}
 */
export function applyFadeAndWispy(
  r: number,
  g: number,
  b: number,
  a: number,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  // Apply fade first
  const fadedA = applyFade(a, x, y);

  // Then apply wispy
  return applyWispy(r, g, b, fadedA, x, y);
}

// ============================================================================
// Layer Filter Types
// ============================================================================

export type FilterType = "wispy" | "fade";
// LayerType is imported from types.ts

/**
 * Get the appropriate filter function based on layer type
 * - lay0: fade + wispy (branches, leaves, stems)
 * - lay1: wispy only (flower petals)
 */
export function getLayerFilter(
  layerType: LayerType,
): (
  r: number,
  g: number,
  b: number,
  a: number,
  x: number,
  y: number,
) => { r: number; g: number; b: number; a: number } {
  if (layerType === "lay0") {
    return applyFadeAndWispy;
  } else {
    return applyWispy;
  }
}

// ============================================================================
// Export namespace for compatibility
// ============================================================================

export const Filter = {
  getWispyAdjustment,
  getFadeAdjustment,
  applyWispy,
  applyFade,
  applyFadeAndWispy,
  getLayerFilter,
};
