/**
 * Flower Generator - Parameter Generation
 * Random parameter generation for plant variations
 * Original: reference-code/flowers/main.js (Lines 788-888)
 */

import type { FlowerParams } from './types'
import { PI, sin, mapval, normRand, randChoice, sigmoid } from './FlowerMath'
import { noise } from './FlowerNoise'

/**
 * Generate random parameters for a flower/plant
 * Creates all the configuration needed for woody or herbal plants
 */
export function genParams(): FlowerParams {
  console.log('🌺 SVG genParams: First 5 random:', [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()])

  const randint = (x: number, y: number) => Math.floor(normRand(x, y))

  // Flower shape masks
  const flowerShapeMask = (x: number) => sin(PI * x) ** 0.2
  const leafShapeMask = (x: number) => sin(PI * x) ** 0.5

  // Flower and leaf chances
  const flowerChance = randChoice([normRand(0, 0.08), normRand(0, 0.03)])
  const leafChance = randChoice([0, normRand(0, 0.1), normRand(0, 0.1)])
  const leafType = randChoice([
    [1, randint(2, 5)],
    [2, randint(3, 7), randint(3, 8)],
    [2, randint(3, 7), randint(3, 8)],
  ])

  // Flower shape
  const flowerShapeNoiseSeed = Math.random() * PI
  const flowerJaggedness = normRand(0.5, 8)
  const flowerShape = (x: number) =>
    noise(x * flowerJaggedness, flowerShapeNoiseSeed) * flowerShapeMask(x)

  // Leaf shape
  const leafShapeNoiseSeed = Math.random() * PI
  const leafJaggedness = normRand(0.1, 40)
  const leafPointyness = normRand(0.5, 1.5)
  const leafShape = randChoice([
    (x: number) => noise(x * leafJaggedness, flowerShapeNoiseSeed) * leafShapeMask(x),
    (x: number) => sin(PI * x) ** leafPointyness,
  ])

  // Flower colors
  const flowerHue0 = (normRand(0, 180) - 130 + 360) % 360
  const flowerHue1 = Math.floor((flowerHue0 + normRand(-70, 70) + 360) % 360)
  const flowerValue0 = Math.min(1, normRand(0.5, 1.3))
  const flowerValue1 = Math.min(1, normRand(0.5, 1.3))
  const flowerSaturation0 = normRand(0, 1.1 - flowerValue0)
  const flowerSaturation1 = normRand(0, 1.1 - flowerValue1)

  const flowerColor = {
    min: [flowerHue0, flowerSaturation0, flowerValue0, normRand(0.8, 1)] as [number, number, number, number],
    max: [flowerHue1, flowerSaturation1, flowerValue1, normRand(0.5, 1)] as [number, number, number, number],
  }

  // Leaf colors
  const leafColor = {
    min: [normRand(10, 200), normRand(0.05, 0.4), normRand(0.3, 0.7), normRand(0.8, 1)] as [number, number, number, number],
    max: [normRand(10, 200), normRand(0.05, 0.4), normRand(0.3, 0.7), normRand(0.8, 1)] as [number, number, number, number],
  }

  // Curve coefficients
  const curveCoeff0 = [normRand(-0.5, 0.5), normRand(5, 10)]
  const curveCoeff2 = [Math.random() * PI, normRand(5, 15)]
  const curveCoeff4 = [Math.random() * 0.5, normRand(0.8, 1.2)]

  // Flower opening curve
  const flowerOpenCurve = randChoice([
    (x: number, op: number) =>
      x < 0.1
        ? 2 + op * curveCoeff2[1]
        : noise(x * 10, curveCoeff2[0]),
    (x: number, op: number) =>
      x < curveCoeff4[0] ? 0 : 10 - x * mapval(op, 0, 1, 16, 20) * curveCoeff4[1],
  ])

  // Flower color curve
  const flowerColorCurve = randChoice([
    (x: number) => sigmoid(x + curveCoeff0[0], curveCoeff0[1]),
  ])

  // Dimensions
  const leafLength = normRand(30, 100)
  const flowerLength = normRand(5, 55)
  const pedicelLength = normRand(5, 30)
  const leafWidth = normRand(5, 30)
  const flowerWidth = normRand(5, 30)

  // Stem parameters
  const stemWidth = normRand(2, 11)
  const stemBend = normRand(2, 16)
  const stemLength = normRand(300, 400)
  const stemCount = randChoice([2, 3, 4, 5])

  // Sheath and shoot
  const sheathLength = randChoice([0, normRand(50, 100)])
  const sheathWidth = normRand(5, 15)
  const shootCount = normRand(1, 7)
  const shootLength = normRand(50, 180)
  const leafPosition = randChoice([1, 2])

  // Flower petal count
  const flowerPetal = Math.round(mapval(flowerWidth, 5, 50, 10, 3))

  // Inner flower parts
  const innerLength = Math.min(normRand(0, 20), flowerLength * 0.8)
  const innerWidth = Math.min(randChoice([0, normRand(1, 8)]), flowerWidth * 0.8)
  const innerShape = (x: number) => sin(PI * x) ** 1
  const innerHue = normRand(0, 60)
  const innerColor = {
    min: [innerHue, normRand(0.1, 0.7), normRand(0.5, 0.9), normRand(0.8, 1)] as [number, number, number, number],
    max: [innerHue, normRand(0.1, 0.7), normRand(0.5, 0.9), normRand(0.5, 1)] as [number, number, number, number],
  }

  // Branch parameters (for woody plants)
  const branchWidth = normRand(0.4, 1.3)
  const branchTwist = Math.round(normRand(2, 5))
  const branchDepth = randChoice([3, 4])
  const branchFork = randChoice([4, 5, 6, 7])

  const branchHue = normRand(30, 60)
  const branchSaturation = normRand(0.05, 0.3)
  const branchValue = normRand(0.7, 0.9)
  const branchColor = {
    min: [branchHue, branchSaturation, branchValue, 1] as [number, number, number, number],
    max: [branchHue, branchSaturation, branchValue, 1] as [number, number, number, number],
  }

  const params: FlowerParams = {
    flowerChance,
    flowerShape,
    flowerColor,
    flowerOpenCurve,
    flowerColorCurve,
    flowerLength,
    flowerWidth,
    flowerPetal,

    leafChance,
    leafType,
    leafShape,
    leafColor,
    leafLength,
    leafWidth,
    leafPosition,

    stemWidth,
    stemBend,
    stemLength,
    stemCount,

    pedicelLength,

    sheathLength,
    sheathWidth,

    shootCount,
    shootLength,

    innerLength,
    innerWidth,
    innerShape,
    innerColor,

    branchWidth,
    branchTwist,
    branchDepth,
    branchFork,
    branchColor,
  }

  console.log('Generated flower parameters:', params)

  return params
}
