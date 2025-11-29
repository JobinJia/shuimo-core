/**
 * Flower Generator - Paper Texture
 * Generate ancient paper texture for background
 * Original: reference-code/flowers/main.js (Lines 461-493)
 */

import { noise } from './FlowerNoise'
import { rgba } from './FlowerColor'

// ============================================================================
// Paper Texture Generator
// ============================================================================

export interface PaperOptions {
  /** Base color [r, g, b] in range 0-1 */
  col?: [number, number, number]
  /** Texture intensity (default: 20) */
  tex?: number
  /** Speckle density (default: 1) */
  spr?: number
  /** Resolution (default: 512) */
  reso?: number
}

/**
 * Generate paper texture as Canvas
 * Original: Lines 461-493
 *
 * Creates a tileable ancient paper texture with:
 * - Perlin noise for smooth brightness variation
 * - Random noise for paper grain
 * - Brown speckles for imperfections
 * - Four-quadrant mirror rendering for seamless tiling
 *
 * @param options - Paper generation options
 * @returns Canvas element with paper texture
 */
export function generatePaperCanvas(options: PaperOptions = {}): HTMLCanvasElement {
  const {
    col = [0.98, 0.91, 0.74], // Light beige/cream color
    tex = 20,
    spr = 1,
    reso = 512,
  } = options

  console.log('📄 Paper: Starting generation with reso:', reso)

  const canvas = document.createElement('canvas')
  canvas.width = reso
  canvas.height = reso
  const ctx = canvas.getContext('2d')!

  // Generate texture pixel by pixel
  // Only generate 1/4 of the texture, then mirror to create tileable pattern
  const loopCount = reso / 2 + 1
  console.log('📄 Paper: Loop iterations:', loopCount, 'x', loopCount, '=', loopCount * loopCount)

  for (let i = 0; i < reso / 2 + 1; i++) {
    for (let j = 0; j < reso / 2 + 1; j++) {
      // Base brightness from Perlin noise
      let c = 255 - noise(i * 0.1, j * 0.1) * tex * 0.5
      // Add random grain
      c -= Math.random() * tex

      // Default paper color
      let r = c * col[0]
      let g = c * col[1]
      let b = c * col[2]

      // Add brown speckles (imperfections)
      if (
        noise(i * 0.04, j * 0.04, 2) * Math.random() * spr > 0.7
        || Math.random() < 0.005 * spr
      ) {
        r = c * 0.7
        g = c * 0.5
        b = c * 0.2
      }

      // Draw to all four quadrants (creates tileable texture)
      ctx.fillStyle = rgba(r, g, b)
      ctx.fillRect(i, j, 1, 1)
      ctx.fillRect(reso - i, j, 1, 1)
      ctx.fillRect(i, reso - j, 1, 1)
      ctx.fillRect(reso - i, reso - j, 1, 1)
    }
  }

  return canvas
}

/**
 * Generate paper texture as base64 Data URL
 * Useful for embedding in SVG as <image> element
 *
 * @param options - Paper generation options
 * @returns Base64 data URL string
 */
export function generatePaperDataURL(options: PaperOptions = {}): string {
  console.log('📄 generatePaperDataURL called')
  const canvas = generatePaperCanvas(options)
  return canvas.toDataURL('image/png')
}

/**
 * Create SVG image element with paper texture
 *
 * @param width - Image width
 * @param height - Image height
 * @param options - Paper generation options
 * @returns SVG image element
 */
export function createPaperImage(
  width: number,
  height: number,
  options: PaperOptions = {},
): SVGImageElement {
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const img = document.createElementNS(SVG_NS, 'image')

  const dataURL = generatePaperDataURL(options)

  img.setAttribute('width', width.toString())
  img.setAttribute('height', height.toString())
  img.setAttribute('href', dataURL)

  // For tiling larger areas
  img.setAttribute('preserveAspectRatio', 'none')

  return img
}

/**
 * Create SVG pattern with paper texture for tiling
 *
 * @param id - Pattern ID
 * @param options - Paper generation options
 * @returns SVG pattern element
 */
export function createPaperPattern(
  id: string,
  options: PaperOptions = {},
): SVGPatternElement {
  console.log('📄 createPaperPattern called with id:', id)

  const SVG_NS = 'http://www.w3.org/2000/svg'
  const reso = options.reso || 512

  const pattern = document.createElementNS(SVG_NS, 'pattern')
  pattern.setAttribute('id', id)
  pattern.setAttribute('x', '0')
  pattern.setAttribute('y', '0')
  pattern.setAttribute('width', reso.toString())
  pattern.setAttribute('height', reso.toString())
  pattern.setAttribute('patternUnits', 'userSpaceOnUse')

  const img = document.createElementNS(SVG_NS, 'image')
  img.setAttribute('width', reso.toString())
  img.setAttribute('height', reso.toString())
  img.setAttribute('href', generatePaperDataURL(options))

  pattern.appendChild(img)

  return pattern
}

// ============================================================================
// Predefined Paper Colors
// ============================================================================

/** Default paper color (light beige) */
export const PAPER_COL_DEFAULT: [number, number, number] = [0.98, 0.91, 0.74]

/** Warm paper color (yellowish) */
export const PAPER_COL_WARM: [number, number, number] = [1, 0.99, 0.9]

/** Cool paper color (bluish white) */
export const PAPER_COL_COOL: [number, number, number] = [0.95, 0.97, 1]

/** Aged paper color (darker beige) */
export const PAPER_COL_AGED: [number, number, number] = [0.9, 0.85, 0.7]
