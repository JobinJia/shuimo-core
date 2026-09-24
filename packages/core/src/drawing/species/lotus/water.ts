import { BBS, hsv } from "../../FlowerCanvas";
import { ribbon, taperBoth, type Painter, type Pt } from "./strokes";

/**
 * A few faint horizontal ripple lines at the waterline to seat the
 * reflection. Each ripple is a tapered brush ribbon (thin at both ends), and
 * all of them share one path → a single fill.
 */
export function buildWaterline(waterY: number, cwid: number): Path2D {
  const path = new Path2D();
  const lines = 5;
  const M = 24;
  for (let i = 0; i < lines; i++) {
    const y = waterY + (BBS.next() - 0.3) * 28;
    const x0 = cwid * (0.04 + 0.25 * BBS.next());
    const x1 = cwid * (0.6 + 0.36 * BBS.next());
    const midY = y + (BBS.next() - 0.5) * 6;
    const w = 0.4 + BBS.next() * 0.4;
    const pts: Pt[] = [];
    for (let k = 0; k <= M; k++) {
      // Quadratic curve x0,y → mid → x1,y.
      const t = k / M;
      const u = 1 - t;
      pts.push([
        u * u * x0 + 2 * u * t * ((x0 + x1) / 2) + t * t * x1,
        u * u * y + 2 * u * t * midY + t * t * y,
      ]);
    }
    ribbon(path, pts, taperBoth(w * 1.6));
  }
  return path;
}

export function paintWaterline(p: Painter, path: Path2D): void {
  p.ctx.fillStyle = hsv(0, 0, 0.45, 0.15);
  p.ctx.fill(path);
}
