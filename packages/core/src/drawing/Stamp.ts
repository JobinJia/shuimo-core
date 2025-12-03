/**
 * Traditional Chinese Seal Stamp Generator
 *
 * Generates irregular stamp shapes with customizable text, colors, and noise effects
 * to simulate authentic seal stamps used in traditional Chinese art.
 */

import { createStampNoise, type StampNoise } from './StampNoise';

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

  /** Spacing between columns (horizontal spacing), as a multiplier of fontSize (default: 0.05) */
  columnSpacing?: number;

  /** Spacing between characters within a column (vertical spacing), as a multiplier of fontSize (default: 0.05) */
  characterSpacing?: number;

  /** Horizontal padding around text (left and right), as a multiplier of fontSize (default: 0.05) */
  paddingX?: number;

  /** Vertical padding around text (top and bottom), as a multiplier of fontSize (default: 0.05) */
  paddingY?: number;

  /** Border scale factor - scales the entire stamp border relative to text (default: 1.0, range: 0.8-1.5) */
  borderScale?: number;

  /** Amount of irregularity (0-20, default: 12) */
  noiseAmount?: number;

  /** Number of points on the border path (default: 24) */
  borderPoints?: number;

  /** Corner radius for rounded corners (default: 15, set 0 for sharp corners) */
  cornerRadius?: number;

  /** Border width/stroke width in pixels (default: 1). Only applies to yang stamps (阳章) */
  borderWidth?: number;

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

/**
 * Calculate accurate text dimensions for vertical layout with per-column heights
 * For edge-aligned stamps (贴边印章)
 */
function calculateTextBounds(text: string[], fontSize: number, characterSpacing: number = 0.05, columnSpacing: number = 0.05): {
  width: number;
  height: number;
  columnCount: number;
  maxChars: number;
  columnHeights: number[];
  columnWidth: number;
} {
  // For vertical text with writing-mode: vertical-rl
  // Traditional stamps have minimal spacing between characters and columns

  // Column width: slightly less than fontSize for tighter packing
  // Chinese characters actual width is typically ~0.85-0.9 of fontSize
  const columnWidth = fontSize * 0.85;

  // Calculate height for each column with customizable character spacing
  const columnHeights = text.map(line => {
    const chars = line.length;
    // Vertical packing with customizable spacing:
    // chars * fontSize * 1.1: base height for all characters (with vertical padding for proper display)
    // (chars - 1) * fontSize * characterSpacing: spacing between characters
    return chars * fontSize * 1.1 + (chars - 1) * fontSize * characterSpacing;
  });

  // Find longest column
  const maxChars = Math.max(...text.map(t => t.length));
  const totalHeight = Math.max(...columnHeights);

  // Total width = all columns (with tighter width) + gaps between columns
  // When columnSpacing = 0, columns are tightly packed at 0.85 * fontSize each
  // When columnSpacing > 0, add gaps between columns
  const totalWidth = text.length * columnWidth + (text.length - 1) * fontSize * columnSpacing;

  return {
    width: totalWidth,
    height: totalHeight,
    columnCount: text.length,
    maxChars,
    columnHeights,
    columnWidth
  };
}

/**
 * Generate square shape path
 */
