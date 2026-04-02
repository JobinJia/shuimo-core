/**
 * Traditional Chinese Seal Stamp Generator
 *
 * Generates irregular stamp shapes with customizable text, colors, and noise effects
 * to simulate authentic seal stamps used in traditional Chinese art.
 */

import { createStampNoise } from './StampNoise';
import { dsin, dcos, fmtNum } from '../utils/math';

// ─── Reference constants ────────────────────────────────────────────
// All distance defaults are expressed as ratios of fontSize.
// The reference font size (70px) is used to derive ratios from the
// original fixed pixel defaults so that `ratio × 70` recovers the
// legacy value exactly.

const REFERENCE_FONT_SIZE = 70;
const DEFAULT_NOISE_AMOUNT = 12 / REFERENCE_FONT_SIZE;
const DEFAULT_CORNER_RADIUS = 15 / REFERENCE_FONT_SIZE;
const DEFAULT_BORDER_WIDTH = 1 / REFERENCE_FONT_SIZE;
const DEFAULT_BORDER_POINTS = 24 / REFERENCE_FONT_SIZE;
const MEASURED_HEIGHT_BUFFER = 0.05;

/**
 * Stamp type: 阴章 (Yin) or 阳章 (Yang)
 * - yin: Red background with white text (default)
 * - yang: White background with red text and red border
 */
export type StampType = 'yin' | 'yang';

/**
 * Stamp shape: Control the background shape
 * - auto: Default irregular trapezoid based on text layout
 * - square: Square shape
 * - rectangle: Rectangular shape
 * - circle: Circular shape
 * - ellipse: Elliptical shape (non-standard ellipse)
 */
export type StampShape = 'auto' | 'square' | 'rectangle' | 'circle' | 'ellipse';

export interface MeasuredColumnBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StampOptions {
  /** Text lines to display in reading order (will be displayed right to left as vertical columns) */
  text: string[];

  /** Stamp type: 'yin' (阴章) or 'yang' (阳章) (default: 'yin') */
  type?: StampType;

  /** Stamp shape: Controls the background shape (default: 'auto' - irregular trapezoid) */
  shape?: StampShape;

  /** Stamp ink color (default: traditional red #C8102E) */
  color?: string;

  /** Text color (default: white #FFFFFF for yin, #C8102E for yang) */
  textColor?: string;

  /** Font family for the text */
  fontFamily?: string;

  /** Font size in pixels (default: 70) */
  fontSize?: number;

  /** Font weight for the text (default: 'normal'). Can be 'normal', 'bold', or numeric values like 100-900 */
  fontWeight?: string | number;

  /** Horizontal offset of text within the stamp bounds. Range: -1 to 1, where -1 is left edge, 0 is center, 1 is right edge (default: 0) */
  offsetX?: number;

  /** Vertical offset of text within the stamp bounds. Range: -1 to 1, where -1 is top edge, 0 is center, 1 is bottom edge (default: 0) */
  offsetY?: number;

  /** Spacing between columns (horizontal spacing), as a multiplier of fontSize (default: 0.02) */
  columnSpacing?: number;

  /** Spacing between characters within a column (vertical spacing), as a multiplier of fontSize (default: 0.05) */
  characterSpacing?: number;

  /** Horizontal padding around text (left and right), as a multiplier of fontSize (default: 0.02) */
  paddingX?: number;

  /** Vertical padding around text (top and bottom), as a multiplier of fontSize (default: 0.02) */
  paddingY?: number;

  /** Absolute column spacing in pixels. If provided, overrides columnSpacing */
  columnSpacingPx?: number;

  /** Absolute character spacing in pixels. If provided, overrides characterSpacing */
  characterSpacingPx?: number;

  /** Absolute horizontal padding in pixels. If provided, overrides paddingX */
  paddingXPx?: number;

  /** Absolute vertical padding in pixels. If provided, overrides paddingY */
  paddingYPx?: number;

  /** Absolute column width in pixels. If provided, overrides the automatic calculation (fontSize * 0.85). Use this for cross-platform consistency. */
  columnWidthPx?: number;

  /** Measured column widths in pixels for each column. If provided, uses actual measured widths instead of estimation. Array length should match text.length. */
  measuredColumnWidths?: number[];

  /** Measured column heights in pixels for each column. If provided, uses actual measured heights instead of estimation. Array length should match text.length. */
  measuredColumnHeights?: number[];

  /** Measured SVG bounding boxes for each column. Used to correct visual centering based on the real glyph box. */
  measuredColumnBoxes?: MeasuredColumnBox[];

  /** Border scale factor - scales the entire stamp border relative to text (default: 1.0, range: 0.8-1.5). If borderScaleX/Y are provided, this is ignored. */
  borderScale?: number;

  /** Horizontal border scale factor - scales stamp border width relative to text (default: 1.0) */
  borderScaleX?: number;

  /** Vertical border scale factor - scales stamp border height relative to text (default: 1.0) */
  borderScaleY?: number;

  /** Amount of irregularity as a multiplier of fontSize (default: 12/70 ≈ 0.171) */
  noiseAmount?: number;

  /** Number of border path points as a multiplier of fontSize (default: 24/70 ≈ 0.343) */
  borderPoints?: number;

  /** Corner radius as a multiplier of fontSize (default: 15/70 ≈ 0.214, set 0 for sharp corners) */
  cornerRadius?: number;

  /** Border width as a multiplier of fontSize (default: 1/70 ≈ 0.014). Only applies to yang stamps (阳章) */
  borderWidth?: number;

  /** Absolute noise amount in pixels. If provided, overrides noiseAmount */
  noiseAmountPx?: number;

  /** Absolute border points count. If provided, overrides borderPoints */
  borderPointsPx?: number;

  /** Absolute corner radius in pixels. If provided, overrides cornerRadius */
  cornerRadiusPx?: number;

  /** Absolute border width in pixels. If provided, overrides borderWidth */
  borderWidthPx?: number;

  /** Whether to generate regular geometric shapes without noise (default: false). Only applies to non-auto shapes (square, rectangle, circle, ellipse) */
  regularShape?: boolean;

