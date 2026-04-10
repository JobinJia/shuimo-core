import { Point, Polygon } from "../../foundation/geometry";
import { noise } from "../../foundation/noise";
import { prng } from "../../foundation/random";
import { Brush } from "../../drawing/Brush";
import { stroke } from "../../drawing/Stroke";
import { blob } from "../../drawing/Blob";

export interface WinterPlumOptions {
  /** Height of the main branch */
  hei?: number;
  /** Width of the main branch */
  wid?: number;
  /** Number of main branches */
  branches?: number;
  /** Flower density (0-1) */
  flowerDensity?: number;
  /** Flower color */
  flowerColor?: string;
  /** Whether to include flower buds */
  withBuds?: boolean;
  /** Branch color */
  col?: string;
}

interface BranchPoint {
  x: number;
  y: number;
  angle: number;
  depth: number;
}

/**
 * WinterPlum - Generate Chinese ink painting style winter plum blossoms (腊梅)
 *
 * Implements traditional xieyi (写意) style plum blossom painting with:
 * - Gnarled, curved branches (苍劲弯曲)
 * - Five-petaled flowers scattered along branches
 * - Flower buds as accents
 */
export class WinterPlum {
  /**
   * Generate a complete winter plum composition
   * @param xoff - X offset (base position)
   * @param yoff - Y offset (base position)
   * @param seed - Random seed
   * @param options - Winter plum options
   * @returns SVG string
   */
  static generate(
    xoff: number,
    yoff: number,
    seed: number,
    options: WinterPlumOptions = {},
  ): string {
    prng.seed(seed);

    const hei = options.hei ?? 200;
    const wid = options.wid ?? 10;
    const branches = options.branches ?? 2;
    const flowerDensity = options.flowerDensity ?? 0.4;
    const flowerColor = options.flowerColor ?? "rgba(180,150,100,0.85)";
    const withBuds = options.withBuds ?? true;
    const col = options.col ?? "rgba(60,50,40,0.9)";

    let svg = "";

    // Collect all branch points for flower placement
    const branchPoints: BranchPoint[] = [];

    // Generate main branches
    for (let i = 0; i < branches; i++) {
      const branchAngle = -Math.PI / 2 + ((prng.next() - 0.5) * Math.PI) / 2;
      const branchLength = hei * (0.7 + prng.next() * 0.5);
      const branchWid = wid * (0.8 + prng.next() * 0.4);

      svg += this.generateBranch(
        xoff + (prng.next() - 0.5) * wid * 2,
        yoff,
        branchAngle,
        branchLength,
        branchWid,
        col,
        3, // max depth
        branchPoints,
      );
    }

    // Add flowers at collected branch points
    svg += this.addFlowers(branchPoints, flowerDensity, flowerColor, withBuds);

    return svg;
  }

  /**
   * Generate a branch with recursive sub-branches
   */
  private static generateBranch(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    col: string,
    depth: number,
    branchPoints: BranchPoint[],
  ): string {
    if (depth <= 0 || length < 10 || width < 1) {
      return "";
    }

    let svg = "";
    const n0 = prng.next() * 100;

    // Generate curved branch path
    const points: Polygon = [];
    const steps = Math.max(10, Math.floor(length / 5));

    // Branch bend parameters
    const bendAmount = 0.3 + prng.next() * 0.4;
    const bendDir = prng.next() < 0.5 ? 1 : -1;

    let currentX = x;
    let currentY = y;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // S-curve bend for natural look
      const bend = Math.sin(t * Math.PI) * bendAmount * bendDir + noise.noise(t * 3, n0) * 0.15;

      const px = x + Math.cos(angle) * length * t + Math.cos(angle + Math.PI / 2) * length * bend;
      const py = y - Math.sin(angle) * length * t - Math.sin(angle + Math.PI / 2) * length * bend;

      points.push([px, py]);

      // Collect points for flower placement
      if (i > 0 && i % 3 === 0) {
        branchPoints.push({
          x: px,
          y: py,
          angle: angle + (bend * Math.PI) / 4,
          depth: depth,
        });
      }

      currentX = px;
      currentY = py;
    }

