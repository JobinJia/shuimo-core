// Nonflowers
// Procedurally generated paintings of nonexistent flowers.
// (c) Lingdong Huang 2018

// index arrays with .x, .y, .z and negative indices
Object.defineProperty(Array.prototype, 'x', {
  get() {
    return this[0]
  },
  set(n) {
    this[0] = n
  },
})
Object.defineProperty(Array.prototype, 'y', {
  get() {
    return this[1]
  },
  set(n) {
    this[1] = n
  },
})
Object.defineProperty(Array.prototype, 'z', {
  get() {
    return this[2]
  },
  set(n) {
    this[2] = n
  },
})
for (let i = 1; i < 4; i++) {
  function f(i) {
    Object.defineProperty(Array.prototype, `-${i}`, {
      get() {
        return this[this.length - i]
      },
      set(n) {
        this[this.length - i] = n
      },
    })
  }
  f(i)
}

// math constants
const rad2deg = 180 / Math.PI
const deg2rad = Math.PI / 180
const PI = Math.PI
const sin = Math.sin
const cos = Math.cos
const abs = Math.abs
const pow = Math.pow
function rad(x) {
  return x * deg2rad
}
function deg(x) {
  return x * rad2deg
}

// seedable pseudo random number generator
var Prng = new function () {
  this.s = 1234
  this.p = 999979
  this.q = 999983
  this.m = this.p * this.q
  this.hash = function (x) {
    const y = window.btoa(JSON.stringify(x)); let z = 0
    for (let i = 0; i < y.length; i++) {
      z += y.charCodeAt(i) * 128 ** i
    }
    return z
  }
  this.seed = function (x) {
    if (x == undefined) {
      x = (new Date()).getTime()
    }
    let y = 0; let z = 0
    function redo() {
      y = (Prng.hash(x) + z) % Prng.m; z += 1
    }
    while (y % Prng.p == 0 || y % Prng.q == 0 || y == 0 || y == 1) {
      redo()
    }
    Prng.s = y
    console.log(['int seed', Prng.s])
    for (let i = 0; i < 10; i++) {
      Prng.next()
    }
  }
  this.next = function () {
    Prng.s = (Prng.s * Prng.s) % Prng.m
    return Prng.s / Prng.m
  }
  this.test = function (f) {
    const F = f || function () {
      return Prng.next()
    }
    const t0 = (new Date()).getTime()
    const chart = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < 10000000; i++) {
      chart[Math.floor(F() * 10)] += 1
    }
    console.log(chart)
    console.log(`finished in ${(new Date()).getTime() - t0}`)
    return chart
  }
}()
Math.oldRandom = Math.random
Math.random = function () {
  return Prng.next()
}
Math.seed = function (x) {
  return Prng.seed(x)
}

// parse url arguments
function parseArgs(key2f) {
  let par = window.location.href.split('?')[1]
  if (par == undefined) {
    return
  }
  par = par.split('&')
  for (let i = 0; i < par.length; i++) {
    const e = par[i].split('=')
    try {
      key2f[e[0]](e[1])
    } catch (e) {
      console.log(e)
    }
  }
}
SEED = (`${(new Date()).getTime()}`)
parseArgs({ seed(x) {
  SEED = (x == '' ? SEED : x)
} })
Math.seed(SEED)
console.log(SEED)