  /** Random seed for reproducible generation */
  seed?: number;
}

interface StampResult {
  /** SVG path data for the stamp border */
  path: string;

  /** Bounding box of the stamp */
  bounds: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
  };
}

// ─── Internal helpers ───────────────────────────────────────────────

const PI = Math.PI;

interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

type NoiseFn = (x: number, y: number, edgeProgress: number) => { x: number; y: number };

interface TextLayout {
  width: number;
  height: number;
  columnCount: number;
  maxChars: number;
  columnHeights: number[];
  columnWidth: number;
  columnWidths: number[];
}

/**
 * SVG path builder that uses fmtNum for all coordinates,
 * ensuring deterministic output across platforms.
 */
class PathBuilder {
  private parts: string[] = [];

  moveTo(x: number, y: number): this {
    this.parts.push(`M ${fmtNum(x)} ${fmtNum(y)}`);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.parts.push(`L ${fmtNum(x)} ${fmtNum(y)}`);
    return this;
  }

  quadTo(cx: number, cy: number, x: number, y: number): this {
    this.parts.push(`Q ${fmtNum(cx)} ${fmtNum(cy)}, ${fmtNum(x)} ${fmtNum(y)}`);
    return this;
  }

  cubicTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): this {
    this.parts.push(`C ${fmtNum(c1x)} ${fmtNum(c1y)}, ${fmtNum(c2x)} ${fmtNum(c2y)}, ${fmtNum(x)} ${fmtNum(y)}`);
    return this;
  }

  close(): this {
    this.parts.push('Z');
    return this;
  }

  toString(): string {
    return this.parts.join(' ');
  }
}

/**
 * Randomize corner radii around a base value.
 * For regular shapes all corners are identical; otherwise ±20% random variation.
 */
function randomizeCornerRadii(base: number, random: () => number, regular: boolean): CornerRadii {
  if (regular) {
    return { topLeft: base, topRight: base, bottomRight: base, bottomLeft: base };
  }
  return {
    topLeft: base * (0.8 + random() * 0.4),
    topRight: base * (0.8 + random() * 0.4),
    bottomRight: base * (0.8 + random() * 0.4),
    bottomLeft: base * (0.8 + random() * 0.4),
  };
}

/**
 * Generate noisy points along a straight edge and append them to the builder.
 *
 * @param builder   PathBuilder to append L commands to
 * @param fromX/Y   Start coordinate of the edge (exclusive — not emitted)
 * @param toX/Y     End coordinate of the edge (exclusive — not emitted)
 * @param count     Number of intermediate points (pointsPerEdge)
 * @param applyNoise  Noise function
 * @param fullNoise   true → edgeProgress = 1.0 (top edge style);
 *                    false → edgeProgress = sin(t·π) (other edges)
 */
function generateEdgePoints(
  builder: PathBuilder,
  fromX: number, fromY: number,
  toX: number, toY: number,
  count: number,
  applyNoise: NoiseFn,
  fullNoise: boolean,
): void {
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const edgeProgress = fullNoise ? 1.0 : dsin(t * PI);
    const x = fromX + t * (toX - fromX);
    const y = fromY + t * (toY - fromY);
    const pt = applyNoise(x, y, edgeProgress);
    builder.lineTo(pt.x, pt.y);
  }
}

/**
 * Build a regular (no-noise) rounded-quad path.
 * Works for both square and rectangle.
 */
function buildRegularQuadPath(w: number, h: number, cr: CornerRadii): string {
  if (cr.topLeft > 0 || cr.topRight > 0 || cr.bottomRight > 0 || cr.bottomLeft > 0) {
    const b = new PathBuilder();
    b.moveTo(cr.topLeft, 0)
      .lineTo(w - cr.topRight, 0)
      .quadTo(w, 0, w, cr.topRight)
      .lineTo(w, h - cr.bottomRight)
      .quadTo(w, h, w - cr.bottomRight, h)
      .lineTo(cr.bottomLeft, h)
      .quadTo(0, h, 0, h - cr.bottomLeft)
      .lineTo(0, cr.topLeft)
      .quadTo(0, 0, cr.topLeft, 0)
      .close();
    return b.toString();
  }
  return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
}

/**
 * Build a regular (no-noise) ellipse path using 4 cubic Bézier curves.
 */
function buildRegularEllipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5522847498;
  const ox = rx * k;
  const oy = ry * k;
  const b = new PathBuilder();
  b.moveTo(cx, cy - ry)
    .cubicTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy)
    .cubicTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry)
    .cubicTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy)
    .cubicTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry)
    .close();
  return b.toString();
}

// ─── Text dimension calculation ─────────────────────────────────────

/**
 * Calculate accurate text dimensions for vertical layout with per-column heights
 * For edge-aligned stamps (贴边印章)
 */
function calculateTextBounds(
  text: string[],
  fontSize: number,
  characterSpacing: number = 0.05,
  columnSpacing: number = 0.02,
  columnWidthPx?: number,
  measuredColumnWidths?: number[],
  measuredColumnHeights?: number[]
): TextLayout {
  // For vertical text with writing-mode: vertical-rl
  // Traditional stamps have minimal spacing between characters and columns

  // Determine column widths
  let columnWidths: number[];
  let columnWidth: number; // Average/representative column width for backward compatibility

  if (measuredColumnWidths && measuredColumnWidths.length === text.length) {
    // Use actual measured widths when available
    columnWidths = measuredColumnWidths;
    columnWidth = Math.max(...columnWidths); // Use max width for consistent spacing
  } else if (columnWidthPx !== undefined) {
    // Use uniform absolute column width
    columnWidths = text.map(() => columnWidthPx);
    columnWidth = columnWidthPx;
  } else {
    // Estimate based on fontSize (fallback)
    // FIXED: Use 0.55 for serif fonts (was 0.85, then 0.7, now 0.55)
    // Testing shows serif fonts render much narrower than expected
    const estimatedWidth = fontSize * 0.55;
    columnWidths = text.map(() => estimatedWidth);
    columnWidth = estimatedWidth;
  }

  // Calculate height for each column with customizable character spacing
  let columnHeights: number[];

  if (measuredColumnHeights && measuredColumnHeights.length === text.length) {
    // Use actual measured heights when available (most accurate)
    columnHeights = measuredColumnHeights;
  } else {
    // Estimate based on fontSize and spacing (fallback)
    columnHeights = text.map(line => {
      const chars = line.length;
      // Vertical packing with customizable spacing:
      // chars * fontSize * 1.1: base height for all characters (with vertical padding for proper display)
      // (chars - 1) * fontSize * characterSpacing: spacing between characters
      return chars * fontSize * 1.1 + (chars - 1) * fontSize * characterSpacing;
    });
  }

  // Find longest column
  const maxChars = Math.max(...text.map(t => t.length));
  const totalHeight = Math.max(...columnHeights);

  // Total width = sum of all column widths + gaps between columns
  const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0) + (text.length - 1) * fontSize * columnSpacing;

  return {
    width: totalWidth,
    height: totalHeight,
    columnCount: text.length,
    maxChars,
    columnHeights,
    columnWidth,
    columnWidths
  };
}

