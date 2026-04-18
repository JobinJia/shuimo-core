/**
 * Traditional Chinese Seal Stamp Generator
 *
 * Generates irregular stamp shapes with customizable text, colors, and noise effects
 * to simulate authentic seal stamps used in traditional Chinese art.
 */

import * as opentype from "opentype.js";
import { createStampNoise } from "./StampNoise";
import { dsin, dcos, fmtNum } from "../utils/math";
import {
  calculateStampTextMetrics,
  calculateColumnCharPositions,
  hasFontMetrics,
  findFontMetrics,
} from "./StampMetrics";

// ─── Reference constants ────────────────────────────────────────────
// All distance defaults are expressed as ratios of fontSize.
// The reference font size (70px) is used to derive ratios from the
// original fixed pixel defaults so that `ratio × 70` recovers the
// legacy value exactly.

const REFERENCE_FONT_SIZE = 70;
const DEFAULT_NOISE_AMOUNT = 8 / REFERENCE_FONT_SIZE;
const DEFAULT_CORNER_RADIUS = 15 / REFERENCE_FONT_SIZE;
const DEFAULT_BORDER_WIDTH = 1 / REFERENCE_FONT_SIZE;
const DEFAULT_BORDER_POINTS = 24 / REFERENCE_FONT_SIZE;
const MEASURED_HEIGHT_BUFFER = 0.05;

/**
 * Stamp type: 阴章 (Yin) or 阳章 (Yang)
 * - yin: Red background with white text (default)
 * - yang: White background with red text and red border
 */
export type StampType = "yin" | "yang";

/**
 * Stamp shape: Control the background shape
 * - auto: Default irregular trapezoid based on text layout
 * - square: Square shape
 * - rectangle: Rectangular shape
 * - circle: Circular shape
 * - ellipse: Elliptical shape (non-standard ellipse)
 */
export type StampShape = "auto" | "square" | "rectangle" | "circle" | "ellipse";
export type StampTextCarving = "normal" | "strong" | "stone-cut";

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

  /** 字体文件 URL。用于异步字形路径渲染，例如 stone-cut 模式。 */
  fontUrl?: string;

  /** 字体二进制数据。提供后可直接用于字形路径渲染。 */
  fontData?: ArrayBuffer;

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

  /** 文字刀刻强度。normal 保持清晰可读，strong 增强边缘刀刻缺口，stone-cut 更偏石刻断裂感。 */
  textCarving?: StampTextCarving;

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
const FONT_CACHE = new Map<string, Promise<opentype.Font | null>>();

interface CornerRadii {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

/**
 * Noise function for stamp border distortion.
 * @param inwardNX/inwardNY — unit inward normal of the edge at this point.
 *   When provided, noise is projected onto this direction and only the inward
 *   component is kept (凹陷 only, no 凸起).
 */
type NoiseFn = (
  x: number,
  y: number,
  edgeProgress: number,
  inwardNX?: number,
  inwardNY?: number,
) => { x: number; y: number };

interface TextLayout {
  width: number;
  height: number;
  columnCount: number;
  maxChars: number;
  columnHeights: number[];
  columnWidth: number;
  columnWidths: number[];
}

interface GlyphPathCommand {
  type: string;
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

interface VerticalGlyphColumnMetrics {
  path: opentype.Path;
  box: MeasuredColumnBox;
  width: number;
  height: number;
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
    this.parts.push(
      `C ${fmtNum(c1x)} ${fmtNum(c1y)}, ${fmtNum(c2x)} ${fmtNum(c2y)}, ${fmtNum(x)} ${fmtNum(y)}`,
    );
    return this;
  }

  close(): this {
    this.parts.push("Z");
    return this;
  }

