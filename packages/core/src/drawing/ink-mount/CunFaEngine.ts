import { Vector2 } from "../../foundation/geometry/Vector2";
import { SimplexNoise } from "../../foundation/noise/SimplexNoise";
import type { CunFaStroke, MountainLayer } from "./types";

export interface CunFaEngineInput {
  layer: MountainLayer;
  seed: number;
  density: number; // 0-1
  lengthRange: [number, number]; // min/max stroke length in px
  pressureCurve: number[]; // e.g. [0.3, 1.0, 0.3] thin→thick→thin
}

/**
 * Simple LCG seeded random number generator (no global state).
 */
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Sample a pressure curve at parameter t (0-1) using linear interpolation.
 */
function samplePressure(curve: number[], t: number): number {
  if (curve.length === 0) return 1;
  if (curve.length === 1) return curve[0];

  const pos = t * (curve.length - 1);
  const idx = Math.floor(pos);
  const frac = pos - idx;

  if (idx >= curve.length - 1) return curve[curve.length - 1];
  return curve[idx] * (1 - frac) + curve[idx + 1] * frac;
}

/**
 * Compute curvature at a ridge point using cross product of adjacent tangents.
 */
function computeCurvature(ridgeLine: Vector2[], index: number): number {
  const n = ridgeLine.length;
  if (n < 3 || index <= 0 || index >= n - 1) return 0;

  const prev = ridgeLine[index - 1];
  const curr = ridgeLine[index];
  const next = ridgeLine[index + 1];

  const t1 = curr.sub(prev);
  const t2 = next.sub(curr);

  const len1 = Math.sqrt(t1.x * t1.x + t1.y * t1.y);
  const len2 = Math.sqrt(t2.x * t2.x + t2.y * t2.y);

  if (len1 < 1e-8 || len2 < 1e-8) return 0;

  const cross = t1.x * t2.y - t1.y * t2.x;
  return cross / (len1 * len2);
}

/**
 * Generate cunfa (皴法) brush strokes along mountain surface normals.
 *
 * Cunfa strokes give mountains texture and three-dimensional appearance
 * by simulating traditional Chinese ink painting brush techniques.
 */
export function generateCunFaStrokes(input: CunFaEngineInput): CunFaStroke[] {
  const { layer, seed, density, lengthRange, pressureCurve } = input;
  const { ridgeLine, normals, depth, bounds } = layer;

  const resolution = ridgeLine.length;
  if (resolution < 3) return [];

  const rand = seededRandom(seed);
  const noise = new SimplexNoise(seed);

  const [minLen, maxLen] = lengthRange;
  const baseWidth = 0.3 + depth * 0.8;
  const baseCount = Math.floor(resolution * density * 1.5);

  const strokes: CunFaStroke[] = [];

  for (let iter = 0; iter < baseCount; iter++) {
    // Pick a random point on the ridge
    const idx = Math.floor(rand() * resolution);
    const point = ridgeLine[idx];
    const normal = normals[idx];

    // Compute curvature to modulate stroke placement
    const curvature = Math.abs(computeCurvature(ridgeLine, idx));
    const placementThreshold = 1 - density - curvature * 0.5;
    if (rand() < placementThreshold) continue;

    // Rotate normal by ±15° randomly
    const angleOffset = (rand() - 0.5) * 2 * ((15 * Math.PI) / 180);
    const cosA = Math.cos(angleOffset);
    const sinA = Math.sin(angleOffset);
    const direction = new Vector2(
      normal.x * cosA - normal.y * sinA,
      normal.x * sinA + normal.y * cosA,
    );

    // Stroke length scaled by depth (closer layers get longer strokes)
    const strokeLen = (minLen + rand() * (maxLen - minLen)) * (0.5 + depth * 0.5);

    // Generate path points along the direction with noise wobble
    const pointCount = Math.max(3, Math.round(strokeLen / 5));
    const path: Vector2[] = [];
    const widths: number[] = [];

    for (let p = 0; p < pointCount; p++) {
      const t = p / (pointCount - 1);
      const dist = t * strokeLen;

      // Subtle noise wobble perpendicular to stroke direction
      const wobble = noise.noise2D(point.x * 0.05 + p * 0.3, point.y * 0.05 + seed * 0.1) * 0.8;

      const perpX = -direction.y;
      const perpY = direction.x;

      const px = point.x + direction.x * dist + perpX * wobble;
      const py = point.y + direction.y * dist + perpY * wobble;
      path.push(new Vector2(px, py));

      // Width from pressure curve
      const width = baseWidth * samplePressure(pressureCurve, t);
      widths.push(width);
    }

    // Opacity: lighter at peaks (low y), darker at base (high y)
    const boundsHeight = bounds.height || 1;
    const normalizedY = Math.max(0, Math.min(1, (point.y - bounds.y) / boundsHeight));
    const opacity = 0.15 + normalizedY * 0.65 + rand() * 0.15;

    strokes.push({ path, widths, opacity: Math.min(1, opacity) });
  }

  return strokes;
}
