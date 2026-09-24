import { Polygon } from "../foundation/geometry";
import { noise } from "../foundation/noise";
import { prng } from "../foundation/random";
import { poly } from "../utils/svg";
import { loopNoise } from "../utils/math";

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

/** Outline resolution for regular blobs (21 vertices). */
const BLOB_RESO = 20;
/**
 * Outline resolution for small SVG blobs (11 vertices). Tree foliage emits
 * ~10k blobs of 10-30 px per landscape; at that size 21 vertices are
 * indistinguishable from 11 but double the SVG bytes and DOM size.
 */
const SMALL_BLOB_RESO = 10;
/** Blobs whose length and width both stay below this use SMALL_BLOB_RESO. */
const SMALL_BLOB_SIZE = 24;

interface UnitOutline {
  /** x of each outline sample in units of `len`: 0.5 - |p - 1|, p ∈ [0, 2]. */
  x: Float64Array;
  /** y of each outline sample in units of `wid` for the default shape. */
  y: Float64Array;
}

function defaultBlobShape(x: number): number {
  return x <= 1
    ? Math.pow(Math.sin(x * Math.PI), 0.5)
    : -Math.pow(Math.sin((x + 1) * Math.PI), 0.5);
}

/** y of each outline sample in units of `wid`: fun(p) / 2. */
function sampleShape(fun: (x: number) => number, reso: number): Float64Array {
  const out = new Float64Array(reso + 1);
  for (let i = 0; i <= reso; i++) {
    out[i] = fun((i / reso) * 2) / 2;
  }
  return out;
}

function buildOutline(reso: number): UnitOutline {
  const x = new Float64Array(reso + 1);
  for (let i = 0; i <= reso; i++) {
    x[i] = 0.5 - Math.abs((i / reso) * 2 - 1);
  }
  return { x, y: sampleShape(defaultBlobShape, reso) };
}

const OUTLINES: Record<number, UnitOutline> = {
  [BLOB_RESO]: buildOutline(BLOB_RESO),
  [SMALL_BLOB_RESO]: buildOutline(SMALL_BLOB_RESO),
};

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
    const col = options.col ?? "rgba(200,200,200,0.9)";
    const noi = options.noi ?? 0.5;
    const ret = options.ret ?? 0;
    const reso =
      ret === 0 && Math.abs(len) < SMALL_BLOB_SIZE && Math.abs(wid) < SMALL_BLOB_SIZE
        ? SMALL_BLOB_RESO
        : BLOB_RESO;
    // Unit outline samples (x in half-lengths, y in half-widths). The default
    // shape is cached; a custom shape function is sampled per call.
    const outline = OUTLINES[reso];
    const unitY = options.fun ? sampleShape(options.fun, reso) : outline.y;
    const unitX = outline.x;

    // Generate noise for organic variation (same noise frequency along the
    // outline at either resolution)
    const nstep = (0.05 * BLOB_RESO) / reso;
    const nslist: number[] = new Array(reso + 1);
    const n0 = prng.random() * 10;
    for (let i = 0; i <= reso; i++) {
      nslist[i] = noise.noise(i * nstep, n0);
    }

    loopNoise(nslist);

    // Rotate the scaled outline point by `ang` and scale radially by noise.
    // Equivalent to the polar form cos(a + ang) * l, without atan2/sqrt.
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const plist: Polygon = new Array(reso + 1);
    for (let i = 0; i <= reso; i++) {
      const ns = nslist[i] * noi + (1 - noi);
      const xo = unitX[i] * len * ns;
      const yo = unitY[i] * wid * ns;
      plist[i] = [x + xo * ca - yo * sa, y + xo * sa + yo * ca];
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
