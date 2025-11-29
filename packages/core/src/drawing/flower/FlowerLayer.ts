/**
 * Flower Generator - Layer System
 * SVG group-based layer management
 * Original Canvas version: reference-code/flowers/main.js (Lines 1074-1151)
 */

import type { Layer, BlitOptions, Bounds } from './types'
import { SVG_NS } from './types'
import { distance } from './FlowerMath'

// ============================================================================
// Layer Management
// ============================================================================

/**
 * Create an empty layer (SVG group)
 */
export function empty(w: number = 600, h?: number): Layer {
  // Match original: if h not provided, use w (square canvas)
  const height = h !== undefined ? h : w

  const group = document.createElementNS(SVG_NS, 'g')
  group.setAttribute('data-width', w.toString())
  group.setAttribute('data-height', height.toString())

  return {
    group,
    width: w,
    height,
  }
}

/**
 * Composite one layer onto another (blit)
 * Applies blend mode and offset transformation
 */
export function blit(target: Layer, source: Layer, options: BlitOptions = {}): void {
  const {
    ble = 'normal',
    xof = 0,
    yof = 0,
  } = options

  // Apply transform for offset
  if (xof !== 0 || yof !== 0) {
    const existingTransform = source.group.getAttribute('transform') || ''
    const newTransform = `translate(${xof}, ${yof})`
    source.group.setAttribute(
      'transform',
      existingTransform ? `${existingTransform} ${newTransform}` : newTransform,
    )
  }

  // Apply blend mode
  if (ble === 'multiply') {
    source.group.style.mixBlendMode = 'multiply'
  }
  else {
    source.group.style.mixBlendMode = 'normal'
  }

  // Append to target
  target.group.appendChild(source.group)
}

/**
 * Get bounding box of layer content
 */
export function bound(layer: Layer): Bounds {
  try {
    // If layer is not in DOM, temporarily add it to get bbox
    const isInDOM = document.body.contains(layer.group)
    let tempSVG: SVGSVGElement | null = null

    if (!isInDOM) {
      tempSVG = document.createElementNS(SVG_NS, 'svg')
      tempSVG.style.position = 'absolute'
      tempSVG.style.visibility = 'hidden'
      tempSVG.style.width = '0'
      tempSVG.style.height = '0'
      tempSVG.appendChild(layer.group.cloneNode(true))
      document.body.appendChild(tempSVG)
    }

    const targetGroup = isInDOM ? layer.group : tempSVG!.firstElementChild as SVGGElement
    const bbox = targetGroup.getBBox()

    // Clean up temp element
    if (tempSVG) {
      document.body.removeChild(tempSVG)
    }

    return {
      xmin: bbox.x,
      xmax: bbox.x + bbox.width,
      ymin: bbox.y,
      ymax: bbox.y + bbox.height,
    }
  }
  catch (e) {
    // If getBBox fails (empty group), return zeros
    return {
      xmin: 0,
      xmax: 0,
      ymin: 0,
      ymax: 0,
    }
  }
}

/**
 * Apply border/clipping to layer using clip-path
 * Original: Lines 1107-1129
 * @param layer - Layer to clip
 * @param radiusFunc - Function that returns radius at given angle
 */
export function border(layer: Layer, radiusFunc: (theta: number) => number): void {
  const w = layer.width
  const h = layer.height

  // Create clip path
  const clipPathId = `clip-${Math.random().toString(36).substr(2, 9)}`
  const clipPath = document.createElementNS(SVG_NS, 'clipPath')
  clipPath.setAttribute('id', clipPathId)

  // Generate path from radius function
  const points: [number, number][] = []
  const steps = 360

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI
    const r = radiusFunc(theta)

    // Convert polar to cartesian, centered at (w/2, h/2)
    const nx = Math.cos(theta) * r
    const ny = Math.sin(theta) * r

    // Scale to canvas size (r is normalized to [-1, 1])
    const x = w / 2 + nx * w / 2
    const y = h / 2 + ny * h / 2

    points.push([x, y])
  }

  // Create path element for clip
  let d = `M ${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0]} ${points[i][1]}`
  }
  d += ' Z'

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  clipPath.appendChild(path)

  // Apply clip path to layer
  layer.group.appendChild(clipPath)
  layer.group.setAttribute('clip-path', `url(#${clipPathId})`)
}

// ============================================================================
// Layer Utilities
// ============================================================================

/**
 * Create a container SVG element for a layer
 */
export function createLayerContainer(layer: Layer): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', layer.width.toString())
  svg.setAttribute('height', layer.height.toString())
  svg.setAttribute('viewBox', `0 0 ${layer.width} ${layer.height}`)
  svg.appendChild(layer.group)
  return svg
}

/**
 * Export layer as SVG string
 */
export function layerToSVGString(layer: Layer): string {
  const svg = createLayerContainer(layer)
  return new XMLSerializer().serializeToString(svg)
}