// perlin noise adapted from p5.js
const Noise = new function () {
  const PERLIN_YWRAPB = 4; const PERLIN_YWRAP = 1 << PERLIN_YWRAPB
  const PERLIN_ZWRAPB = 8; const PERLIN_ZWRAP = 1 << PERLIN_ZWRAPB
  const PERLIN_SIZE = 4095
  let perlin_octaves = 4; let perlin_amp_falloff = 0.5
  const scaled_cosine = function (i) {
    return 0.5 * (1.0 - Math.cos(i * Math.PI))
  }
  let perlin
  this.noise = function (x, y, z) {
    y = y || 0; z = z || 0
    if (perlin == null) {
      perlin = Array.from({ length: PERLIN_SIZE + 1 })
      for (let i = 0; i < PERLIN_SIZE + 1; i++) {
        perlin[i] = Math.random()
      }
    }
    if (x < 0) {
      x = -x
    } if (y < 0) {
      y = -y
    } if (z < 0) {
      z = -z
    }
    let xi = Math.floor(x); let yi = Math.floor(y); let zi = Math.floor(z)
    let xf = x - xi; let yf = y - yi; let zf = z - zi
    let rxf, ryf
    let r = 0; let ampl = 0.5
    let n1, n2, n3
    for (let o = 0; o < perlin_octaves; o++) {
      let of = xi + (yi << PERLIN_YWRAPB) + (zi << PERLIN_ZWRAPB)
      rxf = scaled_cosine(xf); ryf = scaled_cosine(yf)
      n1 = perlin[of & PERLIN_SIZE]
      n1 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n1)
      n2 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE]
      n2 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n2)
      n1 += ryf * (n2 - n1)
      of += PERLIN_ZWRAP
      n2 = perlin[of & PERLIN_SIZE]
      n2 += rxf * (perlin[(of + 1) & PERLIN_SIZE] - n2)
      n3 = perlin[(of + PERLIN_YWRAP) & PERLIN_SIZE]
      n3 += rxf * (perlin[(of + PERLIN_YWRAP + 1) & PERLIN_SIZE] - n3)
      n2 += ryf * (n3 - n2)
      n1 += scaled_cosine(zf) * (n2 - n1)
      r += n1 * ampl
      ampl *= perlin_amp_falloff
      xi <<= 1; xf *= 2; yi <<= 1; yf *= 2; zi <<= 1; zf *= 2
      if (xf >= 1.0) {
        xi++; xf--
      }
      if (yf >= 1.0) {
        yi++; yf--
      }
      if (zf >= 1.0) {
        zi++; zf--
      }
    }
    return r
  }
  this.noiseDetail = function (lod, falloff) {
    if (lod > 0) {
      perlin_octaves = lod
    }
    if (falloff > 0) {
      perlin_amp_falloff = falloff
    }
  }
  this.noiseSeed = function (seed) {
    const lcg = (function () {
      const m = 4294967296; const a = 1664525; const c = 1013904223; let seed; let z
      return {
        setSeed(val) {
          z = seed = (val == null ? Math.random() * m : val) >>> 0
        },
        getSeed() {
          return seed
        },
        rand() {
          z = (a * z + c) % m; return z / m
        },
      }
    }())
    lcg.setSeed(seed)
    perlin = Array.from({ length: PERLIN_SIZE + 1 })
    for (let i = 0; i < PERLIN_SIZE + 1; i++) {
      perlin[i] = lcg.rand()
    }
  }
}()
// distance between 2 coordinates in 2D
function distance(p0, p1) {
  return Math.sqrt((p0[0] - p1[0]) ** 2 + (p0[1] - p1[1]) ** 2)
}
// map float from one range to another
function mapval(value, istart, istop, ostart, ostop) {
  return ostart + (ostop - ostart) * ((value - istart) * 1.0 / (istop - istart))
}
// random element from array
function randChoice(arr) {
  return arr[Math.floor(arr.length * Math.random())]
}
// normalized random number
function normRand(m, M) {
  return mapval(Math.random(), 0, 1, m, M)
}
// weighted randomness
function wtrand(func) {
  const x = Math.random()
  const y = Math.random()
  if (y < func(x)) {
    return x
  } else {
    return wtrand(func)
  }
}
// gaussian randomness
function randGaussian() {
  return wtrand((x) => {
    return Math.E ** (-24 * (x - 0.5) ** 2)
  }) * 2 - 1
}
// sigmoid curve
function sigmoid(x, k) {
  k = (k != undefined) ? k : 10
  return 1 / (1 + Math.exp(-k * (x - 0.5)))
}
// pseudo bean curve
function bean(x) {
  return (0.25 - (x - 0.5) ** 2) ** 0.5 * (2.6 + 2.4 * x ** 1.5) * 0.54
}
// interpolate between square and circle
function squircle(r, a) {
  return function (th) {
    while (th > PI / 2) {
      th -= PI / 2
    }
    while (th < 0) {
      th += PI / 2
    }
    return r * (1 / (cos(th) ** a + sin(th) ** a)) ** (1 / a)
  }
}
// mid-point of an array of points
function midPt() {
  const plist = (arguments.length == 1)
    ? arguments[0]
    : Array.apply(null, arguments)
  return plist.reduce((acc, v) => {
    return [v[0] / plist.length + acc[0], v[1] / plist.length + acc[1], v[2] / plist.length + acc[2]]
  }, [0, 0, 0])
}
// rational bezier curve
function bezmh(P, w) {
  w = (w == undefined) ? 1 : w
  if (P.length == 2) {
    P = [P[0], midPt(P[0], P[1]), P[1]]
  }
  const plist = []
  for (let j = 0; j < P.length - 2; j++) {
    var p0; var p1; var p2
    if (j == 0) {
      p0 = P[j]
    } else {
      p0 = midPt(P[j], P[j + 1])
    }
    p1 = P[j + 1]
    if (j == P.length - 3) {
      p2 = P[j + 2]
    } else {
      p2 = midPt(P[j + 1], P[j + 2])
    }
    const pl = 20
    for (let i = 0; i < pl + (j == P.length - 3); i += 1) {
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
// tools for vectors in 3d
v3 = new function () {
  this.forward = [0, 0, 1]
  this.up = [0, 1, 0]
  this.right = [1, 0, 0]
  this.zero = [0, 0, 0]

  this.rotvec = function (vec, axis, th) {
    const [l, m, n] = axis
    const [x, y, z] = vec
    const [costh, sinth] = [Math.cos(th), Math.sin(th)]
    const mat = {}
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
  }
  this.roteuler = function (vec, rot) {
    if (rot.z != 0) {
      vec = v3.rotvec(vec, v3.forward, rot.z)
    }
    if (rot.x != 0) {
      vec = v3.rotvec(vec, v3.right, rot.x)
    }
    if (rot.y != 0) {
      vec = v3.rotvec(vec, v3.up, rot.y)
    }
    return vec
  }

  this.scale = function (vec, p) {
    return [vec.x * p, vec.y * p, vec.z * p]
  }
  this.copy = function (v0) {
    return [v0.x, v0.y, v0.z]
  }
  this.add = function (v0, v) {
    return [v0.x + v.x, v0.y + v.y, v0.z + v.z]
  }
  this.subtract = function (v0, v) {
    return [v0.x - v.x, v0.y - v.y, v0.z - v.z]
  }
  this.mag = function (v) {
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  }
  this.normalize = function (v) {
    p = 1 / mag(v)
    return [v.x * p, v.y * p, v.z * p]
  }
  this.dot = function (u, v) {
    return u.x * v.x + u.y * v.y + u.z * v.z
  }
  this.cross = function (u, v) {
    return [
      u.y * v.z - u.z * v.y,
      u.z * v.x - u.x * v.z,
      u.x * v.y - u.y * v.x,
    ]
  }
  this.angcos = function (u, v) {
    return v3.dot(u, v) / (v3.mag(u) * v3.mag(v))
  }
  this.ang = function (u, v) {
    return Math.acos(v3.angcos(u, v))
  }
  this.toeuler = function (v0) {
    const ep = 5
    let ma = 2 * PI
    let mr = [0, 0, 0]
    let cnt = 0
    for (let x = -180; x < 180; x += ep) {
      for (let y = -90; y < 90; y += ep) {
        cnt++
        const r = [rad(x), rad(y), 0]
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
  }
  this.lerp = function (u, v, p) {
    return [
      u.x * (1 - p) + v.x * p,
      u.y * (1 - p) + v.y * p,
      u.z * (1 - p) + v.z * p,
    ]
  }
}()
// rgba to css color string
function rgba(r, g, b, a) {
  r = (r != undefined) ? r : 255
  g = (g != undefined) ? g : r
  b = (b != undefined) ? b : g
  a = (a != undefined) ? a : 1.0
  return `rgba(${Math.floor(r)},${Math.floor(g)},${Math.floor(b)},${a.toFixed(3)})`
}
// hsv to css color string
function hsv(h, s, v, a) {
  const c = v * s
  const x = c * (1 - abs((h / 60) % 2 - 1))
  const m = v - c
  const [rv, gv, bv] = ([[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]])[Math.floor(h / 60)]
  const [r, g, b] = [(rv + m) * 255, (gv + m) * 255, (bv + m) * 255]
  return rgba(r, g, b, a)
}
// polygon for HTML canvas
function polygon(args) {
  var args = (args != undefined) ? args : {}
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const pts = (args.pts != undefined) ? args.pts : []
  const col = (args.col != undefined) ? args.col : 'black'
  const fil = (args.fil != undefined) ? args.fil : true
  const str = (args.str != undefined) ? args.str : !fil

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
// lerp hue wrapping around 360 degs
function lerpHue(h0, h1, p) {
  const methods = [
    [abs(h1 - h0), mapval(p, 0, 1, h0, h1)],
    [abs(h1 + 360 - h0), mapval(p, 0, 1, h0, h1 + 360)],
    [abs(h1 - 360 - h0), mapval(p, 0, 1, h0, h1 - 360)],
  ]
  methods.sort((x, y) => (x[0] - y[0]))
  return (methods[0][1] + 720) % 360
}
// get rotation at given index of a poly-line
function grot(P, ind) {
  const d = v3.subtract(P[ind], P[ind - 1])
  return v3.toeuler(d)
}
// generate 2d tube shape from list of points
function tubify(args) {
  var args = (args != undefined) ? args : {}
  const pts = (args.pts != undefined) ? args.pts : []
  const wid = (args.wid != undefined) ? args.wid : x => (10)
  vtxlist0 = []
  vtxlist1 = []
  vtxlist = []
  for (let i = 1; i < pts.length - 1; i++) {
    const w = wid(i / pts.length)
    var a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0])
    const a2 = Math.atan2(pts[i][1] - pts[i + 1][1], pts[i][0] - pts[i + 1][0])
    let a = (a1 + a2) / 2
    if (a < a2) {
      a += PI
    }
    vtxlist0.push([pts[i][0] + w * cos(a), (pts[i][1] + w * sin(a))])
    vtxlist1.push([pts[i][0] - w * cos(a), (pts[i][1] - w * sin(a))])
  }
  const l = pts.length - 1
  const a0 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) - Math.PI / 2
  var a1 = Math.atan2(pts[l][1] - pts[l - 1][1], pts[l][0] - pts[l - 1][0]) - Math.PI / 2
  const w0 = wid(0)
  const w1 = wid(1)
  vtxlist0.unshift([pts[0][0] + w0 * Math.cos(a0), (pts[0][1] + w0 * Math.sin(a0))])
  vtxlist1.unshift([pts[0][0] - w0 * Math.cos(a0), (pts[0][1] - w0 * Math.sin(a0))])
  vtxlist0.push([pts[l][0] + w1 * Math.cos(a1), (pts[l][1] + w1 * Math.sin(a1))])
  vtxlist1.push([pts[l][0] - w1 * Math.cos(a1), (pts[l][1] - w1 * Math.sin(a1))])
  return [vtxlist0, vtxlist1]
}
// line work with weight function
function stroke(args) {
  var args = (args != undefined) ? args : {}
  const pts = (args.pts != undefined) ? args.pts : []
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const col = (args.col != undefined) ? args.col : 'black'
  const wid = (args.wid != undefined)
    ? args.wid
    : x => (1 * sin(x * PI) * mapval(Noise.noise(x * 10), 0, 1, 0.5, 1))

  const [vtxlist0, vtxlist1] = tubify({ pts, wid })

  polygon({ pts: vtxlist0.concat(vtxlist1.reverse()), ctx, fil: true, col, xof, yof })
  return [vtxlist0, vtxlist1]
}
// generate paper texture
function paper(args) {
  var args = (args != undefined) ? args : {}
  const col = (args.col != undefined) ? args.col : [0.98, 0.91, 0.74]
  const tex = (args.tex != undefined) ? args.tex : 20
  const spr = (args.spr != undefined) ? args.spr : 1

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const reso = 512
  for (let i = 0; i < reso / 2 + 1; i++) {
    for (let j = 0; j < reso / 2 + 1; j++) {
      let c = (255 - Noise.noise(i * 0.1, j * 0.1) * tex * 0.5)
      c -= Math.random() * tex
      var r = (c * col[0])
      var g = (c * col[1])
      var b = (c * col[2])
      if (Noise.noise(i * 0.04, j * 0.04, 2) * Math.random() * spr > 0.7
        || Math.random() < 0.005 * spr) {
        var r = (c * 0.7)
        var g = (c * 0.5)
        var b = (c * 0.2)
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
// generate leaf-like structure
function leaf(args) {
  var args = (args != undefined) ? args : {}
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const rot = (args.rot != undefined) ? args.rot : [PI / 2, 0, 0]
  const len = (args.len != undefined) ? args.len : 500
  const seg = (args.seg != undefined) ? args.seg : 40
  const wid = (args.wid != undefined) ? args.wid : x => (sin(x * PI) * 20)
  const vei = (args.vei != undefined) ? args.vei : [1, 3]
  const flo = (args.flo != undefined) ? args.flo : false
  const col = (args.col != undefined)
    ? args.col
    : { min: [90, 0.2, 0.3, 1], max: [90, 0.1, 0.9, 1] }
  const cof = (args.cof != undefined) ? args.cof : x => (x)
  const ben = (args.ben != undefined)
    ? args.ben
    : x => ([normRand(-10, 10), 0, normRand(-5, 5)])

  let disp = v3.zero
  let crot = v3.zero
  const P = [disp]
  const ROT = [crot]
  const L = [disp]
  const R = [disp]

  const orient = v => (v3.roteuler(v, rot))

  for (var i = 0; i < seg; i++) {
    var p = i / (seg - 1)
    crot = v3.add(crot, v3.scale(ben(p), 1 / seg))
    disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)))
    const w = wid(p)
    const l = v3.add(disp, orient(v3.roteuler([-w, 0, 0], crot)))
    const r = v3.add(disp, orient(v3.roteuler([w, 0, 0], crot)))

    if (i > 0) {
      const v0 = v3.subtract(disp, L[-1])
      const v1 = v3.subtract(l, disp)
      const v2 = v3.cross(v0, v1)
      if (!flo) {
        var lt = mapval(abs(v3.ang(v2, [0, -1, 0])), 0, PI, 1, 0)
      } else {
        var lt = p * normRand(0.95, 1)
      }
      lt = cof(lt) || 0

      const h = lerpHue(col.min[0], col.max[0], lt)
      const s = mapval(lt, 0, 1, col.min[1], col.max[1])
      const v = mapval(lt, 0, 1, col.min[2], col.max[2])
      const a = mapval(lt, 0, 1, col.min[3], col.max[3])

      polygon({ ctx, pts: [l, L[-1], P[-1], disp], xof, yof, fil: true, str: true, col: hsv(h, s, v, a) })
      polygon({ ctx, pts: [r, R[-1], P[-1], disp], xof, yof, fil: true, str: true, col: hsv(h, s, v, a) })
    }
    P.push(disp)
    ROT.push(crot)
    L.push(l)
    R.push(r)
  }
  if (vei[0] == 1) {
    for (var i = 1; i < P.length; i++) {
      for (let j = 0; j < vei[1]; j++) {
        var p = j / vei[1]

        const p0 = v3.lerp(L[i - 1], P[i - 1], p)
        const p1 = v3.lerp(L[i], P[i], p)

        const q0 = v3.lerp(R[i - 1], P[i - 1], p)
        const q1 = v3.lerp(R[i], P[i], p)
        polygon({ ctx, pts: [p0, p1], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
        polygon({ ctx, pts: [q0, q1], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
      }
    }
    stroke({ ctx, pts: P, xof, yof, col: rgba(0, 0, 0, 0.3) })
  } else if (vei[0] == 2) {
    for (var i = 1; i < P.length - vei[1]; i += vei[2]) {
      polygon({ ctx, pts: [P[i], L[i + vei[1]]], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
      polygon({ ctx, pts: [P[i], R[i + vei[1]]], xof, yof, fil: false, col: hsv(0, 0, 0, normRand(0.4, 0.9)) })
    }
    stroke({ ctx, pts: P, xof, yof, col: rgba(0, 0, 0, 0.3) })
  }

  stroke({ ctx, pts: L, xof, yof, col: rgba(120, 100, 0, 0.3) })
  stroke({ ctx, pts: R, xof, yof, col: rgba(120, 100, 0, 0.3) })
  return P
}

// generate stem-like structure
function stem(args) {
  var args = (args != undefined) ? args : {}
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const rot = (args.rot != undefined) ? args.rot : [PI / 2, 0, 0]
  const len = (args.len != undefined) ? args.len : 400
  const seg = (args.seg != undefined) ? args.seg : 40
  const wid = (args.wid != undefined) ? args.wid : x => (6)
  const col = (args.col != undefined)
    ? args.col
    : { min: [250, 0.2, 0.4, 1], max: [250, 0.3, 0.6, 1] }
  const ben = (args.ben != undefined)
    ? args.ben
    : x => ([normRand(-10, 10), 0, normRand(-5, 5)])

  let disp = v3.zero
  let crot = v3.zero
  const P = [disp]
  const ROT = [crot]

  const orient = v => (v3.roteuler(v, rot))

  for (var i = 0; i < seg; i++) {
    var p = i / (seg - 1)
    crot = v3.add(crot, v3.scale(ben(p), 1 / seg))
    disp = v3.add(disp, orient(v3.roteuler([0, 0, len / seg], crot)))
    ROT.push(crot)
    P.push(disp)
  }
  const [L, R] = tubify({ pts: P, wid })
  const wseg = 4
  for (var i = 1; i < P.length; i++) {
    for (let j = 1; j < wseg; j++) {
      const m = (j - 1) / (wseg - 1)
      const n = j / (wseg - 1)
      var p = i / (P.length - 1)

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

// generate fractal-like branches
function branch(args) {
  var args = (args != undefined) ? args : {}
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const rot = (args.rot != undefined) ? args.rot : [PI / 2, 0, 0]
  const len = (args.len != undefined) ? args.len : 400
  const seg = (args.seg != undefined) ? args.seg : 40
  const wid = (args.wid != undefined) ? args.wid : 1
  const twi = (args.twi != undefined) ? args.twi : 5
  const col = (args.col != undefined)
    ? args.col
    : { min: [50, 0.2, 0.8, 1], max: [50, 0.2, 0.8, 1] }
  const dep = (args.dep != undefined) ? args.dep : 3
  const frk = (args.frk != undefined) ? args.frk : 4

  const jnt = []
  for (var i = 0; i < twi; i++) {
    jnt.push([Math.floor(Math.random() * seg), normRand(-1, 1)])
  }

  function jntdist(x) {
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

  const wfun = function (x) {
    const [m, j] = jntdist(x)
    if (m < 1) {
      return wid * (3 + 5 * (1 - x))
    } else {
      return wid * (2 + 7 * (1 - x) * mapval(Noise.noise(x * 10), 0, 1, 0.5, 1))
    }
  }

  const bfun = function (x) {
    const [m, j] = jntdist(x)
    if (m < 1) {
      return [0, j * 20, 0]
    } else {
      return [0, normRand(-5, 5), 0]
    }
  }

  const P = stem({ ctx, xof, yof, rot, len, seg, wid: wfun, col, ben: bfun })

  let child = []
  if (dep > 0 && wid > 0.1) {
    for (var i = 0; i < frk * Math.random(); i++) {
      const ind = Math.floor(normRand(1, P.length))

      const r = grot(P, ind)
      const L = branch({ ctx, xof: xof + P[ind].x, yof: yof + P[ind].y, rot: [r[0] + normRand(-1, 1) * PI / 6, r[1] + normRand(-1, 1) * PI / 6, r[2] + normRand(-1, 1) * PI / 6], seg, len: len * normRand(0.4, 0.6), wid: wid * normRand(0.4, 0.7), twi: twi * 0.7, dep: dep - 1 })
      // child = child.concat(L.map((v)=>([v[0],[v[1].x+P[ind].x,v[1].y+P[ind].y,v[1].z]])))
      child = child.concat(L)
    }
  }
  return ([[dep, P.map(v => ([v.x + xof, v.y + yof, v.z]))]]).concat(child)
}

// vizualize parameters into HTML table & canvas
function vizParams(PAR) {
  const div = document.createElement('div')
  let viz = ''
  const tabstyle = 'style=\'border: 1px solid grey\''
  viz += `<table><tr><td ${tabstyle}>Summary</td></tr><tr><td ${tabstyle}><table><tr>`
  let cnt = 0
  for (var k in PAR) {
    if (typeof (PAR[k]) == 'number') {
      cnt += 1
      viz += `<td><td ${tabstyle}>${k}</td><td ${tabstyle}>${fmt(PAR[k])}</td></td>`
      if (cnt % 4 == 0) {
        viz += '</tr><tr>'
      }
    }
  }
  viz += '</tr></table>'
  function fmt(a) {
    if (typeof (a) == 'number') {
      return a.toFixed(3)
    } else if (typeof (a) == 'object') {
      let r = '<table><tr>'
      for (const k in a) {
        r += `<td ${tabstyle}>${fmt(a[k])}</td>`
      }
      return `${r}</tr></table>`
    }
  }
  viz += '<table><tr>'
  cnt = 0
  for (var k in PAR) {
    if (typeof (PAR[k]) == 'object') {
      viz += `<td ${tabstyle}><table><tr><td colspan='2' ${tabstyle}>${k}</td></tr>`

      for (var i in PAR[k]) {
        viz += `<tr><td ${tabstyle}>${i}</td><td ${tabstyle}>${fmt(PAR[k][i])}</td>`
        if (k.includes('olor')) {
          viz += `<td ${tabstyle}>` + `<div style='background-color:${hsv(...PAR[k][i])
          }'>&nbsp&nbsp&nbsp&nbsp&nbsp</div></td>`
        }
        viz += '</tr>'
      }
      viz += '</table><td>'

      if (cnt % 2 == 1) {
        viz += '</tr><tr>'
      }
      cnt += 1
    }
  }
  viz += '</tr></table>'
  viz += `</td></tr><tr><td align='left' ${tabstyle}></td></tr></table>`
  const graphs = document.createElement('div')
  for (var k in PAR) {
    if (typeof (PAR[k]) == 'function') {
      const lay = Layer.empty(100)
      lay.fillStyle = 'silver'
      for (var i = 0; i < 100; i++) {
        lay.fillRect(i, 100 - 100 * PAR[k](i / 100, 0.5), 2, 2)
      }
      lay.fillText(k, 2, 10)
      lay.canvas.style = 'border: 1px solid grey'
      graphs.appendChild(lay.canvas)
    }
  }
  // console.log(viz)
  div.innerHTML += viz
  div.lastChild.lastChild.lastChild.lastChild.appendChild(graphs)
  document.getElementById('summary').appendChild(div)
}

// generate random parameters
function genParams() {
  const randint = (x, y) => (Math.floor(normRand(x, y)))

  const PAR = {}

  const flowerShapeMask = x => (sin(PI * x) ** 0.2)
  const leafShapeMask = x => (sin(PI * x) ** 0.5)

  PAR.flowerChance = randChoice([normRand(0, 0.08), normRand(0, 0.03)])
  PAR.leafChance = randChoice([0, normRand(0, 0.1), normRand(0, 0.1)])
  PAR.leafType = randChoice([
    [1, randint(2, 5)],
    [2, randint(3, 7), randint(3, 8)],
    [2, randint(3, 7), randint(3, 8)],
  ])

  const flowerShapeNoiseSeed = Math.random() * PI
  const flowerJaggedness = normRand(0.5, 8)
  PAR.flowerShape = x => (Noise.noise(x * flowerJaggedness, flowerShapeNoiseSeed) * flowerShapeMask(x))

  const leafShapeNoiseSeed = Math.random() * PI
  const leafJaggedness = normRand(0.1, 40)
  const leafPointyness = normRand(0.5, 1.5)
  PAR.leafShape = randChoice([
    x => (Noise.noise(x * leafJaggedness, flowerShapeNoiseSeed) * leafShapeMask(x)),
    x => (sin(PI * x) ** leafPointyness),
  ])

  const flowerHue0 = (normRand(0, 180) - 130 + 360) % 360
  const flowerHue1 = Math.floor((flowerHue0 + normRand(-70, 70) + 360) % 360)
  const flowerValue0 = Math.min(1, normRand(0.5, 1.3))
  const flowerValue1 = Math.min(1, normRand(0.5, 1.3))
  const flowerSaturation0 = normRand(0, 1.1 - flowerValue0)
  const flowerSaturation1 = normRand(0, 1.1 - flowerValue1)

  PAR.flowerColor = { min: [flowerHue0, flowerSaturation0, flowerValue0, normRand(0.8, 1)], max: [flowerHue1, flowerSaturation1, flowerValue1, normRand(0.5, 1)] }
  PAR.leafColor = { min: [normRand(10, 200), normRand(0.05, 0.4), normRand(0.3, 0.7), normRand(0.8, 1)], max: [normRand(10, 200), normRand(0.05, 0.4), normRand(0.3, 0.7), normRand(0.8, 1)] }

  const curveCoeff0 = [normRand(-0.5, 0.5), normRand(5, 10)]
  const curveCoeff1 = [Math.random() * PI, normRand(1, 5)]

  const curveCoeff2 = [Math.random() * PI, normRand(5, 15)]
  const curveCoeff3 = [Math.random() * PI, normRand(1, 5)]
  const curveCoeff4 = [Math.random() * 0.5, normRand(0.8, 1.2)]

  PAR.flowerOpenCurve = randChoice([
    (x, op) => (
      (x < 0.1)
        ? 2 + op * curveCoeff2[1]
        : Noise.noise(x * 10, curveCoeff2[0])),
    (x, op) => (
      (x < curveCoeff4[0]) ? 0 : 10 - x * mapval(op, 0, 1, 16, 20) * curveCoeff4[1]
    ),
  ])

  PAR.flowerColorCurve = randChoice([
    x => (sigmoid(x + curveCoeff0[0], curveCoeff0[1])),
    // (x)=>(Noise.noise(x*curveCoeff1[1],curveCoeff1[0]))
  ])
  PAR.leafLength = normRand(30, 100)
  PAR.flowerLength = normRand(5, 55) //* (0.1-PAR.flowerChance)*10
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
  PAR.innerShape = x => (sin(PI * x) ** 1)
  const innerHue = normRand(0, 60)
  PAR.innerColor = { min: [innerHue, normRand(0.1, 0.7), normRand(0.5, 0.9), normRand(0.8, 1)], max: [innerHue, normRand(0.1, 0.7), normRand(0.5, 0.9), normRand(0.5, 1)] }

  PAR.branchWidth = normRand(0.4, 1.3)
  PAR.branchTwist = Math.round(normRand(2, 5))
  PAR.branchDepth = randChoice([3, 4])
  PAR.branchFork = randChoice([4, 5, 6, 7])

  const branchHue = normRand(30, 60)
  const branchSaturation = normRand(0.05, 0.3)
  const branchValue = normRand(0.7, 0.9)
  PAR.branchColor = { min: [branchHue, branchSaturation, branchValue, 1], max: [branchHue, branchSaturation, branchValue, 1] }

  console.log(PAR)

  vizParams(PAR)
  return PAR
}

// generate a woody plant
function woody(args) {
  var args = (args != undefined) ? args : {}
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const PAR = (args.PAR != undefined) ? args.PAR : genParams()

  const cwid = 1200
  const lay0 = Layer.empty(cwid)
  const lay1 = Layer.empty(cwid)

  const PL = branch({
    ctx: lay0,
    xof: cwid * 0.5,
    yof: cwid * 0.7,
    wid: PAR.branchWidth,
    twi: PAR.branchTwist,
    dep: PAR.branchDepth,
    col: PAR.branchColor,
    frk: PAR.branchFork,
  })

  for (var i = 0; i < PL.length; i++) {
    if (i / PL.length > 0.1) {
      for (let j = 0; j < PL[i][1].length; j++) {
        if (Math.random() < PAR.leafChance) {
          leaf({ ctx: lay0, xof: PL[i][1][j].x, yof: PL[i][1][j].y, len: PAR.leafLength * normRand(0.8, 1.2), vei: PAR.leafType, col: PAR.leafColor, rot: [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0], wid: x => (PAR.leafShape(x) * PAR.leafWidth), ben: x => ([
            mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * 5,
            0,
            mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 5,
          ]) })
        }

        if (Math.random() < PAR.flowerChance) {
          const hr = [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0]

          const P_ = stem({ ctx: lay0, xof: PL[i][1][j].x, yof: PL[i][1][j].y, rot: hr, len: PAR.pedicelLength, col: { min: [50, 1, 0.9, 1], max: [50, 1, 0.9, 1] }, wid: x => (sin(x * PI) * x * 2 + 1), ben: x => ([
            0,
            0,
            0,
          ]) })

          var op = Math.random()

          const r = grot(P_, -1)
          const hhr = r
          for (let k = 0; k < PAR.flowerPetal; k++) {
            leaf({ ctx: lay1, flo: true, xof: PL[i][1][j].x + P_[-1].x, yof: PL[i][1][j].y + P_[-1].y, rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2], len: PAR.flowerLength * normRand(0.7, 1.3), wid: x => (PAR.flowerShape(x) * PAR.flowerWidth), vei: [0], col: PAR.flowerColor, cof: PAR.flowerColorCurve, ben: x => ([
              PAR.flowerOpenCurve(x, op),
              0,
              0,
            ]) })

            leaf({ ctx: lay1, flo: true, xof: PL[i][1][j].x + P_[-1].x, yof: PL[i][1][j].y + P_[-1].y, rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2], len: PAR.innerLength * normRand(0.8, 1.2), wid: x => (sin(x * PI) * 4), vei: [0], col: PAR.innerColor, cof: x => (x), ben: x => ([
              PAR.flowerOpenCurve(x, op),
              0,
              0,
            ]) })
          }
        }
      }
    }
  }
  Layer.filter(lay0, Filter.fade)
  Layer.filter(lay0, Filter.wispy)
  Layer.filter(lay1, Filter.wispy)
  const b1 = Layer.bound(lay0)
  const b2 = Layer.bound(lay1)
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  }
  const xref = xof - (bd.xmin + bd.xmax) / 2
  const yref = yof - bd.ymax
  Layer.blit(ctx, lay0, { ble: 'multiply', xof: xref, yof: yref })
  Layer.blit(ctx, lay1, { ble: 'normal', xof: xref, yof: yref })
}

// generate a herbaceous plant
function herbal(args) {
  var args = (args != undefined) ? args : {}
  const ctx = (args.ctx != undefined) ? args.ctx : CTX
  const xof = (args.xof != undefined) ? args.xof : 0
  const yof = (args.yof != undefined) ? args.yof : 0
  const PAR = (args.PAR != undefined) ? args.PAR : genParams()

  const cwid = 1200
  const lay0 = Layer.empty(cwid)
  const lay1 = Layer.empty(cwid)

  const x0 = cwid * 0.5
  const y0 = cwid * 0.7

  for (var i = 0; i < PAR.stemCount; i++) {
    const r = [PI / 2, 0, normRand(-1, 1) * PI]
    const P = stem({ ctx: lay0, xof: x0, yof: y0, len: PAR.stemLength * normRand(0.7, 1.3), rot: r, wid: x => (PAR.stemWidth
      * (sin(x * PI / 2 + PI / 2) ** 0.5 * Noise.noise(x * 10) * 0.5 + 0.5)), ben: x => ([
      mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * x * PAR.stemBend,
      0,
      mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * x * PAR.stemBend,
    ]) })

    if (PAR.leafPosition == 2) {
      for (var j = 0; j < P.length; j++) {
        if (Math.random() < PAR.leafChance * 2) {
          leaf({ ctx: lay0, xof: x0 + P[j].x, yof: y0 + P[j].y, len: 2 * PAR.leafLength * normRand(0.8, 1.2), vei: PAR.leafType, col: PAR.leafColor, rot: [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * 0], wid: x => (2 * PAR.leafShape(x) * PAR.leafWidth), ben: x => ([
            mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * 5,
            0,
            mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 5,
          ]) })
        }
      }
    }

    const hr = grot(P, -1)
    if (PAR.sheathLength != 0) {
      stem({ ctx: lay0, xof: x0 + P[-1].x, yof: y0 + P[-1].y, rot: hr, len: PAR.sheathLength, col: { min: [60, 0.3, 0.9, 1], max: [60, 0.3, 0.9, 1] }, wid: x => PAR.sheathWidth * (sin(x * PI) ** 2 - x * 0.5 + 0.5), ben: x => ([0, 0, 0]
      ) })
    }
    for (var j = 0; j < Math.max(1, PAR.shootCount * normRand(0.5, 1.5)); j++) {
      const P_ = stem({ ctx: lay0, xof: x0 + P[-1].x, yof: y0 + P[-1].y, rot: hr, len: PAR.shootLength * normRand(0.5, 1.5), col: { min: [70, 0.2, 0.9, 1], max: [70, 0.2, 0.9, 1] }, wid: x => (2), ben: x => ([
        mapval(Noise.noise(x * 1, j), 0, 1, -1, 1) * x * 10,
        0,
        mapval(Noise.noise(x * 1, j + PI), 0, 1, -1, 1) * x * 10,
      ]) })
      var op = Math.random()
      const hhr = [normRand(-1, 1) * PI, normRand(-1, 1) * PI, normRand(-1, 1) * PI]
      for (let k = 0; k < PAR.flowerPetal; k++) {
        leaf({ ctx: lay1, flo: true, xof: x0 + P[-1].x + P_[-1].x, yof: y0 + P[-1].y + P_[-1].y, rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2], len: PAR.flowerLength * normRand(0.7, 1.3) * 1.5, wid: x => (1.5 * PAR.flowerShape(x) * PAR.flowerWidth), vei: [0], col: PAR.flowerColor, cof: PAR.flowerColorCurve, ben: x => ([
          PAR.flowerOpenCurve(x, op),
          0,
          0,
        ]) })

        leaf({ ctx: lay1, flo: true, xof: x0 + P[-1].x + P_[-1].x, yof: y0 + P[-1].y + P_[-1].y, rot: [hhr[0], hhr[1], hhr[2] + k / PAR.flowerPetal * PI * 2], len: PAR.innerLength * normRand(0.8, 1.2), wid: x => (sin(x * PI) * 4), vei: [0], col: PAR.innerColor, cof: x => (x), ben: x => ([
          PAR.flowerOpenCurve(x, op),
          0,
          0,
        ]) })
      }
    }
  }
  if (PAR.leafPosition == 1) {
    for (var i = 0; i < PAR.leafChance * 100; i++) {
      leaf({ ctx: lay0, xof: x0, yof: y0, rot: [PI / 3, 0, normRand(-1, 1) * PI], len: 4 * PAR.leafLength * normRand(0.8, 1.2), wid: x => (2 * PAR.leafShape(x) * PAR.leafWidth), vei: PAR.leafType, ben: x => ([
        mapval(Noise.noise(x * 1, i), 0, 1, -1, 1) * 10,
        0,
        mapval(Noise.noise(x * 1, i + PI), 0, 1, -1, 1) * 10,
      ]) })
    }
  }
  Layer.filter(lay0, Filter.fade)
  Layer.filter(lay0, Filter.wispy)
  Layer.filter(lay1, Filter.wispy)
  const b1 = Layer.bound(lay0)
  const b2 = Layer.bound(lay1)
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  }
  const xref = xof - (bd.xmin + bd.xmax) / 2
  const yref = yof - bd.ymax
  Layer.blit(ctx, lay0, { ble: 'multiply', xof: xref, yof: yref })
  Layer.blit(ctx, lay1, { ble: 'normal', xof: xref, yof: yref })
}
// collection of image filters
var Filter = new function () {
  this.wispy = function (x, y, r, g, b, a) {
    const n = Noise.noise(x * 0.2, y * 0.2)
    const m = Noise.noise(x * 0.5, y * 0.5, 2)
    return [r, g * mapval(m, 0, 1, 0.95, 1), b * mapval(m, 0, 1, 0.9, 1), a * mapval(n, 0, 1, 0.5, 1)]
  }
  this.fade = function (x, y, r, g, b, a) {
    const n = Noise.noise(x * 0.01, y * 0.01)
    return [r, g, b, a * Math.min(Math.max(mapval(n, 0, 1, 0, 1), 0), 1)]
  }
}()

// canvas context operations
var Layer = new function () {
  this.empty = function (w, h) {
    w = (w != undefined) ? w : 600
    h = (h != undefined) ? h : w
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    context = canvas.getContext('2d')
    return context
  }
  this.blit = function (ctx0, ctx1, args) {
    var args = (args != undefined) ? args : {}
    const ble = (args.ble != undefined) ? args.ble : 'normal'
    const xof = (args.xof != undefined) ? args.xof : 0
    const yof = (args.yof != undefined) ? args.yof : 0
    ctx0.globalCompositeOperation = ble
    ctx0.drawImage(ctx1.canvas, xof, yof)
  }
  this.filter = function (ctx, f) {
    const imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const pix = imgd.data
    for (let i = 0, n = pix.length; i < n; i += 4) {
      const [r, g, b, a] = pix.slice(i, i + 4)
      const x = (i / 4) % (ctx.canvas.width)
      const y = Math.floor((i / 4) / (ctx.canvas.width))
      const [r1, g1, b1, a1] = f(x, y, r, g, b, a)
      pix[i] = r1
      pix[i + 1] = g1
      pix[i + 2] = b1
      pix[i + 3] = a1
    }
    ctx.putImageData(imgd, 0, 0)
  }
  this.border = function (ctx, f) {
    const imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const pix = imgd.data
    for (let i = 0, n = pix.length; i < n; i += 4) {
      const [r, g, b, a] = pix.slice(i, i + 4)
      const x = (i / 4) % (ctx.canvas.width)
      const y = Math.floor((i / 4) / (ctx.canvas.width))

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
  }
  // find the dirty region - potentially optimizable
  this.bound = function (ctx) {
    let xmin = ctx.canvas.width
    let xmax = 0
    let ymin = ctx.canvas.height
    let ymax = 0
    const imgd = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const pix = imgd.data
    for (let i = 0, n = pix.length; i < n; i += 4) {
      const [r, g, b, a] = pix.slice(i, i + 4)
      const x = (i / 4) % (ctx.canvas.width)
      const y = Math.floor((i / 4) / (ctx.canvas.width))
      if (a > 0.001) {
        if (x < xmin) {
          xmin = x
        }
        if (x > xmax) {
          xmax = x
        }
        if (y < ymin) {
          ymin = y
        }
        if (y > ymax) {
          ymax = y
        }
      }
    }
    return { xmin, xmax, ymin, ymax }
  }
}()

CTX = Layer.empty()
let BGCANV

PAPER_COL0 = [1, 0.99, 0.9]
PAPER_COL1 = [0.98, 0.91, 0.74]

// download generated image
function makeDownload() {
  const down = document.createElement('a')
  down.innerHTML = '[Download]'
  down.addEventListener('click', function () {
    const ctx = Layer.empty()
    for (let i = 0; i < ctx.canvas.width; i += 512) {
      for (let j = 0; j < ctx.canvas.height; j += 512) {
        ctx.drawImage(BGCANV, i, j)
      }
    }
    ctx.drawImage(CTX.canvas, 0, 0)
    this.href = ctx.canvas.toDataURL()
    this.download = SEED
  }, false)
  document.body.appendChild(down)
  down.click()
  document.body.removeChild(down)
}

// toggle visibility of sub menus
function toggle(x, disp) {
  disp = (disp != undefined) ? disp : 'block'
  const alle = ['summary', 'settings', 'share']
  const d = document.getElementById(x).style.display
  for (let i = 0; i < alle.length; i++) {
    document.getElementById(alle[i]).style.display = 'none'
  }
  if (d == 'none') {
    document.getElementById(x).style.display = disp
  }
}

// fill HTML background with paper texture
function makeBG() {
  setTimeout(_makeBG, 10)
  function _makeBG() {
    BGCANV = paper({ col: PAPER_COL0, tex: 10, spr: 0 })
    const img = BGCANV.toDataURL('image/png')
    document.body.style.backgroundImage = `url(${img})`
  }
}

// generate new plant
function generate() {
  CTX = Layer.empty()
  CTX.fillStyle = 'white'
  CTX.fillRect(0, 0, CTX.canvas.width, CTX.canvas.height)
  // document.body.appendChild(CTX.canvas)
  const ppr = paper({ col: PAPER_COL1 })
  for (let i = 0; i < CTX.canvas.width; i += 512) {
    for (let j = 0; j < CTX.canvas.height; j += 512) {
      CTX.drawImage(ppr, i, j)
    }
  }
  if (Math.random() <= 0.5) {
    woody({ ctx: CTX, xof: 300, yof: 550 })
  } else {
    herbal({ ctx: CTX, xof: 300, yof: 600 })
  }
  Layer.border(CTX, squircle(0.98, 3))
}

// reload page with given seed
function reloadWSeed(s) {
  const u = window.location.href.split('?')[0]
  window.location.href = `${u}?seed=${s}`
}

// initialize everything
function load() {
  makeBG()
  setTimeout(_load, 100)
  function _load() {
    generate()
    document.getElementById('canvas-container').appendChild(CTX.canvas)
    document.getElementById('loader').style.display = 'none'
    document.getElementById('content').style.display = 'block'
    document.getElementById('inp-seed').value = SEED
    document.getElementById('share-twitter').href
      = `https://twitter.com/share?url=${
        window.location.href
      }&amp;text=${window.location.href};hashtags=nonflowers`
  }
}
