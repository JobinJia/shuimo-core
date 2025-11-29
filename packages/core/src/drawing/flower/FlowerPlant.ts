/**
 * Flower Generator - Plant Structures
 * Leaf, stem, and branch generation functions
 * Original: reference-code/flowers/main.js (Lines 495-713)
 */

import type { LeafArgs, StemArgs, BranchArgs, Vec3, Vec2 } from './types'
import { v3, PI, sin, abs, grot } from './FlowerMath'
import { mapval, normRand } from './FlowerMath'
import { lerpHue } from './FlowerColor'
import { hsv, rgba } from './FlowerColor'
import { polygon, stroke, tubify, createSVGElement } from './FlowerShape'
import { noise } from './FlowerNoise'

// ============================================================================
// Leaf Function
// Original: Lines 495-583
// ============================================================================

/**
 * Generate leaf-like structure
 * Can be used for leaves or flower petals
 * @returns SVG group containing the leaf and center line points
 */
export function leaf(args: LeafArgs = {}): { group: SVGGElement, points: Vec3[] } {
  const {
    xof = 0,
    yof = 0,
    rot = [PI / 2, 0, 0],
    len = 500,
    seg = 40,
    wid = (x: number) => sin(x * PI) * 20,
    vei = [1, 3],
    flo = false,
    col = { min: [90, 0.2, 0.3, 1], max: [90, 0.1, 0.9, 1] },
    cof = (x: number) => x,
    ben = (x: number): Vec3 => [normRand(-10, 10), 0, normRand(-5, 5)],
  } = args

  const group = createSVGElement('g')

  let disp: Vec3 = v3.zero
  let crot: Vec3 = v3.zero
  const P: Vec3[] = [disp]
  const ROT: Vec3[] = [crot]
  const L: Vec3[] = [disp]
  const R: Vec3[] = [disp]

  const orient = (v: Vec3) => v3.roteuler(v, rot)

  // Generate leaf segments
  for (let i = 0; i < seg; i++) {
    const p = i / (seg - 1)
    crot = v3.add(crot, v3.scale(ben(p), 1 / seg))
    disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)))
    const w = wid(p)
    const l = v3.add(disp, orient(v3.roteuler([-w, 0, 0], crot)))
    const r = v3.add(disp, orient(v3.roteuler([w, 0, 0], crot)))

    if (i > 0) {
      const v0 = v3.subtract(disp, L[L.length - 1])
      const v1 = v3.subtract(l, disp)
      const v2 = v3.cross(v0, v1)

      let lt: number
      if (!flo) {
        lt = mapval(abs(v3.ang(v2, [0, -1, 0])), 0, PI, 1, 0)
      }
      else {
        lt = p * normRand(0.95, 1)
      }
      lt = cof(lt) || 0

      const h = lerpHue(col.min[0], col.max[0], lt)
      const s = mapval(lt, 0, 1, col.min[1], col.max[1])
      const v = mapval(lt, 0, 1, col.min[2], col.max[2])
      const a = mapval(lt, 0, 1, col.min[3], col.max[3])

      const color = hsv(h, s, v, a)

      // Left side polygon
      const leftPoly = polygon({
        pts: [
          [l[0], l[1]],
          [L[L.length - 1][0], L[L.length - 1][1]],
          [P[P.length - 1][0], P[P.length - 1][1]],
          [disp[0], disp[1]],
        ],
        xof,
        yof,
        fil: true,
        str: false, // No stroke on body to avoid grid effect
        col: color,
      })
      group.appendChild(leftPoly)

      // Right side polygon
      const rightPoly = polygon({
        pts: [
          [r[0], r[1]],
          [R[R.length - 1][0], R[R.length - 1][1]],
          [P[P.length - 1][0], P[P.length - 1][1]],
          [disp[0], disp[1]],
        ],
        xof,
        yof,
        fil: true,
        str: false, // No stroke on body to avoid grid effect
        col: color,
      })
      group.appendChild(rightPoly)
    }

    P.push(disp)
    ROT.push(crot)
    L.push(l)
    R.push(r)
  }

  // Add veins
  if (vei[0] === 1) {
    // Vein type 1: parallel veins
    for (let i = 1; i < P.length; i++) {
      for (let j = 0; j < vei[1]; j++) {
        const p = j / vei[1]

        const p0 = v3.lerp(L[i - 1], P[i - 1], p)
        const p1 = v3.lerp(L[i], P[i], p)

        const q0 = v3.lerp(R[i - 1], P[i - 1], p)
        const q1 = v3.lerp(R[i], P[i], p)

        const veinColor = hsv(0, 0, 0, normRand(0.4, 0.9))

        const leftVein = polygon({
          pts: [[p0[0], p0[1]], [p1[0], p1[1]]],
          xof,
          yof,
          fil: false,
          str: true,
          col: veinColor,
        })
        group.appendChild(leftVein)

        const rightVein = polygon({
          pts: [[q0[0], q0[1]], [q1[0], q1[1]]],
          xof,
          yof,
          fil: false,
          str: true,
          col: veinColor,
        })
        group.appendChild(rightVein)
      }
    }
    const centerStroke = stroke({
      pts: P,
      xof,
      yof,
      col: rgba(0, 0, 0, 0.3),
    })
    group.appendChild(centerStroke)
  }
  else if (vei[0] === 2) {
    // Vein type 2: branching veins
    for (let i = 1; i < P.length - vei[1]; i += vei[2]) {
      const leftVein = polygon({
        pts: [[P[i][0], P[i][1]], [L[i + vei[1]][0], L[i + vei[1]][1]]],
        xof,
        yof,
        fil: false,
        str: true,
        col: hsv(0, 0, 0, normRand(0.4, 0.9)),
      })
      group.appendChild(leftVein)

      const rightVein = polygon({
        pts: [[P[i][0], P[i][1]], [R[i + vei[1]][0], R[i + vei[1]][1]]],
        xof,
        yof,
        fil: false,
        str: true,
        col: hsv(0, 0, 0, normRand(0.4, 0.9)),
      })
      group.appendChild(rightVein)
    }
    const centerStroke = stroke({
      pts: P,
      xof,
      yof,
      col: rgba(0, 0, 0, 0.3),
    })
    group.appendChild(centerStroke)
  }

  // Edge strokes
  const leftEdge = stroke({ pts: L, xof, yof, col: rgba(120, 100, 0, 0.3) })
  const rightEdge = stroke({ pts: R, xof, yof, col: rgba(120, 100, 0, 0.3) })
  group.appendChild(leftEdge)
  group.appendChild(rightEdge)

  return { group, points: P }
}

