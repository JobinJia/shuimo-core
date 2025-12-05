/**
 * Simplex Noise Generator
 *
 * Simplex noise is an improvement over Perlin noise by Ken Perlin (2001).
 * It has less directional artifacts, better performance, and more natural appearance.
 *
 * Based on Stefan Gustavson's implementation
 */

export class SimplexNoise {
  // Simplex skewing constants for 2D
  private readonly F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  private readonly G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

  // Gradients for 2D
  private readonly grad3 = [
    [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
    [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
  ];

  // Permutation table
  private perm: number[] = [];
  private permMod12: number[] = [];

  constructor(seed?: number) {
    this.seed(seed ?? Math.random() * 65536);
  }

  /**
   * Seed the noise generator for reproducible results
   */
  seed(seed: number): void {
    // Simple seeded random number generator
    const random = (x: number): number => {
      const s = Math.sin(x) * 10000;
      return s - Math.floor(s);
    };

    // Build permutation table
    const p: number[] = [];
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }

    // Shuffle using seed
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random(seed + i) * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Extend permutation table
    this.perm = new Array(512);
    this.permMod12 = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /**
   * 2D Simplex noise
   * @param xin - X coordinate
   * @param yin - Y coordinate
   * @returns Noise value in range [-1, 1]
   */
  noise2D(xin: number, yin: number): number {
    let n0: number, n1: number, n2: number; // Noise contributions from the three corners

    // Skew the input space to determine which simplex cell we're in
    const s = (xin + yin) * this.F2; // Hairy factor for 2D
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * this.G2;
    const X0 = i - t; // Unskew the cell origin back to (x,y) space
    const Y0 = j - t;
    const x0 = xin - X0; // The x,y distances from the cell origin
    const y0 = yin - Y0;

    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    let i1: number, j1: number; // Offsets for second (middle) corner of simplex in (i,j) coords
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } // lower triangle, XY order: (0,0)->(1,0)->(1,1)
    else {
      i1 = 0;
      j1 = 1;
    } // upper triangle, YX order: (0,0)->(0,1)->(1,1)

    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    const x1 = x0 - i1 + this.G2; // Offsets for middle corner in (x,y) unskewed coords
    const y1 = y0 - j1 + this.G2;
    const x2 = x0 - 1.0 + 2.0 * this.G2; // Offsets for last corner in (x,y) unskewed coords
    const y2 = y0 - 1.0 + 2.0 * this.G2;

    // Work out the hashed gradient indices of the three simplex corners
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

    // Calculate the contribution from the three corners
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 < 0) n0 = 0.0;
    else {
      t0 *= t0;
      n0 = t0 * t0 * this.dot(this.grad3[gi0], x0, y0); // (x,y) of grad3 used for 2D gradient
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 < 0) n1 = 0.0;
    else {
      t1 *= t1;
      n1 = t1 * t1 * this.dot(this.grad3[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 < 0) n2 = 0.0;
    else {
      t2 *= t2;
      n2 = t2 * t2 * this.dot(this.grad3[gi2], x2, y2);
    }

    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70.0 * (n0 + n1 + n2);
  }

  /**
   * Dot product helper
   */
  private dot(g: number[], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }
}
