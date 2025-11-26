import { Point } from '../foundation/geometry';
import { PolyTools } from '../foundation/geometry/PolyTools';

/**
 * Generate a smooth Bezier curve through multiple control points
 * Uses rational quadratic Bezier curves with midpoint handling
 *
 * @param P - Array of control points
 * @param w - Weight parameter for the Bezier curve (default: 1)
 * @returns Array of points forming the smooth curve
 */
export function bezmh(P: Point[], w: number = 1): Point[] {
  // If only 2 points, add a midpoint
  if (P.length === 2) {
    P = [P[0], PolyTools.midPt(P[0], P[1]), P[1]];
  }

  const plist: Point[] = [];

  for (let j = 0; j < P.length - 2; j++) {
    let p0: Point;
    let p1: Point;
    let p2: Point;

    // Determine control points for this segment
    if (j === 0) {
      p0 = P[j];
    } else {
      p0 = PolyTools.midPt(P[j], P[j + 1]);
    }

    p1 = P[j + 1];

    if (j === P.length - 3) {
      p2 = P[j + 2];
    } else {
      p2 = PolyTools.midPt(P[j + 1], P[j + 2]);
    }

    // Generate points along the Bezier curve
    const pl = 20;
    for (let i = 0; i < pl + (j === P.length - 3 ? 1 : 0); i += 1) {
      const t = i / pl;
      const u = Math.pow(1 - t, 2) + 2 * t * (1 - t) * w + t * t;
      plist.push([
        (Math.pow(1 - t, 2) * p0[0] + 2 * t * (1 - t) * p1[0] * w + t * t * p2[0]) / u,
        (Math.pow(1 - t, 2) * p0[1] + 2 * t * (1 - t) * p1[1] * w + t * t * p2[1]) / u,
      ]);
    }
  }

  return plist;
}