  toString(): string {
    return this.parts.join(" ");
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
 * @param inwardNX/inwardNY  Unit inward normal of this edge
 */
function generateEdgePoints(
  builder: PathBuilder,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  count: number,
  applyNoise: NoiseFn,
  fullNoise: boolean,
  inwardNX: number,
  inwardNY: number,
): void {
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const edgeProgress = fullNoise ? 1.0 : dsin(t * PI);
    const x = fromX + t * (toX - fromX);
    const y = fromY + t * (toY - fromY);
    const pt = applyNoise(x, y, edgeProgress, inwardNX, inwardNY);
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
  measuredColumnHeights?: number[],
  fontFamily?: string,
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
    // Use pre-computed font metrics for cross-platform consistency
    const fontMetrics = calculateStampTextMetrics(text, fontSize, {
      fontFamily,
      characterSpacing,
      columnSpacing,
    });
    columnWidths = fontMetrics.columnWidths;
    columnWidth = Math.max(...columnWidths);
  }

  // Calculate height for each column with customizable character spacing
  let columnHeights: number[];

  if (measuredColumnHeights && measuredColumnHeights.length === text.length) {
    // Use actual measured heights when available (most accurate)
    columnHeights = measuredColumnHeights;
  } else {
    // Use pre-computed font metrics for cross-platform consistency
    const fontMetrics = calculateStampTextMetrics(text, fontSize, {
      fontFamily,
      characterSpacing,
      columnSpacing,
    });
    columnHeights = fontMetrics.columnHeights;
  }

  // Find longest column
  const maxChars = Math.max(...text.map((t) => t.length));
  const totalHeight = Math.max(...columnHeights);

  // Total width = sum of all column widths + gaps between columns
  const totalWidth =
    columnWidths.reduce((sum, w) => sum + w, 0) + (text.length - 1) * fontSize * columnSpacing;

  return {
    width: totalWidth,
    height: totalHeight,
    columnCount: text.length,
    maxChars,
    columnHeights,
    columnWidth,
    columnWidths,
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
  fontFamily?: string,
): TextLayout {
  const bufferedHeights =
    measuredColumnHeights?.length === text.length
      ? measuredColumnHeights.map((height) => height + getMeasuredHeightBuffer(fontSize))
      : undefined;

  const result = calculateTextBounds(
    text,
    fontSize,
    characterSpacing,
    columnSpacing,
    columnWidthPx,
    measuredColumnWidths,
    bufferedHeights,
    fontFamily,
  );

  // Add overflow buffer for border sizing: some glyphs (e.g. '兰' height=1.014)
  // exceed 1.0 em, so borders need extra space to prevent text clipping.
  // This buffer is NOT applied in generateStamp's text positioning metrics.
  const overflowBuffer = fontSize * 0.03;
  result.columnHeights = result.columnHeights.map((h) => h + overflowBuffer);
  result.height = Math.max(...result.columnHeights);
  return result;
}

interface ProfilePoint {
  x: number;
  y: number;
}

interface VisualColumnPlacement {
  x: number;
  y: number;
  visualLeft: number;
  visualTop: number;
  visualRight: number;
  visualBottom: number;
}

interface VisualTextFrame {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  placements: VisualColumnPlacement[];
}

function interpolateProfileY(points: ProfilePoint[], x: number): number {
  if (points.length === 0) return 0;

  if (x <= points[0].x) return points[0].y;

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

function calculateVisualTextFrame(
  columnWidths: number[],
  columnHeights: number[],
  columnGap: number,
  measuredBoxes?: MeasuredColumnBox[],
): VisualTextFrame {
  const totalWidth =
    columnWidths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, columnWidths.length - 1) * columnGap;
  let currentRight = totalWidth;

  const placements = columnWidths.map((columnWidth, index) => {
    const x = currentRight;

    const y = 0;
    const box = measuredBoxes?.[index];
    const visualLeft = x + (box ? box.x : -columnWidth);
    const visualTop = y + (box ? box.y : 0);
    const visualRight = visualLeft + (box?.width ?? columnWidth);
    const visualBottom = visualTop + (box?.height ?? columnHeights[index]);

    const placement = {
      x,
      y,
      visualLeft,
      visualTop,
      visualRight,
      visualBottom,
    };

    currentRight -= columnWidth + columnGap;

    return placement;
  });

  const bounds = placements.reduce(
    (acc, placement) => ({
      left: Math.min(acc.left, placement.visualLeft),
      top: Math.min(acc.top, placement.visualTop),
      right: Math.max(acc.right, placement.visualRight),
      bottom: Math.max(acc.bottom, placement.visualBottom),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    ...bounds,
    width: bounds.right - bounds.left,
    height: bounds.bottom - bounds.top,
    placements,
  };
}

function shouldUseCellCenteredFrame(shape: StampShape | undefined, columnCount: number): boolean {
  return (shape === "circle" || shape === "ellipse") && columnCount === 1;
}

function getActualCharacterSpacingPx(options: StampOptions): number {
  const fontSize = options.fontSize ?? 70;
  if (options.characterSpacingPx !== undefined) return options.characterSpacingPx;
  return fontSize * (options.characterSpacing ?? 0.05);
}

function hashNoise(seed: number, index: number, salt: number): number {
  const value = Math.sin(seed * 12.9898 + index * 78.233 + salt * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function quantize(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function translateGlyphPath(path: opentype.Path, dx: number, dy: number): opentype.Path {
  const translated = new opentype.Path();
  translated.commands = path.commands.map((command) => {
    const next = { ...command } as GlyphPathCommand;

    if (typeof next.x === "number") next.x += dx;
    if (typeof next.y === "number") next.y += dy;
    if (typeof next.x1 === "number") next.x1 += dx;
    if (typeof next.y1 === "number") next.y1 += dy;
    if (typeof next.x2 === "number") next.x2 += dx;
    if (typeof next.y2 === "number") next.y2 += dy;

    return next;
  });
  return translated;
}

function angularizeGlyphPath(
  path: opentype.Path,
  seed: number,
  columnIndex: number,
  charIndex: number,
): opentype.Path {
  const angularPath = new opentype.Path();
  const grid = 1.4;
  const jitter = 0.9;
  let previousPoint = { x: 0, y: 0 };

  angularPath.commands = path.commands.map((command, commandIndex) => {
    const next = { ...command } as GlyphPathCommand;
    const localSeed = seed + columnIndex * 131 + charIndex * 17 + commandIndex * 7;

    const moveCoord = (value: number, axisSalt: number) => {
      const stepped = quantize(value, grid);
      const delta = (hashNoise(localSeed, commandIndex, axisSalt) - 0.5) * jitter;
      return stepped + delta;
    };

    if (typeof next.x === "number") next.x = moveCoord(next.x, 11);
    if (typeof next.y === "number") next.y = moveCoord(next.y, 23);

    if (typeof next.x1 === "number" && typeof next.x === "number") {
      const pulled = previousPoint.x + (next.x1 - previousPoint.x) * 0.42;
      next.x1 = clamp(
        moveCoord(pulled, 31),
        Math.min(previousPoint.x, next.x) - 8,
        Math.max(previousPoint.x, next.x) + 8,
      );
    }
    if (typeof next.y1 === "number" && typeof next.y === "number") {
      const pulled = previousPoint.y + (next.y1 - previousPoint.y) * 0.42;
      next.y1 = clamp(
        moveCoord(pulled, 41),
        Math.min(previousPoint.y, next.y) - 8,
        Math.max(previousPoint.y, next.y) + 8,
      );
    }
    if (typeof next.x2 === "number" && typeof next.x === "number") {
      const pulled = next.x + (next.x2 - next.x) * 0.42;
      next.x2 = clamp(
        moveCoord(pulled, 53),
        Math.min(previousPoint.x, next.x) - 8,
        Math.max(previousPoint.x, next.x) + 8,
      );
    }
    if (typeof next.y2 === "number" && typeof next.y === "number") {
      const pulled = next.y + (next.y2 - next.y) * 0.42;
      next.y2 = clamp(
        moveCoord(pulled, 67),
        Math.min(previousPoint.y, next.y) - 8,
        Math.max(previousPoint.y, next.y) + 8,
      );
    }

    if (typeof next.x === "number" && typeof next.y === "number")
      previousPoint = { x: next.x, y: next.y };

    return next;
  });

  return angularPath;
}

function extractFillFromStyle(styleText: string | null): string | null {
  if (!styleText) return null;

  const match = styleText.match(/fill:\s*([^;]+)/);
  return match?.[1]?.trim() ?? null;
}

function measureVerticalGlyphColumn(
  font: opentype.Font,
  line: string,
  fontSize: number,
  characterSpacingPx: number,
): VerticalGlyphColumnMetrics {
  const chars = Array.from(line);
  const combinedPath = new opentype.Path();

  if (chars.length === 0) {
    return {
      path: combinedPath,
      box: { x: 0, y: 0, width: 0, height: 0 },
      width: 0,
      height: 0,
    };
  }

  const glyphMetrics = chars.map((char) => {
    const basePath = font.getPath(char, 0, 0, fontSize);
    const bbox = basePath.getBoundingBox();
    return {
      char,
      width: Math.max(1, bbox.x2 - bbox.x1),
      height: Math.max(1, bbox.y2 - bbox.y1),
      bbox,
    };
  });

  // Use advance width as the column width (not ink bounds) so that
  // the stamp border is sized proportionally to how characters are spaced.
  // Ink bounds are much narrower than advance width for CJK characters.
  const advanceWidths = chars.map((char) => {
    const glyph = font.charToGlyph(char);
    return glyph.advanceWidth ? (glyph.advanceWidth / font.unitsPerEm) * fontSize : fontSize;
  });
  const maxAdvanceWidth = Math.max(...advanceWidths);
  const maxInkWidth = Math.max(...glyphMetrics.map((item) => item.width));

  let currentTop = 0;

  glyphMetrics.forEach((glyph) => {
    const translateX = -glyph.bbox.x1 + (maxInkWidth - glyph.width) / 2;
    const translateY = currentTop - glyph.bbox.y1;
    const rawPath = font.getPath(glyph.char, translateX, translateY, fontSize);
    combinedPath.commands.push(...rawPath.commands);
    currentTop += glyph.height + characterSpacingPx;
  });

  const bbox = combinedPath.getBoundingBox();
  const inkWidth = Math.max(0, bbox.x2 - bbox.x1);
  const width = Math.max(maxAdvanceWidth, inkWidth);
  const height = Math.max(0, bbox.y2 - bbox.y1);
  // Center the glyph ink within the advance width so left/right margins are equal
  const centeringShift = (width - inkWidth) / 2;

  return {
    path: combinedPath,
    box: {
      x: -(bbox.x2 + centeringShift),
      y: bbox.y1,
      width,
      height,
    },
    width,
    height,
  };
}

function measureStampTextWithGlyphFont(
  options: StampOptions,
  font: opentype.Font,
): {
  width: number;
  height: number;
  columnWidths: number[];
  columnHeights: number[];
  columnBoxes: MeasuredColumnBox[];
} | null {
  const { text, fontSize = 70 } = options;
  if (!text || text.length === 0) return null;

  const characterSpacingPx = getActualCharacterSpacingPx(options);
  const columns = text.map((line) =>
    measureVerticalGlyphColumn(font, line, fontSize, characterSpacingPx),
  );

  return {
    width: Math.max(...columns.map((column) => column.width), 0),
    height: Math.max(...columns.map((column) => column.height), 0),
    columnWidths: columns.map((column) => column.width),
    columnHeights: columns.map((column) => column.height),
    columnBoxes: columns.map((column) => column.box),
  };
}

function buildVerticalGlyphPath(
  font: opentype.Font,
  line: string,
  fontSize: number,
  characterSpacingPx: number,
  desiredBox: MeasuredColumnBox | undefined,
  x: number,
  y: number,
  seed: number,
  columnIndex: number,
): string {
  const combinedPath = new opentype.Path();
  const chars = Array.from(line);
  const glyphMetrics = chars.map((char) => {
    const basePath = font.getPath(char, 0, 0, fontSize);
    const bbox = basePath.getBoundingBox();
    return {
      char,
      width: Math.max(1, bbox.x2 - bbox.x1),
      height: Math.max(1, bbox.y2 - bbox.y1),
      bbox,
    };
  });

  const maxWidth = Math.max(...glyphMetrics.map((item) => item.width), 0);
  let currentTop = 0;

  glyphMetrics.forEach((glyph, charIndex) => {
    const translateX = -glyph.bbox.x1 + (maxWidth - glyph.width) / 2;
    const translateY = currentTop - glyph.bbox.y1;
    const rawPath = font.getPath(glyph.char, translateX, translateY, fontSize);
    const angularPath = angularizeGlyphPath(rawPath, seed, columnIndex, charIndex);
    combinedPath.commands.push(...angularPath.commands);
    currentTop += glyph.height + characterSpacingPx;
  });

  const bbox = combinedPath.getBoundingBox();
  const inkWidth = Math.max(0, bbox.x2 - bbox.x1);
  // Center ink within the desired box (advance width may be wider than ink)
  const centeringOffset = desiredBox ? (desiredBox.width - inkWidth) / 2 : 0;
  const desiredLeft = x + (desiredBox?.x ?? -bbox.x2) + centeringOffset;
  const desiredTop = y + (desiredBox?.y ?? bbox.y1);
  const translated = translateGlyphPath(combinedPath, desiredLeft - bbox.x1, desiredTop - bbox.y1);
  return translated.toPathData(2);
}

async function loadGlyphFont(options: StampOptions): Promise<opentype.Font | null> {
  if (options.fontData) {
    try {
      return opentype.parse(options.fontData);
    } catch {
      return null;
    }
  }

  if (!options.fontUrl || typeof fetch === "undefined") return null;

  const cached = FONT_CACHE.get(options.fontUrl);
  if (cached) return cached;

  const fontPromise = (async () => {
    try {
      const response = await fetch(options.fontUrl!);
      if (!response.ok) return null;

      const fontBuffer = await response.arrayBuffer();
      return opentype.parse(fontBuffer);
    } catch {
      return null;
    }
  })();

  FONT_CACHE.set(options.fontUrl, fontPromise);
  return fontPromise;
}

function replaceTextElementsWithGlyphPaths(
  svg: string,
  options: StampOptions,
  measured: { columnBoxes: MeasuredColumnBox[] },
  font: opentype.Font,
): string {
  if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") return svg;

  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svg, "image/svg+xml");
  const textElements = Array.from(svgDocument.querySelectorAll("text"));
  if (textElements.length !== options.text.length) return svg;

  const fontSize = options.fontSize ?? 70;
  const characterSpacingPx = getActualCharacterSpacingPx(options);
  const seed = options.seed ?? 0;

  textElements.forEach((textElement, index) => {
    const x = Number.parseFloat(textElement.getAttribute("x") ?? "0");
    const y = Number.parseFloat(textElement.getAttribute("y") ?? "0");
    const fill =
      extractFillFromStyle(textElement.getAttribute("style")) ??
      textElement.getAttribute("fill") ??
      "#FFFFFF";
    const filter = textElement.getAttribute("filter");
    const glyphPath = buildVerticalGlyphPath(
      font,
      options.text[index],
      fontSize,
      characterSpacingPx,
      measured.columnBoxes[index],
      x,
      y,
      seed,
      index,
    );

    const pathElement = svgDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    pathElement.setAttribute("d", glyphPath);
    pathElement.setAttribute("fill", fill);
    pathElement.setAttribute("fill-rule", "nonzero");
    if (filter) pathElement.setAttribute("filter", filter);

    textElement.replaceWith(pathElement);
  });

  return new XMLSerializer().serializeToString(svgDocument);
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
  regularShape: boolean,
): string {
  if (regularShape) {
    const cr = randomizeCornerRadii(cornerRadius, random, true);
    return buildRegularQuadPath(size, size, cr);
  }

  // Small uniform outer corner rounding — inner angle stays 90°, outer tip slightly rounded
  const r = Math.min(cornerRadius, size * 0.03);
  const pointsPerEdge = Math.floor(borderPoints / 4);
  const b = new PathBuilder();

  // Start after top-left outer rounding
  b.moveTo(r, 0);

  // Top edge → inward is downward (0, +1)
  generateEdgePoints(b, r, 0, size - r, 0, pointsPerEdge, applyNoise, true, 0, 1);

  // Top-right corner: small outer rounding
  b.quadTo(size, 0, size, r);

  // Right edge → inward is leftward (-1, 0)
  generateEdgePoints(b, size, r, size, size - r, pointsPerEdge, applyNoise, false, -1, 0);

  // Bottom-right corner
  b.quadTo(size, size, size - r, size);

  // Bottom edge → inward is upward (0, -1)
  generateEdgePoints(b, size - r, size, r, size, pointsPerEdge, applyNoise, false, 0, -1);

  // Bottom-left corner
  b.quadTo(0, size, 0, size - r);

  // Left edge → inward is rightward (+1, 0)
  generateEdgePoints(b, 0, size - r, 0, r, pointsPerEdge, applyNoise, false, 1, 0);

  // Close back to top-left
  b.quadTo(0, 0, r, 0);
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
  regularShape: boolean,
): string {
  if (regularShape) {
    const cr = randomizeCornerRadii(cornerRadius, random, true);
    return buildRegularQuadPath(width, height, cr);
  }

  // Small uniform outer corner rounding — inner angle stays 90°, outer tip slightly rounded
  const r = Math.min(cornerRadius, Math.min(width, height) * 0.03);
  const pointsPerEdge = Math.floor(borderPoints / 4);
  const b = new PathBuilder();

  b.moveTo(r, 0);

  // Top edge → inward is downward (0, +1)
  generateEdgePoints(b, r, 0, width - r, 0, pointsPerEdge, applyNoise, true, 0, 1);

  // Top-right corner
  b.quadTo(width, 0, width, r);

  // Right edge → inward is leftward (-1, 0)
  generateEdgePoints(b, width, r, width, height - r, pointsPerEdge, applyNoise, false, -1, 0);

  // Bottom-right corner
  b.quadTo(width, height, width - r, height);

  // Bottom edge → inward is upward (0, -1)
  generateEdgePoints(b, width - r, height, r, height, pointsPerEdge, applyNoise, false, 0, -1);

  // Bottom-left corner
  b.quadTo(0, height, 0, height - r);

  // Left edge → inward is rightward (+1, 0)
  generateEdgePoints(b, 0, height - r, 0, r, pointsPerEdge, applyNoise, false, 1, 0);

  // Close back to top-left
  b.quadTo(0, 0, r, 0);
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
  regularShape: boolean,
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

    // Inward normal for circle = toward center = -(cos, sin)
    const inwardNX = -dcos(angle);
    const inwardNY = -dsin(angle);

    const edgeProgress = 1.0;
    const pt = applyNoise(x, y, edgeProgress, inwardNX, inwardNY);

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
  regularShape: boolean,
): string {
  if (regularShape) {
    const rx = width / 2;
    const ry = height / 2;
    return buildRegularEllipsePath(rx, ry, rx, ry);
  }

  const pointsPerEdge = Math.floor(borderPoints / 4);
  const b = new PathBuilder();

  // Shape center for radial inward normal on curved segments
  const shapeCX = width / 2;
  const shapeCY = height / 2;

  if (width > height) {
    // Horizontal capsule: straight top/bottom + curved left/right
    const radius = height / 2;
    const curveRadius = radius * 0.5;
    const straightLength = width - radius * 2;

    const start = applyNoise(curveRadius, 0, 0);
    b.moveTo(start.x, start.y);

    // Top edge (straight) → inward downward (0, +1)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(curveRadius + t * straightLength, 0, edgeProgress, 0, 1);
      b.lineTo(pt.x, pt.y);
    }

    // Right curve (top to bottom) → radial inward toward shape center
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = -PI / 2 + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = width - curveRadius + dcos(angle) * curveRadius;
      const y = radius + dsin(angle) * radius;
      // Inward normal: toward shape center
      const dx = x - shapeCX;
      const dy = y - shapeCY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pt = applyNoise(x, y, edgeProgress, -dx / d, -dy / d);
      b.lineTo(pt.x, pt.y);
    }

    // Bottom edge (right to left) → inward upward (0, -1)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(width - curveRadius - t * straightLength, height, edgeProgress, 0, -1);
      b.lineTo(pt.x, pt.y);
    }

    // Left curve (bottom to top) → radial inward toward shape center
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = PI / 2 + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = curveRadius + dcos(angle) * curveRadius;
      const y = radius + dsin(angle) * radius;
      const dx = x - shapeCX;
      const dy = y - shapeCY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pt = applyNoise(x, y, edgeProgress, -dx / d, -dy / d);
      b.lineTo(pt.x, pt.y);
    }
  } else {
    // Vertical capsule: straight left/right + curved top/bottom
    const radius = width / 2;
    const curveRadius = radius * 0.5;
    const straightLength = height - curveRadius * 2;

    const start = applyNoise(0, curveRadius, 0);
    b.moveTo(start.x, start.y);

    // Top curve (left to right) → radial inward toward shape center
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = PI + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = radius + dcos(angle) * radius;
      const y = curveRadius + dsin(angle) * curveRadius;
      const dx = x - shapeCX;
      const dy = y - shapeCY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pt = applyNoise(x, y, edgeProgress, -dx / d, -dy / d);
      b.lineTo(pt.x, pt.y);
    }

    // Right edge (top to bottom) → inward leftward (-1, 0)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(width, curveRadius + t * straightLength, edgeProgress, -1, 0);
      b.lineTo(pt.x, pt.y);
    }

    // Bottom curve (right to left) → radial inward toward shape center
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = 0 + t * PI;
      const edgeProgress = dsin(t * PI);
      const x = radius + dcos(angle) * radius;
      const y = height - curveRadius + dsin(angle) * curveRadius;
      const dx = x - shapeCX;
      const dy = y - shapeCY;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pt = applyNoise(x, y, edgeProgress, -dx / d, -dy / d);
      b.lineTo(pt.x, pt.y);
    }

