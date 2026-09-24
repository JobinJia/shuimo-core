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
 *   1. Every ring is densified (so 4-vertex squares actually have material to
 *      perturb) and each vertex is pushed along the outward normal by
 *      two-octave simplex noise (amp ∝ roughness, weighted heaviest at the
 *      corners). This gives an organic wobble on the rim.
 *   2. A handful of seed-placed chips (smooth bites with a ragged floor) are
 *      pushed into the outer ring, mostly near corners. Count and depth grow
 *      with `roughness`.
 *
 * Inner rings (the inner edge of a yang rim) get a tamer wobble and no chips,
 * and inward displacement of the outer ring is capped so the rim band never
 * inverts.
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
  // Frequencies scale with frequencyScale so the wobble count per perimeter
  // is size-invariant; amplitudes scale with lengthScale.
  const { lengthScale, frequencyScale } = scaleForSize(opts.size ?? 0);
  const ampScale = opts.size ? lengthScale : 1;
  const freqScale = opts.size ? frequencyScale : 1;
  // @since 3.0.0 amplitude is decoupled from `border.thickness`: it used to
  // be `roughness × thickness × 0.5`, so a caller-pinned 4 px rim got 0.4 px
  // of wear and every seed looked the same. The thickness now only caps the
  // wear so a yang rim (outer edge in + inner edge out) is never cut through
  // — crossing rings would render as evenodd artefacts.
  const hasHoles = base.some((poly) => poly.length > 1);
  const rawAmp = roughness * AMP_AT_REF * ampScale;
  const amp = hasHoles ? Math.min(rawAmp, border.thickness * 0.3) : rawAmp;
  const maxInward = hasHoles ? border.thickness * 0.55 : Infinity;
  const noiseLo = new SimplexNoise(prng.next() * 65536);
  const noiseHi = new SimplexNoise(prng.next() * 65536);

  // Chips (缺口): a few seed-placed bites into the outer rim, biased toward
  // the corners where real seals wear first. Count and depth grow with
  // roughness; positions come from the stage PRNG so each seed differs.
  const chipCount = Math.floor(roughness * 6 + prng.next() * 1.6);
  const chips: Chip[] = [];
  for (let i = 0; i < chipCount; i++) {
    const nearCorner = prng.next() < 0.6;
    chips.push({
      // Parametric position around the ring bbox perimeter, in [0, 1).
      at: nearCorner ? (Math.floor(prng.next() * 4) + (prng.next() - 0.5) * 0.12 + 1) % 4 / 4 : prng.next(),
      halfWidth: (5 + prng.next() * 9) * ampScale,
      depth: roughness * (18 + prng.next() * 22) * ampScale,
    });
  }

  // Perturb both the outer rim AND any inner holes (the inner border edge in
  // 阳章). 阴章 collapses holes upstream so this only adds noise on the
  // inside when it's actually visible (annular yang border). Use a different
  // simplex offset per ring so the inner edge wobble is decorrelated from the
  // outer rim wobble — otherwise both edges would wave together and the
  // border band would look uniformly translated rather than chewed up.
  const perturbed: MultiPolygon = base.map((poly, polyIdx) =>
    poly.map((ring, ringIdx) => {
      const dense = densify(ring, minSegLen);
      const outer = ringIdx === 0;
      // Inner edges get a tamer amp so the border band doesn't get
      // dangerously thin where outer-in and inner-out displacement coincide.
      const ringAmp = outer ? amp : amp * 0.7;
      const salt = polyIdx * 31 + ringIdx * 113;
      return perturbRing(dense, {
        noiseLo,
        noiseHi,
        amp: ringAmp,
        freqScale,
        salt,
        chips: outer ? chips : NO_CHIPS,
        maxInward: outer ? maxInward : Infinity,
      });
    }),
  );

  return perturbed;
}

/** Wear amplitude (user units) at REF_SIZE for roughness = 1. */
const AMP_AT_REF = 9.6;

interface Chip {
  at: number;
  halfWidth: number;
  depth: number;
}
const NO_CHIPS: Chip[] = [];

