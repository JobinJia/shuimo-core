/**
 * Flower Generator - Perlin Noise
 * Implementation adapted from p5.js
 * Migrated from reference-code/flowers/main.js (Lines 102-166)
 */

/**
 * Perlin Noise Generator
 * Generates smooth, continuous noise for natural-looking variations
 */
export class FlowerNoise {
  private readonly PERLIN_YWRAPB = 4
  private readonly PERLIN_YWRAP = 1 << this.PERLIN_YWRAPB
  private readonly PERLIN_ZWRAPB = 8
  private readonly PERLIN_ZWRAP = 1 << this.PERLIN_ZWRAPB
  private readonly PERLIN_SIZE = 4095

  private perlin_octaves = 4
  private perlin_amp_falloff = 0.5
  private perlin: number[] | null = null

  /**
   * Scaled cosine interpolation
   */
  private scaled_cosine(i: number): number {
    return 0.5 * (1.0 - Math.cos(i * Math.PI))
  }

  /**
   * Generate Perlin noise value
   * @param x - X coordinate
   * @param y - Y coordinate (optional)
   * @param z - Z coordinate (optional)
   * @returns Noise value in range [0, 1]
   */
  noise(x: number, y: number = 0, z: number = 0): number {
    if (this.perlin == null) {
      console.log('🔧 Noise: Initializing perlin array (4096 Math.random calls)')
      console.trace('🔧 Noise: Call stack:')
      this.perlin = Array.from({ length: this.PERLIN_SIZE + 1 })
      for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
        this.perlin[i] = Math.random()
      }
      console.log('🔧 Noise: Perlin array initialized')
    }

    if (x < 0) x = -x
    if (y < 0) y = -y
    if (z < 0) z = -z

    let xi = Math.floor(x)
    let yi = Math.floor(y)
    let zi = Math.floor(z)
    let xf = x - xi
    let yf = y - yi
    let zf = z - zi

    let rxf: number
    let ryf: number

    let r = 0
    let ampl = 0.5

    let n1: number
    let n2: number
    let n3: number

    for (let o = 0; o < this.perlin_octaves; o++) {
      let of = xi + (yi << this.PERLIN_YWRAPB) + (zi << this.PERLIN_ZWRAPB)

      rxf = this.scaled_cosine(xf)
      ryf = this.scaled_cosine(yf)

      n1 = this.perlin[of & this.PERLIN_SIZE]
      n1 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n1)
      n2 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE]
      n2 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n2)
      n1 += ryf * (n2 - n1)

      of += this.PERLIN_ZWRAP
      n2 = this.perlin[of & this.PERLIN_SIZE]
      n2 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n2)
      n3 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE]
      n3 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n3)
      n2 += ryf * (n3 - n2)

      n1 += this.scaled_cosine(zf) * (n2 - n1)

      r += n1 * ampl
      ampl *= this.perlin_amp_falloff

      xi <<= 1
      xf *= 2
      yi <<= 1
      yf *= 2
      zi <<= 1
      zf *= 2

      if (xf >= 1.0) {
        xi++
        xf--
      }
      if (yf >= 1.0) {
        yi++
        yf--
      }
      if (zf >= 1.0) {
        zi++
        zf--
      }
    }

    return r
  }

  /**
   * Set noise detail
   * @param lod - Level of detail (octaves)
   * @param falloff - Amplitude falloff per octave
   */
  noiseDetail(lod: number, falloff: number): void {
    if (lod > 0) {
      this.perlin_octaves = lod
    }
    if (falloff > 0) {
      this.perlin_amp_falloff = falloff
    }
  }

  /**
   * Set noise seed for deterministic noise generation
   * @param seed - Seed value
   */
  noiseSeed(seed: number): void {
    // Linear congruential generator
    const lcg = (() => {
      const m = 4294967296
      const a = 1664525
      const c = 1013904223
      let s: number
      let z: number

      return {
        setSeed(val: number) {
          z = s = (val == null ? Math.random() * m : val) >>> 0
        },
        getSeed() {
          return s
        },
        rand() {
          z = (a * z + c) % m
          return z / m
        },
      }
    })()

    lcg.setSeed(seed)
    this.perlin = Array.from({ length: this.PERLIN_SIZE + 1 })
    for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
      this.perlin[i] = lcg.rand()
    }
  }

  /**
   * Reset noise generator (force re-initialization on next call)
   * This should be called when changing the global PRNG seed
   */
  reset(): void {
    console.log('🔧 Noise: Reset called, perlin array will be re-initialized')
    this.perlin = null
  }
}

// ============================================================================
// Global Noise Instance
// ============================================================================

/** Global noise generator instance */
console.log('🔧 Creating global FlowerNoise instance')
export const flowerNoise = new FlowerNoise()
console.log('🔧 Global FlowerNoise instance created:', flowerNoise)

/**
 * Generate Perlin noise (convenience function)
 */
export function noise(x: number, y?: number, z?: number): number {
  return flowerNoise.noise(x, y, z)
}

/**
 * Set noise detail (convenience function)
 */
export function noiseDetail(lod: number, falloff: number): void {
  flowerNoise.noiseDetail(lod, falloff)
}

/**
 * Set noise seed (convenience function)
 */
export function noiseSeed(seed: number): void {
  flowerNoise.noiseSeed(seed)
}

/**
 * Reset noise generator (convenience function)
 * Forces re-initialization on next noise() call
 */
export function resetNoise(): void {
  flowerNoise.reset()
}