    // Left edge (bottom to top) → inward rightward (+1, 0)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const pt = applyNoise(0, height - curveRadius - t * straightLength, edgeProgress, 1, 0);
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
    shape = "auto",
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
    seed = Date.now(),
  } = options;

  // Resolve actual pixel values — *Px takes precedence over fontSize-relative values
  const actualColumnSpacing =
    columnSpacingPx !== undefined ? columnSpacingPx / fontSize : columnSpacing;
  const actualCharacterSpacing =
    characterSpacingPx !== undefined ? characterSpacingPx / fontSize : characterSpacing;
  const actualPaddingX = paddingXPx !== undefined ? paddingXPx : fontSize * paddingX;
  const actualPaddingY = paddingYPx !== undefined ? paddingYPx : fontSize * paddingY;
  const actualNoiseAmount = noiseAmountPx ?? fontSize * noiseAmount;
  const actualBorderPoints = Math.round(borderPointsPx ?? fontSize * borderPoints);
  const actualCornerRadius = cornerRadiusPx ?? fontSize * cornerRadius;

  // Early return if no valid text
  if (!text || text.length === 0 || text.every((t) => !t || t.trim().length === 0)) {
    const defaultSize = 100;
    return {
      path: `M 0 0 L ${defaultSize} 0 L ${defaultSize} ${defaultSize} L 0 ${defaultSize} Z`,
      bounds: {
        left: 0,
        right: defaultSize,
        top: 0,
        bottom: defaultSize,
        width: defaultSize,
        height: defaultSize,
      },
    };
  }