function generateSquarePath(
  size: number,
  noiseAmount: number,
  borderPoints: number,
  cornerRadius: number,
  noise: StampNoise,
  random: () => number,
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number },
  regularShape: boolean
): string {
  // For regular shapes, use uniform corner radius; otherwise randomize
  const cornerRadii = regularShape ? {
    topLeft: cornerRadius,
    topRight: cornerRadius,
    bottomRight: cornerRadius,
    bottomLeft: cornerRadius
  } : {
    topLeft: cornerRadius * (0.8 + random() * 0.4),
    topRight: cornerRadius * (0.8 + random() * 0.4),
    bottomRight: cornerRadius * (0.8 + random() * 0.4),
    bottomLeft: cornerRadius * (0.8 + random() * 0.4)
  };

  let path = '';

  if (regularShape) {
    // Generate perfect square with uniform corners
    if (cornerRadius > 0) {
      // Rounded square
      path = `M ${cornerRadii.topLeft} 0 ` +
             `L ${size - cornerRadii.topRight} 0 ` +
             `Q ${size} 0, ${size} ${cornerRadii.topRight} ` +
             `L ${size} ${size - cornerRadii.bottomRight} ` +
             `Q ${size} ${size}, ${size - cornerRadii.bottomRight} ${size} ` +
             `L ${cornerRadii.bottomLeft} ${size} ` +
             `Q 0 ${size}, 0 ${size - cornerRadii.bottomLeft} ` +
             `L 0 ${cornerRadii.topLeft} ` +
             `Q 0 0, ${cornerRadii.topLeft} 0 Z`;
    } else {
      // Sharp corners
      path = `M 0 0 L ${size} 0 L ${size} ${size} L 0 ${size} Z`;
    }
    return path;
  }

  // Irregular square with noise (original behavior)
  const pointsPerEdge = Math.floor(borderPoints / 4);

  // Top-left corner start point
  const startX = cornerRadii.topLeft;
  const startY = 0;
  const start = applyNoise(startX, startY, 0);
  path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

  // Top edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = 1.0;
    const x = cornerRadii.topLeft + t * (size - cornerRadii.topLeft - cornerRadii.topRight);
    const y = 0;
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Top-right corner - NO noise on corners for smooth curves
  path += ` Q ${size.toFixed(2)} ${(0).toFixed(2)}, ${size.toFixed(2)} ${cornerRadii.topRight.toFixed(2)}`;

  // Right edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = size;
    const y = cornerRadii.topRight + t * (size - cornerRadii.topRight - cornerRadii.bottomRight);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-right corner - NO noise on corners for smooth curves
  path += ` Q ${size.toFixed(2)} ${size.toFixed(2)}, ${(size - cornerRadii.bottomRight).toFixed(2)} ${size.toFixed(2)}`;

  // Bottom edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = (size - cornerRadii.bottomRight) - t * (size - cornerRadii.bottomRight - cornerRadii.bottomLeft);
    const y = size;
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-left corner - NO noise on corners for smooth curves
  path += ` Q ${(0).toFixed(2)} ${size.toFixed(2)}, ${(0).toFixed(2)} ${(size - cornerRadii.bottomLeft).toFixed(2)}`;

  // Left edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = 0;
    const y = (size - cornerRadii.bottomLeft) - t * (size - cornerRadii.bottomLeft - cornerRadii.topLeft);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Top-left corner (close path) - NO noise on corners for smooth curves
  path += ` Q ${(0).toFixed(2)} ${(0).toFixed(2)}, ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

  path += ' Z';
  return path;
}

/**
 * Generate rectangle shape path
 */
function generateRectanglePath(
  width: number,
  height: number,
  noiseAmount: number,
  borderPoints: number,
  cornerRadius: number,
  noise: StampNoise,
  random: () => number,
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number },
  regularShape: boolean
): string {
  // For regular shapes, use uniform corner radius; otherwise randomize
  const cornerRadii = regularShape ? {
    topLeft: cornerRadius,
    topRight: cornerRadius,
    bottomRight: cornerRadius,
    bottomLeft: cornerRadius
  } : {
    topLeft: cornerRadius * (0.8 + random() * 0.4),
    topRight: cornerRadius * (0.8 + random() * 0.4),
    bottomRight: cornerRadius * (0.8 + random() * 0.4),
    bottomLeft: cornerRadius * (0.8 + random() * 0.4)
  };

  let path = '';

  if (regularShape) {
    // Generate perfect rectangle with uniform corners
    if (cornerRadius > 0) {
      // Rounded rectangle
      path = `M ${cornerRadii.topLeft} 0 ` +
             `L ${width - cornerRadii.topRight} 0 ` +
             `Q ${width} 0, ${width} ${cornerRadii.topRight} ` +
             `L ${width} ${height - cornerRadii.bottomRight} ` +
             `Q ${width} ${height}, ${width - cornerRadii.bottomRight} ${height} ` +
             `L ${cornerRadii.bottomLeft} ${height} ` +
             `Q 0 ${height}, 0 ${height - cornerRadii.bottomLeft} ` +
             `L 0 ${cornerRadii.topLeft} ` +
             `Q 0 0, ${cornerRadii.topLeft} 0 Z`;
    } else {
      // Sharp corners
      path = `M 0 0 L ${width} 0 L ${width} ${height} L 0 ${height} Z`;
    }
    return path;
  }

  // Irregular rectangle with noise (original behavior)
  const pointsPerEdge = Math.floor(borderPoints / 4);

  // Top-left corner start point
  const startX = cornerRadii.topLeft;
  const startY = 0;
  const start = applyNoise(startX, startY, 0);
  path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

  // Top edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = 1.0;
    const x = cornerRadii.topLeft + t * (width - cornerRadii.topLeft - cornerRadii.topRight);
    const y = 0;
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Top-right corner - NO noise for smooth curves
  path += ` Q ${width.toFixed(2)} ${(0).toFixed(2)}, ${width.toFixed(2)} ${cornerRadii.topRight.toFixed(2)}`;

  // Right edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = width;
    const y = cornerRadii.topRight + t * (height - cornerRadii.topRight - cornerRadii.bottomRight);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-right corner - NO noise for smooth curves
  path += ` Q ${width.toFixed(2)} ${height.toFixed(2)}, ${(width - cornerRadii.bottomRight).toFixed(2)} ${height.toFixed(2)}`;

  // Bottom edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = (width - cornerRadii.bottomRight) - t * (width - cornerRadii.bottomRight - cornerRadii.bottomLeft);
    const y = height;
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-left corner - NO noise for smooth curves
  path += ` Q ${(0).toFixed(2)} ${height.toFixed(2)}, ${(0).toFixed(2)} ${(height - cornerRadii.bottomLeft).toFixed(2)}`;

  // Left edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = 0;
    const y = (height - cornerRadii.bottomLeft) - t * (height - cornerRadii.bottomLeft - cornerRadii.topLeft);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Top-left corner (close path) - NO noise for smooth curves
  path += ` Q ${(0).toFixed(2)} ${(0).toFixed(2)}, ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

  path += ' Z';
  return path;
}

