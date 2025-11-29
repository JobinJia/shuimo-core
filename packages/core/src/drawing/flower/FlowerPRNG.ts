/**
 * Flower Generator - Pseudo Random Number Generator
 * Seedable PRNG using Blum Blum Shub algorithm
 * Migrated from reference-code/flowers/main.js (Lines 40-79)
 */

/**
 * Seedable Pseudo Random Number Generator
 * Uses Blum Blum Shub algorithm for reproducible randomness
 */
export class FlowerPRNG {
  private s: number = 1234
  private readonly p: number = 999979
  private readonly q: number = 999983
  private readonly m: number

  constructor() {
    this.m = this.p * this.q
  }

  /**
   * Hash function to convert seed to number
   * Uses btoa (base64 encoding) to match original implementation
   */
  private hash(x: any): number {
    // Match original: window.btoa(JSON.stringify(x))
    const jsonStr = JSON.stringify(x)

    // Use btoa for base64 encoding (browser environment only)
    // This implementation is designed for browser environments where btoa is available
    let encoded: string
    if (typeof btoa !== 'undefined') {
      encoded = btoa(jsonStr)
    } else {
      // Fallback: use simple encoding if btoa not available
      // This maintains some consistency but won't match original exactly
      console.warn('btoa not available, using fallback hash')
      encoded = jsonStr
    }

    let z = 0
    for (let i = 0; i < encoded.length; i++) {
      z += encoded.charCodeAt(i) * 128 ** i
    }
    return z
  }

  /**
   * Set the random seed
   * @param x - Seed value (number or string)
   */
  seed(x?: number | string): void {
    if (x === undefined) {
      x = new Date().getTime()
    }

    let y = 0
    let z = 0

    const redo = (): void => {
      y = (this.hash(x) + z) % this.m
      z += 1
    }

    while (y % this.p === 0 || y % this.q === 0 || y === 0 || y === 1) {
      redo()
    }

    this.s = y
    console.log(['int seed', this.s])

    // Warm up the generator
    for (let i = 0; i < 10; i++) {
      this.next()
    }
  }

  /**
   * Get next random number in range [0, 1)
   */
  next(): number {
    this.s = (this.s * this.s) % this.m
    return this.s / this.m
  }

  /**
   * Test the distribution of random numbers
   */
  test(f?: () => number): number[] {
    const F = f || (() => this.next())
    const t0 = new Date().getTime()
    const chart = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

    for (let i = 0; i < 10000000; i++) {
      chart[Math.floor(F() * 10)] += 1
    }

    console.log(chart)
    console.log(`finished in ${new Date().getTime() - t0}`)
    return chart
  }
}

// ============================================================================
// Global PRNG Instance and Math.random Override
// ============================================================================

/** Global PRNG instance */
export const flowerPRNG = new FlowerPRNG()

/**
 * Override Math.random with seeded PRNG
 * Note: This modifies the global Math object!
 */
export function installGlobalPRNG(): void {
  const originalRandom = Math.random

  // Store original for potential restoration
  ;(Math as any).oldRandom = originalRandom

  // Override Math.random
  Math.random = () => flowerPRNG.next()

  // Add seed method to Math
  ;(Math as any).seed = (x?: number | string) => flowerPRNG.seed(x)
}

/**
 * Restore original Math.random
 */
export function restoreOriginalRandom(): void {
  if ((Math as any).oldRandom) {
    Math.random = (Math as any).oldRandom
    delete (Math as any).oldRandom
    delete (Math as any).seed
  }
}

// ============================================================================
// Standalone Functions (without global override)
// ============================================================================

/**
 * Create a new PRNG instance with a specific seed
 */
export function createSeededPRNG(seed?: number | string): FlowerPRNG {
  const prng = new FlowerPRNG()
  prng.seed(seed)
  return prng
}

/**
 * Generate a random number using the global PRNG
 */
export function random(): number {
  return flowerPRNG.next()
}

/**
 * Seed the global PRNG
 */
export function seed(x?: number | string): void {
  flowerPRNG.seed(x)
}
