import { Polygon } from "../../foundation/geometry";
import { noise } from "../../foundation/noise";
import { prng } from "../../foundation/random";
import { stroke } from "../../drawing/Stroke";

export interface WaterOptions {
  /** Height/amplitude of water waves */
  hei?: number;
  /** Total length of water surface */
  len?: number;
  /** Number of wave clusters */
  clu?: number;
}

/**
 * Water - Generate water surface with waves
 * Creates traditional Chinese painting style water with undulating waves
 */
export class Water {
  /**
   * Generate water surface
   * @param xoff - X offset
   * @param yoff - Y offset
   * @param seed - Random seed for consistent generation
   * @param options - Water styling options
   * @returns SVG string representing the water
   */
  static generate(xoff: number, yoff: number, seed: number, options: WaterOptions = {}): string {
    const hei = options.hei ?? 2;
    const len = options.len ?? 800;
    const clu = options.clu ?? 10;
    let canv = "";

    const ptlist: Polygon[] = [];
    let yk = 0;

    // Cap cluster half-length so a large `len` (e.g. a hero-scene baseline
    // passing len ≈ viewport width) cannot stretch one stroke across the
    // whole canvas. With `hei` as low as 2, a several-hundred-pixel-wide
    // stroke only has ~2px of vertical travel and renders as a straight
    // line. 120 keeps clusters reading as ripple groups.
    const lkCap = Math.min(len / 4, 120);

    // Generate wave clusters
    for (let i = 0; i < clu; i++) {
      ptlist.push([]);
      const xk = (prng.random() - 0.5) * (len / 8);
      yk += prng.random() * 5;
      const lk = lkCap / 2 + prng.random() * (lkCap / 2);
      const reso = 5;

      for (let j = -lk; j < lk; j += reso) {
        ptlist[ptlist.length - 1].push([
          j + xk,
          Math.sin(j * 0.2) * hei * noise.noise(j * 0.1) - 20 + yk,
        ]);
      }
    }

    // Draw wave strokes
    for (let j = 1; j < ptlist.length; j += 1) {
      canv += stroke(ptlist[j], {
        xof: xoff,
        yof: yoff,
        col: "rgba(100,100,100," + (0.3 + prng.random() * 0.3).toFixed(3) + ")",
        wid: 1,
      });
    }

    return canv;
  }
}

// Export a convenience function
export function water(
  xoff: number,
  yoff: number,
  seed: number,
  options: WaterOptions = {},
): string {
  return Water.generate(xoff, yoff, seed, options);
}
