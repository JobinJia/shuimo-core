/**
 * Flower Generator - Math Utilities
 * Pure mathematical functions for geometry and interpolation
 * Migrated from reference-code/flowers/main.js (Lines 28-355)
 */

import type { Vec2, Vec3 } from './types'

// ============================================================================
// Math Constants and Basic Functions
// ============================================================================

export const rad2deg = 180 / Math.PI
export const deg2rad = Math.PI / 180
export const PI = Math.PI
export const sin = Math.sin
export const cos = Math.cos
export const abs = Math.abs
export const pow = Math.pow

/** Convert degrees to radians */
export function rad(x: number): number {
  return x * deg2rad
}

/** Convert radians to degrees */
export function deg(x: number): number {
  return x * rad2deg
}

// ============================================================================
// Distance and Mapping
// ============================================================================

/** Calculate distance between two 2D points */
export function distance(p0: Vec2, p1: Vec2): number {
  return Math.sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2)
}

/** Map value from one range to another */
export function mapval(
  value: number,
  istart: number,
  istop: number,
  ostart: number,
  ostop: number,
): number {
  return ostart + (ostop - ostart) * ((value - istart) * 1.0 / (istop - istart))
}

// ============================================================================
// Random Utilities
// ============================================================================

/** Get random element from array */
export function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(arr.length * Math.random())]
}

/** Normalized random number between m and M */
export function normRand(m: number, M: number): number {
  return mapval(Math.random(), 0, 1, m, M)
}

/** Weighted random using accept-reject method */
export function wtrand(func: (x: number) => number): number {
  const x = Math.random()
  const y = Math.random()
  if (y < func(x)) {
    return x
  }
  else {
    return wtrand(func)
  }
}

/** Gaussian random number (using weighted random) */
export function randGaussian(): number {
  return wtrand((x) => Math.E ** (-24 * (x - 0.5) ** 2)) * 2 - 1
}

// ============================================================================
// Curve Functions
// ============================================================================

/** Sigmoid curve */
export function sigmoid(x: number, k: number = 10): number {
  return 1 / (1 + Math.exp(-k * (x - 0.5)))
}

/** Pseudo bean curve */
export function bean(x: number): number {
  return (0.25 - (x - 0.5) ** 2) ** 0.5 * (2.6 + 2.4 * x ** 1.5) * 0.54
}

/** Squircle function - interpolate between square and circle */
export function squircle(r: number, a: number): (th: number) => number {
  return function (th: number): number {
    while (th > PI / 2) {
      th -= PI / 2
    }
    while (th < 0) {
      th += PI / 2
    }
    return r * (1 / (cos(th) ** a + sin(th) ** a)) ** (1 / a)
  }
}

// ============================================================================
// Point Utilities
// ============================================================================

/** Calculate mid-point of an array of points */
export function midPt(...args: Vec3[] | [Vec3[]]): Vec3 {
  const plist = (args.length === 1 && Array.isArray(args[0]))
    ? args[0] as Vec3[]
    : args as Vec3[]

  return plist.reduce(
    (acc, v) => {
      return [
        v[0] / plist.length + acc[0],
        v[1] / plist.length + acc[1],
        v[2] / plist.length + acc[2],
      ]
    },
    [0, 0, 0] as Vec3,
  )
}

// ============================================================================
// Bezier Curves
// ============================================================================

/**
 * Rational bezier curve (bezmh)
 * Generate smooth curve through control points
 */
export function bezmh(P: Vec3[], w: number = 1): Vec3[] {
  if (P.length === 2) {
    P = [P[0], midPt(P[0], P[1]), P[1]]
  }

  const plist: Vec3[] = []

  for (let j = 0; j < P.length - 2; j++) {
    let p0: Vec3
    let p1: Vec3
    let p2: Vec3

    if (j === 0) {
      p0 = P[j]
    }
    else {
      p0 = midPt(P[j], P[j + 1])
    }

    p1 = P[j + 1]

    if (j === P.length - 3) {
      p2 = P[j + 2]
    }
    else {
      p2 = midPt(P[j + 1], P[j + 2])
    }

    const pl = 20
    for (let i = 0; i < pl + (j === P.length - 3 ? 1 : 0); i += 1) {
      const t = i / pl
      const u = ((1 - t) ** 2 + 2 * t * (1 - t) * w + t * t)
      plist.push([
        ((1 - t) ** 2 * p0[0] + 2 * t * (1 - t) * p1[0] * w + t * t * p2[0]) / u,
        ((1 - t) ** 2 * p0[1] + 2 * t * (1 - t) * p1[1] * w + t * t * p2[1]) / u,
        ((1 - t) ** 2 * p0[2] + 2 * t * (1 - t) * p1[2] * w + t * t * p2[2]) / u,
      ])
    }
  }

  return plist
}

