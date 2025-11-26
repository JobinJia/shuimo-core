/**
 * Type definitions for geometry operations
 */
export type Point = [number, number];
export type Line = [Point, Point];
export type Polygon = Point[];

export interface TriangulateOptions {
  /** Maximum area for triangles */
  area?: number;
  /** Whether the polygon is convex */
  convex?: boolean;
  /** Whether to optimize triangle quality */
  optimize?: boolean;
}

/**
 * Polygon manipulation and analysis tools
 */
export class PolyTools {
  /**
   * Calculate the midpoint of multiple points
   * @param points - Variable number of points or an array of points
   * @returns The midpoint
   */
  static midPt(...points: Point[] | [Point[]]): Point {
    const plist = points.length === 1 && Array.isArray(points[0][0])
      ? (points[0] as Point[])
      : (points as Point[]);

    return plist.reduce(
      (acc, v) => {
        return [v[0] / plist.length + acc[0], v[1] / plist.length + acc[1]];
      },
      [0, 0] as Point
    );
  }

  /**
   * Triangulate a polygon into smaller triangles
   * @param plist - List of polygon vertices
   * @param options - Triangulation options
   * @returns Array of triangles (each triangle is a 3-point polygon)
   */
  static triangulate(plist: Polygon, options: TriangulateOptions = {}): Polygon[] {
    const area = options.area ?? 100;
    const convex = options.convex ?? false;
    const optimize = options.optimize ?? true;

    /**
     * Get line equation in form [m, k] where y = mx + k
     */
    function lineExpr(pt0: Point, pt1: Point): [number, number] {
      const den = pt1[0] - pt0[0];
      const m = den === 0 ? Infinity : (pt1[1] - pt0[1]) / den;
      const k = pt0[1] - m * pt0[0];
      return [m, k];
    }

    /**
     * Check if two line segments intersect
     */
    function intersect(ln0: Line, ln1: Line): Point | false {
      const le0 = lineExpr(...ln0);
      const le1 = lineExpr(...ln1);
      const den = le0[0] - le1[0];

      if (den === 0) {
        return false;
      }

      const x = (le1[1] - le0[1]) / den;
      const y = le0[0] * x + le0[1];

      function onSeg(p: Point, ln: Line): boolean {
        return (
          Math.min(ln[0][0], ln[1][0]) <= p[0] &&
          p[0] <= Math.max(ln[0][0], ln[1][0]) &&
          Math.min(ln[0][1], ln[1][1]) <= p[1] &&
          p[1] <= Math.max(ln[0][1], ln[1][1])
        );
      }

      if (onSeg([x, y], ln0) && onSeg([x, y], ln1)) {
        return [x, y];
      }
      return false;
    }

    /**
     * Check if a point is inside a polygon using ray casting
     */
    function ptInPoly(pt: Point, plist: Polygon): boolean {
      let scount = 0;
      for (let i = 0; i < plist.length; i++) {
        const np = plist[i !== plist.length - 1 ? i + 1 : 0];
        const sect = intersect([plist[i], np], [pt, [pt[0] + 999, pt[1] + 999]]);
        if (sect !== false) {
          scount++;
        }
      }
      return scount % 2 === 1;
    }

    /**
     * Check if a line segment is inside a polygon
     */
    function lnInPoly(ln: Line, plist: Polygon): boolean {
      const lnc: Line = [[0, 0], [0, 0]];
      const ep = 0.01;

      lnc[0][0] = ln[0][0] * (1 - ep) + ln[1][0] * ep;
      lnc[0][1] = ln[0][1] * (1 - ep) + ln[1][1] * ep;
      lnc[1][0] = ln[0][0] * ep + ln[1][0] * (1 - ep);
      lnc[1][1] = ln[0][1] * ep + ln[1][1] * (1 - ep);

      for (let i = 0; i < plist.length; i++) {
        const pt = plist[i];
        const np = plist[i !== plist.length - 1 ? i + 1 : 0];
        if (intersect(lnc, [pt, np]) !== false) {
          return false;
        }
      }

      const mid = PolyTools.midPt(ln);
      if (ptInPoly(mid, plist) === false) {
        return false;
      }
      return true;
    }

    /**
     * Calculate side lengths of a polygon
     */
    function sidesOf(plist: Polygon): number[] {
      const slist: number[] = [];
      for (let i = 0; i < plist.length; i++) {
        const pt = plist[i];
        const np = plist[i !== plist.length - 1 ? i + 1 : 0];
        const s = Math.sqrt(Math.pow(np[0] - pt[0], 2) + Math.pow(np[1] - pt[1], 2));
        slist.push(s);
      }
      return slist;
    }

    /**
     * Calculate area of a triangle using Heron's formula
     */
    function areaOf(plist: Polygon): number {
      const slist = sidesOf(plist);
      const a = slist[0];
      const b = slist[1];
      const c = slist[2];
      const s = (a + b + c) / 2;
      return Math.sqrt(s * (s - a) * (s - b) * (s - c));
    }

    /**
     * Calculate sliver ratio (quality metric for triangles)
     */
    function sliverRatio(plist: Polygon): number {
      const A = areaOf(plist);
      const P = sidesOf(plist).reduce((m, n) => m + n, 0);
      return A / P;
    }

    /**
     * Find the best ear to clip from the polygon
     */
    function bestEar(plist: Polygon): [Polygon, Polygon] {
      const cuts: [Polygon, Polygon][] = [];

      for (let i = 0; i < plist.length; i++) {
        const pt = plist[i];
        const lp = plist[i !== 0 ? i - 1 : plist.length - 1];
        const np = plist[i !== plist.length - 1 ? i + 1 : 0];
        const qlist = plist.slice();
        qlist.splice(i, 1);

        if (convex || lnInPoly([lp, np], plist)) {
          const c: [Polygon, Polygon] = [[lp, pt, np], qlist];
          if (!optimize) return c;
          cuts.push(c);
        }
      }

      let best: [Polygon, Polygon] = [plist, []];
      let bestRatio = 0;
      for (let i = 0; i < cuts.length; i++) {
        const r = sliverRatio(cuts[i][0]);
        if (r >= bestRatio) {
          best = cuts[i];
          bestRatio = r;
        }
      }
      return best;
    }

    /**
     * Recursively shatter a triangle into smaller triangles
     */
    function shatter(plist: Polygon, a: number): Polygon[] {
      if (plist.length === 0) {
        return [];
      }
      if (areaOf(plist) < a) {
        return [plist];
      } else {
        const slist = sidesOf(plist);
        const ind = slist.reduce((iMax, x, i, arr) => (x > arr[iMax] ? i : iMax), 0);
        const nind = (ind + 1) % plist.length;
        const lind = (ind + 2) % plist.length;

        try {
          const mid = PolyTools.midPt([plist[ind], plist[nind]]);
          return shatter([plist[ind], mid, plist[lind]], a).concat(
            shatter([plist[lind], plist[nind], mid], a)
          );
        } catch (err) {
          console.log(plist);
          console.log(err);
          return [];
        }
      }
    }

    // Main triangulation logic
    if (plist.length <= 3) {
      return shatter(plist, area);
    } else {
      const cut = bestEar(plist);
      return shatter(cut[0], area).concat(PolyTools.triangulate(cut[1], options));
    }
  }
}

// Export a global instance for convenience
export const polyTools = new PolyTools();
