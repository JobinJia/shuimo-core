import { BBS, hsv, normRand, pnoise } from "../../FlowerCanvas";
import {
  ROSE_H,
  PETAL_WASH_BASE_S,
  PETAL_WASH_BASE_V,
  PETAL_WASH_TIP_S,
  PETAL_WASH_TIP_V,
  PETAL_CONTOUR_W,
  PETAL_CONTOUR_S_LIGHT,
  PETAL_CONTOUR_S_DEEP,
  PETAL_CONTOUR_V_LIGHT,
  PETAL_CONTOUR_V_DEEP,
  PETAL_CONTOUR_A_LIGHT,
  PETAL_CONTOUR_A_DEEP,
  PETAL_CONTOUR_NOISE_AMP,
  PETAL_CONTOUR_TIP_BIAS,
  PETAL_TIP_ROUND_START,
  PETAL_TIP_TAPER,
  PETAL_TIP_LEAN_FRAC,
  PETAL_TIP_WARP_AMP,
  PETAL_TIP_WARP_FREQ,
  PETAL_EDGE_NOISE_AMP,
  PETAL_EDGE_NOISE_FREQ,
  PETAL_VEIN_W,
  PETAL_VEIN_COUNT_MIN,
  PETAL_VEIN_COUNT_MAX,
  PETAL_FULLNESS,
} from "./constants";
import { polyPath, ribbon, taperBoth, type Painter, type Pt } from "./strokes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

/** Random-free petal shape inputs chosen by the caller (flower / bud / falling). */
export interface PetalShape {
  baseX: number;
  baseY: number;
  /** spine direction, screen radians (-PI/2 = straight up). */
  angle: number;
  length: number;
  halfW: number;
  /** perpendicular bow of the spine (px). */
  bend: number;
  /** widest point along spine, 0..1. */
  widePos: number;
  /** left/right asymmetry, -1..1. */
  curl: number;
  /** per-layer/per-petal value offset. */
  vShift: number;
  alpha: number;
  /** draw interior veins (skip on edge-on petals to avoid clutter). */
  veins?: boolean;
}

/** A fully-determined petal: shape + every random parameter it needs. */
export interface PetalArgs extends PetalShape {
  /** sideways lean of the upper petal (px). */
  tipLean: number;
  /** perlin offset for silhouette warp / edge noise / vein jitter. */
  warpSeed: number;
  /** number of veins (0 = none). */
  veinCount: number;
}

/** Painted geometry of one petal, built once and painted by every pass. */
export interface PetalGeom {
  /** closed silhouette (染 wash area). */
  wash: Path2D;
  gradFrom: Pt;
  gradTo: Pt;
  washBase: string;
  washTip: string;
  /** single continuous contour ribbon (勾). */
  contour: Path2D;
  contourLight: string;
  contourDeep: string;
  /** darker ink pooling along the contour where the edge noise peaks. */
  pool: Path2D | null;
  poolCol: string;
  /** all veins of the petal merged into one path (脉). */
  veins: Path2D | null;
  veinCol: string;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const lerp = (x: number, y: number, p: number): number => x + (y - x) * p;

/** Draw the petal's random parameters from BBS (the only BBS use for a petal). */
export function planPetal(shape: PetalShape): PetalArgs {
  const tipLean = (BBS.next() - 0.5) * shape.halfW * PETAL_TIP_LEAN_FRAC;
  const warpSeed = BBS.next() * 30;
  const veinCount =
    shape.veins !== false
      ? Math.floor(normRand(PETAL_VEIN_COUNT_MIN, PETAL_VEIN_COUNT_MAX + 1))
      : 0;
  return { ...shape, tipLean, warpSeed, veinCount };
}

/** Contour colour at ink density `d` (0 = palest, 1 = deepest). */
function contourColor(a: PetalArgs, d: number, alphaMul = 1): string {
  const S = lerp(PETAL_CONTOUR_S_LIGHT, PETAL_CONTOUR_S_DEEP, d);
  const V = clamp01(lerp(PETAL_CONTOUR_V_LIGHT, PETAL_CONTOUR_V_DEEP, d) + a.vShift);
  const A = lerp(PETAL_CONTOUR_A_LIGHT, PETAL_CONTOUR_A_DEEP, d) * a.alpha * alphaMul;
  return hsv(ROSE_H, S, V, A);
}

// Contour density along the spine: pale at the base, deep at the tip.
const DENSITY_BASE = 0.22;
// Edge-noise contribution above which ink visibly pools on the contour.
const POOL_THRESHOLD = 0.04;
const POOL_RANGE = 0.12;

/**
 * One lotus petal as 染 (interior wash, base→tip rose gradient) + 勾 (a SINGLE
 * continuous contour ribbon around the silhouette, open at the base) + 脉 (fine
 * vein ribbons from the base). Pure geometry: no randomness is consumed here,
 * so building the same PetalArgs twice gives the same petal.
 *
 * The silhouette half-width follows a Beta-distribution profile
 * `w(t) = halfW · t^a (1-t)^b / peak` (a = F·widePos, b = F·(1-widePos)),
 * which is C∞-smooth with a single peak — continuous curvature, no kink at the
 * widest point or tip. This is the "natural regularity" the reference shows.
 */
export function buildPetal(a: PetalArgs): PetalGeom {
  const ax = cos(a.angle);
  const ay = sin(a.angle);
  const px = -ay; // perpendicular
  const py = ax;
  const N = 28;
  const { tipLean, warpSeed } = a;

  // Spine: straight axis + perpendicular bow peaking mid, plus an upper-petal
  // lean that grows toward the tip (the recurved/deformed apex).
  const spine: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const sx = a.baseX + ax * a.length * t;
    const sy = a.baseY + ay * a.length * t;
    const leanEnv = t < 0.4 ? 0 : Math.pow((t - 0.4) / 0.6, 2);
    const bow = sin(t * PI) * a.bend + leanEnv * tipLean;
    spine.push([sx + px * bow, sy + py * bow]);
  }

