/**
 * Worley Noise Generator (Cellular Noise / Voronoi Noise)
 *
 * Generates cell-like patterns by calculating distances to randomly placed feature points.
 * Useful for creating textures like stone, water, cells, or in our case - ink particles.
 *
 * References:
 * - Steven Worley, "A Cellular Texture Basis Function" (1996)
 * - Used in Chinese ink painting to simulate ink particle distribution
 */

export interface WorleyNoiseOptions {
  /** Distance metric to use */
  distanceFunc?: 'euclidean' | 'manhattan' | 'chebyshev';
  /** Which feature point distance to return (F1, F2, F3...) */
  featurePoint?: number;
  /** Grid cell size (smaller = more feature points, finer detail) */
  cellSize?: number;
  /** Jitter amount (0 = regular grid, 1 = fully random) */
  jitter?: number;
}

export class WorleyNoise {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.random() * 65536;
  }

  /**
   * Seeded pseudo-random number generator
   */
  private random(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453123;
    return n - Math.floor(n);
  }

  /**
   * Generate 2D Worley noise
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - Configuration options
   * @returns Distance value (typically in range [0, 1])
   */
  noise2D(x: number, y: number, options: WorleyNoiseOptions = {}): number {
    const {
      distanceFunc = 'euclidean',
      featurePoint = 1, // F1 by default (closest point)
      cellSize = 1.0,
      jitter = 1.0,
    } = options;

    // Scale coordinates by cell size
    const scaledX = x / cellSize;
    const scaledY = y / cellSize;

    // Determine which cell we're in
    const cellX = Math.floor(scaledX);
    const cellY = Math.floor(scaledY);

    // Array to store distances to feature points
    const distances: number[] = [];

    // Check 3x3 grid of cells around current cell
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighborX = cellX + dx;
        const neighborY = cellY + dy;

        // Generate feature point position within neighbor cell
        // Use cell coordinates as seed for consistent random values
        const randomX = this.random(neighborX, neighborY);
        const randomY = this.random(neighborX + 0.1, neighborY + 0.1);

        // Feature point position (with jitter)
        const featureX = neighborX + randomX * jitter + (1 - jitter) * 0.5;
        const featureY = neighborY + randomY * jitter + (1 - jitter) * 0.5;

        // Calculate distance from current point to feature point
        const dist = this.distance(
          scaledX,
          scaledY,
          featureX,
          featureY,
          distanceFunc,
        );

        distances.push(dist);
      }
    }

    // Sort distances (closest first)
    distances.sort((a, b) => a - b);

    // Return the requested feature point distance
    // F1 = closest, F2 = second closest, etc.
    const distIndex = Math.min(featurePoint - 1, distances.length - 1);
    let result = distances[distIndex];

    // Normalize to approximate [0, 1] range
    // For euclidean distance with cellSize=1, typical max is ~sqrt(2)
    if (distanceFunc === 'euclidean') {
      result = Math.min(result / (cellSize * 1.5), 1.0);
    } else if (distanceFunc === 'manhattan') {
      result = Math.min(result / (cellSize * 2.0), 1.0);
    } else if (distanceFunc === 'chebyshev') {
      result = Math.min(result / cellSize, 1.0);
    }

    return result;
  }

  /**
   * Calculate distance between two points
   */
  private distance(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    metric: string,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;

    switch (metric) {
      case 'euclidean':
        return Math.sqrt(dx * dx + dy * dy);
      case 'manhattan':
        return Math.abs(dx) + Math.abs(dy);
      case 'chebyshev':
        return Math.max(Math.abs(dx), Math.abs(dy));
      default:
        return Math.sqrt(dx * dx + dy * dy);
    }
  }

  /**
   * Generate F2 - F1 (useful for creating cell edges)
   * This creates high values at cell boundaries
   */
  edgeNoise2D(x: number, y: number, options: WorleyNoiseOptions = {}): number {
    const { cellSize = 1.0, jitter = 1.0, distanceFunc = 'euclidean' } = options;

    const scaledX = x / cellSize;
    const scaledY = y / cellSize;
    const cellX = Math.floor(scaledX);
    const cellY = Math.floor(scaledY);

    const distances: number[] = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighborX = cellX + dx;
        const neighborY = cellY + dy;

        const randomX = this.random(neighborX, neighborY);
        const randomY = this.random(neighborX + 0.1, neighborY + 0.1);

        const featureX = neighborX + randomX * jitter + (1 - jitter) * 0.5;
        const featureY = neighborY + randomY * jitter + (1 - jitter) * 0.5;

        const dist = this.distance(
          scaledX,
          scaledY,
          featureX,
          featureY,
          distanceFunc,
        );

        distances.push(dist);
      }
    }

    distances.sort((a, b) => a - b);

    // F2 - F1 creates high values at cell boundaries
    const f1 = distances[0];
    const f2 = distances[1];
    const edge = f2 - f1;

    // Normalize
    return Math.min(edge / cellSize, 1.0);
  }

  /**
   * Generate multi-octave Worley noise (for richer detail)
   * Similar to FBM but for Worley noise
   */
  fbm2D(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0,
    options: WorleyNoiseOptions = {},
  ): number {
    let value = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const noiseValue = this.noise2D(x * frequency, y * frequency, {
        ...options,
        cellSize: (options.cellSize ?? 1.0) / frequency,
      });

      value += noiseValue * amplitude;
      maxValue += amplitude;

      amplitude *= persistence;
      frequency *= lacunarity;
    }

    // Normalize to [0, 1]
    return value / maxValue;
  }
}
