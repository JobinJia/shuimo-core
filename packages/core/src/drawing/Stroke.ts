import { Polygon } from "../foundation/geometry";
import { noise } from "../foundation/noise";
import { prng } from "../foundation/random";
import { poly } from "../utils/svg";

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
    const col = options.col ?? "rgba(200,200,200,0.9)";
    const noi = options.noi ?? 0.5;
    const out = options.out ?? 1;
    const fun = options.fun ?? ((x: number) => Math.sin(x * Math.PI));

    if (ptlist.length === 0) {
      return "";
    }

    const n = ptlist.length;
    const inner = n > 2 ? n - 2 : 0;
    // Closed outline: start, one side forward, end, other side backward, start.
    const vtxlist: Polygon = new Array(inner * 2 + 3);
    const n0 = prng.random() * 10;

    vtxlist[0] = ptlist[0];
    // Generate vertices along both sides of the stroke
    for (let i = 1; i < n - 1; i++) {
      let w = wid * fun(i / n);
      w = w * (1 - noi) + w * noi * noise.noise(i * 0.5, n0);

      const p = ptlist[i];
      const a1 = Math.atan2(p[1] - ptlist[i - 1][1], p[0] - ptlist[i - 1][0]);
      const a2 = Math.atan2(p[1] - ptlist[i + 1][1], p[0] - ptlist[i + 1][0]);
      let a = (a1 + a2) / 2;

      if (a < a2) {
        a += Math.PI;
      }

      const dx = w * Math.cos(a);
      const dy = w * Math.sin(a);
      vtxlist[i] = [p[0] + dx, p[1] + dy];
      vtxlist[inner * 2 + 2 - i] = [p[0] - dx, p[1] - dy];
    }
    vtxlist[inner + 1] = ptlist[n - 1];
    vtxlist[inner * 2 + 2] = ptlist[0];

    // Offsets are applied while formatting instead of copying every point.
    return poly(vtxlist, { xof, yof, fil: col, str: col, wid: out, filter: options.filter });
  }
}

// Export a convenience function
export function stroke(ptlist: Polygon, options: StrokeOptions = {}): string {
  return Stroke.generate(ptlist, options);
}