  // Body half-width: Beta profile (smooth single peak at widePos) up to
  // PETAL_TIP_ROUND_START; beyond that the cap tapers to a soft point.
  const wp = Math.min(0.85, Math.max(0.15, a.widePos));
  const aExp = PETAL_FULLNESS * wp;
  const bExp = PETAL_FULLNESS * (1 - wp);
  const peakT = aExp / (aExp + bExp);
  const peak = Math.pow(peakT, aExp) * Math.pow(1 - peakT, bExp);
  const betaAt = (t: number): number => {
    if (t <= 0 || t >= 1) return 0;
    return (a.halfW * (Math.pow(t, aExp) * Math.pow(1 - t, bExp))) / peak;
  };
  const tc = PETAL_TIP_ROUND_START;
  const wCap = betaAt(tc);
  const halfAt = (t: number): number => {
    if (t <= 0 || t >= 1) return 0;
    if (t < tc) return betaAt(t);
    // Cap tapers to a soft point: (1-u)^TAPER (≈1 = straight-sided point).
    const u = (t - tc) / (1 - tc);
    return wCap * Math.pow(1 - u, PETAL_TIP_TAPER);
  };

  const lf = 1 - a.curl * 0.35;
  const rf = 1 + a.curl * 0.35;
  const edgeSeedL = warpSeed + 11;
  const edgeSeedR = warpSeed + 29;
  const left: Pt[] = [];
  const right: Pt[] = [];
  // Raw edge-noise per side (0..1), kept so the contour ink-density can be
  // driven by the SAME signal that undulates the geometry → 起伏 and 笔墨浓度
  // move together.
  const leftNoise: number[] = [];
  const rightNoise: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // Subtle overall width warp (both edges together) → 变形.
    const warp = 1 + PETAL_TIP_WARP_AMP * (pnoise(t * PETAL_TIP_WARP_FREQ + warpSeed, 0) - 0.5) * 2;
    const hw = halfAt(t) * warp;
    // Independent per-edge perlin wobble, enveloped to 0 at base & tip so the
    // point and attachment stay clean → hand-painted brush edge.
    const env = sin(t * PI);
    const noiseL = pnoise(t * PETAL_EDGE_NOISE_FREQ + edgeSeedL, 0);
    const noiseR = pnoise(t * PETAL_EDGE_NOISE_FREQ + edgeSeedR, 0);
    leftNoise.push(noiseL);
    rightNoise.push(noiseR);
    const nL = (noiseL - 0.5) * 2 * PETAL_EDGE_NOISE_AMP * a.halfW * env;
    const nR = (noiseR - 0.5) * 2 * PETAL_EDGE_NOISE_AMP * a.halfW * env;
    const s = spine[i];
    left.push([s[0] + px * (hw * lf + nL), s[1] + py * (hw * lf + nL)]);
    right.push([s[0] - px * (hw * rf + nR), s[1] - py * (hw * rf + nR)]);
  }

  // ── 染 wash (closed silhouette, base→tip rose gradient) ──
  const outline: Pt[] = left.slice();
  for (let i = N; i >= 0; i--) outline.push(right[i]);
  const wash = new Path2D();
  polyPath(wash, outline);

  // ── 勾 contour: ONE continuous ribbon around the edge, open at the base ──
  // base-left → up left edge → around the tip → down right edge → base-right.
  // The colour follows the spine (a base→tip gradient: pale base, deep tip);
  // the width follows the SAME edge noise that displaced the geometry, and
  // where that noise peaks a second, deeper ribbon pools ink on top — so the
  // outline has 浓淡 without one fill per segment.
  const edge: Pt[] = [];
  const noiseTerm: number[] = [];
  const spineT: number[] = [];
  for (let i = 0; i <= N; i++) {
    edge.push(left[i]);
    noiseTerm.push(PETAL_CONTOUR_NOISE_AMP * (leftNoise[i] - 0.5) * 2);
    spineT.push(i / N);
  }
  for (let i = N - 1; i >= 0; i--) {
    edge.push(right[i]);
    noiseTerm.push(PETAL_CONTOUR_NOISE_AMP * (rightNoise[i] - 0.5) * 2);
    spineT.push(i / N);
  }
  const last = edge.length - 1;
  const idx = (s: number): number => Math.round(s * last);
  const contour = new Path2D();
  // Line thickens where the ink is dense (pooling), thins where it's pale.
  ribbon(contour, edge, (s) => {
    const k = idx(s);
    const d = clamp01(DENSITY_BASE + PETAL_CONTOUR_TIP_BIAS * spineT[k] + noiseTerm[k]);
    return PETAL_CONTOUR_W * (0.55 + 0.9 * d);
  });
  let pool: Path2D | null = null;
  if (noiseTerm.some((v) => v > POOL_THRESHOLD)) {
    pool = new Path2D();
    ribbon(pool, edge, (s) => {
      const v = noiseTerm[idx(s)];
      return PETAL_CONTOUR_W * 0.9 * clamp01((v - POOL_THRESHOLD) / POOL_RANGE);
    });
  }

  // ── 脉 veins: many fine radial lines, converging at the base and spreading
  // toward the tip following the silhouette — the defining lotus-petal texture.
  let veins: Path2D | null = null;
  if (a.veinCount > 0) {
    veins = new Path2D();
    const M = 12;
    const vw = taperBoth(PETAL_VEIN_W);
    for (let v = 0; v < a.veinCount; v++) {
      // Lateral fraction across the petal width, -1 (left edge) .. +1 (right).
      const fr = a.veinCount > 1 ? (v / (a.veinCount - 1) - 0.5) * 2 : 0;
      const jitter = (pnoise(v * 1.3 + warpSeed, 0) - 0.5) * 0.12;
      const vpts: Pt[] = [];
      for (let i = 0; i <= M; i++) {
        const t = 0.06 + (i / M) * 0.86;
        const s = spine[Math.round(t * N)];
        const lateral = (fr + jitter) * halfAt(t) * 0.82; // fan follows the petal shape
        vpts.push([s[0] + px * lateral, s[1] + py * lateral]);
      }
      ribbon(veins, vpts, vw);
    }
  }

  return {
    wash,
    gradFrom: [a.baseX, a.baseY],
    gradTo: spine[N],
    washBase: hsv(ROSE_H, PETAL_WASH_BASE_S, clamp01(PETAL_WASH_BASE_V + a.vShift), a.alpha),
    washTip: hsv(ROSE_H, PETAL_WASH_TIP_S, clamp01(PETAL_WASH_TIP_V + a.vShift), a.alpha),
    contour,
    contourLight: contourColor(a, DENSITY_BASE),
    contourDeep: contourColor(a, DENSITY_BASE + PETAL_CONTOUR_TIP_BIAS),
    pool,
    poolCol: contourColor(a, 1, 0.75),
    veins,
    veinCol: hsv(ROSE_H, lerp(0.32, 0.6, 0.6), clamp01(0.72 + a.vShift), a.alpha * 0.5),
  };
}

/** Paint one petal: wash, contour, pooled ink, veins — 3–4 unfiltered fills. */
export function paintPetal(p: Painter, g: PetalGeom): void {
  const ctx = p.ctx;
  const [x0, y0] = g.gradFrom;
  const [x1, y1] = g.gradTo;
  const wash = ctx.createLinearGradient(x0, y0, x1, y1);
  wash.addColorStop(0, g.washBase);
  wash.addColorStop(1, g.washTip);
  ctx.fillStyle = wash;
  ctx.fill(g.wash);

  const line = ctx.createLinearGradient(x0, y0, x1, y1);
  line.addColorStop(0, g.contourLight);
  line.addColorStop(1, g.contourDeep);
  ctx.fillStyle = line;
  ctx.fill(g.contour);

  if (g.pool) {
    ctx.fillStyle = g.poolCol;
    ctx.fill(g.pool);
  }
  if (g.veins) {
    ctx.fillStyle = g.veinCol;
    ctx.fill(g.veins);
  }
}