function getMeasuredHeightBuffer(fontSize: number): number {
  return fontSize * MEASURED_HEIGHT_BUFFER;
}

function getPathTextBounds(
  text: string[],
  fontSize: number,
  characterSpacing: number,
  columnSpacing: number,
  columnWidthPx: number | undefined,
  measuredColumnWidths: number[] | undefined,
  measuredColumnHeights: number[] | undefined,
): TextLayout {
  const bufferedHeights = measuredColumnHeights?.length === text.length
    ? measuredColumnHeights.map(height => height + getMeasuredHeightBuffer(fontSize))
    : undefined;

  return calculateTextBounds(
    text,
    fontSize,
    characterSpacing,
    columnSpacing,
    columnWidthPx,
    measuredColumnWidths,
    bufferedHeights,
  );
}

interface ProfilePoint {
  x: number;
  y: number;
}

function interpolateProfileY(points: ProfilePoint[], x: number): number {
  if (points.length === 0)
    return 0;

  if (x <= points[0].x)
    return points[0].y;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (x <= curr.x) {
      const span = curr.x - prev.x || 1;
      const t = (x - prev.x) / span;
      return prev.y + (curr.y - prev.y) * t;
    }
  }

  return points[points.length - 1].y;
}

// ─── Shape generators ───────────────────────────────────────────────

/**
 * Generate square shape path
 */
function generateSquarePath(
  size: number,
  borderPoints: number,
  cornerRadius: number,
  random: () => number,
  applyNoise: NoiseFn,
  regularShape: boolean
): string {
  const cr = randomizeCornerRadii(cornerRadius, random, regularShape);

  if (regularShape) {
    return buildRegularQuadPath(size, size, cr);
  }

  const pointsPerEdge = Math.floor(borderPoints / 4);
  const b = new PathBuilder();

  // Top-left corner start point
  const start = applyNoise(cr.topLeft, 0, 0);
  b.moveTo(start.x, start.y);

  // Top edge (full noise)
  generateEdgePoints(b, cr.topLeft, 0, size - cr.topRight, 0, pointsPerEdge, applyNoise, true);

  // Top-right corner
  b.quadTo(size, 0, size, cr.topRight);

  // Right edge
  generateEdgePoints(b, size, cr.topRight, size, size - cr.bottomRight, pointsPerEdge, applyNoise, false);

  // Bottom-right corner
  b.quadTo(size, size, size - cr.bottomRight, size);

  // Bottom edge (right to left)
  generateEdgePoints(b, size - cr.bottomRight, size, cr.bottomLeft, size, pointsPerEdge, applyNoise, false);

  // Bottom-left corner
  b.quadTo(0, size, 0, size - cr.bottomLeft);

  // Left edge (bottom to top)
  generateEdgePoints(b, 0, size - cr.bottomLeft, 0, cr.topLeft, pointsPerEdge, applyNoise, false);

  // Top-left corner (close)
  b.quadTo(0, 0, start.x, start.y);
  b.close();

  return b.toString();
}

/**
 * Generate rectangle shape path
 */
function generateRectanglePath(
  width: number,
  height: number,
  borderPoints: number,
  cornerRadius: number,
  random: () => number,
  applyNoise: NoiseFn,
  regularShape: boolean
): string {
  const cr = randomizeCornerRadii(cornerRadius, random, regularShape);

  if (regularShape) {
    return buildRegularQuadPath(width, height, cr);
  }

  const pointsPerEdge = Math.floor(borderPoints / 4);
  const b = new PathBuilder();

  const start = applyNoise(cr.topLeft, 0, 0);
  b.moveTo(start.x, start.y);

  // Top edge (full noise)
  generateEdgePoints(b, cr.topLeft, 0, width - cr.topRight, 0, pointsPerEdge, applyNoise, true);

  // Top-right corner
  b.quadTo(width, 0, width, cr.topRight);

  // Right edge
  generateEdgePoints(b, width, cr.topRight, width, height - cr.bottomRight, pointsPerEdge, applyNoise, false);

  // Bottom-right corner
  b.quadTo(width, height, width - cr.bottomRight, height);

  // Bottom edge (right to left)
  generateEdgePoints(b, width - cr.bottomRight, height, cr.bottomLeft, height, pointsPerEdge, applyNoise, false);

  // Bottom-left corner
  b.quadTo(0, height, 0, height - cr.bottomLeft);

  // Left edge (bottom to top)
  generateEdgePoints(b, 0, height - cr.bottomLeft, 0, cr.topLeft, pointsPerEdge, applyNoise, false);

  // Top-left corner (close)
  b.quadTo(0, 0, start.x, start.y);
  b.close();

  return b.toString();
}

/**
 * Generate circle shape path
 */
