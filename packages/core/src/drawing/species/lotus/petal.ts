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
import { gradedLine, inkLine, taperBoth, type Pt } from "./strokes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

export interface PetalArgs {
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

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const lerp = (x: number, y: number, p: number): number => x + (y - x) * p;

/**
 * One lotus petal painted as 染 (interior wash, base→tip rose gradient) +
 * 勾 (a SINGLE continuous contour stroke around the silhouette, open at the
 * base) + 脉 (a few fine vein strokes from the base).
 *
 * The silhouette half-width follows a Beta-distribution profile
 * `w(t) = halfW · t^a (1-t)^b / peak` (a = F·widePos, b = F·(1-widePos)),
 * which is C∞-smooth with a single peak — continuous curvature, no kink at the
 * widest point or tip. This is the "natural regularity" the reference shows.
 */
export function drawPetal(ctx: CanvasRenderingContext2D, a: PetalArgs): void {
  const ax = cos(a.angle);
  const ay = sin(a.angle);
  const px = -ay; // perpendicular
  const py = ax;
  const N = 28;

  // Per-petal tip lean + warp seed (deterministic via BBS).
  const tipLean = (BBS.next() - 0.5) * a.halfW * PETAL_TIP_LEAN_FRAC;
  const warpSeed = BBS.next() * 30;

  // Spine: straight axis + perpendicular bow peaking mid, plus an upper-petal
  // lean that grows toward the tip (the recurved/deformed apex).
  const spine: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const sx = a.baseX + ax * a.length * t;
    const sy = a.baseY + ay * a.length * t;
    const leanEnv = t < 0.4 ? 0 : Math.pow((t - 0.4) / 0.6, 2);
    const bow = sin(t * PI) * a.bend + leanEnv * tipLean;
    spine.push([sx + px * bow, sy + py * bow, 0]);
  }

  // Body half-width: Beta profile (smooth single peak at widePos) up to
  // PETAL_TIP_ROUND_START; beyond that the edges follow a quarter-ellipse cap
  // (w = wCap·√(1-u²)) so they curve over to a rounded apex with a vertical
  // tangent — a soft dome, not a knife point (弧度).
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
    left.push([s[0] + px * (hw * lf + nL), s[1] + py * (hw * lf + nL), 0]);
    right.push([s[0] - px * (hw * rf + nR), s[1] - py * (hw * rf + nR), 0]);
  }

  // ── 染 wash (closed silhouette, base→tip rose gradient) ──
  ctx.save();
  ctx.filter = "blur(0.6px)";
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i <= N; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = N; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  const tipX = spine[N][0];
  const tipY = spine[N][1];
  const grad = ctx.createLinearGradient(a.baseX, a.baseY, tipX, tipY);
  grad.addColorStop(0, hsv(ROSE_H, PETAL_WASH_BASE_S, clamp01(PETAL_WASH_BASE_V + a.vShift), a.alpha));
  grad.addColorStop(1, hsv(ROSE_H, PETAL_WASH_TIP_S, clamp01(PETAL_WASH_TIP_V + a.vShift), a.alpha));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // ── 勾 contour: ONE continuous stroke around the edge, open at the base ──
  // base-left → up left edge → around the tip → down right edge → base-right.
  // Walk the outline (left base→tip, then right tip→base) and, for each point,
  // derive an ink-density from (a) the spine position — deepest at the tip —
  // and (b) the SAME edge noise that displaced the geometry. So the ink pools
  // and thins along the very undulations of the edge (起伏 + 笔墨浓度).
  const edge: Pt[] = [];
  const density: number[] = [];
  const pushPt = (pt: Pt, t: number, noise: number): void => {
    edge.push(pt);
    density.push(
      clamp01(0.22 + PETAL_CONTOUR_TIP_BIAS * t + PETAL_CONTOUR_NOISE_AMP * (noise - 0.5) * 2),
    );
  };
  for (let i = 0; i <= N; i++) pushPt(left[i], i / N, leftNoise[i]);
  for (let i = N - 1; i >= 0; i--) pushPt(right[i], i / N, rightNoise[i]);

  const lastIdx = edge.length - 1;
  const colorAt = (s: number): string => {
    const d = density[Math.round(s * lastIdx)];
    const S = lerp(PETAL_CONTOUR_S_LIGHT, PETAL_CONTOUR_S_DEEP, d);
    const V = clamp01(lerp(PETAL_CONTOUR_V_LIGHT, PETAL_CONTOUR_V_DEEP, d) + a.vShift);
    const A = lerp(PETAL_CONTOUR_A_LIGHT, PETAL_CONTOUR_A_DEEP, d) * a.alpha;
    return hsv(ROSE_H, S, V, A);
  };
  // Line thickens where the ink is dense (pooling), thins where it's pale.
  const widthAt = (s: number): number =>
    PETAL_CONTOUR_W * (0.55 + 0.9 * density[Math.round(s * lastIdx)]);
  gradedLine(ctx, edge, { wid: widthAt, color: colorAt, blur: 0.4 });

  // ── 脉 veins: many fine radial lines, converging at the base and spreading
  // toward the tip following the silhouette — the defining lotus-petal texture.
  if (a.veins !== false) {
    const veinCount = Math.floor(normRand(PETAL_VEIN_COUNT_MIN, PETAL_VEIN_COUNT_MAX + 1));
    const M = 12;
    for (let v = 0; v < veinCount; v++) {
      // Lateral fraction across the petal width, -1 (left edge) .. +1 (right).
      const fr = veinCount > 1 ? (v / (veinCount - 1) - 0.5) * 2 : 0;
      const jitter = (pnoise(v * 1.3 + warpSeed, 0) - 0.5) * 0.12;
      const vpts: Pt[] = [];
      for (let i = 0; i <= M; i++) {
        const t = 0.06 + (i / M) * 0.86;
        const s = spine[Math.round(t * N)];
        const lateral = (fr + jitter) * halfAt(t) * 0.82; // fan follows the petal shape
        vpts.push([s[0] + px * lateral, s[1] + py * lateral, 0]);
      }
      // Outer veins (near the edge) slightly deeper; all stay a clear rose.
      const vDepth = 0.4 + 0.4 * Math.abs(fr);
      const veinCol = hsv(ROSE_H, lerp(0.32, 0.6, vDepth), clamp01(0.72 + a.vShift), a.alpha * 0.5);
      inkLine(ctx, vpts, { col: veinCol, wid: taperBoth(PETAL_VEIN_W), blur: 0.3 });
    }
  }
}
