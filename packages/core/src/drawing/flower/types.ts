/**
 * Flower Generator - TypeScript Type Definitions
 * Migrated from Canvas-based implementation to SVG
 */

export const SVG_NS = 'http://www.w3.org/2000/svg'

// ============================================================================
// Basic Types
// ============================================================================

/** 3D Vector [x, y, z] */
export type Vec3 = [number, number, number]

/** 2D Vector [x, y] */
export type Vec2 = [number, number]

/** Color in HSVA format [hue, saturation, value, alpha] */
export type ColorHSVA = [number, number, number, number]

/** Color range with min and max HSVA values */
export interface ColorRange {
  min: ColorHSVA
  max: ColorHSVA
}

// ============================================================================
// Polygon and Stroke Arguments
// ============================================================================

export interface PolygonArgs {
  /** List of 2D points */
  pts: Vec2[]
  /** Color (CSS color string or rgba/hsv) */
  col?: string
  /** Fill the polygon */
  fil?: boolean
  /** Stroke the polygon */
  str?: boolean
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
}

export interface TubifyArgs {
  /** List of 3D points */
  pts: Vec3[]
  /** Width function: (progress: 0-1) => width */
  wid?: (x: number) => number
}

export interface StrokeArgs {
  /** List of 3D points */
  pts: Vec3[]
  /** Color */
  col?: string
  /** Width function */
  wid?: (x: number) => number
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
}

// ============================================================================
// Plant Structure Arguments
// ============================================================================

export interface LeafArgs {
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
  /** Rotation in 3D [x, y, z] (radians) */
  rot?: Vec3
  /** Length of the leaf */
  len?: number
  /** Number of segments */
  seg?: number
  /** Width function */
  wid?: (x: number) => number
  /** Vein configuration [type, ...params] */
  vei?: number[]
  /** Is this a flower petal */
  flo?: boolean
  /** Color range */
  col?: ColorRange
  /** Color offset function */
  cof?: (x: number) => number
  /** Bend function: returns rotation delta */
  ben?: (x: number) => Vec3
}

export interface StemArgs {
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
  /** Rotation in 3D */
  rot?: Vec3
  /** Length of the stem */
  len?: number
  /** Number of segments */
  seg?: number
  /** Width function */
  wid?: (x: number) => number
  /** Color range */
  col?: ColorRange
  /** Bend function */
  ben?: (x: number) => Vec3
}

export interface BranchArgs {
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
  /** Rotation in 3D */
  rot?: Vec3
  /** Length of the branch */
  len?: number
  /** Number of segments */
  seg?: number
  /** Width multiplier */
  wid?: number
  /** Twist/joint count */
  twi?: number
  /** Color range */
  col?: ColorRange
  /** Recursion depth */
  dep?: number
  /** Fork count */
  frk?: number
}

// ============================================================================
// Layer System
// ============================================================================

export interface Layer {
  /** SVG group element */
  group: SVGGElement
  /** Layer width */
  width: number
  /** Layer height */
  height: number
}

export interface BlitOptions {
  /** Blend mode */
  ble?: 'normal' | 'multiply'
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
}

export interface Bounds {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

// ============================================================================
// Filter System
// ============================================================================

export type FilterType = 'wispy' | 'fade'

export type NoiseFunction = (x: number, y?: number, z?: number) => number

// ============================================================================
// Parameter Generation
// ============================================================================

export interface FlowerParams {
  // Flower parameters
  flowerChance: number
  flowerShape: (x: number) => number
  flowerColor: ColorRange
  flowerOpenCurve: (x: number, op: number) => number
  flowerColorCurve: (x: number) => number
  flowerLength: number
  flowerWidth: number
  flowerPetal: number

  // Leaf parameters
  leafChance: number
  leafType: number[]
  leafShape: (x: number) => number
  leafColor: ColorRange
  leafLength: number
  leafWidth: number
  leafPosition: number

  // Stem parameters
  stemWidth: number
  stemBend: number
  stemLength: number
  stemCount: number

  // Pedicel (flower stem)
  pedicelLength: number

  // Sheath
  sheathLength: number
  sheathWidth: number

  // Shoot
  shootCount: number
  shootLength: number

  // Inner flower parts
  innerLength: number
  innerWidth: number
  innerShape: (x: number) => number
  innerColor: ColorRange

  // Branch (for woody plants)
  branchWidth: number
  branchTwist: number
  branchDepth: number
  branchFork: number
  branchColor: ColorRange
}

// ============================================================================
// Composer Arguments
// ============================================================================

export interface WoodyArgs {
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
  /** Parameters */
  PAR?: FlowerParams
}

export interface HerbalArgs {
  /** X offset */
  xof?: number
  /** Y offset */
  yof?: number
  /** Parameters */
  PAR?: FlowerParams
}

// ============================================================================
// Main Export Options
// ============================================================================

export interface FlowerOptions {
  /** Random seed for reproducibility */
  seed?: number | string
  /** Type of plant to generate */
  type?: 'woody' | 'herbal' | 'random'
  /** SVG width */
  width?: number
  /** SVG height */
  height?: number
  /** Background option */
  background?: 'none' | 'paper' | string
}
