import { Vector2 } from "../../foundation/geometry/Vector2";
import { SimplexNoise } from "../../foundation/noise/SimplexNoise";
import type { MistRegion, MountainLayer } from "./types";

export interface MistInput {
  layers: MountainLayer[];
  width: number;
  height: number;
  seed: number;
  opacity: number;
  frequency: number;
  coverage: number; // 0-1
}

/**
 * Compute the average Y value of a ridge line.
 */
function averageRidgeY(ridgeLine: Vector2[]): number {
  if (ridgeLine.length === 0) return 0;
  return ridgeLine.reduce((sum, p) => sum + p.y, 0) / ridgeLine.length;
}

/**
 * Generate mist regions between adjacent mountain layers.
 * Mist appears in the band between far and near layer ridge lines,
 * modulated by simplex noise to produce organic cloud-like patches.
 */
export function generateMist(input: MistInput): MistRegion[] {
  const { layers, width, height, seed, opacity, coverage } = input;

  if (layers.length < 2) return [];

  // Sort layers by depth ascending (far to near)
  const sorted = [...layers].sort((a, b) => a.depth - b.depth);

  const regions: MistRegion[] = [];
  const noise = new SimplexNoise(seed);

  for (let i = 0; i < sorted.length - 1; i++) {
    const farLayer = sorted[i];
    const nearLayer = sorted[i + 1];

    const farY = averageRidgeY(farLayer.ridgeLine);
    const nearY = averageRidgeY(nearLayer.ridgeLine);

    // Band between the two average Y positions with padding
    const padding = height * 0.1;
    const bandTop = Math.min(farY, nearY) - padding;
    const bandBottom = Math.max(farY, nearY) + padding;
    const bandHeight = bandBottom - bandTop;
    const bandCenterY = (bandTop + bandBottom) * 0.5;

    const patchCount = Math.max(1, Math.floor(3 * coverage));

    for (let p = 0; p < patchCount; p++) {
      // Center X spread across width
      const centerX = (0.1 + (p / patchCount) * 0.8) * width;
      const centerY = bandCenterY;

      // Ellipse radii — horizontally stretched
      const rx = width * (0.15 + coverage * 0.2);
      const ry = bandHeight * (0.2 + coverage * 0.3);

      // Mist opacity: farther mist is more opaque
      const patchOpacity = opacity * (0.5 + (1 - farLayer.depth) * 0.5);

      const fadeRadius = Math.max(ry, rx) * 0.4;

      // Build 20-segment noise-modulated contour
      const segments = 20;
      const contour: Vector2[] = [];

      for (let s = 0; s < segments; s++) {
        const angle = (s / segments) * Math.PI * 2;

        // Base ellipse point
        const baseX = Math.cos(angle) * rx;
        const baseY = Math.sin(angle) * ry;

        // Noise offset to make it organic
        const noiseScale = 0.005;
        const noiseVal = noise.noise2D(
          (centerX + baseX) * noiseScale,
          (centerY + baseY) * noiseScale,
        );
        // Modulate the radius by noise: ~[-1,1] mapped to [0.7, 1.3]
        const radiusScale = 1.0 + noiseVal * 0.3;

        contour.push(new Vector2(centerX + baseX * radiusScale, centerY + baseY * radiusScale));
      }

      regions.push({
        contour,
        opacity: patchOpacity,
        fadeRadius,
      });
    }
  }

  return regions;
}

export interface ForegroundMistInput {
  width: number;
  height: number;
  seed: number;
  opacity: number;
  /** Top of the foreground mist band, 0..1 of canvas height (default 0.55) */
  bandStart?: number;
  /** Bottom of the foreground mist band, 0..1 (default 0.95) */
  bandEnd?: number;
  /** Number of overlapping mist patches (default 5) */
  patchCount?: number;
}

/**
 * Generate a low, wide mist band intended to be drawn AFTER all mountain
 * layers. The patches cover the painting's lower portion horizontally so
 * the near mountain reads as partially veiled — a staple of 山水画 staging.
 */
export function generateForegroundMist(input: ForegroundMistInput): MistRegion[] {
  const { width, height, seed, opacity } = input;
  // Default band straddles the canvas bottom: top ~82% (visible), bottom
  // 120% (off-canvas). The canvas naturally crops the lower half of every
  // patch, so the viewer sees mist "rolling in from below" rather than a
  // fully-rendered ellipse with a visible lower fade.
  const bandStart = input.bandStart ?? 0.88;
  const bandEnd = input.bandEnd ?? 1.26;
  // Many small overlapping patches with size variance produce a
  // continuous wispy band; few large patches read as discrete balls.
  const patchCount = input.patchCount ?? 14;

  const noise = new SimplexNoise(seed);
  const regions: MistRegion[] = [];

  const bandTop = height * bandStart;
  const bandBottom = height * bandEnd;
  const bandHeight = bandBottom - bandTop;
  const bandCenter = (bandTop + bandBottom) * 0.5;

  for (let p = 0; p < patchCount; p++) {
    // Jitter the horizontal slot so patches don't line up on a grid.
    const slotT = (p + 0.5) / patchCount;
    const slotJitter = noise.noise2D(p * 1.3, 7) * (0.7 / patchCount);
    const centerX = (slotT + slotJitter) * width;

    // Larger vertical jitter so the top of the band undulates.
    const centerY = bandCenter + noise.noise2D(p * 0.7, 11) * bandHeight * 0.35;

    // Mix small wisps and medium clouds — sample sizeBias as multi-octave
    // noise so the distribution feels less uniform.
    const sizeBias = noise.noise2D(p * 0.9, 17) * 0.5 + 0.5; // 0..1
    const sizeMul = 0.55 + sizeBias * 0.9; // 0.55..1.45 multiplier

    const rx = width * 0.18 * sizeMul;
    const ry = bandHeight * 0.3 * sizeMul;

    const segments = 24;
    const contour: Vector2[] = [];
    for (let s = 0; s < segments; s++) {
      const angle = (s / segments) * Math.PI * 2;
      const baseX = Math.cos(angle) * rx;
      const baseY = Math.sin(angle) * ry;
      // Two-octave contour noise — adds the fine ragged edge that real
      // mist patches have.
      const nLow = noise.noise2D((centerX + baseX) * 0.003, (centerY + baseY) * 0.003);
      const nHi = noise.noise2D((centerX + baseX) * 0.012, (centerY + baseY) * 0.012);
      const radiusScale = 1.0 + nLow * 0.35 + nHi * 0.15;
      contour.push(new Vector2(centerX + baseX * radiusScale, centerY + baseY * radiusScale));
    }

    regions.push({
      contour,
      // Per-patch opacity variance so some wisps are barely there.
      opacity: opacity * (0.45 + 0.55 * (noise.noise2D(p, 3) * 0.5 + 0.5)),
      fadeRadius: Math.max(rx, ry) * 0.55,
    });
  }

  return regions;
}
