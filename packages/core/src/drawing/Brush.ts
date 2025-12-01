import { Point, Polygon } from '../foundation/geometry';
import { noise } from '../foundation/noise';
import { poly } from '../utils/svg';

export interface BrushStrokeOptions {
  /** Stroke width at the start */
  width?: number;
  /** Color (rgba format recommended) */
  color?: string;
  /** Pressure curve function (0-1 input, 0-1 output) */
  pressure?: (t: number) => number;
  /** Ink concentration at start (0-1) */
  inkStart?: number;
  /** Ink concentration at end (0-1) */
  inkEnd?: number;
  /** Noise amount for edge variation (0-1) */
  noise?: number;
  /** Flying white effect intensity (0-1) - 飞白 */
  flyingWhite?: number;
  /** Brush angle in radians */
  angle?: number;
  /** Texture density (number of texture marks) */
  texture?: number;
}

/**
 * Brush - Generate realistic Chinese calligraphy brush strokes
 *
 * Simulates traditional brush painting with:
 * - 起笔 (qǐbǐ): Initial stroke entry
 * - 行笔 (xíngbǐ): Stroke progression with ink depletion
 * - 收笔 (shōubǐ): Stroke ending with flying white effect
 * - 笔锋 (bǐfēng): Brush tip variations
 */
export class Brush {
  /**
   * Generate a brush stroke along a path
   * @param points - Array of points defining the stroke path
   * @param options - Brush stroke options
   * @returns SVG string representing the brush stroke
   */
  static stroke(points: Polygon, options: BrushStrokeOptions = {}): string {
    if (points.length < 2) {
      return '';
    }

    const width = options.width ?? 8;
    const color = options.color ?? 'rgba(50,50,50,0.9)';
    const pressure = options.pressure ?? ((t: number) => {
      // Default: pressure increase at start, stable middle, decrease at end
      if (t < 0.2) return 0.5 + t * 2.5; // Quick build-up
      if (t > 0.8) return 1.0 - (t - 0.8) * 2.5; // Quick release
      return 1.0; // Stable middle
    });
    const inkStart = options.inkStart ?? 0.9;
    const inkEnd = options.inkEnd ?? 0.3;
    const noiseAmount = options.noise ?? 0.6;
    const flyingWhite = options.flyingWhite ?? 0.3;
    const angle = options.angle ?? 0;
    const textureCount = options.texture ?? 5;

    let svg = '';
    const n0 = Math.random() * 10;

    // Parse color components
    const colorMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const r = colorMatch ? parseInt(colorMatch[1]) : 50;
    const g = colorMatch ? parseInt(colorMatch[2]) : 50;
    const b = colorMatch ? parseInt(colorMatch[3]) : 50;
    const baseAlpha = colorMatch && colorMatch[4] ? parseFloat(colorMatch[4]) : 0.9;

    // Generate main stroke body
    const leftEdge: Point[] = [];
    const rightEdge: Point[] = [];

    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1);
      const point = points[i];

      // Calculate stroke direction
      let direction: number;
      if (i === 0) {
        direction = Math.atan2(points[1][1] - point[1], points[1][0] - point[0]);
      } else if (i === points.length - 1) {
        direction = Math.atan2(point[1] - points[i - 1][1], point[0] - points[i - 1][0]);
      } else {
        const d1 = Math.atan2(point[1] - points[i - 1][1], point[0] - points[i - 1][0]);
        const d2 = Math.atan2(points[i + 1][1] - point[1], points[i + 1][0] - point[0]);
        direction = (d1 + d2) / 2;
      }

      // Calculate width based on pressure
      const pressureValue = pressure(t);
      let currentWidth = width * pressureValue;

      // Add noise to width
      const widthNoise = noise.noise(i * 0.3, n0) * noiseAmount;
      currentWidth *= (1 - noiseAmount * 0.5 + widthNoise * 0.5);

