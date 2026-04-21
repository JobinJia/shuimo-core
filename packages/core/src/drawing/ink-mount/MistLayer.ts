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
