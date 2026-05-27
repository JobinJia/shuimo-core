import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import type { PRNG } from "../../../foundation/random/prng";
import type { Point2, Ring } from "../geometry/flatten";
import { ringBBox } from "../geometry/flatten";
import type { MultiPolygon } from "../geometry/boolean";
import type { BorderRings } from "./shape";
import { scaleForSize } from "../internal/visualScale";

export interface ErosionOptions {
  /** 0-1; 0 returns input untouched. */
  roughness?: number;
  /** Densification target: max segment length on the outer ring before perturbing. */
  minSegLen?: number;
  /**
   * Seal size in px (typically max(width, height)). Used to size-adapt the
   * simplex noise wavelength so the rim wobble pattern reads the same at
   * 200px and 480px. Defaults to REF_SIZE (no-op) for back-compat.
   * @since 2.0.4-beta.1
   */
  size?: number;
}

/**
 * 边框磨损 + 缺角. Two-layer model:
 *   1. Outer ring is densified (so 4-vertex squares actually have material to
 *      perturb) and each vertex is pushed along the outward normal by simplex
 *      noise (amp ∝ roughness * thickness). This gives an organic, low-freq
 *      wave on the rim.
 *   2. A handful of triangular "chips" are generated at random points along
 *      the rim and subtracted from the polygon. Chip count and size scale
 *      with `roughness`. This adds the discrete worn-corner look the
 *      reference 阴章 has.
 *
 * Inner rings (holes) are preserved untouched — they bound the text area and
 * shouldn't get visibly noisy at the same time the outline does.
 */
export function erodeBorder(
  border: BorderRings,
  base: MultiPolygon,
  opts: ErosionOptions,
  prng: PRNG,
): MultiPolygon {
  const roughness = opts.roughness ?? 0;
  if (roughness <= 0 || base.length === 0) return base;
  const minSegLen = opts.minSegLen ?? 6;
  // amp is already in seal user units and `border.thickness` typically
  // scales with size, so amplitude is naturally size-adaptive. The simplex
  // noise frequencies (0.03 / 0.18 below) are NOT — they're in absolute
  // user units, so at a small seal you get fewer waves around the rim.
  // Scaling frequency by frequencyScale keeps the wave-count-per-perimeter
  // constant across sizes; lengthScale on amp keeps amplitude proportional
  // to seal size even if the caller pinned `border.thickness` to a fixed px
  // value (otherwise we'd over-erode small seals with a pinned thick rim).
  const { lengthScale, frequencyScale } = scaleForSize(opts.size ?? 0);
  const ampScale = opts.size ? lengthScale : 1;
  const freqScale = opts.size ? frequencyScale : 1;
  const amp = roughness * border.thickness * 0.5 * ampScale;
  const noiseLo = new SimplexNoise(prng.next() * 65536);
  const noiseHi = new SimplexNoise(prng.next() * 65536);

  // Perturb both the outer rim AND any inner holes (the inner border edge in
  // 阳章). 阴章 collapses holes upstream so this only adds noise on the
  // inside when it's actually visible (annular yang border). Use a different
  // simplex offset per ring so the inner edge wobble is decorrelated from the
  // outer rim wobble — otherwise both edges would wave together and the
  // border band would look uniformly translated rather than chewed up.
  const perturbed: MultiPolygon = base.map((poly, polyIdx) =>
    poly.map((ring, ringIdx) => {
      const dense = densify(ring, minSegLen);
      // Inner edges get a slightly tamer amp so the border band doesn't get
      // dangerously thin where outer-out and inner-in displacement coincide.
      const ringAmp = ringIdx === 0 ? amp : amp * 0.7;
      const salt = polyIdx * 31 + ringIdx * 113;
      return perturbRing(dense, noiseLo, noiseHi, ringAmp, freqScale, salt);
    }),
  );

  return perturbed;
}

