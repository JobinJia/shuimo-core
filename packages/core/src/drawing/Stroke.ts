import { Point, Polygon } from '../foundation/geometry';
import { noise } from '../foundation/noise';
import { poly } from '../utils/svg';

export interface StrokeOptions {
  /** X offset */
  xof?: number;
  /** Y offset */
  yof?: number;
  /** Stroke width */
  wid?: number;
  /** Color */
  col?: string;
  /** Noise amount (0-1) */
  noi?: number;
  /** Outline width */
  out?: number;
  /** Width function along the stroke */
  fun?: (x: number) => number;
  /** SVG filter reference */
  filter?: string;
}

/**
 * Stroke - Generate calligraphic brush strokes
 * Creates organic, variable-width strokes with noise for natural appearance
 */
export class Stroke {
  /**
   * Generate a brush stroke along a path
   * @param ptlist - Array of points defining the stroke path
   * @param options - Stroke styling options
   * @returns SVG string representing the stroke
   */
  static generate(ptlist: Polygon, options: StrokeOptions = {}): string {
    const xof = options.xof ?? 0;
    const yof = options.yof ?? 0;
    const wid = options.wid ?? 2;
    const col = options.col ?? 'rgba(200,200,200,0.9)';
    const noi = options.noi ?? 0.5;
    const out = options.out ?? 1;
    const fun = options.fun ?? ((x: number) => Math.sin(x * Math.PI));

    if (ptlist.length === 0) {
      return '';
    }

    const vtxlist0: Point[] = [];
    const vtxlist1: Point[] = [];
    const n0 = Math.random() * 10;

    // Generate vertices along both sides of the stroke
    for (let i = 1; i < ptlist.length - 1; i++) {
      let w = wid * fun(i / ptlist.length);
      w = w * (1 - noi) + w * noi * noise.noise(i * 0.5, n0);

      const a1 = Math.atan2(
        ptlist[i][1] - ptlist[i - 1][1],
        ptlist[i][0] - ptlist[i - 1][0]
      );
      const a2 = Math.atan2(
        ptlist[i][1] - ptlist[i + 1][1],
        ptlist[i][0] - ptlist[i + 1][0]
      );
      let a = (a1 + a2) / 2;

      if (a < a2) {
        a += Math.PI;
      }

      vtxlist0.push([
        ptlist[i][0] + w * Math.cos(a),
        ptlist[i][1] + w * Math.sin(a),
      ]);
      vtxlist1.push([
        ptlist[i][0] - w * Math.cos(a),
        ptlist[i][1] - w * Math.sin(a),
      ]);
    }

    // Combine vertices into a closed polygon
    const vtxlist: Polygon = [ptlist[0]]
      .concat(vtxlist0)
      .concat(vtxlist1.concat([ptlist[ptlist.length - 1]]).reverse())
      .concat([ptlist[0]]);

    // Generate SVG
    const canv = poly(
      vtxlist.map((x) => [x[0] + xof, x[1] + yof]),
      { fil: col, str: col, wid: out, filter: options.filter }
    );

    return canv;
  }
}

// Export a convenience function
export function stroke(ptlist: Polygon, options: StrokeOptions = {}): string {
  return Stroke.generate(ptlist, options);
}
