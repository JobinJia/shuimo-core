import { Point, Polygon } from "../../foundation/geometry";
import { noise } from "../../foundation/noise";
import { prng } from "../../foundation/random";
import { Brush } from "../../drawing/Brush";

export interface OrchidOptions {
  /** Number of leaves */
  leafCount?: number;
  /** Maximum leaf length */
  leafLength?: number;
  /** Whether to include flowers */
  hasFlower?: boolean;
  /** Number of flowers */
  flowerCount?: number;
  /** Color */
  col?: string;
  /** Flower color */
  flowerCol?: string;
}

/**
 * Orchid - Generate Chinese ink painting style orchid (兰花草)
 *
 * Implements traditional xieyi (写意) style orchid painting with:
 * - Elegant flowing leaves (一气呵成的长撇)
 * - Delicate small flowers
 * - Natural organic curves
 */
export class Orchid {
  /**
   * Generate a complete orchid composition
   * @param xoff - X offset (base position)
   * @param yoff - Y offset (base position)
   * @param seed - Random seed
   * @param options - Orchid options
   * @returns SVG string
   */
  static generate(xoff: number, yoff: number, seed: number, options: OrchidOptions = {}): string {
    prng.seed(seed);

    const leafCount = options.leafCount ?? 5;
    const leafLength = options.leafLength ?? 150;
    const hasFlower = options.hasFlower ?? true;
    const flowerCount = options.flowerCount ?? 2;
    const col = options.col ?? "rgba(50,70,50,0.85)";
    const flowerCol = options.flowerCol ?? "rgba(80,60,80,0.8)";

    let svg = "";

    // Generate leaves first (they go behind flowers)
    svg += this.generateLeaves(xoff, yoff, leafCount, leafLength, col);

    // Generate flowers on stems
    if (hasFlower) {
      svg += this.generateFlowers(xoff, yoff, flowerCount, leafLength, col, flowerCol);
    }

    return svg;
  }

  /**
   * Generate orchid leaves
   */
  private static generateLeaves(
    x: number,
    y: number,
    count: number,
    maxLength: number,
    col: string,
  ): string {
    let svg = "";

    // Distribute leaves in a natural fan pattern
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;

      // Spread angle from -60 to 60 degrees
      const baseAngle = -Math.PI / 3 + t * ((Math.PI * 2) / 3);
      const angleVariation = (prng.next() - 0.5) * 0.3;
      const angle = baseAngle + angleVariation;

      // Vary the length
      const length = maxLength * (0.7 + prng.next() * 0.5);

      // Vary the curve direction and amount
      const curveDir = prng.next() < 0.5 ? 1 : -1;
      const curveAmount = 0.2 + prng.next() * 0.3;

      // Slight position offset at base
      const offsetX = (prng.next() - 0.5) * 8;
      const offsetY = (prng.next() - 0.5) * 5;

      svg += this.generateLeaf(
        x + offsetX,
        y + offsetY,
        angle,
        length,
        curveDir * curveAmount,
        col,
      );
    }

