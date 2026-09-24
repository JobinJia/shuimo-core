import { Vector2 } from "../../foundation/geometry/Vector2";
import { SimplexNoise } from "../../foundation/noise/SimplexNoise";
import type { CunFaStroke, MountainLayer } from "./types";
import { smoothProfile, topProfile } from "./internal/silhouette";

export interface CunFaEngineInput {
  layer: MountainLayer;
  seed: number;
  density: number; // 0-1
  lengthRange: [number, number]; // min/max stroke length in px
  pressureCurve: number[]; // e.g. [0.3, 1.0, 0.3] thin→thick→thin
  /**
   * How far below the silhouette a stroke may start, in px. Strokes are
   * biased toward the ridge; the lower body is left for the wash and mist.
   * Default: 1.2 × ridge bounds height, at least 2 × the max stroke length.
   */
  reach?: number;
  /** Canvas width the silhouette spans. Default: right edge of the ridge bounds. */
  width?: number;
}

/**
 * Simple LCG seeded random number generator (no global state).
 */
function seededRandom(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483647;
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

/** Central-difference slope of the edge profile over ±radius px. */
function slopeProfile(top: Float32Array, radius: number): Float32Array {
  const n = top.length;
  const out = new Float32Array(n);
  for (let x = 0; x < n; x++) {
    const a = Math.max(0, x - radius);
    const b = Math.min(n - 1, x + radius);
    out[x] = b > a ? (top[b] - top[a]) / (b - a) : 0;
  }
  return out;
}

/**
 * Generate cunfa (皴法) brush strokes under the mountain silhouette.
 *
 * Hemp-fibre style (披麻皴): each stroke starts just under the deformed
 * edge and runs down the slope, bending to stay roughly parallel to the
 * flank above it, so the texture describes the mountain's form. Strokes
 * cluster near the ridge and thin out down the body.
 */
export function generateCunFaStrokes(input: CunFaEngineInput): CunFaStroke[] {
  const { layer, seed, density, lengthRange, pressureCurve } = input;
  const { depth, bounds } = layer;
  const edge =
    layer.silhouette && layer.silhouette.length >= 3 ? layer.silhouette : layer.ridgeLine;
  if (edge.length < 3 || density <= 0) return [];

  const width = Math.max(1, input.width ?? Math.ceil(bounds.x + bounds.width));
  const top = topProfile(edge, width);
  // Read slopes off a smoothed edge so Hobbs micro-spikes don't make the
  // strokes zigzag.
  const smoothTop = smoothProfile(top, 12);
  const slope = slopeProfile(smoothTop, 10);
  const broadSlope = slopeProfile(smoothTop, 60);

  const rand = seededRandom(seed);
  const noise = new SimplexNoise(seed);

  const [minLen, maxLen] = lengthRange;
  const reach = input.reach ?? Math.max(maxLen * 2, bounds.height * 1.2);
  const baseWidth = 0.6 + depth * 1.6;
  const count = Math.round((width / 4) * density * (0.35 + 0.65 * depth));
  const stepLen = 4;

  const strokes: CunFaStroke[] = [];

  // Strokes come in small bundles of near-parallel siblings, the way a
  // brush lays hemp-fibre texture, rather than as isolated scratches.
  let placed = 0;
  while (placed < count) {
    const x0 = rand() * width;
    const col = Math.min(width, Math.max(0, Math.round(x0)));
    // Bias start points toward the ridge.
    const u = rand() ** 2.2;
    const y0 = top[col] + 3 + u * reach;
    const baseLen = (minLen + rand() * (maxLen - minLen)) * (0.45 + depth * 0.55);
    // Darker near the ridge, fading down the body.
    const baseOpacity = (0.3 + 0.6 * (1 - u)) * (0.6 + 0.4 * rand());
    const bundle = 1 + Math.floor(rand() * 3);

    for (let b = 0; b < bundle && placed < count; b++, placed++) {
      const spread = b === 0 ? 0 : (b % 2 === 1 ? 1 : -1) * (2 + rand() * 3) * (0.6 + depth);
      const sx = x0 + spread;
      const sy = y0 + (rand() - 0.5) * 6 + b * 2;
      const strokeLen = baseLen * (b === 0 ? 1 : 0.6 + rand() * 0.35);
      const pointCount = Math.max(3, Math.round(strokeLen / stepLen) + 1);
      const wScale = 0.7 + rand() * 0.6;

      let x = sx;
      let y = sy;
      let dx = 0;
      let dy = 1;
      const path: Vector2[] = [];
      const widths: number[] = [];

      for (let p = 0; p < pointCount; p++) {
        const t = p / (pointCount - 1);
        path.push(new Vector2(x, y));
        widths.push(baseWidth * wScale * samplePressure(pressureCurve, t));

        const c = Math.min(width, Math.max(0, Math.round(x)));
        // Downhill side from the broad slope, local steepness from the
        // fine one: the stroke echoes the flank directly above it.
        const side = broadSlope[c] >= 0 ? 1 : -1;
        const tx = side;
        const ty = Math.max(0.15, side * slope[c]);
        const wobble = noise.noise2D(x0 * 0.02 + p * 0.25, y0 * 0.02) * 0.35;
        let wx = tx * 0.75 + wobble;
        let wy = ty * 0.75 + 0.55;
        const wl = Math.hypot(wx, wy) || 1;
        wx /= wl;
        wy /= wl;
        if (p === 0) {
          dx = wx;
          dy = wy;
        } else {
          dx = dx * 0.55 + wx * 0.45;
          dy = dy * 0.55 + wy * 0.45;
          const dl = Math.hypot(dx, dy) || 1;
          dx /= dl;
          dy /= dl;
        }
        x += dx * stepLen;
        y += dy * stepLen;
      }

      const opacity = Math.min(1, Math.max(0.05, baseOpacity * (b === 0 ? 1 : 0.75)));
      strokes.push({ path, widths, opacity });
    }
  }

  return strokes;
}
