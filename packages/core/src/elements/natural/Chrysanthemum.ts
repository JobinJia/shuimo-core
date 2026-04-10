import { Point, Polygon } from "../../foundation/geometry";
import { noise } from "../../foundation/noise";
import { prng } from "../../foundation/random";
import { Brush } from "../../drawing/Brush";
import { stroke } from "../../drawing/Stroke";

export interface ChrysanthemumOptions {
  /** Flower size (radius) */
  size?: number;
  /** Number of petal layers */
  petalLayers?: number;
  /** Base number of petals per layer */
  petalCount?: number;
  /** Whether to include stem */
  withStem?: boolean;
  /** Whether to include leaves */
  withLeaves?: boolean;
  /** Flower color */
  col?: string;
  /** Stem/leaf color */
  stemCol?: string;
}

/**
 * Chrysanthemum - Generate Chinese ink painting style chrysanthemum (菊花)
 *
 * Implements traditional xieyi (写意) style chrysanthemum painting with:
 * - Multiple layers of radiating petals
 * - Inner petals shorter and denser
 * - Outer petals longer and more spread
 */
export class Chrysanthemum {
  /**
   * Generate a complete chrysanthemum composition
   * @param xoff - X offset (flower center)
   * @param yoff - Y offset (flower center)
   * @param seed - Random seed
   * @param options - Chrysanthemum options
   * @returns SVG string
   */
  static generate(
    xoff: number,
    yoff: number,
    seed: number,
    options: ChrysanthemumOptions = {},
  ): string {
    prng.seed(seed);

    const size = options.size ?? 60;
    const petalLayers = options.petalLayers ?? 4;
    const petalCount = options.petalCount ?? 12;
    const withStem = options.withStem ?? true;
    const withLeaves = options.withLeaves ?? true;
    const col = options.col ?? "rgba(180,160,80,0.85)";
    const stemCol = options.stemCol ?? "rgba(60,80,50,0.85)";

    let svg = "";

    // Generate stem first (goes behind flower)
    if (withStem) {
      svg += this.generateStem(xoff, yoff, size * 2.5, stemCol);
    }

    // Generate leaves
    if (withLeaves) {
      svg += this.generateLeaves(xoff, yoff + size * 0.5, size, stemCol);
    }

    // Generate flower
    svg += this.generateFlower(xoff, yoff, size, petalLayers, petalCount, col);

    return svg;
  }

  /**
   * Generate the chrysanthemum flower
   */
  private static generateFlower(
    x: number,
    y: number,
    size: number,
    layers: number,
    basePetalCount: number,
    col: string,
  ): string {
    let svg = "";

    // Generate petals from outer layer to inner
    // This ensures inner petals are drawn on top
    for (let layer = layers - 1; layer >= 0; layer--) {
      const layerT = layer / (layers - 1);

      // Outer layers have longer, fewer petals
      // Inner layers have shorter, more petals
      const layerSize = size * (0.4 + layerT * 0.6);
      const layerPetalCount = Math.floor(basePetalCount * (1 + (1 - layerT) * 0.5));
      const layerRotation = ((prng.next() - 0.5) * Math.PI) / basePetalCount;

      // Slightly different color for each layer (inner darker)
      const layerCol = this.adjustColorBrightness(col, 0.8 + layerT * 0.3);

      svg += this.generatePetalLayer(
        x,
        y,
        layerSize,
        layerPetalCount,
        layerRotation,
        layerCol,
        layerT,
      );
    }

    // Add center
    svg += this.generateFlowerCenter(x, y, size * 0.15, col);

    return svg;
  }

  /**
   * Generate a layer of petals
   */
  private static generatePetalLayer(
    x: number,
    y: number,
    size: number,
    petalCount: number,
    rotation: number,
    col: string,
    layerT: number,
  ): string {
    let svg = "";

    for (let i = 0; i < petalCount; i++) {
      const baseAngle = (i / petalCount) * Math.PI * 2 + rotation;
      const angleVariation = (prng.next() - 0.5) * 0.15;
      const angle = baseAngle + angleVariation;

      // Petal length varies slightly
      const petalLength = size * (0.85 + prng.next() * 0.3);

      // Petal width - outer petals are wider
      const petalWidth = size * 0.08 * (1 + layerT * 0.5);

      // Petal curve - outer petals curve outward more
      const petalCurve = (0.1 + layerT * 0.2) * (prng.next() < 0.5 ? 1 : -1);

      svg += this.generatePetal(x, y, angle, petalLength, petalWidth, petalCurve, col);
    }

    return svg;
  }

  /**
   * Generate a single petal
   *
   * Chrysanthemum petals are thin and elongated,
   * drawn with short strokes (点、短撇)
   */
  private static generatePetal(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    curve: number,
    col: string,
  ): string {
    const points: Polygon = [];
    const steps = 12;
    const n0 = prng.next() * 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // Curved petal path
      const curveOffset = Math.sin(t * Math.PI) * length * curve;
      // Add slight noise for organic feel
      const noiseOffset = noise.noise(t * 2, n0) * length * 0.03;

      const px =
        x +
        Math.cos(angle) * length * t +
        Math.cos(angle + Math.PI / 2) * (curveOffset + noiseOffset);
      const py =
        y +
        Math.sin(angle) * length * t +
        Math.sin(angle + Math.PI / 2) * (curveOffset + noiseOffset);

      points.push([px, py]);
    }

