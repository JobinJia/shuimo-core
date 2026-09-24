import { pnoise } from "../../FlowerCanvas";

/** 2D point in scene coordinates. */
export type Pt = [number, number];

const PI = Math.PI;

/**
 * Where a lotus pass paints. `scale` is the scene→device scale of the
 * fit-transform, used to convert scene-unit blur radii to device pixels
 * (ctx.filter lengths ignore the current transform).
 */
export interface Painter {
  ctx: CanvasRenderingContext2D;
  scale: number;
}

/**
 * Set ctx.filter to a blur of `sceneBlur` scene units. The device radius is
 * floored to 0.5 px steps (so the browser sees only a handful of distinct
 * filter strings) and dropped entirely below half a pixel.
 */
export function setBlur(p: Painter, sceneBlur: number): void {
  const px = Math.floor(sceneBlur * p.scale * 2) / 2;
  p.ctx.filter = px > 0 ? `blur(${px}px)` : "none";
}

/** Two-ended taper: thin at both ends, fattest mid. Veins, spurs, ripples. */
export function taperBoth(w: number): (t: number) => number {
  return (t) => w * Math.sin(t * PI);
}

/** Root-thick, tip-thin taper with a small floor so the 梢 never vanishes. Stems. */
export function taperTail(w: number, k = 1.6): (t: number) => number {
  return (t) => w * (1 - Math.pow(t, k)) + w * 0.15;
}

/** Perlin micro-jitter on a path to give a hand-drawn wobble (deterministic via seed). */
export function jitterPath(pts: Pt[], amp: number, seed: number): Pt[] {
  return pts.map((p, i) => {
    const t = i / Math.max(1, pts.length - 1);
    const jy = (pnoise(t * 4 + seed, 0) - 0.5) * 2 * amp;
    const jx = (pnoise(t * 4 + seed + 100, 0) - 0.5) * 2 * amp;
    return [p[0] + jx, p[1] + jy] as Pt;
  });
}

/**
 * Append one variable-width calligraphic line to `path` as a closed filled
 * ribbon (never a uniform ctx.stroke()). `halfWidth(t∈[0,1])` is the offset on
 * each side of the centreline. Many ribbons of the same colour can share one
 * Path2D and be painted with a single fill (nonzero rule → overlaps union
 * instead of double-compositing, so there are no dark seams).
 */
export function ribbon(path: Path2D, pts: Pt[], halfWidth: (t: number) => number): void {
  const n = pts.length;
  if (n < 2) return;
  const rx = new Float64Array(n);
  const ry = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = halfWidth(t);
    const p0 = pts[i > 0 ? i - 1 : 0];
    const p1 = pts[i < n - 1 ? i + 1 : n - 1];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    const x = pts[i][0];
    const y = pts[i][1];
    if (i === 0) path.moveTo(x + nx, y + ny);
    else path.lineTo(x + nx, y + ny);
    rx[i] = x - nx;
    ry[i] = y - ny;
  }
  for (let i = n - 1; i >= 0; i--) path.lineTo(rx[i], ry[i]);
  path.closePath();
}

/** Append a closed polygon to `path`. */
export function polyPath(path: Path2D, pts: Pt[]): void {
  if (pts.length === 0) return;
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  path.closePath();
}
