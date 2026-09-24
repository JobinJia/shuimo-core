import { BBS, hsv, normRand, pnoise } from "../../FlowerCanvas";
import {
  SPLATTER_V,
  SPLATTER_BLUR,
  SPLATTER_COUNT_MIN,
  SPLATTER_COUNT_MAX,
  SPLATTER_SPREAD_X,
  SPLATTER_SPREAD_Y,
} from "./constants";
import { setBlur, type Painter } from "./strokes";

export interface SplatterGeom {
  /** dots grouped into two ink densities → two fills for the whole cluster. */
  dense: Path2D;
  light: Path2D;
}

/**
 * A cluster of expressive ink dots / splatter at the foot of the leaf mass
 * (泼墨点): a few large dots, many small ones, some small satellites flung
 * off the big ones. Consumes BBS; the geometry is final (splatter lies on the
 * paper, so it is not reflected).
 */
export function buildSplatter(x: number, y: number): SplatterGeom {
  const dense = new Path2D();
  const light = new Path2D();
  // An ink drop is never a perfect circle: a noisy, slightly stretched blob.
  const dot = (cx: number, cy: number, r: number): void => {
    const target = BBS.next() < 0.5 ? dense : light;
    const seed = BBS.next() * 50;
    const stretch = 1 + BBS.next() * 0.5;
    const rot = BBS.next() * Math.PI;
    const n = r > 4 ? 18 : 10;
    for (let k = 0; k < n; k++) {
      const th = (k / n) * 2 * Math.PI;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const rr = r * (1 + 0.5 * (pnoise(c * 1.2 + seed, sn * 1.2 + seed) - 0.5) * 2);
      const lx = c * rr * stretch;
      const ly = sn * rr;
      const x = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
      const y = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
      if (k === 0) target.moveTo(x, y);
      else target.lineTo(x, y);
    }
    target.closePath();
  };
  const count = Math.floor(normRand(SPLATTER_COUNT_MIN, SPLATTER_COUNT_MAX + 1));
  for (let i = 0; i < count; i++) {
    // Squared offsets bunch the dots toward the cluster centre.
    const ux = BBS.next() - 0.5;
    const uy = BBS.next() - 0.5;
    const cx = x + Math.sign(ux) * ux * ux * 2 * SPLATTER_SPREAD_X;
    const cy = y + Math.sign(uy) * uy * uy * 2 * SPLATTER_SPREAD_Y;
    const big = BBS.next() < 0.25;
    const r = normRand(1.5, 7) * (big ? 1.8 : 1);
    dot(cx, cy, r);
    if (big) {
      // Satellites: tiny drops thrown off a big splash.
      const sat = Math.floor(normRand(1, 4));
      for (let k = 0; k < sat; k++) {
        const ang = BBS.next() * 2 * Math.PI;
        const d = r * normRand(1.4, 2.6);
        dot(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, normRand(0.8, 2));
      }
    }
  }
  return { dense, light };
}

export function paintSplatter(p: Painter, g: SplatterGeom): void {
  setBlur(p, SPLATTER_BLUR);
  p.ctx.fillStyle = hsv(0, 0, SPLATTER_V, 0.8);
  p.ctx.fill(g.dense);
  p.ctx.fillStyle = hsv(0, 0, SPLATTER_V, 0.5);
  p.ctx.fill(g.light);
  p.ctx.filter = "none";
}
