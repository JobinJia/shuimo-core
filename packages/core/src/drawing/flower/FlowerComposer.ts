/**
 * Flower Generator - Composers
 * High-level functions to compose woody and herbal plants
 * Original: reference-code/flowers/main.js (Lines 891-1059)
 */

import type { WoodyArgs, HerbalArgs, Layer, Vec3 } from './types'
import { PI, sin, mapval, normRand, grot } from './FlowerMath'
import { noise } from './FlowerNoise'
import { leaf, stem, branch } from './FlowerPlant'
import * as LayerSystem from './FlowerLayer'
import { filter } from './FlowerFilter'
import { genParams } from './FlowerParams'

// ============================================================================
// Woody Plant Composer
// Original: Lines 891-969
// ============================================================================

/**
 * Generate a woody (tree-like) plant
 * Features branches with leaves and flowers
 */
export function woody(args: WoodyArgs = {}): Layer {
  const {
    xof = 0,
    yof = 0,
    PAR = genParams(),
  } = args

  const cwid = 1200
  const lay0 = LayerSystem.empty(cwid, cwid)
  const lay1 = LayerSystem.empty(cwid, cwid)

  // Generate branch structure
  const { group: branchGroup, branches: PL } = branch({
    xof: cwid * 0.5,
    yof: cwid * 0.7,
    wid: PAR.branchWidth,
    twi: PAR.branchTwist,
    dep: PAR.branchDepth,
    col: PAR.branchColor,
    frk: PAR.branchFork,
  })

  // CRITICAL FIX: Add branch SVG group to layer (THIS WAS MISSING!)
  lay0.group.appendChild(branchGroup)

  // Add leaves and flowers to branches
  for (let i = 0; i < PL.length; i++) {
    if (i / PL.length > 0.1) {
      for (let j = 0; j < PL[i][1].length; j++) {
        const pt = PL[i][1][j]

        // Add leaves
        if (Math.random() < PAR.leafChance) {
          const { group: leafGroup } = leaf({
            xof: pt[0],
            yof: pt[1],
            len: PAR.leafLength * normRand(0.8, 1.2),
            vei: PAR.leafType,
            col: PAR.leafColor,
            rot: [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0],
            wid: (x: number) => PAR.leafShape(x) * PAR.leafWidth,
            ben: (x: number): Vec3 => [
              mapval(noise(x * 1, i), 0, 1, -1, 1) * 5,
              0,
              mapval(noise(x * 1, i + PI), 0, 1, -1, 1) * 5,
            ],
          })
          lay0.group.appendChild(leafGroup)
        }

        // Add flowers
        if (Math.random() < PAR.flowerChance) {
          const hr: Vec3 = [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0]

          // Pedicel (flower stem)
          const { points: P_ } = stem({
            xof: pt[0],
            yof: pt[1],
            rot: hr,
            len: PAR.pedicelLength,
            col: { min: [50, 1, 0.9, 1], max: [50, 1, 0.9, 1] },
            wid: (x: number) => sin(x * PI) * x * 2 + 1,
            ben: (x: number): Vec3 => [0, 0, 0],
          })

          const op = Math.random()
          const r = grot(P_, P_.length - 1)
          const hhr = r

          // Generate flower petals
          for (let k = 0; k < PAR.flowerPetal; k++) {
            const { group: petalGroup } = leaf({
              flo: true,
              xof: pt[0] + P_[P_.length - 1][0],
              yof: pt[1] + P_[P_.length - 1][1],
              rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
              len: PAR.flowerLength * normRand(0.7, 1.3),
              wid: (x: number) => PAR.flowerShape(x) * PAR.flowerWidth,
              vei: [0],
              col: PAR.flowerColor,
              cof: PAR.flowerColorCurve,
              ben: (x: number): Vec3 => [
                PAR.flowerOpenCurve(x, op),
                0,
                0,
              ],
            })
            lay1.group.appendChild(petalGroup)

            // Inner flower parts
            const { group: innerGroup } = leaf({
              flo: true,
              xof: pt[0] + P_[P_.length - 1][0],
              yof: pt[1] + P_[P_.length - 1][1],
              rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
              len: PAR.innerLength * normRand(0.8, 1.2),
              wid: (x: number) => sin(x * PI) * 4,
              vei: [0],
              col: PAR.innerColor,
              cof: (x: number) => x,
              ben: (x: number): Vec3 => [
                PAR.flowerOpenCurve(x, op),
                0,
                0,
              ],
            })
            lay1.group.appendChild(innerGroup)
          }
        }
      }
    }
  }

  // Apply filters
  filter(lay0, 'fade')
  filter(lay0, 'wispy')
  filter(lay1, 'wispy')

  // Calculate combined bounds
  const b1 = LayerSystem.bound(lay0)
  const b2 = LayerSystem.bound(lay1)
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  }

  // Calculate positioning
  const xref = xof - (bd.xmin + bd.xmax) / 2
  const yref = yof - bd.ymax

  // Create final layer and composite
  const finalLayer = LayerSystem.empty(cwid, cwid)
  LayerSystem.blit(finalLayer, lay0, { ble: 'multiply', xof: xref, yof: yref })
  LayerSystem.blit(finalLayer, lay1, { ble: 'normal', xof: xref, yof: yref })

  return finalLayer
}

