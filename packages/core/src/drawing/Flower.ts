/**
 * Flower Generator - Main Export
 * Procedurally generated paintings of non-existent flowers
 *
 * Migrated from Canvas to SVG implementation
 * Original: Nonflowers by Lingdong Huang (c) 2018
 * Reference: reference-code/flowers/main.js
 */

import type { FlowerOptions } from './flower/types'
import { SVG_NS } from './flower/types'
import { installGlobalPRNG, seed as seedPRNG } from './flower/FlowerPRNG'
import { resetNoise } from './flower/FlowerNoise'
import { woody, herbal } from './flower/FlowerComposer'
import { squircle } from './flower/FlowerMath'
import { border } from './flower/FlowerLayer'
import { createPaperPattern, generatePaperCanvas, PAPER_COL_WARM } from './flower/FlowerPaper'

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate a procedural flower painting as SVG
 *
 * @param options - Configuration options
 * @returns SVG element containing the generated flower
 *
 * @example
 * ```typescript
 * // Generate random flower
 * const svg = generateFlower()
 * document.body.appendChild(svg)
 *
 * // Generate with specific seed
 * const svg = generateFlower({ seed: '12345' })
 *
 * // Generate woody plant
 * const svg = generateFlower({ type: 'woody', seed: 'my-seed' })
 * ```
 */
export function generateFlower(options: FlowerOptions = {}): SVGSVGElement {
  const {
    seed,
    type = 'random',
    width = 600,
    height = 600,
    background = 'none',
  } = options

  // ============================================================================
  // CRITICAL: Match Original Execution Flow EXACTLY
  // ============================================================================
  // Original flow (reference-code/flowers/main.js):
  // 1. Line 98: Math.seed(SEED) - Initialize PRNG
  // 2. Line 1206-1212: makeBG() calls paper({ col: PAPER_COL0, tex: 10, spr: 0 })
  //    - First call to Noise.noise() initializes perlin array (4,096 randoms)
  //    - paper() loops 257×257 = 66,049 times, each consuming 3 randoms
  //    - Total: 4,096 + 198,147 = 202,243 randoms
  // 3. Line 1220: paper({ col: PAPER_COL1 }) with default tex: 20, spr: 1
  //    - Noise already initialized, so only loop randoms
  //    - Total: 198,147 randoms
  // 4. Line 1226: Math.random() <= 0.5 to decide plant type
  //    - This is random #400,391 in the sequence!
  // 5. Line 1227/1230: woody() or herbal() → genParams()
  // ============================================================================

  const finalSeed = seed !== undefined ? seed : new Date().getTime().toString()

  // Step 1: Install PRNG and set seed
  installGlobalPRNG()
  resetNoise() // Ensure Noise is reset so it will re-initialize
  seedPRNG(finalSeed)

  console.log('🌺 [1] After seed, first 3 randoms:', [Math.random(), Math.random(), Math.random()])
  seedPRNG(finalSeed) // Re-seed to restore state

  // Step 2: Simulate makeBG() - paper({ col: PAPER_COL0, tex: 10, spr: 0 })
  // This MUST happen before SVG creation to match original flow
  console.log('🌺 [2] Simulating makeBG() - calling paper(PAPER_COL0)')
  const PAPER_COL0: [number, number, number] = [0.98, 0.91, 0.74]
  generatePaperCanvas({
    col: PAPER_COL0,
    tex: 10,
    spr: 0,
    reso: 512,
  })
  console.log('🌺 [2] After makeBG(), next 3 randoms:', [Math.random(), Math.random(), Math.random()])
  seedPRNG(finalSeed) // Re-seed

  // Create SVG container
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', width.toString())
  svg.setAttribute('height', height.toString())
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('xmlns', SVG_NS)

  // Step 3: Simulate generate() start - paper({ col: PAPER_COL1 })
  console.log('🌺 [3] Simulating generate() paper - calling paper(PAPER_COL1)')
  const PAPER_COL1: [number, number, number] = [1, 0.99, 0.9]

  if (background === 'paper') {
    // Generate actual visible paper pattern
    const patternId = seed
      ? `paper-texture-${seed.toString().replace(/[^a-zA-Z0-9]/g, '-')}`
      : `paper-texture-${Date.now()}`

    const paperPattern = createPaperPattern(patternId, {
      col: PAPER_COL1,
      tex: 20,
      spr: 1,
      reso: 512,
    })

    const defs = document.createElementNS(SVG_NS, 'defs')
    defs.appendChild(paperPattern)
    svg.appendChild(defs)

    const rect = document.createElementNS(SVG_NS, 'rect')
    rect.setAttribute('width', width.toString())
    rect.setAttribute('height', height.toString())
    rect.setAttribute('fill', `url(#${patternId})`)
    svg.appendChild(rect)
  }
  else {
    // Even if not showing paper, we MUST consume same randoms as original!
    generatePaperCanvas({
      col: PAPER_COL1,
      tex: 20,
      spr: 1,
      reso: 512,
    })

    // Add solid background if requested
    if (background !== 'none') {
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('width', width.toString())
      rect.setAttribute('height', height.toString())
      rect.setAttribute('fill', background)
      svg.appendChild(rect)
    }
  }

  console.log('🌺 [3] After generate() paper, next 3 randoms:', [Math.random(), Math.random(), Math.random()])
  seedPRNG(finalSeed) // Re-seed

  // Step 4: Determine plant type (this is the CRITICAL random call)
  let plantType: 'woody' | 'herbal'
  if (type === 'random') {
    const randomValue = Math.random()
    console.log('🌺 [4] Plant type decision random:', randomValue, '→', randomValue <= 0.5 ? 'woody' : 'herbal')
    plantType = randomValue <= 0.5 ? 'woody' : 'herbal'
  }
  else {
    plantType = type
  }

  // Step 5: Generate plant
  console.log('🌺 [5] Generating', plantType, 'plant')
  const layer = plantType === 'woody'
    ? woody({ xof: 300, yof: 550 })
    : herbal({ xof: 300, yof: 600 })

  // Apply border clipping (squircle shape)
  border(layer, squircle(0.98, 3))

  // Add layer to SVG
  svg.appendChild(layer.group)

  return svg
}

// ============================================================================
// Re-export utilities for advanced usage
// ============================================================================

export { woody, herbal } from './flower/FlowerComposer'
export { genParams } from './flower/FlowerParams'
export { leaf, stem, branch } from './flower/FlowerPlant'
export type { FlowerOptions, FlowerParams } from './flower/types'