interface PerturbParams {
  noiseLo: SimplexNoise;
  noiseHi: SimplexNoise;
  amp: number;
  freqScale: number;
  salt: number;
  chips: Chip[];
  /** Cap on inward displacement (user units). */
  maxInward: number;
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
 * Wear weight along the ring. @since 3.0.0 corners wear the MOST (the old
 * ramp went to 0 at corners — the opposite of real stones, whose corners
 * chip and round first). `t` is the distance along the nearest bbox edge
 * from its closer corner, normalised by half the edge: 0 at a corner, 1 at
 * the edge midpoint. Weight runs from 1.6 at corners down to 0.55 mid-edge.
 */
function cornerWeight(t: number): number {
  const u = 1 - t;
  return 0.55 + 1.05 * u * u * u;
}

/**
 * Position of (x, y) on the bbox perimeter as a fraction in [0, 1):
 * top edge 0..0.25 (left→right), right 0.25..0.5, bottom 0.5..0.75
 * (right→left), left 0.75..1. Used to place chips.
 */
function perimeterParam(x: number, y: number, bb: { x1: number; y1: number; x2: number; y2: number }): number {
  const w = Math.max(1e-6, bb.x2 - bb.x1);
  const h = Math.max(1e-6, bb.y2 - bb.y1);
  const dTop = Math.abs(y - bb.y1);
  const dBot = Math.abs(y - bb.y2);
  const dLeft = Math.abs(x - bb.x1);
  const dRight = Math.abs(x - bb.x2);
  const m = Math.min(dTop, dBot, dLeft, dRight);
  const fx = Math.min(1, Math.max(0, (x - bb.x1) / w));
  const fy = Math.min(1, Math.max(0, (y - bb.y1) / h));
  if (m === dTop) return fx * 0.25;
  if (m === dRight) return 0.25 + fy * 0.25;
  if (m === dBot) return 0.5 + (1 - fx) * 0.25;
  return 0.75 + (1 - fy) * 0.25;
}

function perturbRing(ring: Ring, p: PerturbParams): Ring {
  const bb = ringBBox(ring);
  const w = bb.x2 - bb.x1;
  const h = bb.y2 - bb.y1;
  const perimeter = 2 * (w + h);
  const n = ring.length;
  const out: Ring = new Array(n);
  // Two-layer noise: low-freq for gentle overall shape (30%) + high-freq
  // for small-scale stone roughness (70%).
  const loFreq = 0.03 * p.freqScale;
  const hiFreq = 0.18 * p.freqScale;
  // Orient normals outward regardless of ring winding: with shoelace area
  // A > 0 the right-hand normal (ey, -ex) points out of the ring.
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  const outSign = area2 >= 0 ? 1 : -1;
  const loOff = p.salt * 13.7;
  const hiOff = p.salt * 7.3;

  for (let i = 0; i < n; i++) {
    const x = ring[i][0];
    const y = ring[i][1];
    const prev = ring[(i - 1 + n) % n];
    const next = ring[(i + 1) % n];
    const ex = next[0] - prev[0];
    const ey = next[1] - prev[1];
    const elen = Math.hypot(ex, ey) || 1;
    const nx = (outSign * ey) / elen;
    const ny = (-outSign * ex) / elen;

    const dTop = Math.abs(y - bb.y1);
    const dBot = Math.abs(y - bb.y2);
    const dLeft = Math.abs(x - bb.x1);
    const dRight = Math.abs(x - bb.x2);
    const nearest = Math.min(dTop, dBot, dLeft, dRight);
    let alongEdge: number;
    let halfLen: number;
    if (nearest === dTop || nearest === dBot) {
      alongEdge = Math.min(x - bb.x1, bb.x2 - x);
      halfLen = w / 2;
    } else {
      alongEdge = Math.min(y - bb.y1, bb.y2 - y);
      halfLen = h / 2;
    }
    const t = Math.min(1, alongEdge / Math.max(1, halfLen));
    const weight = cornerWeight(t);

    const lo = p.noiseLo.noise2D(x * loFreq + loOff, y * loFreq + loOff);
    const hi = p.noiseHi.noise2D(x * hiFreq + hiOff, y * hiFreq + hiOff);
    let offset = (lo * 0.3 + hi * 0.7) * p.amp * weight;

    if (p.chips.length > 0 && perimeter > 0) {
      const u = perimeterParam(x, y, bb);
      for (let c = 0; c < p.chips.length; c++) {
        const chip = p.chips[c];
        let d = Math.abs(u - chip.at);
        if (d > 0.5) d = 1 - d;
        const dist = d * perimeter;
        if (dist < chip.halfWidth) {
          // Smooth bite with a ragged floor (hi noise), pushed inward.
          const bump = 0.5 * (1 + Math.cos((Math.PI * dist) / chip.halfWidth));
          offset -= chip.depth * bump * (0.75 + 0.25 * hi);
        }
      }
    }
    // Normals point outward, so inward displacement is negative.
    if (offset < -p.maxInward) offset = -p.maxInward;
    out[i] = [x + nx * offset, y + ny * offset] as Point2;
  }
  return out;
}
