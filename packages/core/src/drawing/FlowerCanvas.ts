/**
 * Flower Generator - Canvas Implementation
 * Procedurally generated paintings of non-existent flowers
 *
 * Direct port from original Nonflowers by Lingdong Huang (c) 2018
 * Reference: reference-code/flowers/main.js
 */

import { PRNG } from '../foundation/random'
import { PerlinNoise } from '../foundation/noise/PerlinNoise'

type Vec3 = [number, number, number]

// Global Noise instance
const Noise = new PerlinNoise()

// ============================================================================
// Types
// ============================================================================

export interface FlowerCanvasOptions {
  seed?: string | number
  type?: 'woody' | 'herbal' | 'random'
  width?: number
  height?: number
}

export interface FlowerParams {
  flowerChance: number
  leafChance: number
  leafType: number[]
  flowerShape: (x: number) => number
  leafShape: (x: number) => number
  flowerColor: ColorRange
  leafColor: ColorRange
  flowerOpenCurve: (x: number, op: number) => number
  flowerColorCurve: (x: number) => number
  leafLength: number
  flowerLength: number
  pedicelLength: number
  leafWidth: number
  flowerWidth: number
  stemWidth: number
  stemBend: number
  stemLength: number
  stemCount: number
  sheathLength: number
  sheathWidth: number
  shootCount: number
  shootLength: number
  leafPosition: number
  flowerPetal: number
  innerLength: number
  innerWidth: number
  innerShape: (x: number) => number
  innerColor: ColorRange
  branchWidth: number
  branchTwist: number
  branchDepth: number
  branchFork: number
  branchColor: ColorRange
}

export interface ColorRange {
  min: [number, number, number, number] // [h, s, v, a]
  max: [number, number, number, number]
}

// ============================================================================
// Math Utilities
// ============================================================================

const PI = Math.PI
const sin = Math.sin
const cos = Math.cos
const abs = Math.abs
const pow = Math.pow
const rad = (x: number) => x * Math.PI / 180
const deg = (x: number) => x * 180 / Math.PI

function distance(p0: number[], p1: number[]): number {
  return Math.sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2)
}

function mapval(value: number, istart: number, istop: number, ostart: number, ostop: number): number {
  return ostart + (ostop - ostart) * ((value - istart) / (istop - istart))
}

function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(arr.length * Math.random())]
}

function normRand(m: number, M: number): number {
  return mapval(Math.random(), 0, 1, m, M)
}

function wtrand(func: (x: number) => number): number {
  const x = Math.random()
  const y = Math.random()
  if (y < func(x)) {
    return x
  }
  else {
    return wtrand(func)
  }
}

function randGaussian(): number {
  return wtrand((x) => Math.E ** (-24 * (x - 0.5) ** 2)) * 2 - 1
}

function sigmoid(x: number, k: number = 10): number {
  return 1 / (1 + Math.exp(-k * (x - 0.5)))
}

function bean(x: number): number {
  return (0.25 - (x - 0.5) ** 2) ** 0.5 * (2.6 + 2.4 * x ** 1.5) * 0.54
}

