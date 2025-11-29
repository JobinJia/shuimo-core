/**
 * Flower Generator - Color Utilities
 * RGBA and HSV color conversion and manipulation
 * Migrated from reference-code/flowers/main.js (Lines 357-409)
 */

import { abs } from './FlowerMath'
import { mapval } from './FlowerMath'

// ============================================================================
// RGBA Color
// ============================================================================

/**
 * Create RGBA color string
 * @param r - Red (0-255)
 * @param g - Green (0-255, defaults to r)
 * @param b - Blue (0-255, defaults to g)
 * @param a - Alpha (0-1, defaults to 1)
 */
export function rgba(
  r: number = 255,
  g?: number,
  b?: number,
  a: number = 1.0,
): string {
  g = (g !== undefined) ? g : r
  b = (b !== undefined) ? b : g
  return `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${a.toFixed(3)})`
}

// ============================================================================
// HSV Color
// ============================================================================

/**
 * Create HSV color string (converts to RGBA)
 * @param h - Hue (0-360)
 * @param s - Saturation (0-1)
 * @param v - Value (0-1)
 * @param a - Alpha (0-1, defaults to 1)
 */
export function hsv(
  h: number,
  s: number,
  v: number,
  a: number = 1.0,
): string {
  const c = v * s
  const x = c * (1 - abs((h / 60) % 2 - 1))
  const m = v - c

  const hueSegment = Math.floor(h / 60)
  const rgbPrimes = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ]

  const [rv, gv, bv] = rgbPrimes[hueSegment] || [0, 0, 0]
  const r = (rv + m) * 255
  const g = (gv + m) * 255
  const b = (bv + m) * 255

  return rgba(r, g, b, a)
}

// ============================================================================
// Color Interpolation
// ============================================================================

/**
 * Lerp hue wrapping around 360 degrees
 * Chooses the shortest path around the color wheel
 * @param h0 - Start hue
 * @param h1 - End hue
 * @param p - Progress (0-1)
 */
export function lerpHue(h0: number, h1: number, p: number): number {
  const methods: [number, number][] = [
    [abs(h1 - h0), mapval(p, 0, 1, h0, h1)],
    [abs(h1 + 360 - h0), mapval(p, 0, 1, h0, h1 + 360)],
    [abs(h1 - 360 - h0), mapval(p, 0, 1, h0, h1 - 360)],
  ]

  methods.sort((x, y) => (x[0] - y[0]))
  return (methods[0][1] + 720) % 360
}

// ============================================================================
// Color Parsing (for filter effects)
// ============================================================================

/**
 * Parse RGBA color string to components
 * @param color - CSS color string (rgba format)
 * @returns [r, g, b, a] or null if parsing fails
 */
export function parseRGBA(color: string): [number, number, number, number] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (!match) return null

  return [
    parseInt(match[1]),
    parseInt(match[2]),
    parseInt(match[3]),
    match[4] ? parseFloat(match[4]) : 1.0,
  ]
}

/**
 * Parse HSV-generated color string back to HSVA
 * Note: This is lossy due to HSV->RGB->HSV conversion
 * @param color - CSS color string
 * @returns Approximate HSVA values or null
 */
export function parseHSVA(color: string): [number, number, number, number] | null {
  const rgba = parseRGBA(color)
  if (!rgba) return null

  const [r, g, b, a] = rgba
  const rNorm = r / 255
  const gNorm = g / 255
  const bNorm = b / 255

  const max = Math.max(rNorm, gNorm, bNorm)
  const min = Math.min(rNorm, gNorm, bNorm)
  const delta = max - min

  // Value
  const v = max

  // Saturation
  const s = max === 0 ? 0 : delta / max

  // Hue
  let h = 0
  if (delta !== 0) {
    if (max === rNorm) {
      h = 60 * (((gNorm - bNorm) / delta) % 6)
    }
    else if (max === gNorm) {
      h = 60 * ((bNorm - rNorm) / delta + 2)
    }
    else {
      h = 60 * ((rNorm - gNorm) / delta + 4)
    }
  }

  if (h < 0) h += 360

  return [h, s, v, a]
}

/**
 * Adjust color with noise (for filter effects)
 * @param color - Original color string
 * @param noiseR - Noise value for red channel
 * @param noiseG - Noise value for green channel
 * @param noiseB - Noise value for blue channel
 * @param noiseA - Noise value for alpha channel
 * @returns Adjusted color string
 */
export function adjustColor(
  color: string,
  noiseR: number = 1,
  noiseG: number = 1,
  noiseB: number = 1,
  noiseA: number = 1,
): string {
  const parsed = parseRGBA(color)
  if (!parsed) return color

  const [r, g, b, a] = parsed
  return rgba(
    r * noiseR,
    g * noiseG,
    b * noiseB,
    a * noiseA,
  )
}