// ============================================================================
// Stem Function
// Original: Lines 586-642
// ============================================================================

/**
 * Generate stem-like structure
 * @returns SVG group and center line points
 */
export function stem(args: StemArgs = {}): { group: SVGGElement, points: Vec3[] } {
  const {
    xof = 0,
    yof = 0,
    rot = [PI / 2, 0, 0],
    len = 400,
    seg = 40,
    wid = (x: number) => 6,
    col = { min: [250, 0.2, 0.4, 1], max: [250, 0.3, 0.6, 1] },
    ben = (x: number): Vec3 => [normRand(-10, 10), 0, normRand(-5, 5)],
  } = args

  const group = createSVGElement('g')

  let disp: Vec3 = v3.zero
  let crot: Vec3 = v3.zero
  const P: Vec3[] = [disp]
  const ROT: Vec3[] = [crot]

  const orient = (v: Vec3) => v3.roteuler(v, rot)

  // Generate stem segments
  for (let i = 0; i < seg; i++) {
    const p = i / (seg - 1)
    crot = v3.add(crot, v3.scale(ben(p), 1 / seg))
    disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)))
    ROT.push(crot)
    P.push(disp)
  }

  const [L, R] = tubify({ pts: P, wid })
  const wseg = 4

  // Helper for Vec2 linear interpolation
  const lerp2 = (a: Vec2, b: Vec2, t: number): Vec2 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ]

  // Draw stem segments with shading
  for (let i = 1; i < P.length; i++) {
    for (let j = 1; j < wseg; j++) {
      const m = (j - 1) / (wseg - 1)
      const n = j / (wseg - 1)
      const p = i / (P.length - 1)

      const p0 = lerp2(L[i - 1], R[i - 1], m)
      const p1 = lerp2(L[i], R[i], m)

      const p2 = lerp2(L[i - 1], R[i - 1], n)
      const p3 = lerp2(L[i], R[i], n)

      const lt = n / p
      const h = lerpHue(col.min[0], col.max[0], lt) * mapval(noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1)
      const s = mapval(lt, 0, 1, col.max[1], col.min[1]) * mapval(noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1)
      const v = mapval(lt, 0, 1, col.min[2], col.max[2]) * mapval(noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1)
      const a = mapval(lt, 0, 1, col.min[3], col.max[3])

      const poly = polygon({
        pts: [
          [p0[0], p0[1]],
          [p1[0], p1[1]],
          [p3[0], p3[1]],
          [p2[0], p2[1]],
        ],
        xof,
        yof,
        fil: true,
        str: false, // No stroke on body to avoid grid effect
        col: hsv(h, s, v, a),
      })
      group.appendChild(poly)
    }
  }

  // Edge strokes
  const leftEdge = stroke({ pts: L.map(p => [p[0], p[1], 0]), xof, yof, col: rgba(0, 0, 0, 0.5) })
  const rightEdge = stroke({ pts: R.map(p => [p[0], p[1], 0]), xof, yof, col: rgba(0, 0, 0, 0.5) })
  group.appendChild(leftEdge)
  group.appendChild(rightEdge)

  return { group, points: P }
}