export function squircle(r: number, a: number): (th: number) => number {
  return function (th: number) {
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
// Vector Math (3D)
// ============================================================================

const v3 = {
  forward: [0, 0, 1] as Vec3,
  up: [0, 1, 0] as Vec3,
  right: [1, 0, 0] as Vec3,
  zero: [0, 0, 0] as Vec3,

  rotvec(vec: Vec3, axis: Vec3, th: number): Vec3 {
    const [l, m, n] = axis
    const [x, y, z] = vec
    const costh = Math.cos(th)
    const sinth = Math.sin(th)

    const mat = {
      11: l * l * (1 - costh) + costh,
      12: m * l * (1 - costh) - n * sinth,
      13: n * l * (1 - costh) + m * sinth,
      21: l * m * (1 - costh) + n * sinth,
      22: m * m * (1 - costh) + costh,
      23: n * m * (1 - costh) - l * sinth,
      31: l * n * (1 - costh) - m * sinth,
      32: m * n * (1 - costh) + l * sinth,
      33: n * n * (1 - costh) + costh,
    }

    return [
      x * mat[11] + y * mat[12] + z * mat[13],
      x * mat[21] + y * mat[22] + z * mat[23],
      x * mat[31] + y * mat[32] + z * mat[33],
    ]
  },

  roteuler(vec: Vec3, rot: Vec3): Vec3 {
    let result = vec
    if (rot[2] !== 0) result = v3.rotvec(result, v3.forward, rot[2])
    if (rot[0] !== 0) result = v3.rotvec(result, v3.right, rot[0])
    if (rot[1] !== 0) result = v3.rotvec(result, v3.up, rot[1])
    return result
  },

  scale(vec: Vec3, p: number): Vec3 {
    return [vec[0] * p, vec[1] * p, vec[2] * p]
  },

  add(v0: Vec3, v: Vec3): Vec3 {
    return [v0[0] + v[0], v0[1] + v[1], v0[2] + v[2]]
  },

  subtract(v0: Vec3, v: Vec3): Vec3 {
    return [v0[0] - v[0], v0[1] - v[1], v0[2] - v[2]]
  },

  mag(v: Vec3): number {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  },

  normalize(v: Vec3): Vec3 {
    const p = 1 / v3.mag(v)
    return [v[0] * p, v[1] * p, v[2] * p]
  },

  dot(u: Vec3, v: Vec3): number {
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  },

  cross(u: Vec3, v: Vec3): Vec3 {
    return [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]
  },

  angcos(u: Vec3, v: Vec3): number {
    return v3.dot(u, v) / (v3.mag(u) * v3.mag(v))
  },

  ang(u: Vec3, v: Vec3): number {
    return Math.acos(v3.angcos(u, v))
  },

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

  lerp(u: Vec3, v: Vec3, p: number): Vec3 {
    return [
      u[0] * (1 - p) + v[0] * p,
      u[1] * (1 - p) + v[1] * p,
      u[2] * (1 - p) + v[2] * p,
    ]
  },
}

function midPt(...args: Vec3[]): Vec3 {
  const plist = args
  return plist.reduce((acc, v) => {
    return [
      v[0] / plist.length + acc[0],
      v[1] / plist.length + acc[1],
      v[2] / plist.length + acc[2],
    ]
  }, [0, 0, 0] as Vec3)
}

// ============================================================================
// Color Functions
// ============================================================================

function rgba(r: number = 255, g: number = r, b: number = g, a: number = 1.0): string {
  return `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${a.toFixed(3)})`
}

function hsv(h: number, s: number, v: number, a: number = 1): string {
  const c = v * s
  const x = c * (1 - abs((h / 60) % 2 - 1))
  const m = v - c
  const idx = Math.floor(h / 60)
  const [rv, gv, bv] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][idx] || [0, 0, 0]
  const [r, g, b] = [(rv + m) * 255, (gv + m) * 255, (bv + m) * 255]
  return rgba(r, g, b, a)
}

function lerpHue(h0: number, h1: number, p: number): number {
  const methods = [
    [abs(h1 - h0), mapval(p, 0, 1, h0, h1)],
    [abs(h1 + 360 - h0), mapval(p, 0, 1, h0, h1 + 360)],
    [abs(h1 - 360 - h0), mapval(p, 0, 1, h0, h1 - 360)],
  ]
  methods.sort((x, y) => x[0] - y[0])
  return (methods[0][1] + 720) % 360
}

// ============================================================================
// Canvas Drawing Functions
// ============================================================================

interface PolygonArgs {
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  pts?: Vec3[]
  col?: string
  fil?: boolean
  str?: boolean
}

function polygon(args: PolygonArgs = {}): void {
  const ctx = args.ctx!
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const pts = args.pts ?? []
  const col = args.col ?? 'black'
  const fil = args.fil ?? true
  const str = args.str ?? !fil

  ctx.beginPath()
  if (pts.length > 0) {
    ctx.moveTo(pts[0][0] + xof, pts[0][1] + yof)
  }
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0] + xof, pts[i][1] + yof)
  }
  if (fil) {
    ctx.fillStyle = col
    ctx.fill()
  }
  if (str) {
    ctx.strokeStyle = col
    ctx.stroke()
  }
}

interface TubifyArgs {
  pts?: Vec3[]
  wid?: (x: number) => number
}

function tubify(args: TubifyArgs = {}): [Vec3[], Vec3[]] {
  const pts = args.pts ?? []
  const wid = args.wid ?? ((x: number) => 10)

  const vtxlist0: Vec3[] = []
  const vtxlist1: Vec3[] = []

  for (let i = 1; i < pts.length - 1; i++) {
    const w = wid(i / pts.length)
    const a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
    const a2 = Math.atan2(pts[i][1] - pts[i + 1][1], pts[i][0] - pts[i + 1][0])
    let a = (a1 + a2) / 2
    if (a < a2) a += PI
    vtxlist0.push([pts[i][0] + w * cos(a), pts[i][1] + w * sin(a), 0])
    vtxlist1.push([pts[i][0] - w * cos(a), pts[i][1] - w * sin(a), 0])
  }

  const l = pts.length - 1
  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) - Math.PI / 2
  const a1 = Math.atan2(pts[l][1] - pts[l - 1][1], pts[l][0] - pts[l - 1][0]) - Math.PI / 2
  const w0 = wid(0)
  const w1 = wid(1)

  vtxlist0.unshift([pts[0][0] + w0 * cos(a0), pts[0][1] + w0 * sin(a0), 0])
  vtxlist1.unshift([pts[0][0] - w0 * cos(a0), pts[0][1] - w0 * sin(a0), 0])
  vtxlist0.push([pts[l][0] + w1 * cos(a1), pts[l][1] + w1 * sin(a1), 0])
  vtxlist1.push([pts[l][0] - w1 * cos(a1), pts[l][1] - w1 * sin(a1), 0])

  return [vtxlist0, vtxlist1]
}

interface StrokeArgs {
  pts?: Vec3[]
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  col?: string
  wid?: (x: number) => number
}

