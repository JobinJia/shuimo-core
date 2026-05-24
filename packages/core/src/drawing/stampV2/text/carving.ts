import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import type { PRNG } from "../../../foundation/random/prng";
import type { Point2, Ring } from "../geometry/flatten";

export interface CarveOptions {
  /** 0-1; 0 leaves rings untouched. */
  intensity?: number;
  /** Spatial frequency of the noise; lower = larger ripples. Default 0.15. */
  scale?: number;
}

/**
 * 刀刻感: perturb each glyph ring vertex with simplex noise so the once-smooth
 * Bezier silhouette reads as hand-carved with small irregular waves.
 *
 * Vertex topology is preserved (same vertex count, same ring count) — only
 * positions move. Two independent noise fields drive X and Y so the
 * displacement looks unbiased.
 */
/**
 * Carving displaces vertices along the ring's OUTWARD normal only (abs of
 * noise), so strokes get bumpy/rough but never thinner than the original.
 * This matches real 篆刻: the carving tool removes material around the
 * character, roughening edges, but the character body itself doesn't shrink.
 */
export function carveRings(rings: Ring[], opts: CarveOptions, prng: PRNG): Ring[] {
  const intensity = opts.intensity ?? 0;
  if (intensity <= 0 || rings.length === 0) return rings;
  const scale = opts.scale ?? 0.08;
  const amp = intensity * 1.8;
  const noise = new SimplexNoise(prng.next() * 65536);
  return rings.map((ring) =>
    ring.map(([x, y], i) => {
      // Compute outward normal from adjacent vertices.
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const next = ring[(i + 1) % ring.length];
      const ex = next[0] - prev[0];
      const ey = next[1] - prev[1];
      const elen = Math.hypot(ex, ey) || 1;
      const nx = ey / elen;
      const ny = -ex / elen;
      // abs(noise) → always outward → strokes only get bumps, never thin.
      const d = Math.abs(noise.noise2D(x * scale, y * scale)) * amp;
      return [x + nx * d, y + ny * d] as Point2;
    }),
  );
}
