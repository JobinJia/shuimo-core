import { SimplexNoise } from "../../foundation/noise/SimplexNoise";
import { Vector2 } from "../../foundation/geometry/Vector2";
import type { MountainLayer } from "./types";

export interface RidgeGeneratorInput {
  width: number;
  height: number;
  seed: number;
  depth: number; // 0 = far, 1 = near
  resolution: number; // number of points on ridge line
  peakCount: number;
  sharpness: number;
  subRidgeCount: number;
  noiseOctaves: number;
}

/**
 * Simple LCG seeded random number generator (no global state).
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Fractal Brownian Motion using SimplexNoise.
 */
function fbm(
  noise: SimplexNoise,
  x: number,
  y: number,
  octaves: number,
  persistence: number = 0.5,
  lacunarity: number = 2.0,
): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxAmplitude = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise.noise2D(x * frequency, y * frequency);
    maxAmplitude += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return value / maxAmplitude;
}

/**
 * Generate a mountain ridge contour using FBM noise with injected sharp peaks.
 */
export function generateRidge(input: RidgeGeneratorInput): MountainLayer {
  const {
    width,
    height,
    seed,
    depth,
    resolution,
    peakCount,
    sharpness,
    subRidgeCount,
    noiseOctaves,
  } = input;

  const rand = seededRandom(seed);
  const noise = new SimplexNoise(seed);

  const baselineY = height * (0.3 + depth * 0.5);
  const heightAmplitude = height * (0.15 + depth * 0.35);

  // Step 1: Generate base FBM ridge line
  const ridgeLine: Vector2[] = [];
  for (let i = 0; i < resolution; i++) {
    const t = i / (resolution - 1);
    const x = t * width;
    const noiseVal = fbm(noise, t * 3, depth * 10, noiseOctaves);
    const y = baselineY - noiseVal * heightAmplitude;
    ridgeLine.push(new Vector2(x, y));
  }

  // Step 2: Inject sharp peaks
  for (let p = 0; p < peakCount; p++) {
    const peakPos = 0.15 + rand() * 0.7; // 15%-85% of width
    const peakHeight = heightAmplitude * (0.3 + rand() * 0.5);
    const falloff = width * (0.05 + rand() * 0.1);

    for (let i = 0; i < resolution; i++) {
      const t = i / (resolution - 1);
      const dist = Math.abs(t * width - peakPos * width);
      if (dist < falloff) {
        const influence = (1 - dist / falloff) ** sharpness;
        ridgeLine[i] = new Vector2(
          ridgeLine[i].x,
          ridgeLine[i].y - peakHeight * influence,
        );
      }
    }
  }

  // Step 3: Compute normals (perpendicular to tangent, pointing downward)
  const normals: Vector2[] = [];
  for (let i = 0; i < resolution; i++) {
    let tangent: Vector2;
    if (i === 0) {
      tangent = ridgeLine[1].sub(ridgeLine[0]);
    }
    else if (i === resolution - 1) {
      tangent = ridgeLine[resolution - 1].sub(ridgeLine[resolution - 2]);
    }
    else {
      tangent = ridgeLine[i + 1].sub(ridgeLine[i - 1]);
    }

    // Rotate 90 degrees: (dx, dy) -> (-dy, dx) or (dy, -dx)
    let normal = new Vector2(-tangent.y, tangent.x).normalize();

    // Ensure normal points downward (positive y in screen coords)
    if (normal.y < 0) {
      normal = new Vector2(-normal.x, -normal.y);
    }

    normals.push(normal);
  }

  // Step 4: Generate sub-ridges (offset copies with decay and extra noise)
  const subRidges: Vector2[][] = [];
  for (let s = 0; s < subRidgeCount; s++) {
    const subRidge: Vector2[] = [];
    const decay = (s + 1) / (subRidgeCount + 1);
    const offsetY = heightAmplitude * 0.1 * (s + 1);
    const subNoise = new SimplexNoise(seed + s + 1);

    for (let i = 0; i < resolution; i++) {
      const t = i / (resolution - 1);
      const extraNoise = fbm(subNoise, t * 5, (s + 1) * 7, Math.max(2, noiseOctaves - 1));
      const x = ridgeLine[i].x;
      const y = ridgeLine[i].y + offsetY + extraNoise * heightAmplitude * 0.1 * decay;
      subRidge.push(new Vector2(x, y));
    }

    subRidges.push(subRidge);
  }

  // Step 5: Compute bounds from all ridge points
  const allPoints = [...ridgeLine, ...subRidges.flat()];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of allPoints) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  return {
    depth,
    ridgeLine,
    subRidges,
    normals,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}