    // Draw the branch with bark texture effect
    svg += this.drawBranchStroke(points, width, col, depth);

    // Generate sub-branches
    const subBranchCount = depth > 1 ? Math.floor(1 + prng.next() * 2) : 0;

    for (let i = 0; i < subBranchCount; i++) {
      // Pick a point along the branch for sub-branch origin
      const branchT = 0.3 + prng.next() * 0.5;
      const branchIdx = Math.floor(branchT * (points.length - 1));
      const branchPt = points[branchIdx];

      // Sub-branch angles away from main branch
      const subAngle =
        angle + (prng.next() < 0.5 ? 1 : -1) * (Math.PI / 4 + (prng.next() * Math.PI) / 4);
      const subLength = length * (0.4 + prng.next() * 0.3);
      const subWidth = width * (0.5 + prng.next() * 0.3);

      svg += this.generateBranch(
        branchPt[0],
        branchPt[1],
        subAngle,
        subLength,
        subWidth,
        col,
        depth - 1,
        branchPoints,
      );
    }

    return svg;
  }

  /**
   * Draw branch with ink painting style
   */
  private static drawBranchStroke(
    points: Polygon,
    width: number,
    col: string,
    depth: number,
  ): string {
    // Main branch body
    let svg = stroke(points, {
      wid: width,
      col: col,
      noi: 0.4,
      fun: (t: number) => {
        // Taper from thick to thin, with some variation
        const base = 1 - t * 0.5;
        const variation = Math.sin(t * Math.PI * 3) * 0.1;
        return base + variation;
      },
    });

    // Add bark texture for main branches
    if (depth >= 2 && width > 4) {
      svg += this.addBarkTexture(points, width, col);
    }

    return svg;
  }

  /**
   * Add bark texture strokes to a branch
   */
  private static addBarkTexture(points: Polygon, width: number, col: string): string {
    let svg = "";
    const n0 = prng.next() * 100;

    // Add a few texture lines along the branch
    const textureCount = Math.floor(points.length / 5);

    for (let i = 0; i < textureCount; i++) {
      if (prng.next() > 0.5) continue;

      const idx = Math.floor(prng.next() * (points.length - 2)) + 1;
      const pt = points[idx];

      // Short perpendicular strokes for bark texture
      const angle =
        Math.atan2(
          points[idx + 1][1] - points[idx - 1][1],
          points[idx + 1][0] - points[idx - 1][0],
        ) +
        Math.PI / 2;

      const texLength = width * (0.3 + prng.next() * 0.4);
      const texPoints: Polygon = [
        [pt[0] - Math.cos(angle) * texLength, pt[1] - Math.sin(angle) * texLength],
        [pt[0] + Math.cos(angle) * texLength, pt[1] + Math.sin(angle) * texLength],
      ];

      svg += stroke(texPoints, {
        wid: 1,
        col: this.adjustColorAlpha(col, 0.6),
        noi: 0.3,
        fun: () => 0.8,
      });
    }

    return svg;
  }

  /**
   * Add flowers and buds at branch points
   */
  private static addFlowers(
    branchPoints: BranchPoint[],
    density: number,
    flowerColor: string,
    withBuds: boolean,
  ): string {
    let svg = "";

    for (const pt of branchPoints) {
      if (prng.next() > density) continue;

      // Decide whether to place flower or bud
      const isFlower = prng.next() > 0.3 || !withBuds;

      if (isFlower) {
        // Offset from branch
        const offsetX = (prng.next() - 0.5) * 10;
        const offsetY = (prng.next() - 0.5) * 10;

        svg += this.generateFlower(
          pt.x + offsetX,
          pt.y + offsetY,
          flowerColor,
          8 + prng.next() * 6, // flower size
        );
      } else if (withBuds) {
        svg += this.generateBud(
          pt.x + (prng.next() - 0.5) * 5,
          pt.y + (prng.next() - 0.5) * 5,
          flowerColor,
        );
      }
    }

    return svg;
  }

  /**
   * Generate a five-petaled plum flower
   */
  private static generateFlower(x: number, y: number, col: string, size: number): string {
    let svg = "";
    const petalCount = 5;

    // Generate 5 petals evenly spaced
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
      const angleVariation = (prng.next() - 0.5) * 0.2;

      svg += this.generatePetal(x, y, angle + angleVariation, size, col);
    }

    // Flower center (stamens)
    svg += this.generateFlowerCenter(x, y, size * 0.4, col);

    return svg;
  }

  /**
   * Generate a single flower petal
   */
  private static generatePetal(
    x: number,
    y: number,
    angle: number,
    size: number,
    col: string,
  ): string {
    const petalLength = size;
    const petalWidth = size * 0.6;

    // Generate petal shape using blob
    const cx = x + Math.cos(angle) * petalLength * 0.5;
    const cy = y + Math.sin(angle) * petalLength * 0.5;

    // Use blob for organic petal shape
    const petalSvg = blob(cx, cy, {
      len: petalLength,
      wid: petalWidth,
      ang: angle,
      col: col,
      ret: 0,
    });

    return petalSvg as string;
  }

  /**
   * Generate flower center with stamens
   */
  private static generateFlowerCenter(x: number, y: number, size: number, col: string): string {
    let svg = "";
    const stamenCount = 5 + Math.floor(prng.next() * 4);
    const darkerCol = this.adjustColorBrightness(col, 0.6);

    // Center dot
    svg += Brush.dot(x, y, {
      width: size * 0.8,
      color: darkerCol,
      noise: 0.5,
    });

    // Small dots around center for stamens
    for (let i = 0; i < stamenCount; i++) {
      const angle = prng.next() * Math.PI * 2;
      const dist = size * (0.4 + prng.next() * 0.4);

      svg += Brush.dot(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, {
        width: 2,
        color: darkerCol,
        noise: 0.6,
      });
    }

    return svg;
  }

  /**
   * Generate a flower bud
   */
  private static generateBud(x: number, y: number, col: string): string {
    const budSize = 4 + prng.next() * 3;
    const budAngle = -Math.PI / 2 + ((prng.next() - 0.5) * Math.PI) / 3;

    // Bud is a simple elongated dot
    const points: Polygon = [];
    const steps = 8;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const len = budSize * (0.5 + Math.sin(t * Math.PI) * 0.5);

      points.push([x + Math.cos(budAngle) * budSize * t, y + Math.sin(budAngle) * budSize * t]);
    }

    return Brush.stroke(points, {
      width: budSize * 0.6,
      color: col,
      pressure: (t: number) => Math.sin(t * Math.PI),
      inkStart: 0.8,
      inkEnd: 0.6,
      noise: 0.3,
      texture: 1,
    });
  }

  /**
   * Adjust color alpha
   */
  private static adjustColorAlpha(color: string, factor: number): string {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] ? parseFloat(match[4]) : 1;
      const newA = Math.min(1, a * factor);
      return `rgba(${r},${g},${b},${newA.toFixed(3)})`;
    }
    return color;
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
   * Generate just plum blossoms (without branches)
   */
  static blossoms(
    xoff: number,
    yoff: number,
    seed: number,
    options: { count?: number; size?: number; col?: string } = {},
  ): string {
    prng.seed(seed);

    const count = options.count ?? 5;
    const size = options.size ?? 12;
    const col = options.col ?? "rgba(180,150,100,0.85)";

    let svg = "";

    for (let i = 0; i < count; i++) {
      svg += this.generateFlower(
        xoff + (prng.next() - 0.5) * 50,
        yoff + (prng.next() - 0.5) * 50,
        col,
        size * (0.7 + prng.next() * 0.6),
      );
    }

    return svg;
  }
}

// Export convenience functions
export function winterPlum(
  xoff: number,
  yoff: number,
  seed: number,
  options?: WinterPlumOptions,
): string {
  return WinterPlum.generate(xoff, yoff, seed, options);
}

export function plumBlossoms(
  xoff: number,
  yoff: number,
  seed: number,
  options?: { count?: number; size?: number; col?: string },
): string {
  return WinterPlum.blossoms(xoff, yoff, seed, options);
}
