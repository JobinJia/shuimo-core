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

  /** Left padding around text (default: 3) */
  paddingX?: number;

  /** Top/bottom padding around text (default: 3) */
  paddingY?: number;

  /** Amount of irregularity (0-20, default: 12) */
  noiseAmount?: number;

  /** Number of points on the border path (default: 24) */
  borderPoints?: number;

  /** Corner radius for rounded corners (default: 15, set 0 for sharp corners) */
  cornerRadius?: number;

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
 */
function calculateTextBounds(text: string[], fontSize: number): {
  width: number;
  height: number;
  columnCount: number;
  maxChars: number;
  columnHeights: number[];
} {
  // For vertical text with writing-mode: vertical-rl
  // Each character occupies approximately fontSize × fontSize space
  // With line-height: 1.1 and letter-spacing: 0.15em

  const lineHeight = 1.1;
  const letterSpacing = 0.15;

  // Column width (character width + some spacing)
  // In vertical mode, this is the horizontal space each column takes
  const columnWidth = fontSize * lineHeight;

  // Calculate height for each column
  const columnHeights = text.map(line => {
    const chars = line.length;
    // Text height calculation with bottom safety margin
    // chars * fontSize: base height for all characters
    // (chars - 1) * fontSize * letterSpacing: spacing between characters
    // fontSize * 0.3: bottom safety margin to ensure last character is fully visible
    return chars * fontSize + (chars - 1) * fontSize * letterSpacing + fontSize * 0.3;
  });

  // Find longest column
  const maxChars = Math.max(...text.map(t => t.length));
  const totalHeight = Math.max(...columnHeights);
  const totalWidth = text.length * columnWidth;

  return {
    width: totalWidth,
    height: totalHeight,
    columnCount: text.length,
    maxChars,
    columnHeights
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
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number }
): string {
  // Generate randomized corner radii
  const cornerRadii = {
    topLeft: cornerRadius * (0.8 + random() * 0.4),
    topRight: cornerRadius * (0.8 + random() * 0.4),
    bottomRight: cornerRadius * (0.8 + random() * 0.4),
    bottomLeft: cornerRadius * (0.8 + random() * 0.4)
  };

  let path = '';
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

  // Top-right corner
  const topRightCorner = applyNoise(size, 0, 0);
  const topRightEnd = applyNoise(size, cornerRadii.topRight, 0);
  path += ` Q ${topRightCorner.x.toFixed(2)} ${topRightCorner.y.toFixed(2)}, ${topRightEnd.x.toFixed(2)} ${topRightEnd.y.toFixed(2)}`;

  // Right edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = size;
    const y = cornerRadii.topRight + t * (size - cornerRadii.topRight - cornerRadii.bottomRight);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-right corner
  const bottomRightCorner = applyNoise(size, size, 0);
  const bottomRightEnd = applyNoise(size - cornerRadii.bottomRight, size, 0);
  path += ` Q ${bottomRightCorner.x.toFixed(2)} ${bottomRightCorner.y.toFixed(2)}, ${bottomRightEnd.x.toFixed(2)} ${bottomRightEnd.y.toFixed(2)}`;

  // Bottom edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = (size - cornerRadii.bottomRight) - t * (size - cornerRadii.bottomRight - cornerRadii.bottomLeft);
    const y = size;
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-left corner
  const bottomLeftCorner = applyNoise(0, size, 0);
  const bottomLeftEnd = applyNoise(0, size - cornerRadii.bottomLeft, 0);
  path += ` Q ${bottomLeftCorner.x.toFixed(2)} ${bottomLeftCorner.y.toFixed(2)}, ${bottomLeftEnd.x.toFixed(2)} ${bottomLeftEnd.y.toFixed(2)}`;

  // Left edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = 0;
    const y = (size - cornerRadii.bottomLeft) - t * (size - cornerRadii.bottomLeft - cornerRadii.topLeft);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Top-left corner (close path)
  const topLeftCorner = applyNoise(0, 0, 0);
  path += ` Q ${topLeftCorner.x.toFixed(2)} ${topLeftCorner.y.toFixed(2)}, ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

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
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number }
): string {
  // Generate randomized corner radii
  const cornerRadii = {
    topLeft: cornerRadius * (0.8 + random() * 0.4),
    topRight: cornerRadius * (0.8 + random() * 0.4),
    bottomRight: cornerRadius * (0.8 + random() * 0.4),
    bottomLeft: cornerRadius * (0.8 + random() * 0.4)
  };

  let path = '';
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

  // Top-right corner
  const topRightCorner = applyNoise(width, 0, 0);
  const topRightEnd = applyNoise(width, cornerRadii.topRight, 0);
  path += ` Q ${topRightCorner.x.toFixed(2)} ${topRightCorner.y.toFixed(2)}, ${topRightEnd.x.toFixed(2)} ${topRightEnd.y.toFixed(2)}`;

  // Right edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = width;
    const y = cornerRadii.topRight + t * (height - cornerRadii.topRight - cornerRadii.bottomRight);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-right corner
  const bottomRightCorner = applyNoise(width, height, 0);
  const bottomRightEnd = applyNoise(width - cornerRadii.bottomRight, height, 0);
  path += ` Q ${bottomRightCorner.x.toFixed(2)} ${bottomRightCorner.y.toFixed(2)}, ${bottomRightEnd.x.toFixed(2)} ${bottomRightEnd.y.toFixed(2)}`;

  // Bottom edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = (width - cornerRadii.bottomRight) - t * (width - cornerRadii.bottomRight - cornerRadii.bottomLeft);
    const y = height;
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Bottom-left corner
  const bottomLeftCorner = applyNoise(0, height, 0);
  const bottomLeftEnd = applyNoise(0, height - cornerRadii.bottomLeft, 0);
  path += ` Q ${bottomLeftCorner.x.toFixed(2)} ${bottomLeftCorner.y.toFixed(2)}, ${bottomLeftEnd.x.toFixed(2)} ${bottomLeftEnd.y.toFixed(2)}`;

  // Left edge
  for (let i = 1; i < pointsPerEdge; i++) {
    const t = i / pointsPerEdge;
    const edgeProgress = Math.sin(t * Math.PI);
    const x = 0;
    const y = (height - cornerRadii.bottomLeft) - t * (height - cornerRadii.bottomLeft - cornerRadii.topLeft);
    const point = applyNoise(x, y, edgeProgress);
    path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }

  // Top-left corner (close path)
  const topLeftCorner = applyNoise(0, 0, 0);
  path += ` Q ${topLeftCorner.x.toFixed(2)} ${topLeftCorner.y.toFixed(2)}, ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

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
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number }
): string {
  const centerX = radius;
  const centerY = radius;
  let path = '';

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
  applyNoise: (x: number, y: number, edgeProgress: number) => { x: number; y: number }
): string {
  let path = '';
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
    paddingX = 3,
    paddingY = 3,
    noiseAmount = 12,
    borderPoints = 24,
    cornerRadius = 15,
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

  // Reverse text array for right-to-left reading order
  // User provides ['风雪', '落梅听'], we display as ['落梅听', '风雪'] (right to left)
  const displayText = [...text].reverse();

  // Calculate actual text dimensions
  const textDims = calculateTextBounds(displayText, fontSize);
  const lineHeight = 1.1;
  const columnWidth = fontSize * lineHeight;

  // Calculate column positions and create control points for each column
  const columnData = displayText.map((line, index) => ({
    x: paddingX + fontSize + index * columnWidth,
    height: textDims.columnHeights[index],
    text: line
  }));

  // Find bounds based on actual text layout
  // 最宽处（顶部）：所有列的总宽度
  const maxWidth = textDims.width + paddingX * 2;
  // 左边高度：第一列（columnData[0]，即 text[0]）的高度
  const leftHeight = columnData[0].height + paddingY * 2;
  // 右边高度：最后一列（columnData[text.length-1]，即 text[text.length-1]）的高度
  const rightHeight = columnData[columnData.length - 1].height + paddingY * 2;

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
    // Square: use the larger dimension to make it square, but keep text bounds tight
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    // Use smaller padding for square shape
    const squarePadding = Math.max(paddingX, paddingY);
    const size = Math.max(textWidth, textHeight) + squarePadding * 2;
    path = generateSquarePath(size, noiseAmount, borderPoints, cornerRadius, noise, random, applyNoise);
    bounds = {
      left: 0,
      right: size,
      top: 0,
      bottom: size,
      width: size,
      height: size
    };
  } else if (shape === 'rectangle') {
    // Rectangle: use tight text bounds with padding
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    const width = textWidth + paddingX * 2;
    const height = textHeight + paddingY * 2;
    path = generateRectanglePath(width, height, noiseAmount, borderPoints, cornerRadius, noise, random, applyNoise);
    bounds = {
      left: 0,
      right: width,
      top: 0,
      bottom: height,
      width,
      height
    };
  } else if (shape === 'circle') {
    // Circle: use the larger dimension as diameter
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);
    // Use uniform padding for circle shape
    const circlePadding = Math.max(paddingX, paddingY);
    const diameter = Math.max(textWidth, textHeight) + circlePadding * 2;
    const radius = diameter / 2;
    path = generateCirclePath(radius, noiseAmount, borderPoints, noise, random, applyNoise);
    bounds = {
      left: 0,
      right: diameter,
      top: 0,
      bottom: diameter,
      width: diameter,
      height: diameter
    };
  } else if (shape === 'ellipse') {
    // Ellipse: non-standard ellipse design
    // - Short axis direction: tightly wraps text (just padding)
    // - Long axis direction: adds curvature for ellipse effect
    const textWidth = textDims.width;
    const textHeight = Math.max(...textDims.columnHeights);

    const aspectRatio = textWidth / textHeight;
    let width: number;
    let height: number;

    if (aspectRatio > 1) {
      // Horizontal layout: text is wider than tall
      // Height: tight fit (just padding)
      // Width: add extra space for curvature based on short side (height)
      height = textHeight + paddingY * 2;
      width = textWidth + paddingX * 2 + height * 0.2;
    } else {
      // Vertical layout: text is taller than wide
      // Width: tight fit (just padding)
      // Height: add extra space for curvature
      // Use textHeight (not width) as base for consistent spacing
      const baseHeight = textHeight + paddingY * 2;
      width = textWidth + paddingX * 2;
      // Calculate curve spacing based on the short side dimension
      const shortSide = Math.min(width, baseHeight);
      height = baseHeight + shortSide * 0.2;
    }

    path = generateEllipsePath(width, height, noiseAmount, borderPoints, noise, random, applyNoise);
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

    // Top-right corner (使用二次贝塞尔曲线)
    const topRightCorner = applyNoise(maxWidth, 0, 0);
    const topRightEnd = applyNoise(maxWidth, cornerRadii.topRight, 0);
    path += ` Q ${topRightCorner.x.toFixed(2)} ${topRightCorner.y.toFixed(2)}, ${topRightEnd.x.toFixed(2)} ${topRightEnd.y.toFixed(2)}`;

    // Right edge (从右上圆角后到右下圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = maxWidth;
      const y = cornerRadii.topRight + t * (rightHeight - cornerRadii.topRight - cornerRadii.bottomRight);
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Bottom-right corner (使用二次贝塞尔曲线)
    const bottomRightCorner = applyNoise(maxWidth, rightHeight, 0);
    const bottomRightEnd = applyNoise(maxWidth - cornerRadii.bottomRight, rightHeight, 0);
    path += ` Q ${bottomRightCorner.x.toFixed(2)} ${bottomRightCorner.y.toFixed(2)}, ${bottomRightEnd.x.toFixed(2)} ${bottomRightEnd.y.toFixed(2)}`;

    // Bottom edge (从右下圆角后到左下圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const xPos = (maxWidth - cornerRadii.bottomRight) - t * (maxWidth - cornerRadii.bottomRight - cornerRadii.bottomLeft);
      const yPos = rightHeight + (leftHeight - rightHeight) * t;
      const point = applyNoise(xPos, yPos, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Bottom-left corner (使用二次贝塞尔曲线)
    const bottomLeftCorner = applyNoise(0, leftHeight, 0);
    const bottomLeftEnd = applyNoise(0, leftHeight - cornerRadii.bottomLeft, 0);
    path += ` Q ${bottomLeftCorner.x.toFixed(2)} ${bottomLeftCorner.y.toFixed(2)}, ${bottomLeftEnd.x.toFixed(2)} ${bottomLeftEnd.y.toFixed(2)}`;

    // Left edge (从左下圆角后到左上圆角前)
    for (let i = 1; i < pointsPerEdge; i++) {
      const t = i / pointsPerEdge;
      const edgeProgress = Math.sin(t * Math.PI);
      const x = 0;
      const y = (leftHeight - cornerRadii.bottomLeft) - t * (leftHeight - cornerRadii.bottomLeft - cornerRadii.topLeft);
      const point = applyNoise(x, y, edgeProgress);
      path += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    // Top-left corner (使用二次贝塞尔曲线，闭合路径)
    const topLeftCorner = applyNoise(0, 0, 0);
    path += ` Q ${topLeftCorner.x.toFixed(2)} ${topLeftCorner.y.toFixed(2)}, ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;

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
    paddingX = 3,
    paddingY = 3,
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

  // Reverse text array for right-to-left reading order (same as in generateStampPath)
  const displayText = [...text].reverse();

  // Calculate text dimensions for centering
  const textDims = calculateTextBounds(displayText, fontSize);
  const lineHeight = 1.1;
  const columnWidth = fontSize * lineHeight;

  // Calculate text position based on shape
  let firstColumnX: number;
  let startY: number;

  if (shape === 'square' || shape === 'circle' || shape === 'ellipse') {
    // For square, circle, and ellipse: center the text both horizontally and vertically
    // Horizontal centering:
    // In vertical-rl mode, x represents the RIGHT edge of the text column
    // - textDims.width is the total width of all columns
    // - leftMargin is where the text block should start
    // - firstColumnX is the right edge of the first column
    const textWidth = textDims.width;
    const leftMargin = (bounds.width - textWidth) / 2;
    firstColumnX = leftMargin + columnWidth;  // Right edge of first column

    // Vertical centering: center of bounds - half of max text height
    const textHeight = Math.max(...textDims.columnHeights);
    startY = (bounds.height - textHeight) / 2;
  } else if (shape === 'rectangle') {
    // For rectangle: use padding
    // In vertical-rl, x is the right edge of the column
    firstColumnX = paddingX + columnWidth;
    startY = paddingY;
  } else {
    // Auto (default): use padding
    // In vertical-rl, x is the right edge of the column
    firstColumnX = paddingX + columnWidth;
    startY = paddingY;
  }

  const textElements = displayText.map((line, index) => {
    // Each subsequent column moves right by columnWidth
    // In vertical-rl mode, x represents the right edge of the text column
    // To center the column, we need to offset by half the column width
    const x = firstColumnX + index * columnWidth;
    return `<text x="${x}" y="${startY}"
      style="
        writing-mode: vertical-rl;
        text-orientation: upright;
        font-family: ${fontFamily};
        font-size: ${fontSize}px;
        fill: ${stampTextColor};
        line-height: 1.1;
        letter-spacing: 0.15em;
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

  <!-- Yang stamp border (阳章 - red border, 1px stroke) -->
  <path d="${path}" fill="none" stroke="${stampColor}" stroke-width="1" filter="url(#stamp-border-texture)" />

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
    <filter id="stamp-text-texture">
      <!-- Primary noise for edge variation -->
      <feTurbulence type="fractalNoise" baseFrequency="0.15" numOctaves="4" seed="${seed}" result="textNoise"/>
      <!-- Stronger displacement for carved effect -->
      <feDisplacementMap in="SourceGraphic" in2="textNoise" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="roughEdges"/>
      <!-- Secondary noise layer for more variation -->
      <feTurbulence type="turbulence" baseFrequency="0.05" numOctaves="2" seed="${seed + 999}" result="coarseNoise"/>
      <feDisplacementMap in="roughEdges" in2="coarseNoise" scale="1.5" xChannelSelector="R" yChannelSelector="G" result="carvedText"/>
      <!-- Slight blur to smooth sharp artifacts -->
      <feGaussianBlur in="carvedText" stdDeviation="0.4" result="smoothedText"/>
      <!-- Enhance contrast for crisp edges -->
      <feColorMatrix in="smoothedText" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1.3 -0.15" result="finalCarvedText"/>
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
      paddingX: options.paddingX || 5,
      paddingY: options.paddingY || 5,
      noiseAmount: options.noiseAmount || 12,
      borderPoints: options.borderPoints || 24,
      cornerRadius: options.cornerRadius || 15,
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