  // Keep text array in original order
  // In vertical-rl mode with decreasing x coordinates, the first element will appear on the right
  // User provides ['A', 'B'], it will display as: B(left) A(right), reading right-to-left
  const displayText = [...text];

  const fontFamily = options.fontFamily ?? "serif";

  const textDims = getPathTextBounds(
    displayText,
    fontSize,
    actualCharacterSpacing,
    actualColumnSpacing,
    columnWidthPx,
    options.measuredColumnWidths,
    options.measuredColumnHeights,
    fontFamily,
  );
  const measuredBoxes =
    options.measuredColumnBoxes?.length === displayText.length
      ? options.measuredColumnBoxes
      : undefined;
  const bufferedMeasuredBoxes = measuredBoxes?.map((box) => {
    const verticalBuffer = getMeasuredHeightBuffer(fontSize);
    return {
      ...box,
      y: box.y - verticalBuffer / 2,
      height: box.height + verticalBuffer,
    };
  });
  const visualFrame = calculateVisualTextFrame(
    textDims.columnWidths,
    textDims.columnHeights,
    fontSize * actualColumnSpacing,
    bufferedMeasuredBoxes,
  );
  // Calculate column positions and heights
  const columnData = displayText.map((line, index) => ({
    height: bufferedMeasuredBoxes
      ? visualFrame.placements[index].visualBottom - visualFrame.top
      : textDims.columnHeights[index],
    text: line,
  }));

