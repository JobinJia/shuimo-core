/**
 * Perlin Noise Generator
 *
 * Implementation of Perlin noise algorithm for generating smooth pseudo-random noise.
 * Used extensively for terrain generation, textures, and natural-looking variations.
 *
 * Reference: Adapted from shan-shui-inf and nonflowers projects
 */

import type { INoise } from '../types';
import { fastFloor } from '../math/utils';

/**
 * Perlin noise implementation
 *
 * Generates coherent noise values that are smooth and continuous.
 * Values are typically in range [-1, 1] but can exceed these bounds slightly.
 */
export class PerlinNoise implements INoise {
  private readonly permutation: number[];
  private readonly p: number[];

  /**
   * Default permutation table (Ken Perlin's original)
   */
  private static readonly DEFAULT_PERMUTATION = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
    234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
    88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
    134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
    230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
    1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
    116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
    124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
    47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
    154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
    108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
    242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
    239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
    50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
    141, 128, 195, 78, 66, 215, 61, 156, 180
  ];

  constructor(seed?: number) {
    // Initialize permutation table
    this.permutation = [...PerlinNoise.DEFAULT_PERMUTATION];

    // Shuffle if seed is provided
    if (seed !== undefined) {
      this.shufflePermutation(seed);
    }

    // Double the permutation table to avoid overflow
    this.p = new Array(512);
    for (let i = 0; i < 256; i++) {
      this.p[i] = this.permutation[i]!;
      this.p[i + 256] = this.permutation[i]!;
    }
  }

  /**
   * Shuffle permutation table using seed
   */
  private shufflePermutation(seed: number): void {
    // Simple seeded shuffle
    let random = seed;
    for (let i = this.permutation.length - 1; i > 0; i--) {
      // LCG random
      random = (random * 16807) % 2147483647;
      const j = Math.abs(random) % (i + 1);
      [this.permutation[i]!, this.permutation[j]!] = [
        this.permutation[j]!,
        this.permutation[i]!
      ];
    }
  }

  /**
   * Fade function for smooth interpolation
   */
  private fade(t: number): number {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Linear interpolation
   */
  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  /**
   * Gradient function for 1D
   */
  private grad1(hash: number, x: number): number {
    return (hash & 1) === 0 ? x : -x;
  }

  /**
   * Gradient function for 2D
   */
  private grad2(hash: number, x: number, y: number): number {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * Gradient function for 3D
   */
  private grad3(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * 1D Perlin noise
   */
  noise1D(x: number): number {
    const X = fastFloor(x) & 255;
    x -= fastFloor(x);

    const u = this.fade(x);

    const a = this.p[X]!;
    const b = this.p[X + 1]!;

    return this.lerp(this.grad1(a, x), this.grad1(b, x - 1), u);
  }

  /**
   * 2D Perlin noise
   */
  noise2D(x: number, y: number): number {
    // Find unit grid cell containing point
    const X = fastFloor(x) & 255;
    const Y = fastFloor(y) & 255;

    // Get relative coordinates within cell
    x -= fastFloor(x);
    y -= fastFloor(y);

    // Compute fade curves
    const u = this.fade(x);
    const v = this.fade(y);

    // Hash coordinates of the 4 cube corners
    const aa = this.p[this.p[X]! + Y]!;
    const ab = this.p[this.p[X]! + Y + 1]!;
    const ba = this.p[this.p[X + 1]! + Y]!;
    const bb = this.p[this.p[X + 1]! + Y + 1]!;

    // Blend results from 4 corners
    return this.lerp(
      this.lerp(this.grad2(aa, x, y), this.grad2(ba, x - 1, y), u),
      this.lerp(this.grad2(ab, x, y - 1), this.grad2(bb, x - 1, y - 1), u),
      v
    );
  }

  /**
   * 3D Perlin noise
   */
  noise3D(x: number, y: number, z: number): number {
    // Find unit cube containing point
    const X = fastFloor(x) & 255;
    const Y = fastFloor(y) & 255;
    const Z = fastFloor(z) & 255;

    // Get relative coordinates within cube
    x -= fastFloor(x);
    y -= fastFloor(y);
    z -= fastFloor(z);

    // Compute fade curves
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    // Hash coordinates of the 8 cube corners
    const aaa = this.p[this.p[this.p[X]! + Y]! + Z]!;
    const aba = this.p[this.p[this.p[X]! + Y + 1]! + Z]!;
    const aab = this.p[this.p[this.p[X]! + Y]! + Z + 1]!;
    const abb = this.p[this.p[this.p[X]! + Y + 1]! + Z + 1]!;
    const baa = this.p[this.p[this.p[X + 1]! + Y]! + Z]!;
    const bba = this.p[this.p[this.p[X + 1]! + Y + 1]! + Z]!;
    const bab = this.p[this.p[this.p[X + 1]! + Y]! + Z + 1]!;
    const bbb = this.p[this.p[this.p[X + 1]! + Y + 1]! + Z + 1]!;

    // Blend results from 8 corners
    return this.lerp(
      this.lerp(
        this.lerp(this.grad3(aaa, x, y, z), this.grad3(baa, x - 1, y, z), u),
        this.lerp(this.grad3(aba, x, y - 1, z), this.grad3(bba, x - 1, y - 1, z), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad3(aab, x, y, z - 1), this.grad3(bab, x - 1, y, z - 1), u),
        this.lerp(this.grad3(abb, x, y - 1, z - 1), this.grad3(bbb, x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }
}