// ============================================================================
// 3D Vector Operations (v3)
// ============================================================================

export const v3 = {
  // Direction vectors
  forward: [0, 0, 1] as Vec3,
  up: [0, 1, 0] as Vec3,
  right: [1, 0, 0] as Vec3,
  zero: [0, 0, 0] as Vec3,

  /** Rotate vector around axis by angle theta */
  rotvec(vec: Vec3, axis: Vec3, th: number): Vec3 {
    const [l, m, n] = axis
    const [x, y, z] = vec
    const [costh, sinth] = [Math.cos(th), Math.sin(th)]

    const mat: Record<number, number> = {}
    mat[11] = l * l * (1 - costh) + costh
    mat[12] = m * l * (1 - costh) - n * sinth
    mat[13] = n * l * (1 - costh) + m * sinth

    mat[21] = l * m * (1 - costh) + n * sinth
    mat[22] = m * m * (1 - costh) + costh
    mat[23] = n * m * (1 - costh) - l * sinth

    mat[31] = l * n * (1 - costh) - m * sinth
    mat[32] = m * n * (1 - costh) + l * sinth
    mat[33] = n * n * (1 - costh) + costh

    return [
      x * mat[11] + y * mat[12] + z * mat[13],
      x * mat[21] + y * mat[22] + z * mat[23],
      x * mat[31] + y * mat[32] + z * mat[33],
    ]
  },

  /** Rotate vector using Euler angles */
  roteuler(vec: Vec3, rot: Vec3): Vec3 {
    if (rot[2] !== 0) {
      vec = v3.rotvec(vec, v3.forward, rot[2])
    }
    if (rot[0] !== 0) {
      vec = v3.rotvec(vec, v3.right, rot[0])
    }
    if (rot[1] !== 0) {
      vec = v3.rotvec(vec, v3.up, rot[1])
    }
    return vec
  },

  /** Scale vector by scalar */
  scale(vec: Vec3, p: number): Vec3 {
    return [vec[0] * p, vec[1] * p, vec[2] * p]
  },

  /** Copy vector */
  copy(v0: Vec3): Vec3 {
    return [v0[0], v0[1], v0[2]]
  },

  /** Add two vectors */
  add(v0: Vec3, v: Vec3): Vec3 {
    return [v0[0] + v[0], v0[1] + v[1], v0[2] + v[2]]
  },

  /** Subtract two vectors */
  subtract(v0: Vec3, v: Vec3): Vec3 {
    return [v0[0] - v[0], v0[1] - v[1], v0[2] - v[2]]
  },

  /** Magnitude of vector */
  mag(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  },

  /** Normalize vector */
  normalize(v: Vec3): Vec3 {
    const p = 1 / v3.mag(v)
    return [v[0] * p, v[1] * p, v[2] * p]
  },

  /** Dot product */
  dot(u: Vec3, v: Vec3): number {
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  },

  /** Cross product */
  cross(u: Vec3, v: Vec3): Vec3 {
    return [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]
  },

  /** Angle cosine between two vectors */
  angcos(u: Vec3, v: Vec3): number {
    return v3.dot(u, v) / (v3.mag(u) * v3.mag(v))
  },

  /** Angle between two vectors */
  ang(u: Vec3, v: Vec3): number {
    return Math.acos(v3.angcos(u, v))
  },

  /** Convert vector to Euler angles */
  toeuler(v0: Vec3): Vec3 {
    const ep = 5
    let ma = 2 * PI
    let mr: Vec3 = [0, 0, 0]

    for (let x = -180; x < 180; x += ep) {
      for (let y = -90; y < 90; y += ep) {
        const r: Vec3 = [rad(x), rad(y), 0]
        const v = v3.roteuler([0, 0, 1], r)
        const a = v3.ang(v0, v)
        if (a < rad(ep)) {
          return r
        }
        if (a < ma) {
          ma = a
          mr = r
        }
      }
    }
    return mr
  },

  /** Linear interpolation between two vectors */
  lerp(u: Vec3, v: Vec3, p: number): Vec3 {
    return [
      u[0] * (1 - p) + v[0] * p,
      u[1] * (1 - p) + v[1] * p,
      u[2] * (1 - p) + v[2] * p,
    ]
  },
}

// ============================================================================
// Rotation Utility
// ============================================================================

/** Get rotation at given index of a poly-line */
export function grot(P: Vec3[], ind: number): Vec3 {
  const d = v3.subtract(P[ind], P[ind - 1])
  return v3.toeuler(d)
}