    return svg;
  }

  /**
   * Generate a single orchid leaf
   *
   * The leaf is drawn with one continuous flowing stroke (一气呵成)
   * starting thick at the base and tapering to a fine point
   */
  private static generateLeaf(
    x: number,
    y: number,
    angle: number,
    length: number,
    curve: number,
    col: string,
  ): string {
    const points: Polygon = [];
    const steps = 25;
    const n0 = prng.next() * 100;

    // Generate curved leaf path
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // S-curve for natural leaf shape
      // Use cubic bezier-like interpolation
      const curveOffset = Math.sin(t * Math.PI) * length * curve;

      // Add subtle noise for organic feel
      const noiseOffset = noise.noise(t * 3, n0) * length * 0.02;

      // Calculate position along the leaf
      const px =
        x +
        Math.cos(angle) * length * t +
        Math.cos(angle + Math.PI / 2) * (curveOffset + noiseOffset);
      const py =
        y -
        Math.sin(angle) * length * t -
        Math.sin(angle + Math.PI / 2) * (curveOffset + noiseOffset);

      points.push([px, py]);
    }

    // Width of the leaf
    const width = length * 0.04;

    return Brush.stroke(points, {
      width: width,
      color: col,
      pressure: (t: number) => {
        // Gradual taper from base to tip
        // Thick at base, thin at tip
        if (t < 0.1) {
          return 0.6 + t * 4; // Build up at base
        } else {
          // Smooth taper to tip
          return 1.0 * Math.pow(1 - (t - 0.1) / 0.9, 0.5);
        }
      },
      inkStart: 0.9,
      inkEnd: 0.4,
      noise: 0.3,
      flyingWhite: 0.15,
      texture: 3,
    });
  }

  /**
   * Generate orchid flowers on stems
   */
  private static generateFlowers(
    x: number,
    y: number,
    count: number,
    leafLength: number,
    stemCol: string,
    flowerCol: string,
  ): string {
    let svg = "";

    for (let i = 0; i < count; i++) {
      // Each flower has its own stem
      const stemAngle = -Math.PI / 2 + ((prng.next() - 0.5) * Math.PI) / 3;
      const stemLength = leafLength * (0.5 + prng.next() * 0.4);
      const stemCurve = (prng.next() - 0.5) * 0.4;

      // Generate stem
      svg += this.generateStem(x, y, stemAngle, stemLength, stemCurve, stemCol);

      // Calculate flower position at stem end
      const stemEndX =
        x +
        Math.cos(stemAngle) * stemLength +
        Math.cos(stemAngle + Math.PI / 2) * Math.sin(Math.PI) * stemLength * stemCurve;
      const stemEndY =
        y -
        Math.sin(stemAngle) * stemLength -
        Math.sin(stemAngle + Math.PI / 2) * Math.sin(Math.PI) * stemLength * stemCurve;

      // Generate flower
      svg += this.generateFlower(stemEndX, stemEndY, flowerCol);
    }

    return svg;
  }

  /**
   * Generate a flower stem
   */
  private static generateStem(
    x: number,
    y: number,
    angle: number,
    length: number,
    curve: number,
    col: string,
  ): string {
    const points: Polygon = [];
    const steps = 15;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curveOffset = Math.sin(t * Math.PI) * length * curve;

      const px = x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI / 2) * curveOffset;
      const py = y - Math.sin(angle) * length * t - Math.sin(angle + Math.PI / 2) * curveOffset;

      points.push([px, py]);
    }

    return Brush.stroke(points, {
      width: 2,
      color: col,
      pressure: (t: number) => 0.8 + Math.sin(t * Math.PI) * 0.2,
      inkStart: 0.8,
      inkEnd: 0.6,
      noise: 0.3,
      flyingWhite: 0.1,
      texture: 1,
    });
  }

  /**
   * Generate an orchid flower
   *
   * Traditional orchid flowers have:
   * - 3 outer sepals (longer, spread out)
   * - 2 inner petals (shorter, more upright)
   * - 1 lip (labellum, distinctive shape)
   */
  private static generateFlower(x: number, y: number, col: string): string {
    let svg = "";
    const petalLength = 15 + prng.next() * 10;

    // 3 outer sepals
    const sepalAngles = [
      -Math.PI * 0.7, // Upper left
      -Math.PI * 0.3, // Upper right
      Math.PI * 0.5, // Lower
    ];

    for (const angle of sepalAngles) {
      svg += this.generatePetal(
        x,
        y,
        angle + (prng.next() - 0.5) * 0.2,
        petalLength * (0.9 + prng.next() * 0.2),
        petalLength * 0.15,
        col,
      );
    }

    // 2 inner petals
    const innerAngles = [-Math.PI * 0.55, -Math.PI * 0.45];
    for (const angle of innerAngles) {
      svg += this.generatePetal(
        x,
        y,
        angle + (prng.next() - 0.5) * 0.15,
        petalLength * 0.7,
        petalLength * 0.12,
        col,
      );
    }

    // Center dot (flower heart)
    svg += Brush.dot(x, y, {
      width: 3,
      color: this.adjustColorBrightness(col, 0.7),
      noise: 0.5,
    });

    return svg;
  }

  /**
   * Generate a single flower petal
   */
  private static generatePetal(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    col: string,
  ): string {
    const points: Polygon = [];
    const steps = 12;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      // Slight curve
      const curveOffset = Math.sin(t * Math.PI) * length * 0.1 * (prng.next() - 0.5);

      const px = x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI / 2) * curveOffset;
      const py = y - Math.sin(angle) * length * t - Math.sin(angle + Math.PI / 2) * curveOffset;

      points.push([px, py]);
    }

    return Brush.stroke(points, {
      width: width,
      color: col,
      pressure: (t: number) => {
        // Petal shape: thin at both ends, wide in middle
        return Math.sin(t * Math.PI) * 0.8 + 0.2;
      },
      inkStart: 0.8,
      inkEnd: 0.5,
      noise: 0.4,
      flyingWhite: 0.1,
      texture: 1,
    });
  }

  /**
   * Adjust color brightness
   */
  private static adjustColorBrightness(color: string, factor: number): string {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = Math.min(255, Math.floor(parseInt(match[1]) * factor));
      const g = Math.min(255, Math.floor(parseInt(match[2]) * factor));
      const b = Math.min(255, Math.floor(parseInt(match[3]) * factor));
      const a = match[4] ? parseFloat(match[4]) : 1;
      return `rgba(${r},${g},${b},${a.toFixed(3)})`;
    }
    return color;
  }

  /**
   * Generate just orchid leaves (for decoration)
   */
  static leaves(
    xoff: number,
    yoff: number,
    seed: number,
    options: { count?: number; length?: number; col?: string } = {},
  ): string {
    prng.seed(seed);

    const count = options.count ?? 5;
    const length = options.length ?? 150;
    const col = options.col ?? "rgba(50,70,50,0.85)";

    return this.generateLeaves(xoff, yoff, count, length, col);
  }
}

// Export convenience functions
export function orchid(xoff: number, yoff: number, seed: number, options?: OrchidOptions): string {
  return Orchid.generate(xoff, yoff, seed, options);
}

export function orchidLeaves(
  xoff: number,
  yoff: number,
  seed: number,
  options?: { count?: number; length?: number; col?: string },
): string {
  return Orchid.leaves(xoff, yoff, seed, options);
}
