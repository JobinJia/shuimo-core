/**
 * Bézier Curve Utilities
 *
 * Functions for working with Bézier curves (quadratic and cubic).
 * Used for smooth paths in landscape elements.
 *
 * Reference: Adapted from nonflowers project
 */

import type { Vec2 } from '../types';
import { Vector2 } from './vector';

/**
 * Evaluate a quadratic Bézier curve at parameter t
 *
 * @param p0 Start point
 * @param p1 Control point
 * @param p2 End point
 * @param t Parameter in [0, 1]
 */
export function quadraticBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const t1 = 1 - t;
  const t1Sq = t1 * t1;
  const tSq = t * t;

  return {
    x: t1Sq * p0.x + 2 * t1 * t * p1.x + tSq * p2.x,
    y: t1Sq * p0.y + 2 * t1 * t * p1.y + tSq * p2.y
  };
}

/**
 * Evaluate a cubic Bézier curve at parameter t
 *
 * @param p0 Start point
 * @param p1 First control point
 * @param p2 Second control point
 * @param p3 End point
 * @param t Parameter in [0, 1]
 */
export function cubicBezier(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const t1 = 1 - t;
  const t1Sq = t1 * t1;
  const t1Cube = t1Sq * t1;
  const tSq = t * t;
  const tCube = tSq * t;

  return {
    x: t1Cube * p0.x + 3 * t1Sq * t * p1.x + 3 * t1 * tSq * p2.x + tCube * p3.x,
    y: t1Cube * p0.y + 3 * t1Sq * t * p1.y + 3 * t1 * tSq * p2.y + tCube * p3.y
  };
}

/**
 * Generate points along a quadratic Bézier curve
 *
 * @param p0 Start point
 * @param p1 Control point
 * @param p2 End point
 * @param segments Number of segments (points = segments + 1)
 */
export function quadraticBezierPoints(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  segments: number
): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(quadraticBezier(p0, p1, p2, t));
  }
  return points;
}

/**
 * Generate points along a cubic Bézier curve
 *
 * @param p0 Start point
 * @param p1 First control point
 * @param p2 Second control point
 * @param p3 End point
 * @param segments Number of segments (points = segments + 1)
 */
export function cubicBezierPoints(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  segments: number
): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push(cubicBezier(p0, p1, p2, p3, t));
  }
  return points;
}

/**
 * Calculate derivative (tangent) of cubic Bézier curve at parameter t
 */
export function cubicBezierDerivative(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 {
  const t1 = 1 - t;
  const t1Sq = t1 * t1;
  const tSq = t * t;

  return {
    x: 3 * t1Sq * (p1.x - p0.x) + 6 * t1 * t * (p2.x - p1.x) + 3 * tSq * (p3.x - p2.x),
    y: 3 * t1Sq * (p1.y - p0.y) + 6 * t1 * t * (p2.y - p1.y) + 3 * tSq * (p3.y - p2.y)
  };
}

/**
 * Catmull-Rom spline (passes through all points)
 *
 * Creates a smooth curve that passes through all control points.
 * Uses cubic Bézier segments between points.
 *
 * @param points Control points
 * @param tension Tension parameter (0 = Catmull-Rom, 1 = tight)
 * @param segments Segments per curve section
 */
export function catmullRomSpline(
  points: Vec2[],
  tension: number = 0,
  segments: number = 10
): Vec2[] {
  if (points.length < 2) return [...points];
  if (points.length === 2) {
    return cubicBezierPoints(points[0], points[0], points[1], points[1], segments);
  }

  const result: Vec2[] = [];
  const alpha = (1 - tension) / 2;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : points[i + 1];

    // Calculate control points
    const cp1 = {
      x: p1.x + alpha * (p2.x - p0.x),
      y: p1.y + alpha * (p2.y - p0.y)
    };

    const cp2 = {
      x: p2.x - alpha * (p3.x - p1.x),
      y: p2.y - alpha * (p3.y - p1.y)
    };

    // Generate segment
    const segmentPoints = cubicBezierPoints(p1, cp1, cp2, p2, segments);

    // Add points (skip first point if not first segment to avoid duplicates)
    if (i === 0) {
      result.push(...segmentPoints);
    } else {
      result.push(...segmentPoints.slice(1));
    }
  }

  return result;
}

/**
 * Simplify a path using Ramer-Douglas-Peucker algorithm
 *
 * Reduces the number of points in a curve while maintaining its shape.
 *
 * @param points Input points
 * @param epsilon Maximum distance threshold
 */
export function simplifyPath(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length < 3) return [...points];

  // Find point with maximum distance from line segment
  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);

    // Combine results (remove duplicate middle point)
    return [...left.slice(0, -1), ...right];
  } else {
    // Max distance is less than epsilon, just return endpoints
    return [start, end];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Vec2, lineStart: Vec2, lineEnd: Vec2): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // Line segment length squared
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line start and end are the same point
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  // Calculate projection parameter
  let t =
    ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));

  // Calculate projection point
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;

  // Calculate distance
  const distX = point.x - projX;
  const distY = point.y - projY;
  return Math.sqrt(distX * distX + distY * distY);
}

/**
 * Calculate approximate length of a cubic Bézier curve
 *
 * Uses adaptive subdivision for accuracy.
 */
export function cubicBezierLength(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  subdivisions: number = 100
): number {
  let length = 0;
  let prev = p0;

  for (let i = 1; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const curr = cubicBezier(p0, p1, p2, p3, t);
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    length += Math.sqrt(dx * dx + dy * dy);
    prev = curr;
  }

  return length;
}
