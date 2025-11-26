/**
 * Linear Congruential Generator for noise seeding
 * Used internally by PerlinNoise for reproducible noise generation
 */
class LCG {
  private readonly m = 4294967296;
  private readonly a = 1664525;
  private readonly c = 1013904223;
  private seed: number = 0;
  private z: number = 0;

  setSeed(val: number | null): void {
    this.z = this.seed = (val == null ? Math.random() * this.m : val) >>> 0;
  }

  getSeed(): number {
    return this.seed;
  }

  rand(): number {
    this.z = (this.a * this.z + this.c) % this.m;
    return this.z / this.m;
  }
}

/**
 * Perlin Noise Generator
 * Based on p5.js implementation
 * @see https://raw.githubusercontent.com/processing/p5.js/master/src/math/noise.js
 */
export class PerlinNoise {
  private readonly PERLIN_YWRAPB = 4;
  private readonly PERLIN_YWRAP = 1 << this.PERLIN_YWRAPB;
  private readonly PERLIN_ZWRAPB = 8;
  private readonly PERLIN_ZWRAP = 1 << this.PERLIN_ZWRAPB;
  private readonly PERLIN_SIZE = 4095;

  private perlin_octaves = 4;
  private perlin_amp_falloff = 0.5;
  private perlin: number[] | null = null;

  /**
   * Scaled cosine interpolation function
   */
  private scaledCosine(i: number): number {
    return 0.5 * (1.0 - Math.cos(i * Math.PI));
  }

  /**
   * Generate Perlin noise value at given coordinates
   * @param x - X coordinate
   * @param y - Y coordinate (optional, defaults to 0)
   * @param z - Z coordinate (optional, defaults to 0)
   * @returns Noise value
   */
  noise(x: number, y: number = 0, z: number = 0): number {
    // Initialize perlin table if not already done
    if (this.perlin == null) {
      this.perlin = new Array(this.PERLIN_SIZE + 1);
      for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
        this.perlin[i] = Math.random();
      }
    }

    // Take absolute values
    if (x < 0) {
      x = -x;
    }
    if (y < 0) {
      y = -y;
    }
    if (z < 0) {
      z = -z;
    }

    // Integer and fractional parts
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    let zi = Math.floor(z);
    let xf = x - xi;
    let yf = y - yi;
    let zf = z - zi;

    let rxf: number, ryf: number;
    let r = 0;
    let ampl = 0.5;
    let n1: number, n2: number, n3: number;

    // Multi-octave noise generation
    for (let o = 0; o < this.perlin_octaves; o++) {
      let of = xi + (yi << this.PERLIN_YWRAPB) + (zi << this.PERLIN_ZWRAPB);
      rxf = this.scaledCosine(xf);
      ryf = this.scaledCosine(yf);

      n1 = this.perlin[of & this.PERLIN_SIZE];
      n1 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n1);
      n2 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
      n2 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n2);
      n1 += ryf * (n2 - n1);

      of += this.PERLIN_ZWRAP;
      n2 = this.perlin[of & this.PERLIN_SIZE];
      n2 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n2);
      n3 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
      n3 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n3);
      n2 += ryf * (n3 - n2);

      n1 += this.scaledCosine(zf) * (n2 - n1);
      r += n1 * ampl;
      ampl *= this.perlin_amp_falloff;

      xi <<= 1;
      xf *= 2;
      yi <<= 1;
      yf *= 2;
      zi <<= 1;
      zf *= 2;

      if (xf >= 1.0) {
        xi++;
        xf--;
      }
      if (yf >= 1.0) {
        yi++;
        yf--;
      }
      if (zf >= 1.0) {
        zi++;
        zf--;
      }
    }

    return r;
  }

  /**
   * Configure noise detail
   * @param lod - Level of detail (number of octaves)
   * @param falloff - Amplitude falloff for each octave
   */
  noiseDetail(lod: number, falloff: number): void {
    if (lod > 0) {
      this.perlin_octaves = lod;
    }
    if (falloff > 0) {
      this.perlin_amp_falloff = falloff;
    }
  }

  /**
   * Seed the noise generator for reproducible results
   * @param seed - Seed value
   */
  noiseSeed(seed: number): void {
    const lcg = new LCG();
    lcg.setSeed(seed);
    this.perlin = new Array(this.PERLIN_SIZE + 1);
    for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
      this.perlin[i] = lcg.rand();
    }
  }
}

// Global instance
export const noise = new PerlinNoise();