      // Add flying white effect at the end
      if (t > 0.7) {
        const flyingWhiteFactor = (t - 0.7) / 0.3;
        const flyingWhiteNoise = noise.noise(i * 0.5, n0 + 5);
        if (flyingWhiteNoise < flyingWhite * flyingWhiteFactor) {
          currentWidth *= 0.3 + Math.random() * 0.4; // Random gaps
        }
      }

      // Calculate perpendicular direction for width
      const perpDir = direction + Math.PI / 2 + angle;

      // Edge noise for organic feel
      const leftNoise = (noise.noise(i * 0.2, n0 + 1) - 0.5) * noiseAmount * 2;
      const rightNoise = (noise.noise(i * 0.2, n0 + 2) - 0.5) * noiseAmount * 2;

      leftEdge.push([
        point[0] + Math.cos(perpDir) * (currentWidth / 2 + leftNoise),
        point[1] + Math.sin(perpDir) * (currentWidth / 2 + leftNoise)
      ]);

      rightEdge.push([
        point[0] - Math.cos(perpDir) * (currentWidth / 2 + rightNoise),
        point[1] - Math.sin(perpDir) * (currentWidth / 2 + rightNoise)
      ]);
    }

    // Create main stroke polygon
    const strokePolygon: Polygon = [...leftEdge, ...rightEdge.reverse()];

    // Draw main stroke with ink gradient
    const avgAlpha = (inkStart + inkEnd) / 2 * baseAlpha;
    svg += poly(strokePolygon, {
      fil: `rgba(${r},${g},${b},${avgAlpha.toFixed(3)})`,
      str: 'none',
      wid: 0
    });

    // Add darker stroke edges for depth
    const edgeAlpha = Math.min(baseAlpha * 1.2, 1.0);
    const edgeColor = `rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},${edgeAlpha.toFixed(3)})`;

    // Left edge
    const leftEdgePath = leftEdge.map((p, i) => {
      const t = i / (leftEdge.length - 1);
      const ink = inkStart + (inkEnd - inkStart) * t;
      return p;
    });

    // Draw edges as strokes
    if (leftEdge.length > 1) {
      svg += this.generateEdgeStroke(leftEdge, edgeColor, 0.8, noiseAmount);
      svg += this.generateEdgeStroke(rightEdge, edgeColor, 0.8, noiseAmount);
    }

    // Add texture marks for paper absorption effect (渗透效果)
    for (let i = 0; i < textureCount; i++) {
      const t = Math.random();
      const idx = Math.floor(t * (points.length - 1));
      const point = points[idx];

      const ink = inkStart + (inkEnd - inkStart) * t;
      const texAlpha = ink * baseAlpha * (0.1 + Math.random() * 0.2);

      const offsetX = (Math.random() - 0.5) * width * 0.6;
      const offsetY = (Math.random() - 0.5) * width * 0.6;

      svg += this.generateTextureBlob(
        point[0] + offsetX,
        point[1] + offsetY,
        width * (0.2 + Math.random() * 0.3),
        `rgba(${r},${g},${b},${texAlpha.toFixed(3)})`
      );
    }

    return svg;
  }

  /**
   * Generate edge stroke for depth
   */
  private static generateEdgeStroke(
    points: Point[],
    color: string,
    width: number,
    noiseAmount: number
  ): string {
    if (points.length < 2) return '';

    const segments: string[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      segments.push(`${i === 0 ? 'M' : 'L'}${points[i][0].toFixed(2)},${points[i][1].toFixed(2)}`);
    }
    segments.push(`L${points[points.length - 1][0].toFixed(2)},${points[points.length - 1][1].toFixed(2)}`);

    return `<path d="${segments.join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${0.6 + Math.random() * 0.2}"/>`;
  }

  /**
   * Generate small texture blob for ink absorption
   */
  private static generateTextureBlob(
    x: number,
    y: number,
    size: number,
    color: string
  ): string {
    const points: Point[] = [];
    const sides = 8;
    const n0 = Math.random() * 10;

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const noiseFactor = 0.7 + noise.noise(i * 0.5, n0) * 0.6;
      const r = size * noiseFactor;
      points.push([
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r
      ]);
    }

    return poly(points, { fil: color, str: 'none', wid: 0 });
  }

  /**
   * Generate a single brush dot (like a stamp)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param options - Brush stroke options
   * @returns SVG string
   */
  static dot(x: number, y: number, options: Partial<BrushStrokeOptions> = {}): string {
    const width = options.width ?? 10;
    const color = options.color ?? 'rgba(50,50,50,0.9)';
    const noiseAmount = options.noise ?? 0.7;
    const textureCount = options.texture ?? 3;

    let svg = '';
    const n0 = Math.random() * 10;

    // Parse color
    const colorMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const r = colorMatch ? parseInt(colorMatch[1]) : 50;
    const g = colorMatch ? parseInt(colorMatch[2]) : 50;
    const b = colorMatch ? parseInt(colorMatch[3]) : 50;
    const baseAlpha = colorMatch && colorMatch[4] ? parseFloat(colorMatch[4]) : 0.9;

    // Main dot body
    const points: Point[] = [];
    const sides = 16;

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2;
      const noiseFactor = 0.8 + noise.noise(i * 0.3, n0) * noiseAmount * 0.4;
      const r = width / 2 * noiseFactor;
      points.push([
        x + Math.cos(angle) * r,
        y + Math.sin(angle) * r
      ]);
    }

    svg += poly(points, {
      fil: `rgba(${r},${g},${b},${baseAlpha.toFixed(3)})`,
      str: `rgba(${Math.max(0, r - 30)},${Math.max(0, g - 30)},${Math.max(0, b - 30)},${Math.min(1, baseAlpha * 1.2).toFixed(3)})`,
      wid: 0.5
    });

    // Add texture blobs
    for (let i = 0; i < textureCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * width * 0.3;
      const texX = x + Math.cos(angle) * dist;
      const texY = y + Math.sin(angle) * dist;
      const texSize = width * (0.15 + Math.random() * 0.2);
      const texAlpha = baseAlpha * (0.2 + Math.random() * 0.3);

      svg += this.generateTextureBlob(
        texX,
        texY,
        texSize,
        `rgba(${r},${g},${b},${texAlpha.toFixed(3)})`
      );
    }

    return svg;
  }

  /**
   * Generate a complete brush stroke with varying ink and pressure
   * This is a convenience method that creates a natural-looking stroke
   */
  static naturalStroke(points: Polygon, options: Partial<BrushStrokeOptions> = {}): string {
    return this.stroke(points, {
      width: options.width ?? 8,
      color: options.color ?? 'rgba(50,50,50,0.85)',
      pressure: (t: number) => {
        // Natural pressure curve: soft start, firm middle, soft end
        if (t < 0.15) {
          return 0.4 + t * 4; // Build up
        } else if (t > 0.85) {
          return 1.0 - (t - 0.85) * 3.33; // Release
        } else {
          // Slight variation in the middle
          return 0.95 + Math.sin(t * Math.PI * 3) * 0.05;
        }
      },
      inkStart: 0.9,
      inkEnd: 0.4,
      noise: options.noise ?? 0.6,
      flyingWhite: options.flyingWhite ?? 0.35,
      angle: options.angle ?? 0,
      texture: options.texture ?? 6,
      ...options
    });
  }
}

// Export convenience function
export function brushStroke(points: Polygon, options: BrushStrokeOptions = {}): string {
  return Brush.stroke(points, options);
}

export function brushDot(x: number, y: number, options: Partial<BrushStrokeOptions> = {}): string {
  return Brush.dot(x, y, options);
}

export function naturalBrushStroke(points: Polygon, options: Partial<BrushStrokeOptions> = {}): string {
  return Brush.naturalStroke(points, options);
}