  // Use separate horizontal and vertical padding (now using actualPaddingX/Y which can be absolute or relative)
  const horizontalPadding = actualPaddingX;
  const verticalPadding = actualPaddingY;

  // Calculate base dimensions with padding
  const baseWidth = visualFrame.width + horizontalPadding * 2;
  const baseRightHeight = columnData[0].height + verticalPadding * 2;
  const baseLeftHeight = columnData[columnData.length - 1].height + verticalPadding * 2;
  const tallestColumnHeight =
    Math.max(...columnData.map((column) => column.height)) + verticalPadding * 2;

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

  // Helper function to apply improved Perlin noise.
  // When an inward normal is provided, noise is projected onto that direction
  // and only the inward component is kept — no protrusions (凸起), no tangential drift.
  const applyNoise: NoiseFn = (x, y, edgeProgress, inwardNX, inwardNY) => {
    // edgeProgress: 0 at corner, 1 at middle of edge
    const cornerFactor = edgeProgress;

    const noiseScale = 0.015;
    const noiseX = noise.noise3D(x * noiseScale, y * noiseScale, 0);
    const noiseY = noise.noise3D(x * noiseScale, y * noiseScale, 100);

    const totalNoiseX = noiseX * actualNoiseAmount * cornerFactor;
    const totalNoiseY = noiseY * actualNoiseAmount * cornerFactor;

    if (inwardNX !== undefined && inwardNY !== undefined) {
      // Project noise vector onto the inward normal
      const inwardProj = totalNoiseX * inwardNX + totalNoiseY * inwardNY;
      // Only keep the inward component (positive projection = inward displacement)
      const inward = Math.max(0, inwardProj);
      return {
        x: x + inward * inwardNX,
        y: y + inward * inwardNY,
      };
    }

    // Fallback: raw noise (used at corners with edgeProgress=0 where noise is zero)
    return { x: x + totalNoiseX, y: y + totalNoiseY };
  };

  // Generate path based on shape
  let path = "";
  let bounds: StampResult["bounds"];