function generateCirclePath(
  radius: number,
  borderPoints: number,
  applyNoise: NoiseFn,
  regularShape: boolean
): string {
  const centerX = radius;
  const centerY = radius;

  if (regularShape) {
    return buildRegularEllipsePath(centerX, centerY, radius, radius);
  }

  const b = new PathBuilder();

  for (let i = 0; i < borderPoints; i++) {
    const angle = (i / borderPoints) * PI * 2;
    const x = centerX + dcos(angle) * radius;
    const y = centerY + dsin(angle) * radius;

    const edgeProgress = 1.0;
    const pt = applyNoise(x, y, edgeProgress);

    if (i === 0) {
      b.moveTo(pt.x, pt.y);
    } else {
      b.lineTo(pt.x, pt.y);
    }
  }

  b.close();
  return b.toString();
}

/**
 * Generate capsule/stadium shape path (looks like ellipse but wraps text better)
 * - Horizontal: top/bottom straight lines + left/right semicircles
 * - Vertical: left/right straight lines + top/bottom semicircles
 */
function generateEllipsePath(
  width: number,
  height: number,
  borderPoints: number,
  applyNoise: NoiseFn,
  regularShape: boolean
): string {
  if (regularShape) {
    const rx = width / 2;
    const ry = height / 2;
    return buildRegularEllipsePath(rx, ry, rx, ry);
  }

  const pointsPerEdge = Math.floor(borderPoints / 4);
  const b = new PathBuilder();

  if (width > height) {
    // Horizontal capsule: straight top/bottom + curved left/right
    const radius = height / 2;
    const curveRadius = radius * 0.5;
    const straightLength = width - radius * 2;

    const start = applyNoise(curveRadius, 0, 0);
    b.moveTo(start.x, start.y);

    // Top edge (straight)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(curveRadius + t * straightLength, 0, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Right curve (top to bottom)
    const rightCenterX = width - curveRadius;
    const rightCenterY = radius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = -PI / 2 + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = rightCenterX + dcos(angle) * curveRadius;
      const y = rightCenterY + dsin(angle) * radius;
      const pt = applyNoise(x, y, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Bottom edge (right to left)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise((width - curveRadius) - t * straightLength, height, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Left curve (bottom to top)
    const leftCenterX = curveRadius;
    const leftCenterY = radius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = PI / 2 + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = leftCenterX + dcos(angle) * curveRadius;
      const y = leftCenterY + dsin(angle) * radius;
      const pt = applyNoise(x, y, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }
  } else {
    // Vertical capsule: straight left/right + curved top/bottom
    const radius = width / 2;
    const curveRadius = radius * 0.5;
    const straightLength = height - curveRadius * 2;

    const start = applyNoise(0, curveRadius, 0);
    b.moveTo(start.x, start.y);

    // Top curve (left to right)
    const topCenterX = radius;
    const topCenterY = curveRadius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = PI + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = topCenterX + dcos(angle) * radius;
      const y = topCenterY + dsin(angle) * curveRadius;
      const pt = applyNoise(x, y, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Right edge (top to bottom)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(width, curveRadius + t * straightLength, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Bottom curve (right to left)
    const bottomCenterX = radius;
    const bottomCenterY = height - curveRadius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = 0 + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = bottomCenterX + dcos(angle) * radius;
      const y = bottomCenterY + dsin(angle) * curveRadius;
      const pt = applyNoise(x, y, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Left edge (bottom to top)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(0, (height - curveRadius) - t * straightLength, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }
  }

  b.close();
  return b.toString();
}

// ─── Main API ───────────────────────────────────────────────────────

/**
 * Generate an irregular stamp border path using trapezoidal layout
 * Based on actual text column heights
 */
export function generateStampPath(options: StampOptions): StampResult {
  const {
    text,
    shape = 'auto',
    fontSize = 70,
    columnSpacing = 0.02,
    characterSpacing = 0.05,
    paddingX = 0.02,
    paddingY = 0.02,
    columnSpacingPx,
    characterSpacingPx,
    paddingXPx,
    paddingYPx,
    columnWidthPx,
    borderScale = 1.0,
    borderScaleX,
    borderScaleY,
    noiseAmount = DEFAULT_NOISE_AMOUNT,
    borderPoints = DEFAULT_BORDER_POINTS,
    cornerRadius = DEFAULT_CORNER_RADIUS,
    noiseAmountPx,
    borderPointsPx,
    cornerRadiusPx,
    regularShape = false,
    seed = Date.now()
  } = options;

  // Resolve actual pixel values — *Px takes precedence over fontSize-relative values
  const actualColumnSpacing = columnSpacingPx !== undefined ? columnSpacingPx / fontSize : columnSpacing;
  const actualCharacterSpacing = characterSpacingPx !== undefined ? characterSpacingPx / fontSize : characterSpacing;
  const actualPaddingX = paddingXPx !== undefined ? paddingXPx : fontSize * paddingX;
  const actualPaddingY = paddingYPx !== undefined ? paddingYPx : fontSize * paddingY;
  const actualNoiseAmount = noiseAmountPx ?? fontSize * noiseAmount;
  const actualBorderPoints = Math.round(borderPointsPx ?? fontSize * borderPoints);
  const actualCornerRadius = cornerRadiusPx ?? fontSize * cornerRadius;

  // Early return if no valid text
  if (!text || text.length === 0 || text.every(t => !t || t.trim().length === 0)) {
    const defaultSize = 100;
    return {
      path: `M 0 0 L ${defaultSize} 0 L ${defaultSize} ${defaultSize} L 0 ${defaultSize} Z`,
      bounds: {
        left: 0,
        right: defaultSize,
        top: 0,
        bottom: defaultSize,
        width: defaultSize,
        height: defaultSize
      }
    };
  }

  // Keep text array in original order
  // In vertical-rl mode with decreasing x coordinates, the first element will appear on the right
  // User provides ['A', 'B'], it will display as: B(left) A(right), reading right-to-left
  const displayText = [...text];

  // Calculate actual text dimensions with custom spacing
  // For stamp path (border), use estimated heights to ensure enough space
  // Don't use measuredColumnHeights here to avoid text overflow
  const textDims = getPathTextBounds(
    displayText,
    fontSize,
    actualCharacterSpacing,
    actualColumnSpacing,
    columnWidthPx,
    options.measuredColumnWidths,
    options.measuredColumnHeights
  );
  // Calculate column positions and heights
  const columnData = displayText.map((line, index) => ({
    height: textDims.columnHeights[index],
    text: line
  }));

  // Use separate horizontal and vertical padding (now using actualPaddingX/Y which can be absolute or relative)
  const horizontalPadding = actualPaddingX;
  const verticalPadding = actualPaddingY;

  // Calculate base dimensions with padding
  const baseWidth = textDims.width + horizontalPadding * 2;
  const baseRightHeight = columnData[0].height + verticalPadding * 2;
  const baseLeftHeight = columnData[columnData.length - 1].height + verticalPadding * 2;
  const tallestColumnHeight = Math.max(...columnData.map(column => column.height)) + verticalPadding * 2;

  // Apply border scale to expand/shrink the border relative to text
  // Scale from the center, so text stays centered
  // Use borderScaleX/Y if provided, otherwise fall back to borderScale
  const scaleX = borderScaleX ?? borderScale;
  const scaleY = borderScaleY ?? borderScale;
  const maxWidth = baseWidth * scaleX;
  let rightHeight = baseRightHeight * scaleY;
  let leftHeight = baseLeftHeight * scaleY;

  // Simple PRNG for reproducible noise — reduce seed to prevent overflow
  let seedValue = ((seed % 233280) + 233280) % 233280;
  const random = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };

  // Initialize improved Perlin Noise with seed
  const noise = createStampNoise(seed);

  // Helper function to apply improved Perlin noise
  const applyNoise: NoiseFn = (x, y, edgeProgress) => {
    // edgeProgress: 0 at corner, 1 at middle of edge
    // Reduce noise near corners for smooth connections
    const cornerFactor = edgeProgress;

    // Use octave noise for more natural, organic variation
    // Scale coordinates for noise sampling
    const noiseScale = 0.015; // Lower frequency for smoother, more natural curves

    // Sample octave noise for X and Y offsets independently
    // Using different z-offsets to decorrelate X and Y variations
    const noiseX = noise.noise3D(x * noiseScale, y * noiseScale, 0);
    const noiseY = noise.noise3D(x * noiseScale, y * noiseScale, 100);

    // Apply noise amount and corner factor
    // Noise is in range [-1, 1] already
    const totalNoiseX = noiseX * actualNoiseAmount * cornerFactor;
    const totalNoiseY = noiseY * actualNoiseAmount * cornerFactor;

    return { x: x + totalNoiseX, y: y + totalNoiseY };
  };

  // Generate path based on shape
  let path = '';
  let bounds: StampResult['bounds'];

  if (shape === 'square') {
    // Square: create a compact square based on text dimensions with padding and border scale
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    const baseSize = Math.max(textWidth + horizontalPadding * 2, textHeight + verticalPadding * 2);
    // For square, use the average of scaleX and scaleY to maintain square shape
    const avgScale = (scaleX + scaleY) / 2;
    const size = baseSize * avgScale;

    path = generateSquarePath(size, actualBorderPoints, actualCornerRadius, random, applyNoise, regularShape);
    bounds = {
      left: 0,
      right: size,
      top: 0,
      bottom: size,
      width: size,
      height: size
    };
  } else if (shape === 'rectangle') {
    // Rectangle: fits text dimensions with padding and border scale
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    const width = (textWidth + horizontalPadding * 2) * scaleX;
    const height = (textHeight + verticalPadding * 2) * scaleY;

    path = generateRectanglePath(width, height, actualBorderPoints, actualCornerRadius, random, applyNoise, regularShape);
    bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width,
      height
    };
  } else if (shape === 'circle') {
    // Circle: fits text dimensions with padding and border scale
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    const baseDiameter = Math.max(textWidth + horizontalPadding * 2, textHeight + verticalPadding * 2);
    // For circle, use the average of scaleX and scaleY to maintain circular shape
    const avgScale = (scaleX + scaleY) / 2;
    const diameter = baseDiameter * avgScale;
    const radius = diameter / 2;

    path = generateCirclePath(radius, actualBorderPoints, applyNoise, regularShape);
    bounds = {
      left: 0,
      right: diameter,
      top: 0,
      bottom: diameter,
      width: diameter,
      height: diameter
    };
  } else if (shape === 'ellipse') {
    // Ellipse: non-standard ellipse design with padding and border scale
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);

    const aspectRatio = textWidth / textHeight;
    let width: number;
    let height: number;

    if (aspectRatio > 1) {
      // Horizontal layout
      const baseHeight = textHeight + verticalPadding * 2;
      const baseWidth = textWidth + horizontalPadding * 2 + baseHeight * 0.15;
      width = baseWidth * scaleX;
      height = baseHeight * scaleY;
    } else {
      // Vertical layout
      const baseHeight = textHeight + verticalPadding * 2;
      const baseWidth = textWidth + horizontalPadding * 2;
      const shortSide = Math.min(baseWidth, baseHeight);
      width = baseWidth * scaleX;
      height = (baseHeight + shortSide * 0.15) * scaleY;
    }

    path = generateEllipsePath(width, height, actualBorderPoints, applyNoise, regularShape);
    bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width,
      height
    };
  } else {
    // Auto (default): trapezoid based on text layout
    const textBlockLeft = (maxWidth - textDims.width) / 2;
    const textBlockRight = maxWidth - textBlockLeft;
    const autoProfile: ProfilePoint[] = [{ x: 0, y: leftHeight }];
    let currentRight = textBlockRight;

    for (let index = 0; index < columnData.length; index++) {
      const columnWidth = textDims.columnWidths[index];
      const columnLeft = currentRight - columnWidth;
      const columnCenter = (columnLeft + currentRight) / 2;
      const columnBottom = (columnData[index].height + verticalPadding * 2) * scaleY;

      autoProfile.push({ x: columnCenter, y: columnBottom });

      currentRight = columnLeft - (index < columnData.length - 1 ? fontSize * actualColumnSpacing : 0);
    }

    autoProfile.push({ x: maxWidth, y: rightHeight });
    autoProfile.sort((a, b) => a.x - b.x);

    bounds = {
      left: 0,
      right: maxWidth,
      top: 0,
      bottom: tallestColumnHeight * scaleY,
      width: maxWidth,
      height: tallestColumnHeight * scaleY
    };

    const cr = randomizeCornerRadii(actualCornerRadius, random, false);
    const pointsPerEdge = Math.floor(actualBorderPoints / 4);

    const b = new PathBuilder();

    // Top-left corner start point (after corner radius)
    const start = applyNoise(cr.topLeft, 0, 0);
    b.moveTo(start.x, start.y);

    // Top edge (从左上圆角后到右上圆角前) — full noise
    generateEdgePoints(b, cr.topLeft, 0, maxWidth - cr.topRight, 0, pointsPerEdge, applyNoise, true);

    // Top-right corner (二次贝塞尔曲线)
    b.quadTo(maxWidth, 0, maxWidth, cr.topRight);

    // Right edge (从右上圆角后到右下圆角前)
    generateEdgePoints(b, maxWidth, cr.topRight, maxWidth, rightHeight - cr.bottomRight, pointsPerEdge, applyNoise, false);

    // Bottom-right corner
    b.quadTo(maxWidth, rightHeight, maxWidth - cr.bottomRight, rightHeight);

    // Bottom edge (trapezoid: right→left with height interpolation)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const xPos = (maxWidth - cr.bottomRight) - t * (maxWidth - cr.bottomRight - cr.bottomLeft);
      const yPos = interpolateProfileY(autoProfile, xPos);
      const pt = applyNoise(xPos, yPos, edgeProgress);
      b.lineTo(pt.x, pt.y);
    }

    // Bottom-left corner
    b.quadTo(0, leftHeight, 0, leftHeight - cr.bottomLeft);

    // Left edge (从左下圆角后到左上圆角前)
    generateEdgePoints(b, 0, leftHeight - cr.bottomLeft, 0, cr.topLeft, pointsPerEdge, applyNoise, false);

    // Top-left corner (close)
    b.quadTo(0, 0, cr.topLeft, 0);

    b.close();
    path = b.toString();
  }

  return { path, bounds };
}

