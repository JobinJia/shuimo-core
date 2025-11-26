import { Polygon } from '../foundation/geometry';
import { noise } from '../foundation/noise';
import { stroke } from './Stroke';

export interface TextureOptions {
  /** X offset */
  xof?: number;
  /** Y offset */
  yof?: number;
  /** Number of texture strokes */
  tex?: number;
  /** Stroke width */
  wid?: number;
  /** Length ratio for texture strokes */
  len?: number;
  /** Shadow/shade width (0 for no shadow) */
  sha?: number;
  /** Return type: 0 for SVG string, 1 for point array */
  ret?: number;
  /** Noise function based on layer depth */
  noi?: (x: number) => number;
  /** Color function based on progress (0-1) */
  col?: (x: number) => string;
  /** Distribution function for horizontal positioning */
  dis?: () => number;
}

/**
 * Texture - Generate organic texture patterns for surfaces
 * Creates natural-looking texture strokes across a surface defined by point layers
 */
export class Texture {
  /**
   * Generate texture for a surface
   * @param ptlist - Array of point layers defining the surface
   * @param options - Texture styling options
   * @returns SVG string or point array depending on ret option
   */
  static generate(ptlist: Polygon[], options: TextureOptions = {}): string | Polygon[] {
    const xof = options.xof ?? 0;
    const yof = options.yof ?? 0;
    const tex = options.tex ?? 400;
    const wid = options.wid ?? 1.5;
    const len = options.len ?? 0.2;
    const sha = options.sha ?? 0;
    const ret = options.ret ?? 0;
    const noi = options.noi ?? ((x: number) => 30 / x);
    const col =
      options.col ??
      ((x: number) => 'rgba(100,100,100,' + (Math.random() * 0.3).toFixed(3) + ')');
    const dis =
      options.dis ??
      (() => {
        if (Math.random() > 0.5) {
          return (1 / 3) * Math.random();
        } else {
          return (1 * 2) / 3 + (1 / 3) * Math.random();
        }
      });

    const reso = [ptlist.length, ptlist[0].length];
    const texlist: Polygon[] = [];

    // Generate texture strokes
    for (let i = 0; i < tex; i++) {
      const mid = (dis() * reso[1]) | 0;
      const hlen = Math.floor(Math.random() * (reso[1] * len));

      let start = mid - hlen;
      let end = mid + hlen;
      start = Math.min(Math.max(start, 0), reso[1]);
      end = Math.min(Math.max(end, 0), reso[1]);

      const layer = (i / tex) * (reso[0] - 1);

      texlist.push([]);
      for (let j = start; j < end; j++) {
        const p = layer - Math.floor(layer);

        const x =
          ptlist[Math.floor(layer)][j][0] * p +
          ptlist[Math.ceil(layer)][j][0] * (1 - p);

        const y =
          ptlist[Math.floor(layer)][j][1] * p +
          ptlist[Math.ceil(layer)][j][1] * (1 - p);

        const ns = [
          noi(layer + 1) * (noise.noise(x, j * 0.5) - 0.5),
          noi(layer + 1) * (noise.noise(y, j * 0.5) - 0.5),
        ];

        texlist[texlist.length - 1].push([x + ns[0], y + ns[1]]);
      }
    }

    let canv = '';

    // SHADE
    if (sha) {
      for (let j = 0; j < texlist.length; j += 1 + (sha !== 0 ? 1 : 0)) {
        canv += stroke(
          texlist[j].map((x) => [x[0] + xof, x[1] + yof]),
          { col: 'rgba(100,100,100,0.1)', wid: sha }
        );
      }
    }

    // TEXTURE
    for (let j = 0 + sha; j < texlist.length; j += 1 + sha) {
      canv += stroke(
        texlist[j].map((x) => [x[0] + xof, x[1] + yof]),
        { col: col(j / texlist.length), wid: wid }
      );
    }

    return ret ? texlist : canv;
  }
}

// Export a convenience function
export function texture(ptlist: Polygon[], options: TextureOptions = {}): string | Polygon[] {
  return Texture.generate(ptlist, options);
}