function stroke(args: StrokeArgs = {}): [Vec3[], Vec3[]] {
  const pts = args.pts ?? []
  const ctx = args.ctx!
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const col = args.col ?? 'black'
  const wid = args.wid ?? ((x: number) => 1 * sin(x * PI) * mapval(Noise.noise(x * 10), 0, 1, 0.5, 1))

  const [vtxlist0, vtxlist1] = tubify({ pts, wid })

  polygon({ pts: vtxlist0.concat(vtxlist1.reverse()), ctx, fil: true, col, xof, yof })
  return [vtxlist0, vtxlist1]
}

// ============================================================================
// Paper Texture Generation
// ============================================================================

interface PaperArgs {
  col?: [number, number, number]
  tex?: number
  spr?: number
}

function paper(args: PaperArgs = {}): HTMLCanvasElement {
  const col = args.col ?? [0.98, 0.91, 0.74]
  const tex = args.tex ?? 20
  const spr = args.spr ?? 1

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const reso = 512

  for (let i = 0; i < reso / 2 + 1; i++) {
    for (let j = 0; j < reso / 2 + 1; j++) {
      let c = 255 - Noise.noise(i * 0.1, j * 0.1) * tex * 0.5
      c -= Math.random() * tex
      let r = c * col[0]
      let g = c * col[1]
      let b = c * col[2]
      if (Noise.noise(i * 0.04, j * 0.04, 2) * Math.random() * spr > 0.7
        || Math.random() < 0.005 * spr) {
        r = c * 0.7
        g = c * 0.5
        b = c * 0.2
      }
      ctx.fillStyle = rgba(r, g, b)
      ctx.fillRect(i, j, 1, 1)
      ctx.fillRect(reso - i, j, 1, 1)
      ctx.fillRect(i, reso - j, 1, 1)
      ctx.fillRect(reso - i, reso - j, 1, 1)
    }
  }
  return canvas
}

// ============================================================================
// Rotation Helper
// ============================================================================

function grot(P: Vec3[], ind: number): Vec3 {
  const d = v3.subtract(P[ind], P[ind - 1])
  return v3.toeuler(d)
}

// ============================================================================
// Plant Generation Functions
// ============================================================================

interface LeafArgs {
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  rot?: Vec3
  len?: number
  seg?: number
  wid?: (x: number) => number
  vei?: number[]
  flo?: boolean
  col?: ColorRange
  cof?: (x: number) => number
  ben?: (x: number) => Vec3
}

