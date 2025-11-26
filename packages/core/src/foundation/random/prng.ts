/**
 * Blum-Blum-Shub Pseudorandom Number Generator
 *
 * A cryptographically secure PRNG based on the difficulty of factoring large numbers.
 * Uses two large prime numbers (p and q) to generate a sequence of random numbers.
 */
export class PRNG {
  private s: number = 1234;
  private readonly p: number = 999979;
  private readonly q: number = 999983;
  private readonly m: number;

  constructor() {
    this.m = this.p * this.q;
  }

  /**
   * Hash function to convert any input to a numeric seed
   */
  private hash(x: any): number {
    const y = window.btoa(JSON.stringify(x));
    let z = 0;
    for (let i = 0; i < y.length; i++) {
      z += y.charCodeAt(i) * Math.pow(128, i);
    }
    return z;
  }

  /**
   * Seed the random number generator
   * @param x - Seed value (uses current timestamp if undefined)
   */
  seed(x?: any): void {
    if (x === undefined) {
      x = new Date().getTime();
    }

    let y = 0;
    let z = 0;

    const redo = () => {
      y = (this.hash(x) + z) % this.m;
      z += 1;
    };

    // Ensure seed is not divisible by p or q, and not 0 or 1
    while (y % this.p === 0 || y % this.q === 0 || y === 0 || y === 1) {
      redo();
    }

    this.s = y;
    console.log(['int seed', this.s]);

    // Warm up the generator
    for (let i = 0; i < 10; i++) {
      this.next();
    }
  }

  /**
   * Generate the next random number in the sequence
   * @returns A random number between 0 and 1
   */
  next(): number {
    this.s = (this.s * this.s) % this.m;
    return this.s / this.m;
  }

  /**
   * Test the distribution quality of the random number generator
   * @param f - Optional custom random function to test
   */
  test(f?: () => number): number[] {
    const F = f || (() => this.next());
    const t0 = new Date().getTime();
    const chart = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    for (let i = 0; i < 10000000; i++) {
      chart[Math.floor(F() * 10)] += 1;
    }

    console.log(chart);
    console.log('finished in ' + (new Date().getTime() - t0));
    return chart;
  }
}

// Global instance
export const prng = new PRNG();

/**
 * Override Math.random with our PRNG
 */
export function overrideMathRandom(): void {
  Math.random = () => prng.next();
  (Math as any).seed = (x?: any) => prng.seed(x);
}