    return Brush.stroke(points, {
      width: width,
      color: col,
      pressure: (t: number) => {
        // Petal shape: slightly thick at base, tapers to point
        if (t < 0.1) {
          return 0.5 + t * 5;
        } else if (t > 0.8) {
          return 1.0 - (t - 0.8) * 4;
        }
        return 1.0;
      },
      inkStart: 0.85,
      inkEnd: 0.5,
      noise: 0.35,
      flyingWhite: 0.15,
      texture: 1,
    });
  }

  /**
   * Generate flower center
   */
  private static generateFlowerCenter(x: number, y: number, size: number, col: string): string {
    let svg = "";
    const darkerCol = this.adjustColorBrightness(col, 0.5);

    // Center disk
    svg += Brush.dot(x, y, {
      width: size,
      color: darkerCol,
      noise: 0.6,
    });

    // Add some small dots for texture
    const dotCount = 5 + Math.floor(prng.next() * 5);
    for (let i = 0; i < dotCount; i++) {
      const angle = prng.next() * Math.PI * 2;
      const dist = prng.next() * size * 0.6;

      svg += Brush.dot(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, {
        width: 1.5,
        color: this.adjustColorBrightness(darkerCol, 0.7),
        noise: 0.7,
      });
    }

    return svg;
  }

  /**
   * Generate stem
   */
  private static generateStem(x: number, y: number, length: number, col: string): string {
    const points: Polygon = [];
    const steps = 15;
    const n0 = prng.next() * 100;

    // Stem curves slightly
    const curve = (prng.next() - 0.5) * 0.2;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curveOffset = Math.sin(t * Math.PI) * length * curve;
      const noiseOffset = noise.noise(t * 2, n0) * 5;

      points.push([x + curveOffset + noiseOffset, y + t * length]);
    }

    return stroke(points, {
      wid: 4,
      col: col,
      noi: 0.3,
      fun: (t: number) => 1 - t * 0.3, // Taper towards bottom
    });
  }

  /**
   * Generate leaves
   */
  private static generateLeaves(x: number, y: number, size: number, col: string): string {
    let svg = "";
    const leafCount = 2 + Math.floor(prng.next() * 2);

    for (let i = 0; i < leafCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const leafAngle = side * (Math.PI / 4 + (prng.next() * Math.PI) / 6);
      const leafLength = size * (0.8 + prng.next() * 0.4);

      const leafY = y + size * (0.3 + prng.next() * 0.5);

      svg += this.generateLeaf(x, leafY, leafAngle, leafLength, col);
    }

    return svg;
  }

  /**
   * Generate a chrysanthemum leaf
   *
   * Chrysanthemum leaves have a distinctive lobed/serrated shape
   */
  private static generateLeaf(
    x: number,
    y: number,
    angle: number,
    length: number,
    col: string,
  ): string {
    let svg = "";
    const width = length * 0.4;

    // Main leaf stroke
    const mainPoints: Polygon = [];
    const steps = 15;
    const n0 = prng.next() * 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const curve = Math.sin(t * Math.PI) * 0.15;
      const noiseOffset = noise.noise(t * 3, n0) * length * 0.02;

      mainPoints.push([
        x +
          Math.cos(angle) * length * t +
          Math.cos(angle + Math.PI / 2) * (length * curve + noiseOffset),
        y +
          Math.sin(angle) * length * t +
          Math.sin(angle + Math.PI / 2) * (length * curve + noiseOffset),
      ]);
    }

    svg += Brush.stroke(mainPoints, {
      width: width * 0.15,
      color: col,
      pressure: (t: number) => {
        if (t < 0.1) return 0.5 + t * 5;
        if (t > 0.85) return 1.0 - (t - 0.85) * 6;
        return 1.0;
      },
      inkStart: 0.85,
      inkEnd: 0.5,
      noise: 0.4,
      flyingWhite: 0.1,
      texture: 2,
    });

    // Add lobes (simplified serrated edges)
    const lobeCount = 3 + Math.floor(prng.next() * 2);
    for (let i = 0; i < lobeCount; i++) {
      const t = 0.2 + (i / lobeCount) * 0.6;
      const idx = Math.floor(t * (mainPoints.length - 1));
      const pt = mainPoints[idx];

      // Alternate sides
      const side = i % 2 === 0 ? 1 : -1;
      const lobeAngle = angle + side * (Math.PI / 3 + (prng.next() * Math.PI) / 6);
      const lobeLength = width * (0.4 + prng.next() * 0.3);

      const lobePoints: Polygon = [
        pt,
        [pt[0] + Math.cos(lobeAngle) * lobeLength, pt[1] + Math.sin(lobeAngle) * lobeLength],
      ];

      svg += stroke(lobePoints, {
        wid: 2,
        col: col,
        noi: 0.3,
        fun: (p: number) => 1 - p * 0.5,
      });
    }

    return svg;
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
   * Generate just the flower (without stem/leaves)
   */
  static flower(
    xoff: number,
    yoff: number,
    seed: number,
    options: { size?: number; layers?: number; petalCount?: number; col?: string } = {},
  ): string {
    prng.seed(seed);

    const size = options.size ?? 60;
    const layers = options.layers ?? 4;
    const petalCount = options.petalCount ?? 12;
    const col = options.col ?? "rgba(180,160,80,0.85)";

    return this.generateFlower(xoff, yoff, size, layers, petalCount, col);
  }
}

// Export convenience functions
export function chrysanthemum(
  xoff: number,
  yoff: number,
  seed: number,
  options?: ChrysanthemumOptions,
): string {
  return Chrysanthemum.generate(xoff, yoff, seed, options);
}

export function chrysanthemumFlower(
  xoff: number,
  yoff: number,
  seed: number,
  options?: { size?: number; layers?: number; petalCount?: number; col?: string },
): string {
  return Chrysanthemum.flower(xoff, yoff, seed, options);
}