function leaf(args: LeafArgs = {}): Vec3[] {
  const ctx = args.ctx!
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const rot = args.rot ?? [PI / 2, 0, 0] as Vec3
  const len = args.len ?? 500
  const seg = args.seg ?? 40
  const wid = args.wid ?? ((x: number) => sin(x * PI) * 20)
  const vei = args.vei ?? [1, 3]
  const flo = args.flo ?? false
  const col = args.col ?? { min: [90, 0.2, 0.3, 1], max: [90, 0.1, 0.9, 1] }
  const cof = args.cof ?? ((x: number) => x)
  const ben = args.ben ?? ((x: number) => [normRand(-10, 10), 0, normRand(-5, 5)] as Vec3)

  let disp: Vec3 = v3.zero
  let crot: Vec3 = v3.zero
  const P: Vec3[] = [disp]
  const ROT: Vec3[] = [crot]
  const L: Vec3[] = [disp]
  const R: Vec3[] = [disp]

  const orient = (v: Vec3) => v3.roteuler(v, rot)

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

      polygon({ ctx, pts: [l, L[L.length - 1], P[P.length - 1], disp], xof, yof, fil: true, str: true, col: hsv(h, s, v, a) })
      polygon({ ctx, pts: [r, R[R.length - 1], P[P.length - 1], disp], xof, yof, fil: true, str: true, col: hsv(h, s, v, a) })
    }
    P.push(disp)
    ROT.push(crot)
    L.push(l)
    R.push(r)
  }

  if (vei[0] === 1) {
    for (let i = 1; i < P.length; i++) {
      for (let j = 0; j < vei[1]; j++) {
        const p = j / vei[1]
        const p0 = v3.lerp(L[i - 1], P[i - 1], p)
        const p1 = v3.lerp(L[i], P[i], p)
        const q0 = v3.lerp(R[i - 1], P[i - 1], p)
        const q1 = v3.lerp(R[i], P[i], p)
        polygon({ ctx, pts: [p0, p1], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
        polygon({ ctx, pts: [q0, q1], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
      }
    }
    stroke({ ctx, pts: P, xof, yof, col: rgba(0, 0, 0, 0.3) })
  }
  else if (vei[0] === 2) {
    for (let i = 1; i < P.length - vei[1]; i += vei[2]) {
      polygon({ ctx, pts: [P[i], L[i + vei[1]]], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
      polygon({ ctx, pts: [P[i], R[i + vei[1]]], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
    }
    stroke({ ctx, pts: P, xof, yof, col: rgba(0, 0, 0, 0.3) })
  }

  stroke({ ctx, pts: L, xof, yof, col: rgba(120, 100, 0, 0.3) })
  stroke({ ctx, pts: R, xof, yof, col: rgba(120, 100, 0, 0.3) })
  return P
}

interface StemArgs {
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  rot?: Vec3
  len?: number
  seg?: number
  wid?: (x: number) => number
  col?: ColorRange
  ben?: (x: number) => Vec3
}

function stem(args: StemArgs = {}): Vec3[] {
  const ctx = args.ctx!
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const rot = args.rot ?? [PI / 2, 0, 0] as Vec3
  const len = args.len ?? 400
  const seg = args.seg ?? 40
  const wid = args.wid ?? ((x: number) => 6)
  const col = args.col ?? { min: [250, 0.2, 0.4, 1], max: [250, 0.3, 0.6, 1] }
  const ben = args.ben ?? ((x: number) => [normRand(-10, 10), 0, normRand(-5, 5)] as Vec3)

  let disp: Vec3 = v3.zero
  let crot: Vec3 = v3.zero
  const P: Vec3[] = [disp]
  const ROT: Vec3[] = [crot]

  const orient = (v: Vec3) => v3.roteuler(v, rot)

  for (let i = 0; i < seg; i++) {
    const p = i / (seg - 1)
    crot = v3.add(crot, v3.scale(ben(p), 1 / seg))
    disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)))
    ROT.push(crot)
    P.push(disp)
  }

  const [L, R] = tubify({ pts: P, wid })
  const wseg = 4
  for (let i = 1; i < P.length; i++) {
    for (let j = 1; j < wseg; j++) {
      const m = (j - 1) / (wseg - 1)
      const n = j / (wseg - 1)
      const p = i / (P.length - 1)

      const p0 = v3.lerp(L[i - 1], R[i - 1], m)
      const p1 = v3.lerp(L[i], R[i], m)
      const p2 = v3.lerp(L[i - 1], R[i - 1], n)
      const p3 = v3.lerp(L[i], R[i], n)

      const lt = n / p
      const h = lerpHue(col.min[0], col.max[0], lt) * mapval(Noise.noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1)
      const s = mapval(lt, 0, 1, col.max[1], col.min[1]) * mapval(Noise.noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1)
      const v = mapval(lt, 0, 1, col.min[2], col.max[2]) * mapval(Noise.noise(p * 10, m * 10, n * 10), 0, 1, 0.5, 1)
      const a = mapval(lt, 0, 1, col.min[3], col.max[3])

      polygon({ ctx, pts: [p0, p1, p3, p2], xof, yof, fil: true, str: true, col: hsv(h, s, v, a) })
    }
  }

  stroke({ ctx, pts: L, xof, yof, col: rgba(0, 0, 0, 0.5) })
  stroke({ ctx, pts: R, xof, yof, col: rgba(0, 0, 0, 0.5) })
  return P
}

interface BranchArgs {
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  rot?: Vec3
  len?: number
  seg?: number
  wid?: number
  twi?: number
  col?: ColorRange
  dep?: number
  frk?: number
}

type BranchResult = [number, Vec3[]]

function branch(args: BranchArgs = {}): BranchResult[] {
  const ctx = args.ctx!
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const rot = args.rot ?? [PI / 2, 0, 0] as Vec3
  const len = args.len ?? 400
  const seg = args.seg ?? 40
  const wid = args.wid ?? 1
  const twi = args.twi ?? 5
  const col = args.col ?? { min: [50, 0.2, 0.8, 1], max: [50, 0.2, 0.8, 1] }
  const dep = args.dep ?? 3
  const frk = args.frk ?? 4

  const jnt: [number, number][] = []
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

  const wfun = (x: number) => {
    const [m, j] = jntdist(x)
    if (m < 1) {
      return wid * (3 + 5 * (1 - x))
    }
    else {
      return wid * (2 + 7 * (1 - x) * mapval(Noise.noise(x * 10), 0, 1, 0.5, 1))
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

  const P = stem({ ctx, xof, yof, rot, len, seg, wid: wfun, col, ben: bfun })

  const child: BranchResult[] = []
  if (dep > 0 && wid > 0.1) {
    for (let i = 0; i < frk * Math.random(); i++) {
      const ind = Math.floor(normRand(1, P.length))
      const r = grot(P, ind)
      const L = branch({
        ctx,
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
      })
      child.push(...L)
    }
  }

  return [[dep, P.map(v => [v[0] + xof, v[1] + yof, v[2]] as Vec3)] as BranchResult].concat(child)
}

// ============================================================================
// Parameter Generation
// ============================================================================

export function genParams(): FlowerParams {
  const randint = (x: number, y: number) => Math.floor(normRand(x, y))

  const flowerShapeMask = (x: number) => sin(PI * x) ** 0.2
  const leafShapeMask = (x: number) => sin(PI * x) ** 0.5

  const PAR = {} as FlowerParams

  PAR.flowerChance = randChoice([normRand(0, 0.08), normRand(0, 0.03)])
  PAR.leafChance = randChoice([0, normRand(0, 0.1), normRand(0, 0.1)])
  PAR.leafType = randChoice([
    [1, randint(2, 5)],
    [2, randint(3, 7), randint(3, 8)],
    [2, randint(3, 7), randint(3, 8)],
  ])

  const flowerShapeNoiseSeed = Math.random() * PI
  const flowerJaggedness = normRand(0.5, 8)
  PAR.flowerShape = (x: number) => Noise.noise(x * flowerJaggedness, flowerShapeNoiseSeed) * flowerShapeMask(x)

  const leafShapeNoiseSeed = Math.random() * PI
  const leafJaggedness = normRand(0.1, 40)
  const leafPointyness = normRand(0.5, 1.5)
  PAR.leafShape = randChoice([
    (x: number) => Noise.noise(x * leafJaggedness, flowerShapeNoiseSeed) * leafShapeMask(x),
    (x: number) => sin(PI * x) ** leafPointyness,
  ])

  const flowerHue0 = (normRand(0, 180) - 130 + 360) % 360
  const flowerHue1 = Math.floor((flowerHue0 + normRand(-70, 70) + 360) % 360)
  const flowerValue0 = Math.min(1, normRand(0.5, 1.3))
  const flowerValue1 = Math.min(1, normRand(0.5, 1.3))
  const flowerSaturation0 = normRand(0, 1.1 - flowerValue0)
  const flowerSaturation1 = normRand(0, 1.1 - flowerValue1)

  PAR.flowerColor = {
    min: [flowerHue0, flowerSaturation0, flowerValue0, normRand(0.8, 1)],
    max: [flowerHue1, flowerSaturation1, flowerValue1, normRand(0.5, 1)],
  }
  PAR.leafColor = {
    min: [normRand(10, 200), normRand(0.05, 0.4), normRand(0.3, 0.7), normRand(0.8, 1)],
    max: [normRand(10, 200), normRand(0.05, 0.4), normRand(0.3, 0.7), normRand(0.8, 1)],
  }

  const curveCoeff0 = [normRand(-0.5, 0.5), normRand(5, 10)]
  const curveCoeff2 = [Math.random() * PI, normRand(5, 15)]
  const curveCoeff4 = [Math.random() * 0.5, normRand(0.8, 1.2)]

  PAR.flowerOpenCurve = randChoice([
    (x: number, op: number) => (x < 0.1)
      ? 2 + op * curveCoeff2[1]
      : Noise.noise(x * 10, curveCoeff2[0]),
    (x: number, op: number) => (x < curveCoeff4[0])
      ? 0
      : 10 - x * mapval(op, 0, 1, 16, 20) * curveCoeff4[1],
  ])

  PAR.flowerColorCurve = randChoice([
    (x: number) => sigmoid(x + curveCoeff0[0], curveCoeff0[1]),
  ])

  PAR.leafLength = normRand(30, 100)
  PAR.flowerLength = normRand(5, 55)
  PAR.pedicelLength = normRand(5, 30)
  PAR.leafWidth = normRand(5, 30)
  PAR.flowerWidth = normRand(5, 30)
  PAR.stemWidth = normRand(2, 11)
  PAR.stemBend = normRand(2, 16)
  PAR.stemLength = normRand(300, 400)
  PAR.stemCount = randChoice([2, 3, 4, 5])
  PAR.sheathLength = randChoice([0, normRand(50, 100)])
  PAR.sheathWidth = normRand(5, 15)
  PAR.shootCount = normRand(1, 7)
  PAR.shootLength = normRand(50, 180)
  PAR.leafPosition = randChoice([1, 2])
  PAR.flowerPetal = Math.round(mapval(PAR.flowerWidth, 5, 50, 10, 3))
  PAR.innerLength = Math.min(normRand(0, 20), PAR.flowerLength * 0.8)
  PAR.innerWidth = Math.min(randChoice([0, normRand(1, 8)]), PAR.flowerWidth * 0.8)
  PAR.innerShape = (x: number) => sin(PI * x) ** 1

  const innerHue = normRand(0, 60)
  PAR.innerColor = {
    min: [innerHue, normRand(0.1, 0.7), normRand(0.5, 0.9), normRand(0.8, 1)],
    max: [innerHue, normRand(0.1, 0.7), normRand(0.5, 0.9), normRand(0.5, 1)],
  }

  PAR.branchWidth = normRand(0.4, 1.3)
  PAR.branchTwist = Math.round(normRand(2, 5))
  PAR.branchDepth = randChoice([3, 4])
  PAR.branchFork = randChoice([4, 5, 6, 7])

  const branchHue = normRand(30, 60)
  const branchSaturation = normRand(0.05, 0.3)
  const branchValue = normRand(0.7, 0.9)
  PAR.branchColor = {
    min: [branchHue, branchSaturation, branchValue, 1],
    max: [branchHue, branchSaturation, branchValue, 1],
  }

  return PAR
}

// ============================================================================
// Layer System (Canvas Contexts)
// ============================================================================

interface LayerContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

const Layer = {
  empty(w: number = 600, h: number = w): LayerContext {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    return { canvas, ctx }
  },

  blit(ctx0: CanvasRenderingContext2D, ctx1: CanvasRenderingContext2D, args: { ble?: string, xof?: number, yof?: number } = {}) {
    const ble = args.ble ?? 'normal'
    const xof = args.xof ?? 0
    const yof = args.yof ?? 0
    ctx0.globalCompositeOperation = ble as GlobalCompositeOperation
    ctx0.drawImage(ctx1.canvas, xof, yof)
  },

  filter(ctx: CanvasRenderingContext2D, f: (x: number, y: number, r: number, g: number, b: number, a: number) => [number, number, number, number]) {
    const imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const pix = imgd.data
    for (let i = 0, n = pix.length; i < n; i += 4) {
      const [r, g, b, a] = [pix[i], pix[i + 1], pix[i + 2], pix[i + 3]]
      const x = (i / 4) % ctx.canvas.width
      const y = Math.floor((i / 4) / ctx.canvas.width)
      const [r1, g1, b1, a1] = f(x, y, r, g, b, a)
      pix[i] = r1
      pix[i + 1] = g1
      pix[i + 2] = b1
      pix[i + 3] = a1
    }
    ctx.putImageData(imgd, 0, 0)
  },

  border(ctx: CanvasRenderingContext2D, f: (th: number) => number) {
    const imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const pix = imgd.data
    for (let i = 0, n = pix.length; i < n; i += 4) {
      const x = (i / 4) % ctx.canvas.width
      const y = Math.floor((i / 4) / ctx.canvas.width)

      const nx = (x / ctx.canvas.width - 0.5) * 2
      const ny = (y / ctx.canvas.height - 0.5) * 2
      const theta = Math.atan2(ny, nx)
      const r_ = distance([nx, ny], [0, 0])
      const rr_ = f(theta)

      if (r_ > rr_) {
        pix[i] = 0
        pix[i + 1] = 0
        pix[i + 2] = 0
        pix[i + 3] = 0
      }
    }
    ctx.putImageData(imgd, 0, 0)
  },

  bound(ctx: CanvasRenderingContext2D) {
    let xmin = ctx.canvas.width
    let xmax = 0
    let ymin = ctx.canvas.height
    let ymax = 0
    const imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const pix = imgd.data
    for (let i = 0, n = pix.length; i < n; i += 4) {
      const a = pix[i + 3]
      const x = (i / 4) % ctx.canvas.width
      const y = Math.floor((i / 4) / ctx.canvas.width)
      if (a > 0.001) {
        if (x < xmin) xmin = x
        if (x > xmax) xmax = x
        if (y < ymin) ymin = y
        if (y > ymax) ymax = y
      }
    }
    return { xmin, xmax, ymin, ymax }
  },
}

const Filter = {
  wispy(x: number, y: number, r: number, g: number, b: number, a: number): [number, number, number, number] {
    const n = Noise.noise(x * 0.2, y * 0.2)
    const m = Noise.noise(x * 0.5, y * 0.5, 2)
    return [r, g * mapval(m, 0, 1, 0.95, 1), b * mapval(m, 0, 1, 0.9, 1), a * mapval(n, 0, 1, 0.5, 1)]
  },

  fade(x: number, y: number, r: number, g: number, b: number, a: number): [number, number, number, number] {
    const n = Noise.noise(x * 0.01, y * 0.01)
    return [r, g, b, a * Math.min(Math.max(mapval(n, 0, 1, 0, 1), 0), 1)]
  },
}

// ============================================================================
// Woody Plant Generator
// ============================================================================

interface WoodyArgs {
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  PAR?: FlowerParams
}

function woody(args: WoodyArgs = {}): CanvasRenderingContext2D {
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const PAR = args.PAR ?? genParams()

  const cwid = 1200
  const lay0 = Layer.empty(cwid)
  const lay1 = Layer.empty(cwid)

  const PL = branch({
    ctx: lay0.ctx,
    xof: cwid * 0.5,
    yof: cwid * 0.7,
    wid: PAR.branchWidth,
    twi: PAR.branchTwist,
    dep: PAR.branchDepth,
    col: PAR.branchColor,
    frk: PAR.branchFork,
  })

  for (let i = 0; i < PL.length; i++) {
    if (i / PL.length > 0.1) {
      for (let j = 0; j < PL[i][1].length; j++) {
        if (Math.random() < PAR.leafChance) {
          leaf({
            ctx: lay0.ctx,
            xof: PL[i][1][j][0],
            yof: PL[i][1][j][1],
            len: PAR.leafLength * normRand(0.8, 1.2),
            vei: PAR.leafType,
            col: PAR.leafColor,
            rot: [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0],
            wid: (x: number) => PAR.leafShape(x) * PAR.leafWidth,
            ben: (x: number) => [
              mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * 5,
              0,
              mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 5,
            ],
          })
        }

        if (Math.random() < PAR.flowerChance) {
          const hr: Vec3 = [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0]

          const P_ = stem({
            ctx: lay0.ctx,
            xof: PL[i][1][j][0],
            yof: PL[i][1][j][1],
            rot: hr,
            len: PAR.pedicelLength,
            col: { min: [50, 1, 0.9, 1], max: [50, 1, 0.9, 1] },
            wid: (x: number) => sin(x * PI) * x * 2 + 1,
            ben: (x: number) => [0, 0, 0],
          })

          const op = Math.random()
          const r = grot(P_, P_.length - 1)
          const hhr = r
          for (let k = 0; k < PAR.flowerPetal; k++) {
            leaf({
              ctx: lay1.ctx,
              flo: true,
              xof: PL[i][1][j][0] + P_[P_.length - 1][0],
              yof: PL[i][1][j][1] + P_[P_.length - 1][1],
              rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
              len: PAR.flowerLength * normRand(0.7, 1.3),
              wid: (x: number) => PAR.flowerShape(x) * PAR.flowerWidth,
              vei: [0],
              col: PAR.flowerColor,
              cof: PAR.flowerColorCurve,
              ben: (x: number) => [PAR.flowerOpenCurve(x, op), 0, 0],
            })

            leaf({
              ctx: lay1.ctx,
              flo: true,
              xof: PL[i][1][j][0] + P_[P_.length - 1][0],
              yof: PL[i][1][j][1] + P_[P_.length - 1][1],
              rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
              len: PAR.innerLength * normRand(0.8, 1.2),
              wid: (x: number) => sin(x * PI) * 4,
              vei: [0],
              col: PAR.innerColor,
              cof: (x: number) => x,
              ben: (x: number) => [PAR.flowerOpenCurve(x, op), 0, 0],
            })
          }
        }
      }
    }
  }

  Layer.filter(lay0.ctx, Filter.fade)
  Layer.filter(lay0.ctx, Filter.wispy)
  Layer.filter(lay1.ctx, Filter.wispy)

  const b1 = Layer.bound(lay0.ctx)
  const b2 = Layer.bound(lay1.ctx)
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  }

  const xref = xof - (bd.xmin + bd.xmax) / 2
  const yref = yof - bd.ymax

  const finalCtx = args.ctx ?? Layer.empty(600, 600).ctx
  Layer.blit(finalCtx, lay0.ctx, { ble: 'multiply', xof: xref, yof: yref })
  Layer.blit(finalCtx, lay1.ctx, { ble: 'normal', xof: xref, yof: yref })

  return finalCtx
}

// ============================================================================
// Herbal Plant Generator
// ============================================================================

interface HerbalArgs {
  ctx?: CanvasRenderingContext2D
  xof?: number
  yof?: number
  PAR?: FlowerParams
}

function herbal(args: HerbalArgs = {}): CanvasRenderingContext2D {
  const xof = args.xof ?? 0
  const yof = args.yof ?? 0
  const PAR = args.PAR ?? genParams()

  const cwid = 1200
  const lay0 = Layer.empty(cwid)
  const lay1 = Layer.empty(cwid)

  const x0 = cwid * 0.5
  const y0 = cwid * 0.7

  for (let i = 0; i < PAR.stemCount; i++) {
    const r: Vec3 = [PI / 2, 0, normRand(-1, 1) * PI]
    const P = stem({
      ctx: lay0.ctx,
      xof: x0,
      yof: y0,
      len: PAR.stemLength * normRand(0.7, 1.3),
      rot: r,
      wid: (x: number) => PAR.stemWidth
        * (sin(x * PI / 2 + PI / 2) ** 0.5 * Noise.noise(x * 10) * 0.5 + 0.5),
      ben: (x: number) => [
        mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * x * PAR.stemBend,
        0,
        mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * x * PAR.stemBend,
      ],
    })

    if (PAR.leafPosition === 2) {
      for (let j = 0; j < P.length; j++) {
        if (Math.random() < PAR.leafChance * 2) {
          leaf({
            ctx: lay0.ctx,
            xof: x0 + P[j][0],
            yof: y0 + P[j][1],
            len: 2 * PAR.leafLength * normRand(0.8, 1.2),
            vei: PAR.leafType,
            col: PAR.leafColor,
            rot: [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0],
            wid: (x: number) => 2 * PAR.leafShape(x) * PAR.leafWidth,
            ben: (x: number) => [
              mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * 5,
              0,
              mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 5,
            ],
          })
        }
      }
    }

    const hr = grot(P, P.length - 1)
    if (PAR.sheathLength !== 0) {
      stem({
        ctx: lay0.ctx,
        xof: x0 + P[P.length - 1][0],
        yof: y0 + P[P.length - 1][1],
        rot: hr,
        len: PAR.sheathLength,
        col: { min: [60, 0.3, 0.9, 1], max: [60, 0.3, 0.9, 1] },
        wid: (x: number) => PAR.sheathWidth * (sin(x * PI) ** 2 - x * 0.5 + 0.5),
        ben: (x: number) => [0, 0, 0],
      })
    }

    for (let j = 0; j < Math.max(1, PAR.shootCount * normRand(0.5, 1.5)); j++) {
      const P_ = stem({
        ctx: lay0.ctx,
        xof: x0 + P[P.length - 1][0],
        yof: y0 + P[P.length - 1][1],
        rot: hr,
        len: PAR.shootLength * normRand(0.5, 1.5),
        col: { min: [70, 0.2, 0.9, 1], max: [70, 0.2, 0.9, 1] },
        wid: (x: number) => 2,
        ben: (x: number) => [
          mapval(Noise.noise(x * 1, j), 0, 1, -1, 1) * x * 10,
          0,
          mapval(Noise.noise(x * 1, j + PI), 0, 1, -1, 1) * x * 10,
        ],
      })

      const op = Math.random()
      const hhr: Vec3 = [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * PI]
      for (let k = 0; k < PAR.flowerPetal; k++) {
        leaf({
          ctx: lay1.ctx,
          flo: true,
          xof: x0 + P[P.length - 1][0] + P_[P_.length - 1][0],
          yof: y0 + P[P.length - 1][1] + P_[P_.length - 1][1],
          rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
          len: PAR.flowerLength * normRand(0.7, 1.3) * 1.5,
          wid: (x: number) => 1.5 * PAR.flowerShape(x) * PAR.flowerWidth,
          vei: [0],
          col: PAR.flowerColor,
          cof: PAR.flowerColorCurve,
          ben: (x: number) => [PAR.flowerOpenCurve(x, op), 0, 0],
        })

        leaf({
          ctx: lay1.ctx,
          flo: true,
          xof: x0 + P[P.length - 1][0] + P_[P_.length - 1][0],
          yof: y0 + P[P.length - 1][1] + P_[P_.length - 1][1],
          rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2],
          len: PAR.innerLength * normRand(0.8, 1.2),
          wid: (x: number) => sin(x * PI) * 4,
          vei: [0],
          col: PAR.innerColor,
          cof: (x: number) => x,
          ben: (x: number) => [PAR.flowerOpenCurve(x, op), 0, 0],
        })
      }
    }
  }

  if (PAR.leafPosition === 1) {
    for (let i = 0; i < PAR.leafChance * 100; i++) {
      leaf({
        ctx: lay0.ctx,
        xof: x0,
        yof: y0,
        rot: [PI / 3, 0, normRand(-1, 1) * PI],
        len: 4 * PAR.leafLength * normRand(0.8, 1.2),
        wid: (x: number) => 2 * PAR.leafShape(x) * PAR.leafWidth,
        vei: PAR.leafType,
        ben: (x: number) => [
          mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * 10,
          0,
          mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 10,
        ],
      })
    }
  }

  Layer.filter(lay0.ctx, Filter.fade)
  Layer.filter(lay0.ctx, Filter.wispy)
  Layer.filter(lay1.ctx, Filter.wispy)

  const b1 = Layer.bound(lay0.ctx)
  const b2 = Layer.bound(lay1.ctx)
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  }

  const xref = xof - (bd.xmin + bd.xmax) / 2
  const yref = yof - bd.ymax

  const finalCtx = args.ctx ?? Layer.empty(600, 600).ctx
  Layer.blit(finalCtx, lay0.ctx, { ble: 'multiply', xof: xref, yof: yref })
  Layer.blit(finalCtx, lay1.ctx, { ble: 'normal', xof: xref, yof: yref })

  return finalCtx
}

// ============================================================================
// Main Generation Function
// ============================================================================

const PAPER_COL0: [number, number, number] = [0.98, 0.91, 0.74]
const PAPER_COL1: [number, number, number] = [1, 0.99, 0.9]

export function generateFlowerCanvas(options: FlowerCanvasOptions = {}): HTMLCanvasElement {
  const {
    seed,
    type = 'random',
    width = 600,
    height = 600,
  } = options

  // Initialize PRNG
  const finalSeed = seed !== undefined ? seed : new Date().getTime().toString()
  const prng = new PRNG()
  prng.seed(finalSeed)

  // Replace Math.random globally
  const oldRandom = Math.random
  Math.random = () => prng.next()

  // Reset noise - it will reinitialize on first use

  // Simulate makeBG() - consumes randoms for noise initialization
  paper({ col: PAPER_COL0, tex: 10, spr: 0 })

  // Create main canvas
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Fill with white
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, width, height)

  // Add paper texture
  const ppr = paper({ col: PAPER_COL1 })
  for (let i = 0; i < width; i += 512) {
    for (let j = 0; j < height; j += 512) {
      ctx.drawImage(ppr, i, j)
    }
  }

  // Determine plant type
  let plantType: 'woody' | 'herbal'
  if (type === 'random') {
    plantType = Math.random() <= 0.5 ? 'woody' : 'herbal'
  }
  else {
    plantType = type
  }

  // Generate plant
  if (plantType === 'woody') {
    woody({ ctx, xof: 300, yof: 550 })
  }
  else {
    herbal({ ctx, xof: 300, yof: 600 })
  }

  // Apply border
  Layer.border(ctx, squircle(0.98, 3))

  // Restore Math.random
  Math.random = oldRandom

  return canvas
}
