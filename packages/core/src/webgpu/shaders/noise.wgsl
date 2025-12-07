// ============================================================================
// GPU 噪声函数库
// 包含 Simplex 2D/3D, Perlin 2D/3D, FBM, Worley 噪声
// ============================================================================

// ----------------------------------------------------------------------------
// 工具函数
// ----------------------------------------------------------------------------

fn mod289_3(x: vec3<f32>) -> vec3<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_4(x: vec4<f32>) -> vec4<f32> {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn mod289_f(x: f32) -> f32 {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

fn permute_3(x: vec3<f32>) -> vec3<f32> {
  return mod289_3(((x * 34.0) + 1.0) * x);
}

fn permute_4(x: vec4<f32>) -> vec4<f32> {
  return mod289_4(((x * 34.0) + 1.0) * x);
}

fn permute_f(x: f32) -> f32 {
  return mod289_f(((x * 34.0) + 1.0) * x);
}

fn taylorInvSqrt_4(r: vec4<f32>) -> vec4<f32> {
  return 1.79284291400159 - 0.85373472095314 * r;
}

fn taylorInvSqrt_f(r: f32) -> f32 {
  return 1.79284291400159 - 0.85373472095314 * r;
}

// ----------------------------------------------------------------------------
// Simplex 2D 噪声
// 返回值范围 [-1, 1]
// ----------------------------------------------------------------------------

fn simplex2D(v: vec2<f32>) -> f32 {
  let C = vec4<f32>(
    0.211324865405187,   // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,   // 0.5 * (sqrt(3.0) - 1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439    // 1.0 / 41.0
  );

  // 第一个角
  var i = floor(v + dot(v, vec2<f32>(C.y, C.y)));
  let x0 = v - i + dot(i, vec2<f32>(C.x, C.x));

  // 其他角
  var i1: vec2<f32>;
  if (x0.x > x0.y) {
    i1 = vec2<f32>(1.0, 0.0);
  } else {
    i1 = vec2<f32>(0.0, 1.0);
  }

  var x12 = x0.xyxy + C.xxzz;
  x12 = vec4<f32>(x12.xy - i1, x12.zw);

  // 排列
  i = i - floor(i * (1.0 / 289.0)) * 289.0;
  let p = permute_3(permute_3(i.y + vec3<f32>(0.0, i1.y, 1.0)) + i.x + vec3<f32>(0.0, i1.x, 1.0));

  var m = max(0.5 - vec3<f32>(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3<f32>(0.0));
  m = m * m;
  m = m * m;

  // 梯度
  let x = 2.0 * fract(p * C.www) - 1.0;
  let h = abs(x) - 0.5;
  let ox = floor(x + 0.5);
  let a0 = x - ox;

  // 归一化梯度
  m = m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h));

  // 计算最终噪声值
  let g = vec3<f32>(
    a0.x * x0.x + h.x * x0.y,
    a0.y * x12.x + h.y * x12.y,
    a0.z * x12.z + h.z * x12.w
  );

  return 130.0 * dot(m, g);
}

// ----------------------------------------------------------------------------
// Simplex 3D 噪声
// 返回值范围 [-1, 1]
// ----------------------------------------------------------------------------

fn simplex3D(v: vec3<f32>) -> f32 {
  let C = vec2<f32>(1.0 / 6.0, 1.0 / 3.0);
  let D = vec4<f32>(0.0, 0.5, 1.0, 2.0);

  // 第一个角
  var i = floor(v + dot(v, vec3<f32>(C.y, C.y, C.y)));
  let x0 = v - i + dot(i, vec3<f32>(C.x, C.x, C.x));

  // 其他角
  let g = step(x0.yzx, x0.xyz);
  let l = 1.0 - g;
  let i1 = min(g.xyz, l.zxy);
  let i2 = max(g.xyz, l.zxy);

  let x1 = x0 - i1 + C.xxx;
  let x2 = x0 - i2 + C.yyy;
  let x3 = x0 - D.yyy;

  // 排列
  i = i - floor(i * (1.0 / 289.0)) * 289.0;
  let p = permute_4(permute_4(permute_4(
    i.z + vec4<f32>(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4<f32>(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4<f32>(0.0, i1.x, i2.x, 1.0));

  // 梯度
  let n_ = 0.142857142857;
  let ns = n_ * D.wyz - D.xzx;

  let j = p - 49.0 * floor(p * ns.z * ns.z);

  let x_ = floor(j * ns.z);
  let y_ = floor(j - 7.0 * x_);

  let x = x_ * ns.x + ns.yyyy;
  let y = y_ * ns.x + ns.yyyy;
  let h = 1.0 - abs(x) - abs(y);

  let b0 = vec4<f32>(x.xy, y.xy);
  let b1 = vec4<f32>(x.zw, y.zw);

  let s0 = floor(b0) * 2.0 + 1.0;
  let s1 = floor(b1) * 2.0 + 1.0;
  let sh = -step(h, vec4<f32>(0.0));

  let a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  let a1 = b1.xzyw + s1.xzyw * sh.zzww;

  var p0 = vec3<f32>(a0.xy, h.x);
  var p1 = vec3<f32>(a0.zw, h.y);
  var p2 = vec3<f32>(a1.xy, h.z);
  var p3 = vec3<f32>(a1.zw, h.w);

  // 归一化梯度
  let norm = taylorInvSqrt_4(vec4<f32>(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 = p0 * norm.x;
  p1 = p1 * norm.y;
  p2 = p2 * norm.z;
  p3 = p3 * norm.w;

  // 混合
  var m = max(0.6 - vec4<f32>(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), vec4<f32>(0.0));
  m = m * m;

  return 42.0 * dot(m * m, vec4<f32>(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ----------------------------------------------------------------------------
// Perlin 2D 噪声（经典实现）
// 返回值范围 [-1, 1]
// ----------------------------------------------------------------------------

fn hash2D(p: vec2<f32>) -> vec2<f32> {
  let k = vec2<f32>(0.3183099, 0.3678794);
  var pp = p * k + k.yx;
  return -1.0 + 2.0 * fract(16.0 * k * fract(pp.x * pp.y * (pp.x + pp.y)));
}

fn perlin2D(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);

  // 平滑插值
  let u = f * f * (3.0 - 2.0 * f);

  // 四个角的梯度
  let a = dot(hash2D(i + vec2<f32>(0.0, 0.0)), f - vec2<f32>(0.0, 0.0));
  let b = dot(hash2D(i + vec2<f32>(1.0, 0.0)), f - vec2<f32>(1.0, 0.0));
  let c = dot(hash2D(i + vec2<f32>(0.0, 1.0)), f - vec2<f32>(0.0, 1.0));
  let d = dot(hash2D(i + vec2<f32>(1.0, 1.0)), f - vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// ----------------------------------------------------------------------------
// Perlin 3D 噪声
// 返回值范围 [-1, 1]
// ----------------------------------------------------------------------------

fn hash3D(p: vec3<f32>) -> vec3<f32> {
  var pp = vec3<f32>(
    dot(p, vec3<f32>(127.1, 311.7, 74.7)),
    dot(p, vec3<f32>(269.5, 183.3, 246.1)),
    dot(p, vec3<f32>(113.5, 271.9, 124.6))
  );
  return -1.0 + 2.0 * fract(sin(pp) * 43758.5453123);
}

fn perlin3D(p: vec3<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);

  // 平滑插值
  let u = f * f * (3.0 - 2.0 * f);

  // 八个角的梯度
  let n000 = dot(hash3D(i + vec3<f32>(0.0, 0.0, 0.0)), f - vec3<f32>(0.0, 0.0, 0.0));
  let n100 = dot(hash3D(i + vec3<f32>(1.0, 0.0, 0.0)), f - vec3<f32>(1.0, 0.0, 0.0));
  let n010 = dot(hash3D(i + vec3<f32>(0.0, 1.0, 0.0)), f - vec3<f32>(0.0, 1.0, 0.0));
  let n110 = dot(hash3D(i + vec3<f32>(1.0, 1.0, 0.0)), f - vec3<f32>(1.0, 1.0, 0.0));
  let n001 = dot(hash3D(i + vec3<f32>(0.0, 0.0, 1.0)), f - vec3<f32>(0.0, 0.0, 1.0));
  let n101 = dot(hash3D(i + vec3<f32>(1.0, 0.0, 1.0)), f - vec3<f32>(1.0, 0.0, 1.0));
  let n011 = dot(hash3D(i + vec3<f32>(0.0, 1.0, 1.0)), f - vec3<f32>(0.0, 1.0, 1.0));
  let n111 = dot(hash3D(i + vec3<f32>(1.0, 1.0, 1.0)), f - vec3<f32>(1.0, 1.0, 1.0));

  // 三线性插值
  let nx00 = mix(n000, n100, u.x);
  let nx10 = mix(n010, n110, u.x);
  let nx01 = mix(n001, n101, u.x);
  let nx11 = mix(n011, n111, u.x);

  let nxy0 = mix(nx00, nx10, u.y);
  let nxy1 = mix(nx01, nx11, u.y);

  return mix(nxy0, nxy1, u.z);
}

// ----------------------------------------------------------------------------
// FBM (Fractional Brownian Motion) - 分形噪声
// ----------------------------------------------------------------------------

fn fbm2D(p: vec2<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  var pp = p;

  for (var i = 0; i < octaves; i = i + 1) {
    value = value + amplitude * simplex2D(pp * frequency);
    frequency = frequency * lacunarity;
    amplitude = amplitude * gain;
  }

  return value;
}

fn fbm3D(p: vec3<f32>, octaves: i32, lacunarity: f32, gain: f32) -> f32 {
  var value = 0.0;
  var amplitude = 0.5;
  var frequency = 1.0;
  var pp = p;

  for (var i = 0; i < octaves; i = i + 1) {
    value = value + amplitude * simplex3D(pp * frequency);
    frequency = frequency * lacunarity;
    amplitude = amplitude * gain;
  }

  return value;
}

// ----------------------------------------------------------------------------
// Worley 噪声 (Cellular/Voronoi)
// 返回到最近特征点的距离
// ----------------------------------------------------------------------------

fn random2(p: vec2<f32>) -> vec2<f32> {
  return fract(sin(vec2<f32>(
    dot(p, vec2<f32>(127.1, 311.7)),
    dot(p, vec2<f32>(269.5, 183.3))
  )) * 43758.5453);
}

fn worley2D(p: vec2<f32>, jitter: f32) -> f32 {
  let n = floor(p);
  let f = fract(p);

  var minDist = 1.0;

  for (var j = -1; j <= 1; j = j + 1) {
    for (var i = -1; i <= 1; i = i + 1) {
      let neighbor = vec2<f32>(f32(i), f32(j));
      let point = random2(n + neighbor) * jitter;
      let diff = neighbor + point - f;
      let dist = length(diff);
      minDist = min(minDist, dist);
    }
  }

  return minDist;
}

// 返回两个最近距离（用于边缘检测）
fn worley2D_F1F2(p: vec2<f32>, jitter: f32) -> vec2<f32> {
  let n = floor(p);
  let f = fract(p);

  var minDist1 = 1.0;
  var minDist2 = 1.0;

  for (var j = -1; j <= 1; j = j + 1) {
    for (var i = -1; i <= 1; i = i + 1) {
      let neighbor = vec2<f32>(f32(i), f32(j));
      let point = random2(n + neighbor) * jitter;
      let diff = neighbor + point - f;
      let dist = length(diff);

      if (dist < minDist1) {
        minDist2 = minDist1;
        minDist1 = dist;
      } else if (dist < minDist2) {
        minDist2 = dist;
      }
    }
  }

  return vec2<f32>(minDist1, minDist2);
}

// ----------------------------------------------------------------------------
// 域扭曲 (Domain Warping)
// 用于创建更复杂的纹理效果
// ----------------------------------------------------------------------------

fn domainWarp2D(p: vec2<f32>, strength: f32, octaves: i32) -> vec2<f32> {
  let q = vec2<f32>(
    fbm2D(p, octaves, 2.0, 0.5),
    fbm2D(p + vec2<f32>(5.2, 1.3), octaves, 2.0, 0.5)
  );

  return p + strength * q;
}

// ----------------------------------------------------------------------------
// 纸张纹理噪声
// 组合多种噪声模拟宣纸纤维
// ----------------------------------------------------------------------------

fn paperTexture(p: vec2<f32>, seed: f32) -> f32 {
  // 大尺度纤维方向
  let fiber1 = fbm2D(p * 0.01 + vec2<f32>(seed, 0.0), 3, 2.0, 0.5);

  // 中尺度纤维纹理
  let fiber2 = fbm2D(p * 0.03 + vec2<f32>(0.0, seed), 4, 2.0, 0.5);

  // 小尺度颗粒
  let grain = simplex2D(p * 0.1 + vec2<f32>(seed * 0.5, seed * 0.3));

  // 组合
  return fiber1 * 0.5 + fiber2 * 0.35 + grain * 0.15;
}

// ----------------------------------------------------------------------------
// 墨水扩散噪声
// 模拟墨水在纸上渗透的不均匀性
// ----------------------------------------------------------------------------

fn inkSpreadNoise(p: vec2<f32>, time: f32) -> f32 {
  // 基础扩散
  let base = fbm2D(p * 0.02, 4, 2.0, 0.5);

  // 时间变化的扰动
  let temporal = simplex3D(vec3<f32>(p * 0.05, time * 0.1));

  // Worley 边缘
  let edge = worley2D(p * 0.03, 0.8);

  return base * 0.6 + temporal * 0.25 + (1.0 - edge) * 0.15;
}