  if (shape === "square") {
    // Square: create a compact square based on text dimensions with padding and border scale
    const textWidth = visualFrame.width;
    const textHeight = visualFrame.height;
    const baseSize = Math.max(textWidth + horizontalPadding * 2, textHeight + verticalPadding * 2);
    // For square, use the average of scaleX and scaleY to maintain square shape
    const avgScale = (scaleX + scaleY) / 2;
    const size = baseSize * avgScale;

    path = generateSquarePath(
      size,
      actualBorderPoints,
      actualCornerRadius,
      random,
      applyNoise,
      regularShape,
    );
    bounds = {
      left: 0,
      right: size,
      top: 0,
      bottom: size,
      width: size,
      height: size,
    };
  } else if (shape === "rectangle") {
    // Rectangle: fits text dimensions with padding and border scale
    const textWidth = visualFrame.width;
    const textHeight = visualFrame.height;
    const width = (textWidth + horizontalPadding * 2) * scaleX;
    const height = (textHeight + verticalPadding * 2) * scaleY;

    path = generateRectanglePath(
      width,
      height,
      actualBorderPoints,
      actualCornerRadius,
      random,
      applyNoise,
      regularShape,
    );
    bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width,
      height,
    };
  } else if (shape === "circle") {
    // Circle: fits text dimensions with padding and border scale
    const textWidth = visualFrame.width;
    const textHeight = visualFrame.height;
    const baseDiameter = Math.max(
      textWidth + horizontalPadding * 2,
      textHeight + verticalPadding * 2,
    );
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
      height: diameter,
    };
  } else if (shape === "ellipse") {
    // Ellipse: non-standard ellipse design with padding and border scale
    const textWidth = visualFrame.width;
    const textHeight = visualFrame.height;

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

    width -= 2;
    path = generateEllipsePath(width, height, actualBorderPoints, applyNoise, regularShape);
    bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width,
      height,
    };
  } else {
    // Auto (default): trapezoid based on text layout
    const textBlockLeft = (maxWidth - visualFrame.width) / 2;
    const textBlockRight = maxWidth - textBlockLeft;
    const autoProfile: ProfilePoint[] = [{ x: 0, y: leftHeight }];

    for (let index = 0; index < columnData.length; index++) {
      const placement = visualFrame.placements[index];
      const columnCenter =
        textBlockLeft +
        (placement.visualLeft - visualFrame.left) +
        (placement.visualRight - placement.visualLeft) / 2;
      const columnBottom = (columnData[index].height + verticalPadding * 2) * scaleY;

      autoProfile.push({ x: columnCenter, y: columnBottom });
    }

    autoProfile.push({ x: maxWidth, y: rightHeight });
    autoProfile.sort((a, b) => a.x - b.x);

    bounds = {
      left: 0,
      right: maxWidth,
      top: 0,
      bottom: tallestColumnHeight * scaleY,
      width: maxWidth,
      height: tallestColumnHeight * scaleY,
    };

    const pointsPerEdge = Math.floor(actualBorderPoints / 4);
    const r = Math.min(
      actualCornerRadius,
      Math.min(maxWidth, Math.max(leftHeight, rightHeight)) * 0.03,
    );

    const b = new PathBuilder();

    // Top-left corner: small outer rounding
    b.moveTo(r, 0);

    // Top edge → inward downward (0, +1)
    generateEdgePoints(b, r, 0, maxWidth - r, 0, pointsPerEdge, applyNoise, true, 0, 1);

    // Top-right corner
    b.quadTo(maxWidth, 0, maxWidth, r);

    // Right edge → inward leftward (-1, 0)
    generateEdgePoints(
      b,
      maxWidth,
      r,
      maxWidth,
      rightHeight - r,
      pointsPerEdge,
      applyNoise,
      false,
      -1,
      0,
    );

    // Bottom-right corner
    b.quadTo(maxWidth, rightHeight, maxWidth - r, rightHeight);

    // Bottom edge (trapezoid: right→left with height interpolation) → inward upward (0, -1)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = dsin(t * PI);
      const xPos = maxWidth - r - t * (maxWidth - r - r);
      const yPos = interpolateProfileY(autoProfile, xPos);
      const pt = applyNoise(xPos, yPos, edgeProgress, 0, -1);
      b.lineTo(pt.x, pt.y);
    }

    // Bottom-left corner
    b.quadTo(0, leftHeight, 0, leftHeight - r);

    // Left edge → inward rightward (+1, 0)
    generateEdgePoints(b, 0, leftHeight - r, 0, r, pointsPerEdge, applyNoise, false, 1, 0);

    // Close back to top-left
    b.quadTo(0, 0, r, 0);
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
    shape = "auto",
    type = "yin",
    color = "#C8102E",
    fontFamily = "serif",
    fontSize = 70,
    fontWeight = "normal",
    offsetX = 0,
    offsetY = 0,
    columnSpacing = 0.02,
    characterSpacing = 0.05,
    columnSpacingPx,
    characterSpacingPx,
    columnWidthPx,
    borderWidth = DEFAULT_BORDER_WIDTH,
    textCarving = "normal",
    seed = Date.now(),
  } = options;

  // Resolve actual pixel values — *Px takes precedence over fontSize-relative values
  const actualBorderWidth = options.borderWidthPx ?? fontSize * borderWidth;
  const actualColumnSpacing =
    columnSpacingPx !== undefined ? columnSpacingPx / fontSize : columnSpacing;
  const actualCharacterSpacing =
    characterSpacingPx !== undefined ? characterSpacingPx / fontSize : characterSpacing;

  // SVG filter scaling — keep visual texture density consistent across font sizes
  const filterScale = fontSize / REFERENCE_FONT_SIZE;
  const filterScaleInv = REFERENCE_FONT_SIZE / fontSize;
  const carvingProfile =
    textCarving === "stone-cut"
      ? {
          coreErode: 0.12,
          edgeNoiseType: "turbulence",
          edgeFrequency: 0.28,
          edgeDisplacement: 1.9,
          edgePosterizeTable: "0 0.18 0.18 0.5 0.5 0.82 0.82 1",
          chipFrequency: 0.14,
          chipThreshold: -0.18,
          chipTable: "0 0 0 1 1 1 1",
          grainFrequency: 0.46,
          grainThreshold: -0.5,
          grainTable: "0 0 0 0 1 1",
          alphaGain: 1.03,
          alphaBias: -0.04,
        }
      : textCarving === "strong"
        ? {
            coreErode: 0.14,
            edgeNoiseType: "fractalNoise",
            edgeFrequency: 0.22,
            edgeDisplacement: 1.45,
            edgePosterizeTable: "",
            chipFrequency: 0.11,
            chipThreshold: -0.26,
            chipTable: "0 0 0 0 1 1 1",
            grainFrequency: 0.38,
            grainThreshold: -0.62,
            grainTable: "0 0 0 0 0 1",
            alphaGain: 1.08,
            alphaBias: -0.03,
          }
        : {
            coreErode: 0.18,
            edgeNoiseType: "fractalNoise",
            edgeFrequency: 0.18,
            edgeDisplacement: 1.1,
            edgePosterizeTable: "",
            chipFrequency: 0.09,
            chipThreshold: -0.32,
            chipTable: "0 0 0 0 1 1 1",
            grainFrequency: 0.32,
            grainThreshold: -0.7,
            grainTable: "0 0 0 0 0 1",
            alphaGain: 1.12,
            alphaBias: -0.02,
          };

  // Early return if no valid text
  if (!text || text.length === 0 || text.every((t) => !t || t.trim().length === 0)) {
    return '<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"></svg>';
  }

  // Set default colors based on stamp type
  const stampColor = color;
  const stampTextColor = options.textColor || (type === "yin" ? "#FFFFFF" : "#C8102E");
  const stampBgColor = type === "yin" ? stampColor : "#FFFFFF";

  // Yin stamps with straight-edge shapes use regularShape; ellipse/circle keep border noise
  const yinStraightShapes = type === "yin" && shape !== "ellipse" && shape !== "circle";
  const { path, bounds } = generateStampPath(
    yinStraightShapes ? { ...options, regularShape: true } : options,
  );

  // Keep text array in original order (same as in generateStampPath)
  const displayText = [...text];

  const textDims = calculateTextBounds(
    displayText,
    fontSize,
    actualCharacterSpacing,
    actualColumnSpacing,
    columnWidthPx,
    options.measuredColumnWidths,
    options.measuredColumnHeights,
    fontFamily,
  );
  const columnWidths = textDims.columnWidths;
  const columnHeights = textDims.columnHeights;
  const columnGap = fontSize * actualColumnSpacing;
  const measuredBoxes =
    options.measuredColumnBoxes?.length === displayText.length
      ? options.measuredColumnBoxes
      : undefined;
  // Use the same buffered boxes as generateStampPath for consistent sizing/centering
  const bufferedBoxes = measuredBoxes?.map((box) => {
    const verticalBuffer = getMeasuredHeightBuffer(fontSize);
    return { ...box, y: box.y - verticalBuffer / 2, height: box.height + verticalBuffer };
  });
  const positioningBoxes = shouldUseCellCenteredFrame(shape, displayText.length)
    ? undefined
    : bufferedBoxes;
  const visualFrame = calculateVisualTextFrame(
    columnWidths,
    columnHeights,
    columnGap,
    positioningBoxes,
  );
  const visualWidth = visualFrame.width;
  const visualHeight = visualFrame.height;
  const horizontalSpace = bounds.width - visualWidth;
  const verticalSpace = bounds.height - visualHeight;
  const targetLeft = ((offsetX + 1) / 2) * horizontalSpace;
  const targetTop = ((offsetY + 1) / 2) * verticalSpace;
  let ellipseMarginShift = 0;
  if (shape === "ellipse") {
    ellipseMarginShift = type === "yin" ? 1.0 : -2.0;
  }
  const shiftX = targetLeft - visualFrame.left + ellipseMarginShift;
  const shiftY = targetTop - visualFrame.top;

  // One <text> element per column — required for replaceTextElementsWithGlyphPaths
  // which converts these to cross-platform SVG paths from the font file.
  const textElements = visualFrame.placements
    .map(({ x, y }, index) => {
      const shiftedX = x + shiftX;
      const shiftedY = y + shiftY;
      const line = displayText[index];

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
    })
    .join("\n    ");

  // For yang stamp, we need different rendering
  const stampContent =
    type === "yin"
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
      <!-- Step 1: Edge displacement for irregular border, then clip to original boundary (凹陷 only, no 凸起) -->
      <feTurbulence type="fractalNoise" baseFrequency="${fmtNum(0.04 * filterScaleInv)}" numOctaves="4" seed="${seed + 123}" result="borderNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="borderNoise" scale="${fmtNum(10 * filterScale)}" xChannelSelector="R" yChannelSelector="G" result="rawDisplaced"/>
      <feComposite in="rawDisplaced" in2="SourceGraphic" operator="in" result="displacedShape"/>

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

    <!-- Text engraving texture - keep glyph cores readable while roughening carved edges -->
    <filter id="stamp-text-texture" x="-18%" y="-18%" width="136%" height="136%">
      <feMorphology in="SourceGraphic" operator="erode" radius="${fmtNum(carvingProfile.coreErode * filterScale)}" result="textCore"/>
      <feComposite in="SourceGraphic" in2="textCore" operator="out" result="textEdgeBand"/>

      <feTurbulence type="${carvingProfile.edgeNoiseType}" baseFrequency="${fmtNum(carvingProfile.edgeFrequency * filterScaleInv)}" numOctaves="3" seed="${seed}" result="textEdgeNoise"/>
      ${
        textCarving === "stone-cut"
          ? `<feComponentTransfer in="textEdgeNoise" result="textEdgeNoiseStepped">
        <feFuncR type="discrete" tableValues="${carvingProfile.edgePosterizeTable}"/>
        <feFuncG type="discrete" tableValues="${carvingProfile.edgePosterizeTable}"/>
        <feFuncB type="discrete" tableValues="${carvingProfile.edgePosterizeTable}"/>
        <feFuncA type="table" tableValues="0 1"/>
      </feComponentTransfer>`
          : ""
      }
      <feDisplacementMap in="textEdgeBand" in2="${textCarving === "stone-cut" ? "textEdgeNoiseStepped" : "textEdgeNoise"}" scale="${fmtNum(carvingProfile.edgeDisplacement * filterScale)}" xChannelSelector="R" yChannelSelector="G" result="textDisplacedEdge"/>

      <feTurbulence type="turbulence" baseFrequency="${fmtNum(carvingProfile.chipFrequency * filterScaleInv)}" numOctaves="2" seed="${seed + 999}" result="textChipNoise"/>
      <feColorMatrix in="textChipNoise" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                1 1 1 0 ${fmtNum(carvingProfile.chipThreshold)}" result="textChipMaskRaw"/>
      <feComponentTransfer in="textChipMaskRaw" result="textChipMask">
        <feFuncA type="discrete" tableValues="${carvingProfile.chipTable}"/>
      </feComponentTransfer>

      <feComposite in="textDisplacedEdge" in2="textChipMask" operator="out" result="textChippedEdge"/>

      <feTurbulence type="fractalNoise" baseFrequency="${fmtNum(carvingProfile.grainFrequency * filterScaleInv)}" numOctaves="2" seed="${seed + 321}" result="textGrainNoise"/>
      <feColorMatrix in="textGrainNoise" type="matrix"
        values="0 0 0 0 0
                0 0 0 0 0
                0 0 0 0 0
                1 1 1 0 ${fmtNum(carvingProfile.grainThreshold)}" result="textGrainMaskRaw"/>
      <feComponentTransfer in="textGrainMaskRaw" result="textGrainMask">
        <feFuncA type="discrete" tableValues="${carvingProfile.grainTable}"/>
      </feComponentTransfer>

      <feComposite in="textChippedEdge" in2="textGrainMask" operator="out" result="textCarvedEdge"/>
      <feMerge result="textCarved">
        <feMergeNode in="textCore"/>
        <feMergeNode in="textCarvedEdge"/>
      </feMerge>
      <feColorMatrix in="textCarved" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${fmtNum(carvingProfile.alphaGain)} ${fmtNum(carvingProfile.alphaBias)}" result="finalCarvedText"/>
    </filter>
  </defs>

