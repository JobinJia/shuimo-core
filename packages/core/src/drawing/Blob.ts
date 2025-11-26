import { Point, Polygon } from '../foundation/geometry';
import { noise } from '../foundation/noise';
import { poly } from '../utils/svg';
import { loopNoise } from '../utils/math';

export interface BlobOptions {
  /** Length of the blob */
  len?: number;
  /** Width of the blob */
  wid?: number;
  /** Rotation angle in radians */
  ang?: number;
  /** Color */
  col?: string;
  /** Noise amount (0-1) */
  noi?: number;
  /** Return type: 0 for SVG string, 1 for point array */
  ret?: number;
  /** Shape function */
  fun?: (x: number) => number;
}

/**
 * Blob - Generate organic blob shapes
 * Creates ink-like blobs with natural variation
 */
export class Blob {
  /**
   * Generate a blob shape at given position
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - Blob styling options
   * @returns SVG string or point array depending on ret option
   */
  static generate(x: number, y: number, options: BlobOptions = {}): string | Polygon {
    const len = options.len ?? 20;
    const wid = options.wid ?? 5;
    const ang = options.ang ?? 0;
    const col = options.col ?? 'rgba(200,200,200,0.9)';
    const noi = options.noi ?? 0.5;
    const ret = options.ret ?? 0;
    const fun =
      options.fun ??
      ((x: number) => {
        return x <= 1
          ? Math.pow(Math.sin(x * Math.PI), 0.5)
          : -Math.pow(Math.sin((x + 1) * Math.PI), 0.5);
      });

    const reso = 20.0;
    const lalist: [number, number][] = [];

    // Calculate polar coordinates for blob shape
    for (let i = 0; i < reso + 1; i++) {
      const p = (i / reso) * 2;
      const xo = len / 2 - Math.abs(p - 1) * len;
      const yo = (fun(p) * wid) / 2;
      const a = Math.atan2(yo, xo);
      const l = Math.sqrt(xo * xo + yo * yo);
      lalist.push([l, a]);
    }

    // Generate noise for organic variation
    const nslist: number[] = [];
    const n0 = Math.random() * 10;
    for (let i = 0; i < reso + 1; i++) {
      nslist.push(noise.noise(i * 0.05, n0));
    }

    loopNoise(nslist);

    // Convert to Cartesian coordinates with noise
    const plist: Polygon = [];
    for (let i = 0; i < lalist.length; i++) {
      const ns = nslist[i] * noi + (1 - noi);
      const nx = x + Math.cos(lalist[i][1] + ang) * lalist[i][0] * ns;
      const ny = y + Math.sin(lalist[i][1] + ang) * lalist[i][0] * ns;
      plist.push([nx, ny]);
    }

    if (ret === 0) {
      return poly(plist, { fil: col, str: col, wid: 0 });
    } else {
      return plist;
    }
  }
}

// Export a convenience function
export function blob(x: number, y: number, options: BlobOptions = {}): string | Polygon {
  return Blob.generate(x, y, options);
}
