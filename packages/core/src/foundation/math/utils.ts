/**
 * Mathematical utility functions
 */

// ============================================================================
// Constants
// ============================================================================

export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
export const DEG_TO_RAD = Math.PI / 180;
export const RAD_TO_DEG = 180 / Math.PI;
export const EPSILON = 1e-10;

// ============================================================================
// Basic Math Operations
// ============================================================================

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation between a and b
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Inverse linear interpolation (find t given a, b, and value)
 */
export function inverseLerp(a: number, b: number, value: number): number {
  return (value - a) / (b - a);
}

/**
 * Map a value from one range to another
 */
export function map(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/**
 * Smooth step interpolation (cubic Hermite)
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Smoother step interpolation (quintic)
 */
export function smootherstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// ============================================================================
// Angle Operations
// ============================================================================

/**
 * Convert degrees to radians
 */
export function degToRad(degrees: number): number {
  return degrees * DEG_TO_RAD;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(radians: number): number {
  return radians * RAD_TO_DEG;
}

/**
 * Normalize angle to [0, 2π)
 */
export function normalizeAngle(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * Normalize angle to [-π, π)
 */
export function normalizeAngleSigned(angle: number): number {
  let a = normalizeAngle(angle);
  if (a > PI) a -= TWO_PI;
  return a;
}

/**
 * Linear interpolation between two angles (shortest path)
 */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = normalizeAngleSigned(b - a);
  return a + diff * t;
}

// ============================================================================
// Distance and Geometry
// ============================================================================

/**
 * Euclidean distance between two points
 */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Squared distance (faster, no square root)
 */
export function distanceSquared(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/**
 * Manhattan distance
 */
export function manhattanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x2 - x1) + Math.abs(y2 - y1);
}

// ============================================================================
// Comparison
// ============================================================================

/**
 * Check if two numbers are approximately equal
 */
export function approximately(a: number, b: number, epsilon: number = EPSILON): boolean {
  return Math.abs(a - b) < epsilon;
}

/**
 * Check if a number is approximately zero
 */
export function isZero(value: number, epsilon: number = EPSILON): boolean {
  return Math.abs(value) < epsilon;
}

// ============================================================================
// Special Functions
// ============================================================================

/**
 * Wrap a value to [0, max)
 */
export function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}

/**
 * Wrap a value to [min, max)
 */
export function wrapRange(value: number, min: number, max: number): number {
  const range = max - min;
  return min + wrap(value - min, range);
}

/**
 * Ping-pong a value between 0 and length
 */
export function pingpong(value: number, length: number): number {
  const t = value % (length * 2);
  return t < length ? t : length * 2 - t;
}

/**
 * Sign function (-1, 0, or 1)
 */
export function sign(value: number): number {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

/**
 * Fast floor function for positive numbers
 */
export function fastFloor(x: number): number {
  return x > 0 ? (x | 0) : ((x | 0) - 1);
}

/**
 * Fractional part of a number
 */
export function fract(x: number): number {
  return x - Math.floor(x);
}

// ============================================================================
// Easing Functions
// ============================================================================

export const easing = {
  linear: (t: number): number => t,

  // Quadratic
  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  // Cubic
  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => (--t) * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  // Quartic
  easeInQuart: (t: number): number => t * t * t * t,
  easeOutQuart: (t: number): number => 1 - (--t) * t * t * t,
  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,

  // Exponential
  easeInExpo: (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t: number): number => {
    if (t === 0 || t === 1) return t;
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
    return (2 - Math.pow(2, -20 * t + 10)) / 2;
  },
};