// ============================================================================
// Branch Function (Recursive)
// Original: Lines 645-713
// ============================================================================

/**
 * Generate fractal-like branches
 * @returns Object containing SVG group and array of [depth, points] tuples
 */
export function branch(args: BranchArgs = {}): { group: SVGGElement, branches: Array<[number, Vec3[]]> } {
  const {
    xof = 0,
    yof = 0,
    rot = [PI / 2, 0, 0],
    len = 400,
    seg = 40,
    wid = 1,
    twi = 5,
    col = { min: [50, 0.2, 0.8, 1], max: [50, 0.2, 0.8, 1] },
    dep = 3,
    frk = 4,
  } = args

  const branchGroup = createSVGElement('g')

  // Generate joints for twisting
  const jnt: Array<[number, number]> = []
  for (let i = 0; i < twi; i++) {
    jnt.push([Math.floor(Math.random() * seg), normRand(-1, 1)])
  }

  function jntdist(x: number): [number, number] {
    let m = seg
    let j = 0
    for (let i = 0; i < jnt.length; i++) {
      const n = Math.abs(x * seg - jnt[i][0])
      if (n < m) {
        m = n
        j = i
      }
    }
    return [m, jnt[j][1]]
  }

  const wfun = (x: number): number => {
    const [m, j] = jntdist(x)
    if (m < 1) {
      return wid * (3 + 5 * (1 - x))
    }
    else {
      return wid * (2 + 7 * (1 - x) * mapval(noise(x * 10), 0, 1, 0.5, 1))
    }
  }

  const bfun = (x: number): Vec3 => {
    const [m, j] = jntdist(x)
    if (m < 1) {
      return [0, j * 20, 0]
    }
    else {
      return [0, normRand(-5, 5), 0]
    }
  }

  // CRITICAL FIX: Get both group AND points from stem
  const { group: stemGroup, points: P } = stem({ xof, yof, rot, len, seg, wid: wfun, col, ben: bfun })

  // Add stem to branch group (THIS WAS MISSING!)
  branchGroup.appendChild(stemGroup)

  const child: Array<[number, Vec3[]]> = []

  if (dep > 0 && wid > 0.1) {
    for (let i = 0; i < frk * Math.random(); i++) {
      const ind = Math.floor(normRand(1, P.length))

      const r = grot(P, ind)
      const childBranch = branch({
        xof: xof + P[ind][0],
        yof: yof + P[ind][1],
        rot: [
          r[0] + normRand(-1, 1) * PI / 6,
          r[1] + normRand(-1, 1) * PI / 6,
          r[2] + normRand(-1, 1) * PI / 6,
        ],
        seg,
        len: len * normRand(0.4, 0.6),
        wid: wid * normRand(0.4, 0.7),
        twi: twi * 0.7,
        dep: dep - 1,
        col,
        frk,
      })

      // Add child branch SVG to our group
      branchGroup.appendChild(childBranch.group)

      // Collect child branch points
      child.push(...childBranch.branches)
    }
  }

  const branches = [[dep, P.map(v => [v[0] + xof, v[1] + yof, v[2]])], ...child] as Array<[number, Vec3[]]>

  return { group: branchGroup, branches }
}