// ============================================================================
// Herbal Plant Composer
// Original: Lines 972-1059
// ============================================================================

/**
 * Generate a herbal (grass-like) plant
 * Features stems with leaves and flowers at the top
 */
export function herbal(args: HerbalArgs = {}): Layer {
  const {
    xof = 0,
    yof = 0,
    PAR = genParams(),
  } = args

  const cwid = 1200
  const lay0 = LayerSystem.empty(cwid, cwid)
  const lay1 = LayerSystem.empty(cwid, cwid)

  const x0 = cwid * 0.5
  const y0 = cwid * 0.7

  // Generate multiple stems
  for (let i = 0; i < PAR.stemCount; i++) {
    const r: Vec3 = [PI / 2, 0, normRand(-1, 1) * PI]
    const { group: stemGroup, points: P } = stem({
      xof: x0,
      yof: y0,
      len: PAR.stemLength * normRand(0.7, 1.3),
      rot: r,
      wid: (x: number) =>
        PAR.stemWidth * (sin(x * PI / 2 + PI / 2) ** 0.5 * noise(x * 10) * 0.5 + 0.5),
      ben: (x: number): Vec3 => [
        mapval(noise(x * 1, i), 0, 1, -1, 1) * x * PAR.stemBend,
        0,
        mapval(noise(x * 1, i + PI), 0, 1, -1, 1) * x * PAR.stemBend,
      ],
    })
    lay0.group.appendChild(stemGroup)

    // Add leaves along stem (leafPosition == 2)
    if (PAR.leafPosition === 2) {
      for (let j = 0; j < P.length; j++) {
        if (Math.random() < PAR.leafChance * 2) {
          const { group: leafGroup } = leaf({
            xof: x0 + P[j][0],
            yof: y0 + P[j][1],
            len: 2 * PAR.leafLength * normRand(0.8, 1.2),
            vei: PAR.leafType,
            col: PAR.leafColor,
            rot: [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0],
            wid: (x: number) => 2 * PAR.leafShape(x) * PAR.leafWidth,
            ben: (x: number): Vec3 => [
              mapval(noise(x * 1, i), 0, 1, -1, 1) * 5,
              0,
              mapval(noise(x * 1, i + PI), 0, 1, -1, 1) * 5,
            ],
          })
          lay0.group.appendChild(leafGroup)
        }
      }
    }

    // Add sheath at top of stem
    const hr = grot(P, P.length - 1)
    if (PAR.sheathLength !== 0) {
      const { group: sheathGroup } = stem({
        xof: x0 + P[P.length - 1][0],
        yof: y0 + P[P.length - 1][1],
        rot: hr,
        len: PAR.sheathLength,
        col: { min: [60, 0.3, 0.9, 1], max: [60, 0.3, 0.9, 1] },
        wid: (x: number) => PAR.sheathWidth * (sin(x * PI) ** 2 - x * 0.5 + 0.5),
        ben: (x: number): Vec3 => [0, 0, 0],
      })
      lay0.group.appendChild(sheathGroup)
    }

    // Add shoots with flowers
    for (let j = 0; j < Math.max(1, PAR.shootCount * normRand(0.5, 1.5)); j++) {
      const { group: shootGroup, points: P_ } = stem({
        xof: x0 + P[P.length - 1][0],
        yof: y0 + P[P.length - 1][1],
        rot: hr,
        len: PAR.shootLength * normRand(0.5, 1.5),
        col: { min: [70, 0.2, 0.9, 1], max: [70, 0.2, 0.9, 1] },
        wid: (x: number) => 2,
        ben: (x: number): Vec3 => [
          mapval(noise(x * 1, j), 0, 1, -1, 1) * x * 10,
          0,
          mapval(noise(x * 1, j + PI), 0, 1, -1, 1) * x * 10,
        ],
      })
      lay0.group.appendChild(shootGroup)

      const op = Math.random()
      const hhr: Vec3 = [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * PI]

      // Generate flower petals
      for (let k = 0; k < PAR.flowerPetal; k++) {
        const { group: petalGroup } = leaf({
          flo: true,
          xof: x0 + P[P.length - 1][0] + P_[P_.length - 1][0],
          yof: y0 + P[P.length - 1][1] + P_[P_.length - 1][1],
          rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
          len: PAR.flowerLength * normRand(0.7, 1.3) * 1.5,
          wid: (x: number) => 1.5 * PAR.flowerShape(x) * PAR.flowerWidth,
          vei: [0],
          col: PAR.flowerColor,
          cof: PAR.flowerColorCurve,
          ben: (x: number): Vec3 => [
            PAR.flowerOpenCurve(x, op),
            0,
            0,
          ],
        })
        lay1.group.appendChild(petalGroup)

        // Inner flower parts
        const { group: innerGroup } = leaf({
          flo: true,
          xof: x0 + P[P.length - 1][0] + P_[P_.length - 1][0],
          yof: y0 + P[P.length - 1][1] + P_[P_.length - 1][1],
          rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
          len: PAR.innerLength * normRand(0.8, 1.2),
          wid: (x: number) => sin(x * PI) * 4,
          vei: [0],
          col: PAR.innerColor,
          cof: (x: number) => x,
          ben: (x: number): Vec3 => [
            PAR.flowerOpenCurve(x, op),
            0,
            0,
          ],
        })
        lay1.group.appendChild(innerGroup)
      }
    }
  }

  // Add basal leaves (leafPosition == 1)
  if (PAR.leafPosition === 1) {
    for (let i = 0; i < PAR.leafChance * 100; i++) {
      const { group: leafGroup } = leaf({
        xof: x0,
        yof: y0,
        rot: [PI / 3, 0, normRand(-1, 1) * PI],
        len: 4 * PAR.leafLength * normRand(0.8, 1.2),
        wid: (x: number) => 2 * PAR.leafShape(x) * PAR.leafWidth,
        vei: PAR.leafType,
        ben: (x: number): Vec3 => [
          mapval(noise(x * 1, i), 0, 1, -1, 1) * 10,
          0,
          mapval(noise(x * 1, i + PI), 0, 1, -1, 1) * 10,
        ],
      })
      lay0.group.appendChild(leafGroup)
    }
  }

  // Apply filters
  filter(lay0, 'fade')
  filter(lay0, 'wispy')
  filter(lay1, 'wispy')

  // Calculate combined bounds
  const b1 = LayerSystem.bound(lay0)
  const b2 = LayerSystem.bound(lay1)
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  }

  // Calculate positioning
  const xref = xof - (bd.xmin + bd.xmax) / 2
  const yref = yof - bd.ymax

  // Create final layer and composite
  const finalLayer = LayerSystem.empty(cwid, cwid)
  LayerSystem.blit(finalLayer, lay0, { ble: 'multiply', xof: xref, yof: yref })
  LayerSystem.blit(finalLayer, lay1, { ble: 'normal', xof: xref, yof: yref })

  return finalLayer
}