/**
 * Generate complete SVG for a stamp with text
 */
export function generateStamp(options: StampOptions): string {
  const {
    text,
    type = 'yin',
    color = '#C8102E',
    fontFamily = 'serif',
    fontSize = 70,
    fontWeight = 'normal',
    offsetX = 0,
    offsetY = 0,
    columnSpacing = 0.02,
    characterSpacing = 0.05,
    columnSpacingPx,
    characterSpacingPx,
    columnWidthPx,
    borderWidth = DEFAULT_BORDER_WIDTH,
    seed = Date.now()
  } = options;

  // Resolve actual pixel values — *Px takes precedence over fontSize-relative values
  const actualBorderWidth = options.borderWidthPx ?? fontSize * borderWidth;
  const actualColumnSpacing = columnSpacingPx !== undefined ? columnSpacingPx / fontSize : columnSpacing;
  const actualCharacterSpacing = characterSpacingPx !== undefined ? characterSpacingPx / fontSize : characterSpacing;

  // SVG filter scaling — keep visual texture density consistent across font sizes
  const filterScale = fontSize / REFERENCE_FONT_SIZE;
  const filterScaleInv = REFERENCE_FONT_SIZE / fontSize;

  // Early return if no valid text
  if (!text || text.length === 0 || text.every(t => !t || t.trim().length === 0)) {
    return '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>';
  }

  // Set default colors based on stamp type
  const stampColor = color;
  const stampTextColor = options.textColor || (type === 'yin' ? '#FFFFFF' : '#C8102E');
  const stampBgColor = type === 'yin' ? stampColor : '#FFFFFF';

  const { path, bounds } = generateStampPath(options);

  // Keep text array in original order (same as in generateStampPath)
  const displayText = [...text];

  // Calculate text dimensions with custom spacing
  const textDims = calculateTextBounds(
    displayText,
    fontSize,
    actualCharacterSpacing,
    actualColumnSpacing,
    columnWidthPx,
    options.measuredColumnWidths,
    options.measuredColumnHeights
  );
  const columnWidths = textDims.columnWidths;
  const columnHeights = textDims.columnHeights;
  const columnGap = fontSize * actualColumnSpacing;
  const measuredBoxes = options.measuredColumnBoxes?.length === displayText.length ? options.measuredColumnBoxes : undefined;

  const columnPlacements = displayText.map((line, index) => {
    let x = textDims.width;
    for (let i = 0; i < index; i++) {
      x -= columnWidths[i] + columnGap;
    }

    const y = 0;
    const box = measuredBoxes?.[index];
    const visualLeft = x + (box ? box.x : -columnWidths[index]);
    const visualTop = y + (box ? box.y : 0);
    const visualWidth = box?.width ?? columnWidths[index];
    const visualHeight = box?.height ?? columnHeights[index];

    return {
      line,
      x,
      y,
      visualLeft,
      visualTop,
      visualRight: visualLeft + visualWidth,
      visualBottom: visualTop + visualHeight,
    };
  });

  const visualBounds = columnPlacements.reduce((acc, placement) => ({
    left: Math.min(acc.left, placement.visualLeft),
    top: Math.min(acc.top, placement.visualTop),
    right: Math.max(acc.right, placement.visualRight),
    bottom: Math.max(acc.bottom, placement.visualBottom),
  }), {
    left: Number.POSITIVE_INFINITY,
    top: Number.POSITIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
    bottom: Number.NEGATIVE_INFINITY,
  });

  const visualWidth = visualBounds.right - visualBounds.left;
  const visualHeight = visualBounds.bottom - visualBounds.top;
  const horizontalSpace = bounds.width - visualWidth;
  const verticalSpace = bounds.height - visualHeight;
  const targetLeft = (offsetX + 1) / 2 * horizontalSpace;
  const targetTop = (offsetY + 1) / 2 * verticalSpace;
  const shiftX = targetLeft - visualBounds.left;
  const shiftY = targetTop - visualBounds.top;

  const textElements = columnPlacements.map(({ line, x, y }) => {
    const shiftedX = x + shiftX;
    const shiftedY = y + shiftY;

    return `<text x="${shiftedX}" y="${shiftedY}"
      style="
        writing-mode: vertical-rl;
        text-orientation: upright;
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        font-weight: ${fontWeight};
        fill: ${stampTextColor};
        letter-spacing: ${actualCharacterSpacing}em;
        dominant-baseline: text-before-edge;
        text-anchor: start;
      "
      filter="url(#stamp-text-texture)">${line}</text>`;
  }).join('\n    ');

  // For yang stamp, we need different rendering
  const stampContent = type === 'yin'
    ? `  <!-- Stamp background (阴章) -->
  <path d="${path}" fill="${stampBgColor}" filter="url(#stamp-ink-texture)" />

  <!-- Text -->
  ${textElements}`
    : `  <!-- Yang stamp background (阳章 - white background) -->
  <path d="${path}" fill="${stampBgColor}" filter="url(#stamp-ink-texture)" />

  <!-- Yang stamp border (阳章 - red border with custom width) -->
  <path d="${path}" fill="none" stroke="${stampColor}" stroke-width="${fmtNum(actualBorderWidth)}" filter="url(#stamp-border-texture)" />

  <!-- Text -->
  ${textElements}`;

  const svg = `<svg width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Realistic ink stamp texture - simulates paper fiber absorption and ink splatter -->
    <filter id="stamp-ink-texture" x="-20%" y="-20%" width="140%" height="140%">
      <!-- Step 1: Edge displacement for irregular border -->
      <feTurbulence type="fractalNoise" baseFrequency="${fmtNum(0.04 * filterScaleInv)}" numOctaves="4" seed="${seed + 123}" result="borderNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="borderNoise" scale="${fmtNum(18 * filterScale)}" xChannelSelector="R" yChannelSelector="G" result="displacedShape"/>

      <!-- Step 2: Create granular texture (paper fibers) - increased visibility -->
      <feTurbulence type="fractalNoise" baseFrequency="${fmtNum(0.4 * filterScaleInv)}" numOctaves="4" seed="${seed + 456}" result="grainNoise"/>

      <!-- Step 3: Create larger blotchy patterns (ink distribution) - more pronounced -->
      <feTurbulence type="turbulence" baseFrequency="${fmtNum(0.08 * filterScaleInv)}" numOctaves="2" seed="${seed + 789}" result="blotchNoise"/>

      <!-- Step 4: Combine grain and blotches using blend multiply -->
      <feBlend in="grainNoise" in2="blotchNoise" mode="multiply" result="combinedNoise"/>

      <!-- Step 5: Convert to alpha mask with threshold -->
      <feColorMatrix in="combinedNoise" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                1 1 1 0 0" result="noiseMask"/>

      <!-- Step 6: Enhance contrast to create MORE visible holes and variation -->
      <feComponentTransfer in="noiseMask" result="contrastMask">
        <feFuncA type="discrete" tableValues="0 0 0 0 0.2 0.4 0.6 0.75 0.88 0.95 1 1"/>
      </feComponentTransfer>

      <!-- Step 7: Apply texture mask to displaced shape -->
      <feComposite in="displacedShape" in2="contrastMask" operator="in" result="texturedShape"/>

      <!-- Step 8: Slight blur for natural ink spread -->
      <feGaussianBlur in="texturedShape" stdDeviation="${fmtNum(0.5 * filterScale)}" result="blurredInk"/>

      <!-- Step 9: Final opacity adjustment -->
      <feColorMatrix in="blurredInk" type="matrix"
        values="1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.98 0" result="finalStampShape"/>
    </filter>

    <!-- Border texture for yang stamp - similar to ink texture but for stroke -->
    <filter id="stamp-border-texture" x="-20%" y="-20%" width="140%" height="140%">
      <!-- Edge displacement -->
      <feTurbulence type="fractalNoise" baseFrequency="${fmtNum(0.04 * filterScaleInv)}" numOctaves="3" seed="${seed + 123}" result="borderNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="borderNoise" scale="${fmtNum(8 * filterScale)}" xChannelSelector="R" yChannelSelector="G" result="displacedBorder"/>

      <!-- Slight blur for natural ink spread -->
      <feGaussianBlur in="displacedBorder" stdDeviation="${fmtNum(0.3 * filterScale)}" result="blurredBorder"/>
    </filter>

    <!-- Text engraving texture - simulates carved/chiseled effect -->
    <filter id="stamp-text-texture" x="-10%" y="-10%" width="120%" height="120%">
      <!-- Primary noise for edge variation -->
      <feTurbulence type="fractalNoise" baseFrequency="${fmtNum(0.15 * filterScaleInv)}" numOctaves="4" seed="${seed}" result="textNoise"/>
      <!-- Reduced displacement to prevent text breaking apart -->
      <feDisplacementMap in="SourceGraphic" in2="textNoise" scale="${fmtNum(1.2 * filterScale)}" xChannelSelector="R" yChannelSelector="G" result="roughEdges"/>
      <!-- Secondary noise layer for more variation -->
      <feTurbulence type="turbulence" baseFrequency="${fmtNum(0.05 * filterScaleInv)}" numOctaves="2" seed="${seed + 999}" result="coarseNoise"/>
      <feDisplacementMap in="roughEdges" in2="coarseNoise" scale="${fmtNum(0.8 * filterScale)}" xChannelSelector="R" yChannelSelector="G" result="carvedText"/>
      <!-- Slight blur to smooth sharp artifacts -->
      <feGaussianBlur in="carvedText" stdDeviation="${fmtNum(0.3 * filterScale)}" result="smoothedText"/>
      <!-- Enhance contrast for crisp edges -->
      <feColorMatrix in="smoothedText" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1.2 -0.1" result="finalCarvedText"/>
    </filter>
  </defs>

${stampContent}
</svg>`;

  return svg;
}