/**
 * Generate circle shape path
 */
function generateCirclePath(
  radius: number,
  noiseAmount: number,
  borderPoints: number,
  noise: StampNoise,
  random: () => number,
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number },
  regularShape: boolean
): string {
  const centerX = radius;
  const centerY = radius;
  let path = '';

  if (regularShape) {
    // Generate perfect circle using SVG circle command converted to path
    // Using 4 cubic Bezier curves for a smooth circle (standard SVG approach)
    const k = 0.5522847498; // Magic constant for circle approximation with cubic Bezier
    const offset = radius * k;

    path = `M ${centerX} ${centerY - radius} ` +
           `C ${centerX + offset} ${centerY - radius}, ${centerX + radius} ${centerY - offset}, ${centerX + radius} ${centerY} ` +
           `C ${centerX + radius} ${centerY + offset}, ${centerX + offset} ${centerY + radius}, ${centerX} ${centerY + radius} ` +
           `C ${centerX - offset} ${centerY + radius}, ${centerX - radius} ${centerY + offset}, ${centerX - radius} ${centerY} ` +
           `C ${centerX - radius} ${centerY - offset}, ${centerX - offset} ${centerY - radius}, ${centerX} ${centerY - radius} Z`;
    return path;
  }

  // Irregular circle with noise (original behavior)
  // Generate points around the circle
  for (let i = 0; i < borderPoints; i++) {
    const angle = (i / borderPoints) * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    // Apply noise with full strength throughout
    const edgeProgress = 1.0;
    const point = applyNoise(x, y, edgeProgress);

    if (i === 0) {
      path = `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    } else {
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }
  }

  path += ' Z';
  return path;
}

/**
 * Generate capsule/stadium shape path (looks like ellipse but wraps text better)
 * - Horizontal: top/bottom straight lines + left/right semicircles
 * - Vertical: left/right straight lines + top/bottom semicircles
 */
function generateEllipsePath(
  width: number,
  height: number,
  noiseAmount: number,
  borderPoints: number,
  noise: StampNoise,
  random: () => number,
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number },
  regularShape: boolean
): string {
  let path = '';

  if (regularShape) {
    // Generate perfect ellipse/capsule shape
    const k = 0.5522847498; // Magic constant for circle approximation with cubic Bezier
    const rx = width / 2;  // X radius
    const ry = height / 2; // Y radius
    const cx = rx;         // Center X
    const cy = ry;         // Center Y
    const ox = rx * k;     // X offset for control points
    const oy = ry * k;     // Y offset for control points

    // Perfect ellipse using 4 cubic Bezier curves
    path = `M ${cx} ${cy - ry} ` +
           `C ${cx + ox} ${cy - ry}, ${cx + rx} ${cy - oy}, ${cx + rx} ${cy} ` +
           `C ${cx + rx} ${cy + oy}, ${cx + ox} ${cy + ry}, ${cx} ${cy + ry} ` +
           `C ${cx - ox} ${cy + ry}, ${cx - rx} ${cy + oy}, ${cx - rx} ${cy} ` +
           `C ${cx - rx} ${cy - oy}, ${cx - ox} ${cy - ry}, ${cx} ${cy - ry} Z`;
    return path;
  }

  // Irregular ellipse with noise (original behavior)
  const pointsPerEdge = Math.floor(borderPoints / 4);

  if (width > height) {
    // Horizontal capsule: straight top/bottom + curved left/right
    // Reduce curvature by half
    const radius = height / 2;
    const curveRadius = radius * 0.5; // Half the curvature
    const straightLength = width - radius * 2; // Length of straight portion

    // Start at top-left
    const startX = curveRadius;
    const startY = 0;
    const start = applyNoise(startX, startY, 0);
    path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

    // Top edge (straight line)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = curveRadius + t * straightLength;
      const y = 0;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Right curve (top to bottom) - reduced curvature
    const rightCenterX = width - curveRadius;
    const rightCenterY = radius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = -Math.PI / 2 + t * Math.PI; // -90° to 90°
      const edgeProgress = Math.sin(t * Math.PI);
      const x = rightCenterX + Math.cos(angle) * curveRadius;
      const y = rightCenterY + Math.sin(angle) * radius;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Bottom edge (straight line, right to left)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = (width - curveRadius) - t * straightLength;
      const y = height;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Left curve (bottom to top) - reduced curvature
    const leftCenterX = curveRadius;
    const leftCenterY = radius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = Math.PI / 2 + t * Math.PI; // 90° to 270°
      const edgeProgress = Math.sin(t * Math.PI);
      const x = leftCenterX + Math.cos(angle) * curveRadius;
      const y = leftCenterY + Math.sin(angle) * radius;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }
  } else {
    // Vertical capsule: straight left/right + curved top/bottom
    // Reduce curvature by half (same logic as horizontal)
    const radius = width / 2;
    const curveRadius = radius * 0.5; // Half the curvature for top/bottom arcs
    const straightLength = height - curveRadius * 2; // Length of straight portion

    // Start at top-left corner
    const startX = 0;
    const startY = curveRadius;
    const start = applyNoise(startX, startY, 0);
    path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

    // Top curve (left to right) - reduced curvature
    const topCenterX = radius;
    const topCenterY = curveRadius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = Math.PI + t * Math.PI; // 180° to 360°
      const edgeProgress = Math.sin(t * Math.PI);
      const x = topCenterX + Math.cos(angle) * radius;
      const y = topCenterY + Math.sin(angle) * curveRadius;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Right edge (straight line, top to bottom)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = width;
      const y = curveRadius + t * straightLength;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Bottom curve (right to left) - reduced curvature
    const bottomCenterX = radius;
    const bottomCenterY = height - curveRadius;
    for (let i = 0; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const angle = 0 + t * Math.PI; // 0° to 180°
      const edgeProgress = Math.sin(t * Math.PI);
      const x = bottomCenterX + Math.cos(angle) * radius;
      const y = bottomCenterY + Math.sin(angle) * curveRadius;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Left edge (straight line, bottom to top)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = 0;
      const y = (height - curveRadius) - t * straightLength;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }
  }

  path += ' Z';
  return path;
}

/**
 * Generate an irregular stamp border path using trapezoidal layout
 * Based on actual text column heights
 */
export function generateStampPath(options: StampOptions): StampResult {
  const {
    text,
    shape = 'auto',
    fontSize = 70,
    columnSpacing = 0.05,
    characterSpacing = 0.05,
    paddingX = 0.05,
    paddingY = 0.05,
    borderScale = 1.0,
    noiseAmount = 12,
    borderPoints = 24,
    cornerRadius = 15,
    regularShape = false,
    seed = Date.now()
  } = options;

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
  const textDims = calculateTextBounds(displayText, fontSize, characterSpacing, columnSpacing);
  const columnWidth = textDims.columnWidth;

  // Calculate column positions and heights
  const columnData = displayText.map((line, index) => ({
    height: textDims.columnHeights[index],
    text: line
  }));

  // Use separate horizontal and vertical padding
  const horizontalPadding = fontSize * paddingX;
  const verticalPadding = fontSize * paddingY;

  // Calculate base dimensions with padding
  const baseWidth = textDims.width + horizontalPadding * 2;
  const baseRightHeight = columnData[0].height + verticalPadding * 2;
  const baseLeftHeight = columnData[columnData.length - 1].height + verticalPadding * 2;

  // Apply border scale to expand/shrink the border relative to text
  // Scale from the center, so text stays centered
  const maxWidth = baseWidth * borderScale;
  const rightHeight = baseRightHeight * borderScale;
  const leftHeight = baseLeftHeight * borderScale;

  // Simple PRNG for reproducible noise
  let seedValue = seed;
  const random = () => {
    seedValue = (seedValue * 9301 + 49297) % 233280;
    return seedValue / 233280;
  };

  // Initialize improved Perlin Noise with seed
  const noise = createStampNoise(seed);

  // Helper function to apply improved Perlin noise
  const applyNoise = (x: number, y: number, edgeProgress: number) => {
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
    const totalNoiseX = noiseX * noiseAmount * cornerFactor;
    const totalNoiseY = noiseY * noiseAmount * cornerFactor;

    return { x: x + totalNoiseX, y: y + totalNoiseY };
  };

  // Generate path based on shape
  let path = '';
  let bounds;

  if (shape === 'square') {
    // Square: create a compact square based on text dimensions with padding and border scale
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    const baseSize = Math.max(textWidth + horizontalPadding * 2, textHeight + verticalPadding * 2);
    const size = baseSize * borderScale;

    path = generateSquarePath(size, noiseAmount, borderPoints, cornerRadius, noise, random, applyNoise, regularShape);
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
    const width = (textWidth + horizontalPadding * 2) * borderScale;
    const height = (textHeight + verticalPadding * 2) * borderScale;

    path = generateRectanglePath(width, height, noiseAmount, borderPoints, cornerRadius, noise, random, applyNoise, regularShape);
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
    const diameter = baseDiameter * borderScale;
    const radius = diameter / 2;

    path = generateCirclePath(radius, noiseAmount, borderPoints, noise, random, applyNoise, regularShape);
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
      width = baseWidth * borderScale;
      height = baseHeight * borderScale;
    } else {
      // Vertical layout
      const baseHeight = textHeight + verticalPadding * 2;
      const baseWidth = textWidth + horizontalPadding * 2;
      const shortSide = Math.min(baseWidth, baseHeight);
      width = baseWidth * borderScale;
      height = (baseHeight + shortSide * 0.15) * borderScale;
    }

    path = generateEllipsePath(width, height, noiseAmount, borderPoints, noise, random, applyNoise, regularShape);
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
    bounds = {
      left: 0,
      right: maxWidth,
      top: 0,
      bottom: Math.max(rightHeight, leftHeight),
      width: maxWidth,
      height: Math.max(rightHeight, leftHeight)
    };

    // Generate randomized corner radii for each corner
    const cornerRadii = {
      topLeft: cornerRadius * (0.8 + random() * 0.4),     // 0.8-1.2x
      topRight: cornerRadius * (0.8 + random() * 0.4),
      bottomRight: cornerRadius * (0.8 + random() * 0.4),
      bottomLeft: cornerRadius * (0.8 + random() * 0.4)
    };

    const pointsPerEdge = Math.floor(borderPoints / 4);

    // Top-left corner start point (after corner radius)
    const startX = cornerRadii.topLeft;
    const startY = 0;
    const start = applyNoise(startX, startY, 0);
    path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

    // Top edge (从左上圆角后到右上圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      // Top edge gets maximum noise - keep it natural and irregular
      const edgeProgress = 1.0; // Full noise strength across the entire top edge
      const x = cornerRadii.topLeft + t * (maxWidth - cornerRadii.topLeft - cornerRadii.topRight);
      const y = 0;
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Top-right corner (使用二次贝塞尔曲线) - NO noise for smooth CSS-like border-radius
    path += ` Q ${maxWidth.toFixed(2)} ${(0).toFixed(2)}, ${maxWidth.toFixed(2)} ${cornerRadii.topRight.toFixed(2)}`;

    // Right edge (从右上圆角后到右下圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = maxWidth;
      const y = cornerRadii.topRight + t * (rightHeight - cornerRadii.topRight - cornerRadii.bottomRight);
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Bottom-right corner (使用二次贝塞尔曲线) - NO noise for smooth CSS-like border-radius
    path += ` Q ${maxWidth.toFixed(2)} ${rightHeight.toFixed(2)}, ${(maxWidth - cornerRadii.bottomRight).toFixed(2)} ${rightHeight.toFixed(2)}`;

    // Bottom edge (从右下圆角后到左下圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const xPos = (maxWidth - cornerRadii.bottomRight) - t * (maxWidth - cornerRadii.bottomRight - cornerRadii.bottomLeft);
      const yPos = rightHeight + (leftHeight - rightHeight) * t;
      const point = applyNoise(xPos, yPos, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Bottom-left corner (使用二次贝塞尔曲线) - NO noise for smooth CSS-like border-radius
    path += ` Q ${(0).toFixed(2)} ${leftHeight.toFixed(2)}, ${(0).toFixed(2)} ${(leftHeight - cornerRadii.bottomLeft).toFixed(2)}`;

    // Left edge (从左下圆角后到左上圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = 0;
      const y = (leftHeight - cornerRadii.bottomLeft) - t * (leftHeight - cornerRadii.bottomLeft - cornerRadii.topLeft);
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Top-left corner (使用二次贝塞尔曲线，闭合路径) - NO noise for smooth CSS-like border-radius
    path += ` Q ${(0).toFixed(2)} ${(0).toFixed(2)}, ${cornerRadii.topLeft.toFixed(2)} ${(0).toFixed(2)}`;

    path += ' Z';
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
    shape = 'auto',
    color = '#C8102E',
    fontFamily = 'serif',
    fontSize = 70,
    fontWeight = 'normal',
    offsetX = 0,
    offsetY = 0,
    columnSpacing = 0.05,
    characterSpacing = 0.05,
    borderWidth = 1,
    seed = Date.now()
  } = options;

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
  const textDims = calculateTextBounds(displayText, fontSize, characterSpacing, columnSpacing);
  const columnWidth = textDims.columnWidth;
  const columnGap = fontSize * columnSpacing; // Gap between columns

  // Calculate text position using offset
  // offsetX and offsetY range from -1 to 1
  // -1: left/top edge, 0: center, 1: right/bottom edge

  const fontTopMargin = fontSize * 0.10;  // Font's built-in top margin

  // Calculate available space for offset
  // Horizontal: bounds.width - textDims.width
  const horizontalSpace = bounds.width - textDims.width;
  // Vertical: bounds.height - max(column heights)
  const maxTextHeight = Math.max(...textDims.columnHeights);
  const verticalSpace = bounds.height - maxTextHeight;

  // Apply offset: -1 (left/top) to 1 (right/bottom)
  // offsetX = -1: text at left edge (x = 0)
  // offsetX = 0: text centered (x = horizontalSpace / 2)
  // offsetX = 1: text at right edge (x = horizontalSpace)
  const horizontalOffset = (offsetX + 1) / 2 * horizontalSpace;
  const verticalOffset = (offsetY + 1) / 2 * verticalSpace;

  // Compensate for font's built-in top margin
  const startY = verticalOffset - fontTopMargin;
  // For horizontal positioning, start from the right edge minus the offset
  const firstColumnX = bounds.width - horizontalOffset;

  const textElements = displayText.map((line, index) => {
    // In vertical-rl mode, columns flow right to left
    // x represents the RIGHT edge of the column (inline-start in rl context)
    // Text extends LEFTWARD from x by approximately columnWidth
    // First column (index 0) is rightmost, each subsequent column moves left
    // Each column is separated by columnWidth + columnGap
    const x = firstColumnX - index * (columnWidth + columnGap);

    return `<text x="${x}" y="${startY}"
      style="
        writing-mode: vertical-rl;
        text-orientation: upright;
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        font-weight: ${fontWeight};
        fill: ${stampTextColor};
        letter-spacing: ${characterSpacing}em;
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
  <path d="${path}" fill="none" stroke="${stampColor}" stroke-width="${borderWidth}" filter="url(#stamp-border-texture)" />

  <!-- Text -->
  ${textElements}`;

  const svg = `<svg width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Realistic ink stamp texture - simulates paper fiber absorption and ink splatter -->
    <filter id="stamp-ink-texture" x="-20%" y="-20%" width="140%" height="140%">
      <!-- Step 1: Edge displacement for irregular border -->
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="${seed + 123}" result="borderNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="borderNoise" scale="18" xChannelSelector="R" yChannelSelector="G" result="displacedShape"/>

      <!-- Step 2: Create granular texture (paper fibers) - increased visibility -->
      <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="4" seed="${seed + 456}" result="grainNoise"/>

      <!-- Step 3: Create larger blotchy patterns (ink distribution) - more pronounced -->
      <feTurbulence type="turbulence" baseFrequency="0.08" numOctaves="2" seed="${seed + 789}" result="blotchNoise"/>

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
      <feGaussianBlur in="texturedShape" stdDeviation="0.5" result="blurredInk"/>

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
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="${seed + 123}" result="borderNoise"/>
      <feDisplacementMap in="SourceGraphic" in2="borderNoise" scale="8" xChannelSelector="R" yChannelSelector="G" result="displacedBorder"/>

      <!-- Slight blur for natural ink spread -->
      <feGaussianBlur in="displacedBorder" stdDeviation="0.3" result="blurredBorder"/>
    </filter>

    <!-- Text engraving texture - simulates carved/chiseled effect -->
    <filter id="stamp-text-texture" x="-10%" y="-10%" width="120%" height="120%">
      <!-- Primary noise for edge variation -->
      <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="4" seed="${seed}" result="textNoise"/>
      <!-- Reduced displacement to prevent text breaking apart -->
      <feDisplacementMap in="SourceGraphic" in2="textNoise" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="roughEdges"/>
      <!-- Secondary noise layer for more variation -->
      <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="${seed + 999}" result="coarseNoise"/>
      <feDisplacementMap in="roughEdges" in2="coarseNoise" scale="0.8" xChannelSelector="R" yChannelSelector="G" result="carvedText"/>
      <!-- Slight blur to smooth sharp artifacts -->
      <feGaussianBlur in="carvedText" stdDeviation="0.3" result="smoothedText"/>
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
  private options: Required<StampOptions>;

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
      columnSpacing: options.columnSpacing ?? 0.05,
      characterSpacing: options.characterSpacing ?? 0.05,
      paddingX: options.paddingX ?? 0.05,
      paddingY: options.paddingY ?? 0.05,
      borderScale: options.borderScale ?? 1.0,
      noiseAmount: options.noiseAmount || 12,
      borderPoints: options.borderPoints || 24,
      cornerRadius: options.cornerRadius || 15,
      borderWidth: options.borderWidth ?? 1,
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
