import { Point } from "../../foundation/geometry";
import { noise } from "../../foundation/noise";
import { prng } from "../../foundation/random";

export interface BambooOptions {
  /** Height of the bamboo */
  hei?: number;
  /** Width of the bamboo stalk */
  wid?: number;
  /** Number of segments (bamboo nodes) */
  seg?: number;
  /** Whether to draw leaves */
  leaves?: boolean;
  /** Leaf density (0-1) */
  leafDensity?: number;
  /** Bend amount (0-1) */
  bend?: number;
  /** Color */
  col?: string;
  /** Number of stalks */
  stalks?: number;
}

/**
 * Bamboo - Generate Chinese ink painting style bamboo (墨竹)
 *
 * Style reference: Imperial Encyclopaedia - Plant Kingdom - 竹圖
 * Uses SVG path commands with cubic bezier curves to create
 * authentic ink painting appearance with organic edges.
 */
export class Bamboo {
  /**
   * Generate a complete bamboo composition
   */
  static generate(xoff: number, yoff: number, seed: number, options: BambooOptions = {}): string {
    prng.seed(seed);

    const hei = options.hei ?? 300;
    const wid = options.wid ?? 8;
    const seg = options.seg ?? 5;
    const leaves = options.leaves ?? true;
    const leafDensity = options.leafDensity ?? 0.6;
    const bend = options.bend ?? 0.3;
    const col = options.col ?? "#000000";
    const stalks = options.stalks ?? 1;

    let svg = "";

    for (let s = 0; s < stalks; s++) {
      const stalkXOffset = s * (wid * 3 + prng.next() * wid * 2);
      const stalkHei = hei * (0.7 + prng.next() * 0.5);
      const stalkBend = bend * (prng.next() < 0.5 ? 1 : -1) * (0.5 + prng.next() * 0.5);

      svg += this.generateStalk(
        xoff + stalkXOffset,
        yoff,
        stalkHei,
        wid * (0.8 + prng.next() * 0.4),
        seg,
        stalkBend,
        col,
        leaves,
        leafDensity,
      );
    }

    return svg;
  }

  /**
   * Generate a single bamboo stalk
   */
  private static generateStalk(
    x: number,
    y: number,
    hei: number,
    wid: number,
    seg: number,
    bend: number,
    col: string,
    leaves: boolean,
    leafDensity: number,
  ): string {
    let svg = "";
    const n0 = prng.next() * 100;

    // Generate segment heights
    const segHeights: number[] = [];
    let totalHeight = 0;
    for (let i = 0; i < seg; i++) {
      const baseHeight = hei / seg;
      const heightVariation = 0.7 + (i / seg) * 0.6 + (prng.next() - 0.5) * 0.3;
      segHeights.push(baseHeight * heightVariation);
      totalHeight += segHeights[i];
    }
    const heightScale = hei / totalHeight;
    for (let i = 0; i < seg; i++) {
      segHeights[i] *= heightScale;
    }

    // Calculate node positions
    let currentX = x;
    let currentY = y;
    const nodePositions: Point[] = [[x, y]];

    for (let i = 0; i < seg; i++) {
      const segHeight = segHeights[i];
      const bendOffset = bend * segHeight * noise.noise(i * 0.5, n0);
      const nextBendOffset = bend * segHeight * noise.noise((i + 1) * 0.5, n0);
      currentX = currentX + bendOffset - nextBendOffset;
      currentY = currentY - segHeight;
      nodePositions.push([currentX, currentY]);
    }

    // Draw each segment
    for (let i = 0; i < seg; i++) {
      const t = i / seg;
      const bottomTaper = 1 - Math.pow(t, 0.7) * 0.4;
      const topTaper = 1 - Math.pow((i + 1) / seg, 0.7) * 0.4;

      svg += this.drawSegment(
        nodePositions[i][0],
        nodePositions[i][1],
        nodePositions[i + 1][0],
        nodePositions[i + 1][1],
        wid * bottomTaper,
        wid * topTaper,
        col,
        n0 + i * 10,
      );

      // Draw node
      if (i < seg - 1) {
        svg += this.drawNode(
          nodePositions[i + 1][0],
          nodePositions[i + 1][1],
          wid * topTaper,
          col,
          n0 + i,
        );

        // Add leaves
        if (leaves && prng.next() < leafDensity && i > 0) {
          const leafCount = Math.floor(2 + prng.next() * 4);
          const leafDir = prng.next() < 0.5 ? -1 : 1;
          svg += this.generateLeafCluster(
            nodePositions[i + 1][0],
            nodePositions[i + 1][1],
            leafCount,
            col,
            leafDir,
            hei * 0.15,
          );
        }
      }
    }

    // Top leaves
    if (leaves) {
      svg += this.generateLeafCluster(
        nodePositions[seg][0],
        nodePositions[seg][1],
        Math.floor(3 + prng.next() * 4),
        col,
        prng.next() < 0.5 ? -1 : 1,
        hei * 0.12,
      );
    }

    return svg;
  }