/**
 * Stamp class for object-oriented usage
 */
export class Stamp {
  private options: Required<Pick<StampOptions, 'text' | 'type' | 'shape' | 'color' | 'textColor' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'offsetX' | 'offsetY' | 'columnSpacing' | 'characterSpacing' | 'paddingX' | 'paddingY' | 'borderScale' | 'noiseAmount' | 'borderPoints' | 'cornerRadius' | 'borderWidth' | 'regularShape' | 'seed'>> & Pick<StampOptions, 'columnSpacingPx' | 'characterSpacingPx' | 'paddingXPx' | 'paddingYPx' | 'columnWidthPx' | 'measuredColumnWidths' | 'measuredColumnHeights' | 'measuredColumnBoxes' | 'borderScaleX' | 'borderScaleY' | 'noiseAmountPx' | 'borderPointsPx' | 'cornerRadiusPx' | 'borderWidthPx'>;

  constructor(options: StampOptions) {
    const type = options.type || 'yin';
    this.options = {
      text: options.text,
      type,
      shape: options.shape || 'auto',
      color: options.color || '#C8102E',
      textColor: options.textColor || (type === 'yin' ? '#FFFFFF' : '#C8102E'),
      fontFamily: options.fontFamily || 'serif',
      fontSize: options.fontSize || 70,
      fontWeight: options.fontWeight || 'normal',
      offsetX: options.offsetX ?? 0,
      offsetY: options.offsetY ?? 0,
      columnSpacing: options.columnSpacing ?? 0.02,
      characterSpacing: options.characterSpacing ?? 0.05,
      paddingX: options.paddingX ?? 0.02,
      paddingY: options.paddingY ?? 0.02,
      columnSpacingPx: options.columnSpacingPx,
      characterSpacingPx: options.characterSpacingPx,
      paddingXPx: options.paddingXPx,
      paddingYPx: options.paddingYPx,
      columnWidthPx: options.columnWidthPx,
      measuredColumnWidths: options.measuredColumnWidths,
      measuredColumnHeights: options.measuredColumnHeights,
      measuredColumnBoxes: options.measuredColumnBoxes,
      borderScale: options.borderScale ?? 1.0,
      borderScaleX: options.borderScaleX,
      borderScaleY: options.borderScaleY,
      noiseAmount: options.noiseAmount ?? DEFAULT_NOISE_AMOUNT,
      borderPoints: options.borderPoints ?? DEFAULT_BORDER_POINTS,
      cornerRadius: options.cornerRadius ?? DEFAULT_CORNER_RADIUS,
      borderWidth: options.borderWidth ?? DEFAULT_BORDER_WIDTH,
      noiseAmountPx: options.noiseAmountPx,
      borderPointsPx: options.borderPointsPx,
      cornerRadiusPx: options.cornerRadiusPx,
      borderWidthPx: options.borderWidthPx,
      regularShape: options.regularShape ?? false,
      seed: options.seed || Date.now()
    };
  }

