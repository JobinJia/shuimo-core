/**
 * Gabor Noise (sparse-convolution)
 *
 * Sums oriented Gabor kernels placed via Poisson-disk-like cell hashing.
 * Supports anisotropic orientation distributions (von Mises around a main axis),
 * which makes it a better fit than Perlin for fiber-like textures where the
 * medium has a preferred direction (e.g. hand-pulled Xuan paper formed on a
 * bamboo screen).
 *
 * Reference: Lagae et al., "Procedural Noise using Sparse Gabor Convolution" (2009).
 */

export interface GaborNoiseOptions {
  /**
   * Spatial period of the Gabor cosine carrier, in world units. Smaller = tighter
   * stripes. Defaults to 24.
   */
  frequency?: number;
  /**
   * Gaussian envelope radius, in world units. Defaults to frequency * 1.2.
   */
  kernelRadius?: number;
  /**
   * Mean orientation of kernels in radians. Defaults to 0 (horizontal).
   */
  mainOrientation?: number;
  /**
   * von-Mises concentration (kappa). 0 = fully isotropic, large values = tightly
   * aligned to mainOrientation. Defaults to 0.6.
   */
  orientationConcentration?: number;
  /**
   * Expected number of kernels per cell. Higher = smoother but slower. Defaults to 4.
   */
  kernelsPerCell?: number;
}

interface Kernel {
  x: number;
  y: number;
  theta: number;
  weight: number;
}

const TWO_PI = Math.PI * 2;

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/**
 * Sample von Mises(0, kappa) via a simple uniform fallback for kappa=0
 * and Best-Fisher otherwise. Takes two uniforms u1, u2 in [0, 1).
 */
function vonMisesSample(u1: number, u2: number, kappa: number): number {
  if (kappa < 1e-6) {
    return (u1 - 0.5) * TWO_PI;
  }
  const a = 1 + Math.sqrt(1 + 4 * kappa * kappa);
  const b = (a - Math.sqrt(2 * a)) / (2 * kappa);
  const r = (1 + b * b) / (2 * b);

  let theta = 0;
  let accepted = false;
  let attempt = 0;
  let seed1 = u1;
  let seed2 = u2;

  while (!accepted && attempt < 8) {
    const z = Math.cos(Math.PI * seed1);
    const f = (1 + r * z) / (r + z);
    const c = kappa * (r - f);

    const uTest = seed2;
    if (c * (2 - c) - uTest > 0 || Math.log(c / uTest) + 1 - c >= 0) {
      theta = Math.acos(Math.max(-1, Math.min(1, f)));
      if ((seed1 * 2) % 1 > 0.5) {
        theta = -theta;
      }
      accepted = true;
    } else {
      seed1 = (seed1 * 1.618 + 0.31830988) % 1;
      seed2 = (seed2 * 2.414 + 0.577) % 1;
      attempt++;
    }
  }
  return theta;
}

export class GaborNoise {
  private readonly seed: number;
  private readonly frequency: number;
  private readonly kernelRadius: number;
  private readonly mainOrientation: number;
  private readonly orientationConcentration: number;
  private readonly kernelsPerCell: number;
  private readonly cellSize: number;

  constructor(seed: number, options: GaborNoiseOptions = {}) {
    this.seed = seed | 0 || 1;
    this.frequency = options.frequency ?? 24;
    this.kernelRadius = options.kernelRadius ?? this.frequency * 1.2;
    this.mainOrientation = options.mainOrientation ?? 0;
    this.orientationConcentration = options.orientationConcentration ?? 0.6;
    this.kernelsPerCell = Math.max(1, options.kernelsPerCell ?? 4);
    this.cellSize = this.kernelRadius * 2;
  }

  private *kernelsForCell(cx: number, cy: number): Generator<Kernel> {
    const seedBase = this.seed;
    for (let i = 0; i < this.kernelsPerCell; i++) {
      const h1 = hash2(cx * 73856093 + i, cy * 19349663, seedBase);
      const h2 = hash2(cx * 83492791 + i, cy * 12582917, seedBase + 907);
      const h3 = hash2(cx + i * 31, cy + i * 17, seedBase + 181);
      const h4 = hash2(cx - i * 13, cy - i * 7, seedBase + 613);

      const localX = (cx + h1) * this.cellSize;
      const localY = (cy + h2) * this.cellSize;
      const theta = this.mainOrientation + vonMisesSample(h3, h4, this.orientationConcentration);
      const weight = 0.6 + h4 * 0.8;

      yield { x: localX, y: localY, theta, weight };
    }
  }

  private kernelContribution(kernel: Kernel, px: number, py: number): number {
    const dx = px - kernel.x;
    const dy = py - kernel.y;
    const r2 = dx * dx + dy * dy;
    if (r2 > this.kernelRadius * this.kernelRadius) return 0;
    const gauss = Math.exp((-Math.PI * r2) / (this.kernelRadius * this.kernelRadius));
    const projected = dx * Math.cos(kernel.theta) + dy * Math.sin(kernel.theta);
    const carrier = Math.cos((TWO_PI * projected) / this.frequency);
    return kernel.weight * gauss * carrier;
  }

  /**
   * Scalar noise value at (x, y). Result is roughly in [-1, 1] but not strictly
   * normalized — callers should treat it as a signed, zero-mean field.
   */
  noise2D(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const kernel of this.kernelsForCell(cx + dx, cy + dy)) {
          sum += this.kernelContribution(kernel, x, y);
        }
      }
    }
    return sum / Math.sqrt(this.kernelsPerCell);
  }

  /**
   * Local dominant orientation as a circular mean of nearby kernel angles
   * weighted by their Gaussian envelope. Returns angle in [-π, π].
   */
  directionAt(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    let sumSin = 0;
    let sumCos = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const kernel of this.kernelsForCell(cx + dx, cy + dy)) {
          const ddx = x - kernel.x;
          const ddy = y - kernel.y;
          const r2 = ddx * ddx + ddy * ddy;
          if (r2 > this.kernelRadius * this.kernelRadius) continue;
          const w =
            kernel.weight * Math.exp((-Math.PI * r2) / (this.kernelRadius * this.kernelRadius));
          // Orientation is undirected (mod π), so double-angle before averaging.
          sumSin += w * Math.sin(2 * kernel.theta);
          sumCos += w * Math.cos(2 * kernel.theta);
        }
      }
    }
    if (sumSin === 0 && sumCos === 0) {
      return this.mainOrientation;
    }
    return Math.atan2(sumSin, sumCos) * 0.5;
  }
}
