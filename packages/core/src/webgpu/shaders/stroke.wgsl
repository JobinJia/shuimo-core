// ============================================================================
// GPU 笔触渲染 Shader
// 实现可变宽度的毛笔笔画效果
// ============================================================================

// 导入噪声函数（通过预处理器或直接包含）
// 这里假设噪声函数已经可用

// ----------------------------------------------------------------------------
// 结构体定义
// ----------------------------------------------------------------------------

struct StrokeParams {
  pointCount: u32,           // 路径点数量
  baseWidth: f32,            // 基础笔宽
  noiseAmount: f32,          // 噪声强度 0-1
  seed: f32,                 // 随机种子
  color: vec4<f32>,          // 笔触颜色 RGBA
  widthFuncType: u32,        // 宽度函数类型
  time: f32,                 // 时间（用于动画）
  padding: f32,
}

struct PathPoint {
  position: vec2<f32>,
  pressure: f32,             // 压力值 0-1
  velocity: f32,             // 速度（影响墨量）
}

struct StrokeVertex {
  position: vec2<f32>,
  uv: vec2<f32>,
  opacity: f32,
  side: f32,                 // -1 左侧, +1 右侧
}

// ----------------------------------------------------------------------------
// Bindings
// ----------------------------------------------------------------------------

@group(0) @binding(0) var<uniform> params: StrokeParams;
@group(0) @binding(1) var<storage, read> pathPoints: array<PathPoint>;
@group(0) @binding(2) var<storage, read_write> vertices: array<StrokeVertex>;
@group(0) @binding(3) var<storage, read_write> indices: array<u32>;

// ----------------------------------------------------------------------------
// 噪声函数（简化版，完整版在 noise.wgsl）
// ----------------------------------------------------------------------------

fn hash(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.13);
  p3 = p3 + dot(p3, p3.yzx + vec3<f32>(3.333));
  return fract((p3.x + p3.y) * p3.z);
}

fn noise2D(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);

  let a = hash(i);
  let b = hash(i + vec2<f32>(1.0, 0.0));
  let c = hash(i + vec2<f32>(0.0, 1.0));
  let d = hash(i + vec2<f32>(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 2.0 - 1.0;
}

// ----------------------------------------------------------------------------
// 宽度函数
// ----------------------------------------------------------------------------

// 正弦波（默认毛笔效果）
fn widthFuncSin(t: f32) -> f32 {
  return sin(t * 3.14159265);
}

// 线性递减（收笔）
fn widthFuncLinear(t: f32) -> f32 {
  return 1.0 - t;
}

// 头粗尾细
fn widthFuncTaper(t: f32) -> f32 {
  return pow(1.0 - t, 0.5);
}

// 均匀宽度
fn widthFuncFlat(t: f32) -> f32 {
  return 1.0;
}

// 中间粗两头细
fn widthFuncBulge(t: f32) -> f32 {
  let x = t * 2.0 - 1.0;
  return 1.0 - x * x;
}

fn getWidthFunc(t: f32, funcType: u32) -> f32 {
  switch (funcType) {
    case 0u: { return widthFuncSin(t); }
    case 1u: { return widthFuncLinear(t); }
    case 2u: { return widthFuncTaper(t); }
    case 3u: { return widthFuncFlat(t); }
    case 4u: { return widthFuncBulge(t); }
    default: { return widthFuncSin(t); }
  }
}

// ----------------------------------------------------------------------------
// Compute Shader: 生成笔触几何
// ----------------------------------------------------------------------------

@compute @workgroup_size(64)
fn generateStrokeGeometry(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;

  if (idx >= params.pointCount) {
    return;
  }

  let pointCount = params.pointCount;
  let t = f32(idx) / f32(pointCount - 1u);

  // 获取当前点和相邻点
  let curr = pathPoints[idx];
  var prev: PathPoint;
  var next: PathPoint;

  if (idx == 0u) {
    prev = curr;
    next = pathPoints[idx + 1u];
  } else if (idx == pointCount - 1u) {
    prev = pathPoints[idx - 1u];
    next = curr;
  } else {
    prev = pathPoints[idx - 1u];
    next = pathPoints[idx + 1u];
  }

  // 计算切线方向
  let tangent = normalize(next.position - prev.position);
  let normal = vec2<f32>(-tangent.y, tangent.x);

  // 计算宽度
  var width = params.baseWidth * getWidthFunc(t, params.widthFuncType);

  // 应用压力
  width = width * (0.3 + curr.pressure * 0.7);

  // 应用速度（快速笔画更细）
  width = width * (1.0 - curr.velocity * 0.3);

  // 应用噪声
  let noiseVal = noise2D(vec2<f32>(f32(idx) * 0.5, params.seed));
  width = width * (1.0 - params.noiseAmount) + width * params.noiseAmount * (0.5 + noiseVal * 0.5);

  // 计算两侧顶点
  let leftPos = curr.position + normal * width;
  let rightPos = curr.position - normal * width;

  // 计算透明度（边缘渐变）
  let edgeFade = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.9, t);

  // 存储顶点
  let vertexIdx = idx * 2u;

  vertices[vertexIdx] = StrokeVertex(
    leftPos,
    vec2<f32>(t, 0.0),
    edgeFade,
    -1.0
  );

  vertices[vertexIdx + 1u] = StrokeVertex(
    rightPos,
    vec2<f32>(t, 1.0),
    edgeFade,
    1.0
  );

  // 生成三角形索引（除了最后一个点）
  if (idx < pointCount - 1u) {
    let indexIdx = idx * 6u;
    let v0 = vertexIdx;
    let v1 = vertexIdx + 1u;
    let v2 = vertexIdx + 2u;
    let v3 = vertexIdx + 3u;

    // 两个三角形组成一个四边形
    indices[indexIdx + 0u] = v0;
    indices[indexIdx + 1u] = v1;
    indices[indexIdx + 2u] = v2;

    indices[indexIdx + 3u] = v2;
    indices[indexIdx + 4u] = v1;
    indices[indexIdx + 5u] = v3;
  }
}