function densify(ring: Ring, maxLen: number): Ring {
  if (ring.length < 2) return ring;
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len > maxLen) {
      const n = Math.ceil(len / maxLen);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push([a[0] + dx * t, a[1] + dy * t]);
      }
    }
  }
  return out;
}

/**
 * edgeProgress: controls noise amplitude along the ring. Per the v1 spec:
 *   - Top edge: fullNoise = 1.0 (全程满噪声)
 *   - Other three edges: sin(t×π), so corners = 0 and edge midpoints = 1.
 *
 * We approximate this for arbitrary convex rings by computing each vertex's
 * distance to the nearest corner of the bbox, normalized by half the shorter
 * edge. Vertices near corners get progress → 0, midpoints → 1. The "top
 * edge" special case is handled via a y-threshold.
 */
/**
 * edgeProgress per v1 spec section 四:
 *   - Top edge: fullNoise = 1.0
 *   - Other three edges: sin(t × π/2), where t = distance ALONG the edge
 *     from the nearest corner / half-edge-length.  t=0 at corners, t=1 at
 *     midpoint → progress goes 0 → 1 → 0 symmetrically.
 *
 * Previous bug: used "distance to nearest bbox boundary" instead of "distance
 * along the edge to nearest corner". On left/right/bottom edges the boundary
 * distance was ~0 → progress ~0 → no noise on three sides.
 */
function perturbRing(
  ring: Ring,
  noiseLo: SimplexNoise,
  noiseHi: SimplexNoise,
  amp: number,
  freqScale: number,
  salt: number,
): Ring {
  const bb = ringBBox(ring);
  const w = bb.x2 - bb.x1;
  const h = bb.y2 - bb.y1;
  const edgeThreshold = Math.max(w, h) * 0.12;

  return ring.map(([x, y], i) => {
    const prev = ring[(i - 1 + ring.length) % ring.length];
    const next = ring[(i + 1) % ring.length];
    const ex = next[0] - prev[0];
    const ey = next[1] - prev[1];
    const elen = Math.hypot(ex, ey) || 1;
    const nx = ey / elen;
    const ny = -ex / elen;

    const dTop = Math.abs(y - bb.y1);
    const dBot = Math.abs(y - bb.y2);
    const dLeft = Math.abs(x - bb.x1);
    const dRight = Math.abs(x - bb.x2);
    const nearest = Math.min(dTop, dBot, dLeft, dRight);

    let progress: number;
    if (nearest === dTop && dTop < edgeThreshold) {
      progress = 1;
    } else {
      let alongEdge: number;
      let halfLen: number;
      if (nearest === dBot) {
        alongEdge = Math.min(x - bb.x1, bb.x2 - x);
        halfLen = w / 2;
      } else if (nearest === dLeft) {
        alongEdge = Math.min(y - bb.y1, bb.y2 - y);
        halfLen = h / 2;
      } else {
        alongEdge = Math.min(y - bb.y1, bb.y2 - y);
        halfLen = h / 2;
      }
      const t = Math.min(1, alongEdge / Math.max(1, halfLen));
      progress = Math.sin(t * Math.PI * 0.5);
    }

    // Two-layer noise: low-freq for gentle overall shape (30%) + high-freq
    // for small-scale stone roughness (70%). Single low-freq alone produces
    // smooth "wave" edges; the high-freq layer adds the crunchy notches that
    // real carved stone edges have. Frequencies are scaled by freqScale so a
    // smaller seal still sees the same number of wobbles around its rim
    // instead of one slow wave + nothing.
    const loFreq = 0.03 * freqScale;
    const hiFreq = 0.18 * freqScale;
    const lo = noiseLo.noise2D(x * loFreq + salt * 13.7, y * loFreq + salt * 13.7);
    const hi = noiseHi.noise2D(x * hiFreq + salt * 7.3, y * hiFreq + salt * 7.3);
    const offset = (lo * 0.3 + hi * 0.7) * amp * progress;
    return [x + nx * offset, y + ny * offset] as Point2;
  });
}