${stampContent}
</svg>`;

  return svg;
}

export async function generateStampAsync(options: StampOptions): Promise<string> {
  let font: opentype.Font | null = null;
  let usesGlyphMetrics = false;

  const measured =
    options.measuredColumnWidths && options.measuredColumnHeights && options.measuredColumnBoxes
      ? {
          columnWidths: options.measuredColumnWidths,
          columnHeights: options.measuredColumnHeights,
          columnBoxes: options.measuredColumnBoxes,
        }
      : (() => null)();

  let resolvedMeasured = measured;
  if (!resolvedMeasured) {
    font = await loadGlyphFont(options);
    if (font) {
      resolvedMeasured = measureStampTextWithGlyphFont(options, font);
      usesGlyphMetrics = !!resolvedMeasured;
    }
  }

  if (!resolvedMeasured) resolvedMeasured = measureStampText(options);

  const resolvedOptions = resolvedMeasured
    ? {
        ...options,
        measuredColumnWidths: resolvedMeasured.columnWidths,
        measuredColumnHeights: resolvedMeasured.columnHeights,
        measuredColumnBoxes: resolvedMeasured.columnBoxes,
      }
    : options;

  const svg = generateStamp(resolvedOptions);

  if (!resolvedMeasured) return svg;

  if (!usesGlyphMetrics && options.textCarving !== "stone-cut") return svg;

  if (!font) font = await loadGlyphFont(options);
  if (!font) return svg;

  return replaceTextElementsWithGlyphPaths(svg, resolvedOptions, resolvedMeasured, font);
}

/**
 * Stamp class for object-oriented usage
 */
export class Stamp {
  private options: Required<
    Pick<
      StampOptions,
      | "text"
      | "type"
      | "shape"
      | "color"
      | "textColor"
      | "fontFamily"
      | "fontSize"
      | "fontWeight"
      | "offsetX"
      | "offsetY"
      | "columnSpacing"
      | "characterSpacing"
      | "paddingX"
      | "paddingY"
      | "borderScale"
      | "noiseAmount"
      | "borderPoints"
      | "cornerRadius"
      | "borderWidth"
      | "regularShape"
      | "textCarving"
      | "seed"
    >
  > &
    Pick<
      StampOptions,
      | "fontUrl"
      | "fontData"
      | "columnSpacingPx"
      | "characterSpacingPx"
      | "paddingXPx"
      | "paddingYPx"
      | "columnWidthPx"
      | "measuredColumnWidths"
      | "measuredColumnHeights"
      | "measuredColumnBoxes"
      | "borderScaleX"
      | "borderScaleY"
      | "noiseAmountPx"
      | "borderPointsPx"
      | "cornerRadiusPx"
      | "borderWidthPx"
    >;

  constructor(options: StampOptions) {
    const type = options.type || "yin";
    this.options = {
      text: options.text,
      type,
      shape: options.shape || "auto",
      color: options.color || "#C8102E",
      textColor: options.textColor || (type === "yin" ? "#FFFFFF" : "#C8102E"),
      fontFamily: options.fontFamily || "serif",
      fontUrl: options.fontUrl,
      fontData: options.fontData,
      fontSize: options.fontSize || 70,
      fontWeight: options.fontWeight || "normal",
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
      textCarving: options.textCarving ?? "normal",
      seed: options.seed || Date.now(),
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

  async toSVGAsync(): Promise<string> {
    return generateStampAsync(this.options);
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
export function measureStampText(options: StampOptions): {
  width: number;
  height: number;
  columnWidths: number[];
  columnHeights: number[];
  columnBoxes: MeasuredColumnBox[];
} | null {
  // Only works in browser environment
  if (typeof document === "undefined") {
    console.warn("measureStampText only works in browser environment");
    return null;
  }

  const {
    text,
    fontFamily = "serif",
    fontSize = 70,
    fontWeight = "normal",
    characterSpacing = 0.05,
    characterSpacingPx,
  } = options;
  const actualCharacterSpacing =
    characterSpacingPx !== undefined ? characterSpacingPx / fontSize : characterSpacing;
  const measureOriginX = 500;
  const measureOriginY = 500;

  // Create temporary SVG
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "1000");
  svg.setAttribute("height", "1000");
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  document.body.appendChild(svg);

  const columnWidths: number[] = [];
  const columnHeights: number[] = [];
  const columnBoxes: MeasuredColumnBox[] = [];
  let maxWidth = 0;
  let maxHeight = 0;

  // Measure each column
  text.forEach((line) => {
    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement.setAttribute("x", String(measureOriginX));
    textElement.setAttribute("y", String(measureOriginY));
    textElement.style.writingMode = "vertical-rl";
    textElement.style.textOrientation = "upright";
    textElement.style.fontFamily = fontFamily;
    textElement.style.fontSize = `${fontSize}px`;
    textElement.style.fontWeight = String(fontWeight);
    textElement.style.letterSpacing = `${actualCharacterSpacing}em`;
    textElement.style.dominantBaseline = "text-before-edge";
    textElement.style.textAnchor = "start";
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
