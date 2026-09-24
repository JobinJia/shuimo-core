import { BBS, hsv, normRand } from "../../FlowerCanvas";
import { INK_V, STEM_W, STEM_DRIFT_PX, STEM_BEND_PX, STEM_SPUR_MAX, STEM_BLUR } from "./constants";
import {
  jitterPath,
  ribbon,
  setBlur,
  taperBoth,
  taperTail,
  type Painter,
  type Pt,
} from "./strokes";

/** One sparse spur along the stem. */
interface Spur {
  /** centreline index it grows from. */
  at: number;
  side: 1 | -1;
  len: number;
}

/** A fully-determined stem: anchor, curve and spurs. */
export interface StemPlan {
  anchorX: number;
  anchorY: number;
  bottomY: number;
  bottomX: number;
  bend1: number;
  bend2: number;
  jitterSeed: number;
  spurs: Spur[];
  alpha: number;
}

export interface StemGeom {
  /** the stem ribbon only (reflection pass). */
  body: Path2D;
  /** stem + spurs merged into one path (full-detail pass). */
  full: Path2D;
  col: string;
  /** where the stem meets the waterline. */
  bottomX: number;
}

const N = 40;

/** Draw every random parameter of the stem from BBS. */
export function planStem(anchorX: number, anchorY: number, bottomY: number, alpha = 1): StemPlan {
  const bottomX = anchorX + (BBS.next() - 0.5) * STEM_DRIFT_PX;
  const bend1 = (BBS.next() - 0.5) * STEM_BEND_PX;
  const bend2 = (BBS.next() - 0.5) * STEM_BEND_PX;
  const jitterSeed = BBS.next() * 20;
  const spurCount = Math.floor(normRand(0, STEM_SPUR_MAX));
  const spurs: Spur[] = [];
  for (let k = 0; k < spurCount; k++) {
    const at = Math.floor((0.15 + BBS.next() * 0.7) * N);
    const side = BBS.next() < 0.5 ? 1 : -1;
    const len = normRand(2, 4) + 3;
    spurs.push({ at, side, len });
  }
  return { anchorX, anchorY, bottomY, bottomX, bend1, bend2, jitterSeed, spurs, alpha };
}

/**
 * One thin tapered ink stem from an anchor (the top element) down to bottomY
 * (the waterline), plus a few sparse spurs. `alpha` carries atmospheric depth
 * (far stems paler). Spurs share the stem's colour so the whole stalk is one
 * fill.
 */
export function buildStem(s: StemPlan): StemGeom {
  const { anchorX, anchorY, bottomX, bottomY } = s;
  const c1x = anchorX + (bottomX - anchorX) * 0.33 + s.bend1;
  const c1y = anchorY + (bottomY - anchorY) * 0.33;
  const c2x = anchorX + (bottomX - anchorX) * 0.67 + s.bend2;
  const c2y = anchorY + (bottomY - anchorY) * 0.67;

  let pts: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    pts.push([
      u * u * u * anchorX + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bottomX,
      u * u * u * anchorY + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * bottomY,
    ]);
  }
  pts = jitterPath(pts, 2.5, s.jitterSeed);

  const body = new Path2D();
  ribbon(body, pts, taperTail(STEM_W));
  const full = new Path2D();
  full.addPath(body);

  // ── sparse spurs ──
  const spurW = taperBoth(0.9);
  for (const sp of s.spurs) {
    const p = pts[sp.at];
    const pn = pts[Math.min(sp.at + 1, pts.length - 1)];
    const dx = pn[0] - p[0];
    const dy = pn[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const tip: Pt = [p[0] + nx * sp.side * sp.len, p[1] + ny * sp.side * sp.len];
    const mid: Pt = [(p[0] + tip[0]) / 2, (p[1] + tip[1]) / 2];
    ribbon(full, [p, mid, tip], spurW);
  }
  return { body, full, col: hsv(0, 0, INK_V, 0.9 * s.alpha), bottomX };
}

/** Full-detail pass: stem + spurs in one lightly blurred fill. */
export function paintStem(p: Painter, g: StemGeom): void {
  setBlur(p, STEM_BLUR);
  p.ctx.fillStyle = g.col;
  p.ctx.fill(g.full);
  p.ctx.filter = "none";
}
