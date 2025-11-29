/**
 * Flower Generator - SVG Shape Functions
 * Core drawing primitives: polygon, stroke, tubify
 * Migrated from Canvas to SVG
 * Original: reference-code/flowers/main.js (Lines 374-459)
 */

import type { PolygonArgs, StrokeArgs, TubifyArgs, Vec2, Vec3 } from './types'
import { SVG_NS } from './types'
import { PI, sin } from './FlowerMath'
import { mapval } from './FlowerMath'
import { noise } from './FlowerNoise'

// ============================================================================
// SVG Helper Functions
// ============================================================================

/**
 * Create SVG element with namespace
 */
export function createSVGElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
  attributes?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tagName)

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, String(value))
    }
  }

  return element
}

/**
 * Convert array of points to SVG path d attribute
 */
export function pointsToPath(pts: Vec2[], closed: boolean = true): string {
  if (pts.length === 0) return ''

  let d = `M ${pts[0][0]} ${pts[0][1]}`

  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0]} ${pts[i][1]}`
  }

  if (closed) {
    d += ' Z'
  }

  return d
}

// ============================================================================
// Polygon Function (SVG Version)
// Original: Lines 374-399
// ============================================================================

/**
 * Create SVG polygon from points
 * @param args - Polygon arguments
 * @returns SVG path element
 */
export function polygon(args: PolygonArgs): SVGPathElement {
  const {
    pts = [],
    col = 'black',
    fil = true,
    str = false,
    xof = 0,
    yof = 0,
  } = args

  // Apply offset to points
  const offsetPts: Vec2[] = pts.map(pt => [pt[0] + xof, pt[1] + yof])

  // Generate path data
  const d = pointsToPath(offsetPts, true)

  // Create path element
  const path = createSVGElement('path', { d })

  // Set fill
  if (fil) {
    path.setAttribute('fill', col)
  }
  else {
    path.setAttribute('fill', 'none')
  }

  // Set stroke
  if (str) {
    path.setAttribute('stroke', col)
    path.setAttribute('stroke-width', '1')
  }

  return path
}

// ============================================================================
// Tubify Function (Pure Geometry - No Change)
// Original: Lines 416-442
// ============================================================================

/**
 * Generate 2D tube shape from list of 3D points
 * Returns two edge vertex lists that form the tube outline
 * @param args - Tubify arguments
 * @returns [leftEdge, rightEdge] vertex lists
 */
export function tubify(args: TubifyArgs): [Vec2[], Vec2[]] {
  const {
    pts = [],
    wid = (x: number) => 10,
  } = args

  const vtxlist0: Vec2[] = []
  const vtxlist1: Vec2[] = []

  // Process middle points
  for (let i = 1; i < pts.length - 1; i++) {
    const w = wid(i / pts.length)
    const a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
    const a2 = Math.atan2(pts[i][1] - pts[i + 1][1], pts[i][0] - pts[i + 1][0])
    let a = (a1 + a2) / 2

    if (a < a2) {
      a += PI
    }

    vtxlist0.push([
      pts[i][0] + w * Math.cos(a),
      pts[i][1] + w * Math.sin(a),
    ])
    vtxlist1.push([
      pts[i][0] - w * Math.cos(a),
      pts[i][1] - w * Math.sin(a),
    ])
  }

  // Process end points
  const l = pts.length - 1
  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) - Math.PI / 2
  const a1 = Math.atan2(pts[l][1] - pts[l - 1][1], pts[l][0] - pts[l - 1][0]) - Math.PI / 2

  const w0 = wid(0)
  const w1 = wid(1)

  vtxlist0.unshift([
    pts[0][0] + w0 * Math.cos(a0),
    pts[0][1] + w0 * Math.sin(a0),
  ])
  vtxlist1.unshift([
    pts[0][0] - w0 * Math.cos(a0),
    pts[0][1] - w0 * Math.sin(a0),
  ])

  vtxlist0.push([
    pts[l][0] + w1 * Math.cos(a1),
    pts[l][1] + w1 * Math.sin(a1),
  ])
  vtxlist1.push([
    pts[l][0] - w1 * Math.cos(a1),
    pts[l][1] - w1 * Math.sin(a1),
  ])

  return [vtxlist0, vtxlist1]
}

// ============================================================================
// Stroke Function (SVG Version)
// Original: Lines 444-459
// ============================================================================

/**
 * Create line work with variable width
 * Uses tubify to generate tube shape, then renders as filled polygon
 * @param args - Stroke arguments
 * @returns SVG path element
 */
export function stroke(args: StrokeArgs): SVGPathElement {
  const {
    pts = [],
    col = 'black',
    xof = 0,
    yof = 0,
    wid = (x: number) => (1 * sin(x * PI) * mapval(noise(x * 10), 0, 1, 0.5, 1)),
  } = args

  // Generate tube edges
  const [vtxlist0, vtxlist1] = tubify({ pts, wid })

  // Combine edges into closed polygon
  const allPts = vtxlist0.concat(vtxlist1.reverse())

  // Create filled polygon
  return polygon({ pts: allPts, xof, yof, fil: true, col })
}

// ============================================================================
// Additional Utilities
// ============================================================================

/**
 * Get bounding box of a list of 2D points
 */
export function getBounds(pts: Vec2[]): { xmin: number, xmax: number, ymin: number, ymax: number } {
  if (pts.length === 0) {
    return { xmin: 0, xmax: 0, ymin: 0, ymax: 0 }
  }

  let xmin = pts[0][0]
  let xmax = pts[0][0]
  let ymin = pts[0][1]
  let ymax = pts[0][1]

  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] < xmin) xmin = pts[i][0]
    if (pts[i][0] > xmax) xmax = pts[i][0]
    if (pts[i][1] < ymin) ymin = pts[i][1]
    if (pts[i][1] > ymax) ymax = pts[i][1]
  }

  return { xmin, xmax, ymin, ymax }
}

/**
 * Calculate center point of a polygon
 */
export function getCenter(pts: Vec2[]): Vec2 {
  if (pts.length === 0) return [0, 0]

  let sumX = 0
  let sumY = 0

  for (const pt of pts) {
    sumX += pt[0]
    sumY += pt[1]
  }

  return [sumX / pts.length, sumY / pts.length]
}