  /**
   * Draw a bamboo segment using SVG path with bezier curves
   */
  private static drawSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    widBottom: number,
    widTop: number,
    col: string,
    noiseSeed: number,
  ): string {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const perpAngle = angle + Math.PI / 2;

    // Calculate corner points
    const halfWB = widBottom / 2;
    const halfWT = widTop / 2;

    // Bottom corners
    const bl: Point = [x1 + Math.cos(perpAngle) * halfWB, y1 + Math.sin(perpAngle) * halfWB];
    const br: Point = [x1 - Math.cos(perpAngle) * halfWB, y1 - Math.sin(perpAngle) * halfWB];

    // Top corners
    const tl: Point = [x2 + Math.cos(perpAngle) * halfWT, y2 + Math.sin(perpAngle) * halfWT];
    const tr: Point = [x2 - Math.cos(perpAngle) * halfWT, y2 - Math.sin(perpAngle) * halfWT];

    // Control points for bezier curves - create slight inward curve (waist effect)
    const waist = 0.06; // Amount of inward curve

    // Left side control points
    const leftCtrl1: Point = [
      bl[0] +
        dx * 0.3 -
        Math.cos(perpAngle) * len * waist * (noise.noise(noiseSeed, 0) * 0.5 + 0.5),
      bl[1] + dy * 0.3,
    ];
    const leftCtrl2: Point = [
      tl[0] -
        dx * 0.3 -
        Math.cos(perpAngle) * len * waist * (noise.noise(noiseSeed + 1, 0) * 0.5 + 0.5),
      tl[1] - dy * 0.3,
    ];

    // Right side control points
    const rightCtrl1: Point = [
      tr[0] -
        dx * 0.3 +
        Math.cos(perpAngle) * len * waist * (noise.noise(noiseSeed + 2, 0) * 0.5 + 0.5),
      tr[1] - dy * 0.3,
    ];
    const rightCtrl2: Point = [
      br[0] +
        dx * 0.3 +
        Math.cos(perpAngle) * len * waist * (noise.noise(noiseSeed + 3, 0) * 0.5 + 0.5),
      br[1] + dy * 0.3,
    ];

    // Build SVG path
    const d = [
      `M ${bl[0].toFixed(1)} ${bl[1].toFixed(1)}`,
      `C ${leftCtrl1[0].toFixed(1)} ${leftCtrl1[1].toFixed(1)} ${leftCtrl2[0].toFixed(1)} ${leftCtrl2[1].toFixed(1)} ${tl[0].toFixed(1)} ${tl[1].toFixed(1)}`,
      `L ${tr[0].toFixed(1)} ${tr[1].toFixed(1)}`,
      `C ${rightCtrl1[0].toFixed(1)} ${rightCtrl1[1].toFixed(1)} ${rightCtrl2[0].toFixed(1)} ${rightCtrl2[1].toFixed(1)} ${br[0].toFixed(1)} ${br[1].toFixed(1)}`,
      "Z",
    ].join(" ");

    return `<path d="${d}" fill="${col}" stroke="none"/>`;
  }

  /**
   * Draw a bamboo node (竹节) as two curved ridges
   */
  private static drawNode(
    x: number,
    y: number,
    stalkWidth: number,
    col: string,
    noiseSeed: number,
  ): string {
    let svg = "";

    const nodeWidth = stalkWidth * 1.3;
    const ridgeHeight = stalkWidth * 0.15;
    const gap = stalkWidth * 0.05;

    // Upper ridge
    svg += this.drawNodeRidge(x, y - gap, nodeWidth, ridgeHeight, col, noiseSeed, true);
    // Lower ridge
    svg += this.drawNodeRidge(
      x,
      y + gap,
      nodeWidth * 0.95,
      ridgeHeight * 0.85,
      col,
      noiseSeed + 10,
      false,
    );

    return svg;
  }

  /**
   * Draw a single node ridge using bezier curves
   */
  private static drawNodeRidge(
    x: number,
    y: number,
    width: number,
    height: number,
    col: string,
    noiseSeed: number,
    curveDown: boolean,
  ): string {
    const halfW = width / 2;
    const curveAmount = height * (curveDown ? 0.5 : -0.3);

    // Use bezier curve for the ridge shape
    // Start from left, curve to right
    const d = [
      `M ${(x - halfW).toFixed(1)} ${y.toFixed(1)}`,
      `C ${(x - halfW * 0.5).toFixed(1)} ${(y + curveAmount - height * 0.3).toFixed(1)} ${(x + halfW * 0.5).toFixed(1)} ${(y + curveAmount - height * 0.3).toFixed(1)} ${(x + halfW).toFixed(1)} ${y.toFixed(1)}`,
      `C ${(x + halfW * 0.5).toFixed(1)} ${(y + curveAmount + height * 0.3).toFixed(1)} ${(x - halfW * 0.5).toFixed(1)} ${(y + curveAmount + height * 0.3).toFixed(1)} ${(x - halfW).toFixed(1)} ${y.toFixed(1)}`,
      "Z",
    ].join(" ");

    return `<path d="${d}" fill="${col}" stroke="none"/>`;
  }

  /**
   * Generate a cluster of bamboo leaves
   */
  private static generateLeafCluster(
    x: number,
    y: number,
    count: number,
    col: string,
    direction: number,
    maxLength: number,
  ): string {
    let svg = "";

    for (let i = 0; i < count; i++) {
      const leafAngle = direction * (0.3 + prng.next() * 0.8) + (prng.next() - 0.5) * 0.4;
      const leafLength = maxLength * (0.6 + prng.next() * 0.6);
      const leafWidth = leafLength * 0.1;

      const offsetX = (prng.next() - 0.5) * 5;
      const offsetY = (prng.next() - 0.5) * 8;

      svg += this.generateLeaf(x + offsetX, y + offsetY, leafAngle, leafLength, leafWidth, col);
    }

    return svg;
  }

  /**
   * Generate a single bamboo leaf using bezier curves
   *
   * Mimics the style: M x y c dx1 dy1 dx2 dy2 dx dy ... z
   * Creates organic leaf shape with smooth curves
   */
  private static generateLeaf(
    x: number,
    y: number,
    angle: number,
    length: number,
    maxWidth: number,
    col: string,
  ): string {
    // Leaf direction
    const dx = Math.cos(angle) * length;
    const dy = -Math.sin(angle) * length;

    // Perpendicular direction for width
    const px = Math.cos(angle + Math.PI / 2);
    const py = -Math.sin(angle + Math.PI / 2);

    // Slight curve to the leaf
    const curve = (prng.next() - 0.5) * 0.2;
    const curvePx = px * length * curve;
    const curvePy = py * length * curve;

    // Control points for bezier
    // Leaf shape: starts narrow, widens at ~30%, tapers to point
    const widthAt30 = maxWidth;
    const widthAt60 = maxWidth * 0.7;

    // Key points along leaf
    const p30: Point = [x + dx * 0.3 + curvePx * 0.3, y + dy * 0.3 + curvePy * 0.3];
    const p60: Point = [x + dx * 0.6 + curvePx * 0.6, y + dy * 0.6 + curvePy * 0.6];
    const tip: Point = [x + dx + curvePx, y + dy + curvePy];

    // Build path using cubic bezier curves
    // Start at base (narrow)
    const baseWidth = maxWidth * 0.2;

    const d = [
      // Start at base left
      `M ${(x + px * baseWidth * 0.5).toFixed(1)} ${(y + py * baseWidth * 0.5).toFixed(1)}`,
      // Curve to 30% point (widest)
      `C ${(x + dx * 0.1 + px * baseWidth).toFixed(1)} ${(y + dy * 0.1 + py * baseWidth).toFixed(1)} ${(p30[0] + px * widthAt30 * 0.8).toFixed(1)} ${(p30[1] + py * widthAt30 * 0.8).toFixed(1)} ${(p30[0] + px * widthAt30 * 0.5).toFixed(1)} ${(p30[1] + py * widthAt30 * 0.5).toFixed(1)}`,
      // Curve to 60% point
      `C ${(p30[0] + dx * 0.1 + px * widthAt30 * 0.4).toFixed(1)} ${(p30[1] + dy * 0.1 + py * widthAt30 * 0.4).toFixed(1)} ${(p60[0] + px * widthAt60 * 0.4).toFixed(1)} ${(p60[1] + py * widthAt60 * 0.4).toFixed(1)} ${(p60[0] + px * widthAt60 * 0.3).toFixed(1)} ${(p60[1] + py * widthAt60 * 0.3).toFixed(1)}`,
      // Curve to tip
      `C ${(p60[0] + dx * 0.15 + px * widthAt60 * 0.1).toFixed(1)} ${(p60[1] + dy * 0.15 + py * widthAt60 * 0.1).toFixed(1)} ${(tip[0] - dx * 0.05).toFixed(1)} ${(tip[1] - dy * 0.05).toFixed(1)} ${tip[0].toFixed(1)} ${tip[1].toFixed(1)}`,
      // Back along other side to base
      `C ${(tip[0] - dx * 0.05).toFixed(1)} ${(tip[1] - dy * 0.05).toFixed(1)} ${(p60[0] - px * widthAt60 * 0.1).toFixed(1)} ${(p60[1] - py * widthAt60 * 0.1).toFixed(1)} ${(p60[0] - px * widthAt60 * 0.3).toFixed(1)} ${(p60[1] - py * widthAt60 * 0.3).toFixed(1)}`,
      `C ${(p60[0] - px * widthAt60 * 0.4).toFixed(1)} ${(p60[1] - py * widthAt60 * 0.4).toFixed(1)} ${(p30[0] - px * widthAt30 * 0.4).toFixed(1)} ${(p30[1] - py * widthAt30 * 0.4).toFixed(1)} ${(p30[0] - px * widthAt30 * 0.5).toFixed(1)} ${(p30[1] - py * widthAt30 * 0.5).toFixed(1)}`,
      `C ${(p30[0] - px * widthAt30 * 0.8).toFixed(1)} ${(p30[1] - py * widthAt30 * 0.8).toFixed(1)} ${(x + dx * 0.1 - px * baseWidth).toFixed(1)} ${(y + dy * 0.1 - py * baseWidth).toFixed(1)} ${(x - px * baseWidth * 0.5).toFixed(1)} ${(y - py * baseWidth * 0.5).toFixed(1)}`,
      "Z",
    ].join(" ");

    return `<path d="${d}" fill="${col}" stroke="none"/>`;
  }

  /**
   * Generate just bamboo leaves
   */
  static leaves(
    xoff: number,
    yoff: number,
    seed: number,
    options: { count?: number; length?: number; col?: string } = {},
  ): string {
    prng.seed(seed);

    const count = options.count ?? 5;
    const length = options.length ?? 60;
    const col = options.col ?? "#000000";

    let svg = "";
    for (let i = 0; i < count; i++) {
      const angle = (prng.next() - 0.5) * Math.PI * 0.8;
      const leafLength = length * (0.6 + prng.next() * 0.6);
      const leafWidth = leafLength * 0.1;

      svg += this.generateLeaf(
        xoff + (prng.next() - 0.5) * 20,
        yoff + (prng.next() - 0.5) * 20,
        angle,
        leafLength,
        leafWidth,
        col,
      );
    }

    return svg;
  }
}

// Export convenience functions
export function bamboo(xoff: number, yoff: number, seed: number, options?: BambooOptions): string {
  return Bamboo.generate(xoff, yoff, seed, options);
}

export function bambooLeaves(
  xoff: number,
  yoff: number,
  seed: number,
  options?: { count?: number; length?: number; col?: string },
): string {
  return Bamboo.leaves(xoff, yoff, seed, options);
}