  /**
   * Generate the stamp path
   */
  generatePath(): StampResult {
    return generateStampPath(this.options);
  }

  /**
   * Generate complete SVG
   */
  toSVG(): string {
    return generateStamp(this.options);
  }

  /**
   * Update stamp options
   */
  update(options: Partial<StampOptions>): void {
    Object.assign(this.options, options);
  }
}

/**
 * Convenience function to create a stamp
 */
export function stamp(options: StampOptions): Stamp {
  return new Stamp(options);
}

/**
 * Measure actual text dimensions in browser environment
 * This function creates a temporary SVG to measure the actual rendered text size
 */
export function measureStampText(options: StampOptions): { width: number; height: number; columnWidths: number[]; columnHeights: number[]; columnBoxes: MeasuredColumnBox[] } | null {
  // Only works in browser environment
  if (typeof document === 'undefined') {
    console.warn('measureStampText only works in browser environment');
    return null;
  }

  const {
    text,
    fontFamily = 'serif',
    fontSize = 70,
    fontWeight = 'normal',
    characterSpacing = 0.05,
    characterSpacingPx,
  } = options;
  const actualCharacterSpacing = characterSpacingPx !== undefined ? characterSpacingPx / fontSize : characterSpacing;
  const measureOriginX = 500;
  const measureOriginY = 500;

  // Create temporary SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '1000');
  svg.setAttribute('height', '1000');
  svg.style.position = 'absolute';
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);

  const columnWidths: number[] = [];
  const columnHeights: number[] = [];
  const columnBoxes: MeasuredColumnBox[] = [];
  let maxWidth = 0;
  let maxHeight = 0;

  // Measure each column
  text.forEach((line) => {
    const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textElement.setAttribute('x', String(measureOriginX));
    textElement.setAttribute('y', String(measureOriginY));
    textElement.style.writingMode = 'vertical-rl';
    textElement.style.textOrientation = 'upright';
    textElement.style.fontFamily = fontFamily;
    textElement.style.fontSize = `${fontSize}px`;
    textElement.style.fontWeight = String(fontWeight);
    textElement.style.letterSpacing = `${actualCharacterSpacing}em`;
    textElement.style.dominantBaseline = 'text-before-edge';
    textElement.style.textAnchor = 'start';
    textElement.textContent = line;

    svg.appendChild(textElement);

    // Get bounding box
    const bbox = textElement.getBBox();
    columnWidths.push(bbox.width);
    columnHeights.push(bbox.height);
    columnBoxes.push({
      x: bbox.x - measureOriginX,
      y: bbox.y - measureOriginY,
      width: bbox.width,
      height: bbox.height,
    });
    maxWidth = Math.max(maxWidth, bbox.width);
    maxHeight = Math.max(maxHeight, bbox.height);

    svg.removeChild(textElement);
  });

  // Cleanup
  document.body.removeChild(svg);

  return {
    width: maxWidth,
    height: maxHeight,
    columnWidths,
    columnHeights,
    columnBoxes,
  };
}
