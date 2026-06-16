import { BBS, hsv, normRand } from "../../FlowerCanvas";
import { INK_V, STEM_W, STEM_DRIFT_PX, STEM_BEND_PX, STEM_SPUR_MAX } from "./constants";
import { inkLine, jitterPath, taperBoth, taperTail, type Pt } from "./strokes";

/**
 * One thin tapered ink stem from an anchor (the top element) down to bottomY
 * (the waterline), plus a few sparse spurs. `alpha` carries atmospheric depth
 * (far stems paler).
 */
export function drawLotusStem(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  bottomY: number,
  alpha = 1,
): void {
  const bottomX = anchorX + (BBS.next() - 0.5) * STEM_DRIFT_PX;
  const bend1 = (BBS.next() - 0.5) * STEM_BEND_PX;
  const bend2 = (BBS.next() - 0.5) * STEM_BEND_PX;
  const c1x = anchorX + (bottomX - anchorX) * 0.33 + bend1;
  const c1y = anchorY + (bottomY - anchorY) * 0.33;
  const c2x = anchorX + (bottomX - anchorX) * 0.67 + bend2;
  const c2y = anchorY + (bottomY - anchorY) * 0.67;

  const bez = (t: number): Pt => {
    const u = 1 - t;
    return [
      u * u * u * anchorX + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bottomX,
      u * u * u * anchorY + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * bottomY,
      0,
    ];
  };

  const N = 40;
  let pts: Pt[] = [];
  for (let i = 0; i <= N; i++) pts.push(bez(i / N));
  pts = jitterPath(pts, 2.5, BBS.next() * 20);
  inkLine(ctx, pts, { col: hsv(0, 0, INK_V, 0.9 * alpha), wid: taperTail(STEM_W), blur: 0.5 });

  // ── sparse spurs ──
  const spurCount = Math.floor(normRand(0, STEM_SPUR_MAX));
  for (let k = 0; k < spurCount; k++) {
    const i = Math.floor((0.15 + BBS.next() * 0.7) * N);
    const p = pts[i];
    const pn = pts[Math.min(i + 1, pts.length - 1)];
    const dx = pn[0] - p[0];
    const dy = pn[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const side = BBS.next() < 0.5 ? 1 : -1;
    const slen = normRand(2, 4) + 3;
    const tip: Pt = [p[0] + nx * side * slen, p[1] + ny * side * slen, 0];
    const mid: Pt = [(p[0] + tip[0]) / 2, (p[1] + tip[1]) / 2, 0];
    inkLine(ctx, [p, mid, tip], { col: hsv(0, 0, INK_V, 0.8 * alpha), wid: taperBoth(0.9), blur: 0.3 });
  }
}
