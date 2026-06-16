import { pnoise, stroke } from "../../FlowerCanvas";

/** Point in the flower-canvas Vec3 convention (z unused, kept 0). */
export type Pt = [number, number, number];

const PI = Math.PI;

/** Two-ended taper: thin at both ends, fattest mid. Veins, spurs. */
export function taperBoth(w: number): (t: number) => number {
  return (t) => w * Math.sin(t * PI);
}

/** Root-thick, tip-thin taper with a small floor so the 梢 never vanishes. Stems. */
export function taperTail(w: number, k = 1.6): (t: number) => number {
  return (t) => w * (1 - Math.pow(t, k)) + w * 0.15;
}

/** Contour line: keeps width at both ends (does not vanish), gentle belly. */
export function contourWid(w: number): (t: number) => number {
  return (t) => w * (0.45 + 0.55 * Math.sin(t * PI));
}

/** Perlin micro-jitter on a path to give a hand-drawn wobble (deterministic via seed). */
export function jitterPath(pts: Pt[], amp: number, seed: number): Pt[] {
  return pts.map((p, i) => {
    const t = i / Math.max(1, pts.length - 1);
    const jy = (pnoise(t * 4 + seed, 0) - 0.5) * 2 * amp;
    const jx = (pnoise(t * 4 + seed + 100, 0) - 0.5) * 2 * amp;
    return [p[0] + jx, p[1] + jy, 0] as Pt;
  });
}

/**
 * Draw one line as a tubified variable-width FILLED ribbon (not ctx.stroke()).
 * `wid(t∈[0,1])` is the calligraphic width profile. Soft wet edge via tiny blur.
 */
export function inkLine(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  opts: { col: string; wid: (t: number) => number; blur?: number },
): void {
  if (pts.length < 3) return; // tubify needs interior points
  ctx.save();
  ctx.filter = `blur(${opts.blur ?? 0.4}px)`;
  stroke({ ctx, pts, col: opts.col, wid: opts.wid });
  ctx.restore();
}

/**
 * Like inkLine, but the colour varies ALONG the stroke: each segment is filled
 * with `color(s∈[0,1])` where s is the position along the path. Used for the
 * petal contour so the outline has 浓淡 (light/dark) variation instead of one
 * flat ink value. `wid(t)` is the half-width offset. Adjacent quads share an
 * edge so there are no gaps; the small blur smooths the colour steps.
 */
export function gradedLine(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  opts: { wid: (t: number) => number; color: (s: number) => string; blur?: number },
): void {
  const n = pts.length;
  if (n < 3) return;
  ctx.save();
  ctx.filter = `blur(${opts.blur ?? 0.4}px)`;

  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const w = opts.wid(t);
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[Math.min(n - 1, i + 1)];
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    left.push([pts[i][0] + nx * w, pts[i][1] + ny * w, 0]);
    right.push([pts[i][0] - nx * w, pts[i][1] - ny * w, 0]);
  }

  for (let i = 0; i < n - 1; i++) {
    ctx.fillStyle = opts.color(i / (n - 1));
    ctx.beginPath();
    ctx.moveTo(left[i][0], left[i][1]);
    ctx.lineTo(left[i + 1][0], left[i + 1][1]);
    ctx.lineTo(right[i + 1][0], right[i + 1][1]);
    ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
