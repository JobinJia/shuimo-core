/**
 * Flower Generator - Filter System
 * Complete replication of Canvas pixel filters for SVG
 * Original Canvas version: reference-code/flowers/main.js (Lines 1062-1071, 1092-1105)
 *
 * Strategy: Since SVG doesn't support pixel-level manipulation like Canvas,
 * we apply noise-based color adjustments to each shape element based on its position.
 */

import type { Layer, FilterType } from './types'
import { noise } from './FlowerNoise'
import { mapval } from './FlowerMath'
import { parseRGBA, rgba, hsv, parseHSVA } from './FlowerColor'

// ============================================================================
// Filter Functions
// ============================================================================

/**
 * Wispy filter effect
 * Original: Lines 1062-1066
 * Applies subtle color and alpha variations based on position
 */
function applyWispyFilter(element: SVGElement): void {
  // Get element position (use bounding box center)
  // Try to get bbox, but handle gracefully if element not in DOM
  let x = 0
  let y = 0
  try {
    const bbox = (element as SVGGraphicsElement).getBBox()
    x = bbox.x + bbox.width / 2
    y = bbox.y + bbox.height / 2
  } catch (e) {
    // If getBBox fails, try to extract position from path data
    if (element instanceof SVGPathElement) {
      const d = element.getAttribute('d')
      if (d) {
        const match = d.match(/M\s*([\d.-]+)\s+([\d.-]+)/)
        if (match) {
          x = parseFloat(match[1])
          y = parseFloat(match[2])
        }
      }
    }
  }

  // Calculate noise values (same as original)
  const n = noise(x * 0.2, y * 0.2)
  const m = noise(x * 0.5, y * 0.5, 2)

  // Apply to fill color
  const fill = element.getAttribute('fill')
  if (fill && fill !== 'none') {
    const parsed = parseRGBA(fill)
    if (parsed) {
      const [r, g, b, a] = parsed

      // Apply noise adjustments (exact formula from original)
      const newR = r
      const newG = g * mapval(m, 0, 1, 0.95, 1)
      const newB = b * mapval(m, 0, 1, 0.9, 1)
      const newA = a * mapval(n, 0, 1, 0.5, 1)

      element.setAttribute('fill', rgba(newR, newG, newB, newA))
    }
  }

  // Apply to stroke color if present
  const stroke = element.getAttribute('stroke')
  if (stroke && stroke !== 'none') {
    const parsed = parseRGBA(stroke)
    if (parsed) {
      const [r, g, b, a] = parsed
      const newR = r
      const newG = g * mapval(m, 0, 1, 0.95, 1)
      const newB = b * mapval(m, 0, 1, 0.9, 1)
      const newA = a * mapval(n, 0, 1, 0.5, 1)

      element.setAttribute('stroke', rgba(newR, newG, newB, newA))
    }
  }
}

/**
 * Fade filter effect
 * Original: Lines 1067-1070
 * Applies alpha fade based on low-frequency noise
 */
function applyFadeFilter(element: SVGElement): void {
  // Get element position
  // Try to get bbox, but handle gracefully if element not in DOM
  let x = 0
  let y = 0
  try {
    const bbox = (element as SVGGraphicsElement).getBBox()
    x = bbox.x + bbox.width / 2
    y = bbox.y + bbox.height / 2
  } catch (e) {
    // If getBBox fails, try to extract position from path data
    if (element instanceof SVGPathElement) {
      const d = element.getAttribute('d')
      if (d) {
        const match = d.match(/M\s*([\d.-]+)\s+([\d.-]+)/)
        if (match) {
          x = parseFloat(match[1])
          y = parseFloat(match[2])
        }
      }
    }
  }

  // Calculate noise value (same as original)
  const n = noise(x * 0.01, y * 0.01)

  // Calculate alpha (exact formula from original)
  const alpha = Math.min(Math.max(mapval(n, 0, 1, 0, 1), 0), 1)

  // Apply opacity to element
  const currentOpacity = parseFloat(element.getAttribute('opacity') || '1')
  element.setAttribute('opacity', (currentOpacity * alpha).toString())
}

// ============================================================================
// Layer Filter Application
// ============================================================================

/**
 * Apply filter to all elements in a layer
 * Original: Lines 1092-1105
 */
export function filter(layer: Layer, filterType: FilterType): void {
  // If layer is not in DOM, temporarily add it to get bbox for filtering
  const isInDOM = document.body.contains(layer.group)
  let tempSVG: SVGElement | null = null
  let targetGroup: SVGGElement = layer.group

  if (!isInDOM) {
    const SVG_NS = 'http://www.w3.org/2000/svg'
    tempSVG = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
    ;(tempSVG as SVGSVGElement).style.position = 'absolute'
    ;(tempSVG as SVGSVGElement).style.visibility = 'hidden'
    ;(tempSVG as SVGSVGElement).style.width = '0'
    ;(tempSVG as SVGSVGElement).style.height = '0'
    tempSVG.appendChild(layer.group)
    document.body.appendChild(tempSVG)
    targetGroup = layer.group
  }

  // Get all path and polygon elements (shapes that can be colored)
  const elements = targetGroup.querySelectorAll('path, polygon, rect, circle, ellipse')

  elements.forEach((element) => {
    const svgElement = element as SVGElement

    if (filterType === 'wispy') {
      applyWispyFilter(svgElement)
    }
    else if (filterType === 'fade') {
      applyFadeFilter(svgElement)
    }
  })

  // Clean up temp element and restore layer.group to original state
  if (tempSVG) {
    document.body.removeChild(tempSVG)
  }
}

// ============================================================================
// Alternative: Pre-filter Color Adjustment
// ============================================================================

/**
 * Calculate wispy color adjustment for a given position
 * Can be used during shape generation instead of post-processing
 */
export function getWispyColorAdjustment(x: number, y: number): {
  r: number
  g: number
  b: number
  a: number
} {
  const n = noise(x * 0.2, y * 0.2)
  const m = noise(x * 0.5, y * 0.5, 2)

  return {
    r: 1.0,
    g: mapval(m, 0, 1, 0.95, 1),
    b: mapval(m, 0, 1, 0.9, 1),
    a: mapval(n, 0, 1, 0.5, 1),
  }
}

/**
 * Calculate fade alpha adjustment for a given position
 */
export function getFadeAlphaAdjustment(x: number, y: number): number {
  const n = noise(x * 0.01, y * 0.01)
  return Math.min(Math.max(mapval(n, 0, 1, 0, 1), 0), 1)
}

/**
 * Apply color adjustment to RGBA color string
 */
export function applyColorAdjustment(
  color: string,
  adjustment: { r: number, g: number, b: number, a: number },
): string {
  const parsed = parseRGBA(color)
  if (!parsed) return color

  const [r, g, b, a] = parsed
  return rgba(
    r * adjustment.r,
    g * adjustment.g,
    b * adjustment.b,
    a * adjustment.a,
  )
}

// ============================================================================
// Combined Filter
// ============================================================================

/**
 * Apply multiple filters in sequence
 */
export function applyFilters(layer: Layer, filters: FilterType[]): void {
  for (const filterType of filters) {
    filter(layer, filterType)
  }
}

// ============================================================================
// Export as namespace for compatibility
// ============================================================================

export const Filter = {
  wispy: (layer: Layer) => filter(layer, 'wispy'),
  fade: (layer: Layer) => filter(layer, 'fade'),
  apply: filter,
  applyMultiple: applyFilters,
  getWispyAdjustment: getWispyColorAdjustment,
  getFadeAdjustment: getFadeAlphaAdjustment,
}