// ----------------------------------------------------------------------------
// Vertex Shader: 渲染笔触
// ----------------------------------------------------------------------------

struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) opacity: f32,
  @location(3) side: f32,
}

struct VertexOutput {
  @builtin(position) clipPosition: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) opacity: f32,
  @location(2) side: f32,
}

struct RenderParams {
  viewMatrix: mat4x4<f32>,
  projMatrix: mat4x4<f32>,
  color: vec4<f32>,
  softness: f32,            // 边缘柔和度
  inkDensity: f32,          // 墨色浓度
  paperInfluence: f32,      // 纸张影响
  padding: f32,
}

@group(0) @binding(0) var<uniform> renderParams: RenderParams;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;

  let worldPos = vec4<f32>(input.position, 0.0, 1.0);
  output.clipPosition = renderParams.projMatrix * renderParams.viewMatrix * worldPos;
  output.uv = input.uv;
  output.opacity = input.opacity;
  output.side = input.side;

  return output;
}

// ----------------------------------------------------------------------------
// Fragment Shader: 渲染墨色
// ----------------------------------------------------------------------------

@group(0) @binding(1) var paperTexture: texture_2d<f32>;
@group(0) @binding(2) var paperSampler: sampler;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  // 边缘柔和
  let edgeDist = abs(input.side);
  let edgeFade = 1.0 - smoothstep(0.7, 1.0, edgeDist);

  // 采样纸张纹理
  let paperCoord = input.uv * 10.0; // 缩放纹理坐标
  let paperSample = textureSample(paperTexture, paperSampler, paperCoord);
  let paperEffect = mix(1.0, paperSample.r, renderParams.paperInfluence);

  // 计算最终透明度
  var alpha = input.opacity * edgeFade * paperEffect;
  alpha = alpha * renderParams.inkDensity;

  // 墨色变化（边缘更淡）
  let inkColor = mix(
    renderParams.color.rgb * 0.7,  // 边缘淡色
    renderParams.color.rgb,         // 中心浓色
    edgeFade
  );

  return vec4<f32>(inkColor, alpha * renderParams.color.a);
}

// ----------------------------------------------------------------------------
// 简化版 Fragment Shader（无纸张纹理）
// ----------------------------------------------------------------------------

@fragment
fn fragmentMainSimple(input: VertexOutput) -> @location(0) vec4<f32> {
  // 边缘柔和
  let edgeDist = abs(input.side);
  let edgeFade = 1.0 - smoothstep(0.6, 1.0, edgeDist);

  // 沿路径的渐变
  let pathFade = input.opacity;

  // 计算最终透明度
  let alpha = pathFade * edgeFade * renderParams.inkDensity;

  // 墨色
  let inkColor = renderParams.color.rgb * (0.8 + edgeFade * 0.2);

  return vec4<f32>(inkColor, alpha * renderParams.color.a);
}
