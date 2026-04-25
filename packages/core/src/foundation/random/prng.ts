/**
 * Mulberry32-based Pseudorandom Number Generator
 *
 * Replaces the original BBS implementation which suffered from JavaScript
 * integer overflow (s*s exceeded Number.MAX_SAFE_INTEGER), causing degenerate
 * short-period sequences and visually regular patterns.
 */
export class PRNG {
  private s: number = 1234;

  /**
   * Hash function to convert any input to a numeric seed
   */
  private hash(x: any): number {
    const str = JSON.stringify(x);
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /**
   * Seed the random number generator
   * @param x - Seed value (uses current timestamp if undefined)
   */
  seed(x?: any): void {
    if (x === undefined) {
      x = new Date().getTime();
    }
    this.s = this.hash(x) >>> 0;
    if (this.s === 0) this.s = 1;

    // Warm up the generator
    for (let i = 0; i < 10; i++) {
      this.next();
    }
  }

  /**
   * Generate the next random number in the sequence (Mulberry32)
   * @returns A random number between 0 and 1
   */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Alias for next()
   * @returns A random number between 0 and 1
   */
  random(): number {
    return this.next();
  }

  /**
   * Test the distribution quality of the random number generator
   * @param f - Optional custom random function to test
   */
  test(f?: () => number): number[] {
    const F = f || (() => this.next());
    const chart = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < 10000000; i++) {
      chart[Math.floor(F() * 10)] += 1;
    }

    return chart;
  }
}

// Global instance
export const prng = new PRNG();
