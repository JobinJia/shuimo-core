/**
 * WebGPU 笔触渲染器
 *
 * 使用 GPU 加速的毛笔笔触渲染
 */

import { prng } from "../foundation/random";

// 宽度函数类型
export enum WidthFuncType {
  Sin = 0, // 正弦波（默认毛笔效果）
  Linear = 1, // 线性递减
  Taper = 2, // 头粗尾细
  Flat = 3, // 均匀宽度
  Bulge = 4, // 中间粗两头细
}

// 路径点
export interface PathPoint {
  x: number;
  y: number;
  pressure?: number; // 压力 0-1
  velocity?: number; // 速度 0-1
}

// 笔触选项
export interface StrokeOptions {
  width?: number; // 笔宽
  color?: [number, number, number, number]; // RGBA 0-1
  noiseAmount?: number; // 噪声强度 0-1
  widthFunc?: WidthFuncType;
  softness?: number; // 边缘柔和度 0-1
  inkDensity?: number; // 墨色浓度 0-1
}

// Compute Shader
const strokeComputeShader = /* wgsl */ `
  struct StrokeParams {
    pointCount: u32,
    baseWidth: f32,
    noiseAmount: f32,
    seed: f32,
    color: vec4<f32>,
    widthFuncType: u32,
    time: f32,
    padding1: f32,
    padding2: f32,
  }

  struct PathPoint {
    x: f32,
    y: f32,
    pressure: f32,
    velocity: f32,
  }

  struct StrokeVertex {
    x: f32,
    y: f32,
    u: f32,
    v: f32,
    opacity: f32,
    side: f32,
    padding1: f32,
    padding2: f32,
  }

  @group(0) @binding(0) var<uniform> params: StrokeParams;
  @group(0) @binding(1) var<storage, read> pathPoints: array<PathPoint>;
  @group(0) @binding(2) var<storage, read_write> vertices: array<StrokeVertex>;
  @group(0) @binding(3) var<storage, read_write> indices: array<u32>;

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

  fn getWidthFunc(t: f32, funcType: u32) -> f32 {
    switch (funcType) {
      case 0u: { return sin(t * 3.14159265); }
      case 1u: { return 1.0 - t; }
      case 2u: { return pow(1.0 - t, 0.5); }
      case 3u: { return 1.0; }
      case 4u: { let x = t * 2.0 - 1.0; return 1.0 - x * x; }
      default: { return sin(t * 3.14159265); }
    }
  }

  @compute @workgroup_size(64)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.pointCount) { return; }

    let pointCount = params.pointCount;
    let t = f32(idx) / f32(pointCount - 1u);

    let curr = pathPoints[idx];
    var prevX: f32; var prevY: f32;
    var nextX: f32; var nextY: f32;

    if (idx == 0u) {
      prevX = curr.x; prevY = curr.y;
      let next = pathPoints[idx + 1u];
      nextX = next.x; nextY = next.y;
    } else if (idx == pointCount - 1u) {
      let prev = pathPoints[idx - 1u];
      prevX = prev.x; prevY = prev.y;
      nextX = curr.x; nextY = curr.y;
    } else {
      let prev = pathPoints[idx - 1u];
      let next = pathPoints[idx + 1u];
      prevX = prev.x; prevY = prev.y;
      nextX = next.x; nextY = next.y;
    }

    let dx = nextX - prevX;
    let dy = nextY - prevY;
    let len = sqrt(dx * dx + dy * dy);
    let tangentX = select(1.0, dx / len, len > 0.001);
    let tangentY = select(0.0, dy / len, len > 0.001);
    let normalX = -tangentY;
    let normalY = tangentX;

    var width = params.baseWidth * getWidthFunc(t, params.widthFuncType);
    width = width * (0.3 + curr.pressure * 0.7);
    width = width * (1.0 - curr.velocity * 0.3);

    let noiseVal = noise2D(vec2<f32>(f32(idx) * 0.5, params.seed));
    width = width * (1.0 - params.noiseAmount) + width * params.noiseAmount * (0.5 + noiseVal * 0.5);

    let leftX = curr.x + normalX * width;
    let leftY = curr.y + normalY * width;
    let rightX = curr.x - normalX * width;
    let rightY = curr.y - normalY * width;

    let edgeFade = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.9, t);

    let vertexIdx = idx * 2u;
    vertices[vertexIdx] = StrokeVertex(leftX, leftY, t, 0.0, edgeFade, -1.0, 0.0, 0.0);
    vertices[vertexIdx + 1u] = StrokeVertex(rightX, rightY, t, 1.0, edgeFade, 1.0, 0.0, 0.0);

    if (idx < pointCount - 1u) {
      let indexIdx = idx * 6u;
      let v0 = vertexIdx;
      let v1 = vertexIdx + 1u;
      let v2 = vertexIdx + 2u;
      let v3 = vertexIdx + 3u;
      indices[indexIdx + 0u] = v0;
      indices[indexIdx + 1u] = v1;
      indices[indexIdx + 2u] = v2;
      indices[indexIdx + 3u] = v2;
      indices[indexIdx + 4u] = v1;
      indices[indexIdx + 5u] = v3;
    }
  }
`;

// Render Shader
const strokeRenderShader = /* wgsl */ `
  struct RenderParams {
    viewProj: mat4x4<f32>,
    color: vec4<f32>,
    softness: f32,
    inkDensity: f32,
    canvasWidth: f32,
    canvasHeight: f32,
  }

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

  @group(0) @binding(0) var<uniform> params: RenderParams;

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;

    // 转换到 NDC 坐标
    let x = (input.position.x / params.canvasWidth) * 2.0 - 1.0;
    let y = 1.0 - (input.position.y / params.canvasHeight) * 2.0;

    output.clipPosition = vec4<f32>(x, y, 0.0, 1.0);
    output.uv = input.uv;
    output.opacity = input.opacity;
    output.side = input.side;

    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let edgeDist = abs(input.side);
    let edgeFade = 1.0 - smoothstep(1.0 - params.softness, 1.0, edgeDist);
    let alpha = input.opacity * edgeFade * params.inkDensity;
    let inkColor = params.color.rgb * (0.8 + edgeFade * 0.2);
    return vec4<f32>(inkColor, alpha * params.color.a);
  }
`;

/**
 * WebGPU 笔触渲染器
 */
export class StrokeRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;

  private paramsBuffer: GPUBuffer | null = null;
  private pathBuffer: GPUBuffer | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private renderParamsBuffer: GPUBuffer | null = null;

  private computeBindGroup: GPUBindGroup | null = null;
  private renderBindGroup: GPUBindGroup | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private maxPoints = 1000; // 最大路径点数

  private isInitialized = false;
  private seed = prng.random() * 1000;

  /**
   * 初始化渲染器
   */
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.gpu) {
      console.error("WebGPU 不支持");
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error("无法获取 GPU adapter");
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = canvas.getContext("webgpu");

    if (!this.context) {
      console.error("无法获取 WebGPU context");
      return false;
    }

    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    await this.createBuffers();
    await this.createPipelines();

    this.isInitialized = true;
    return true;
  }

  /**
   * 创建缓冲区
   */
  private async createBuffers(): Promise<void> {
    if (!this.device) return;

    // Compute 参数 (48 bytes, 对齐到 16)
    this.paramsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 路径点缓冲区
    this.pathBuffer = this.device.createBuffer({
      size: this.maxPoints * 16, // 4 floats per point
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 顶点缓冲区 (每个点生成 2 个顶点)
    this.vertexBuffer = this.device.createBuffer({
      size: this.maxPoints * 2 * 32, // 8 floats per vertex
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // 索引缓冲区 (每个线段 6 个索引)
    this.indexBuffer = this.device.createBuffer({
      size: this.maxPoints * 6 * 4, // u32
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    // 渲染参数
    this.renderParamsBuffer = this.device.createBuffer({
      size: 96, // mat4 + vec4 + 4 floats
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * 创建管线
   */
  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    // Compute 管线
    const computeModule = this.device.createShaderModule({
      code: strokeComputeShader,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: computeModule,
        entryPoint: "main",
      },
    });

    // Render 管线
    const renderModule = this.device.createShaderModule({
      code: strokeRenderShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderModule,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" }, // position
              { shaderLocation: 1, offset: 8, format: "float32x2" }, // uv
              { shaderLocation: 2, offset: 16, format: "float32" }, // opacity
              { shaderLocation: 3, offset: 20, format: "float32" }, // side
            ],
          },
        ],
      },
      fragment: {
        module: renderModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  /**
   * 绘制笔触
   */
  drawStroke(points: PathPoint[], options: StrokeOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context) return;
    if (points.length < 2) return;

    const {
      width = 5,
      color = [0.1, 0.1, 0.12, 1.0],
      noiseAmount = 0.3,
      widthFunc = WidthFuncType.Sin,
      softness = 0.3,
      inkDensity = 0.9,
    } = options;

    const pointCount = Math.min(points.length, this.maxPoints);

    // 准备路径数据
    const pathData = new Float32Array(pointCount * 4);
    for (let i = 0; i < pointCount; i++) {
      const p = points[i];
      pathData[i * 4 + 0] = p.x;
      pathData[i * 4 + 1] = p.y;
      pathData[i * 4 + 2] = p.pressure ?? 1.0;
      pathData[i * 4 + 3] = p.velocity ?? 0.0;
    }
    this.device.queue.writeBuffer(this.pathBuffer!, 0, pathData);

    // 更新 compute 参数
    const computeParams = new Float32Array([
      pointCount, // pointCount (as float, will be cast to u32)
      width, // baseWidth
      noiseAmount, // noiseAmount
      this.seed++, // seed
      ...color, // color RGBA
      widthFunc, // widthFuncType
      0, // time
      0,
      0, // padding
    ]);
    // 需要单独处理 u32
    const paramsView = new DataView(new ArrayBuffer(48));
    paramsView.setUint32(0, pointCount, true);
    paramsView.setFloat32(4, width, true);
    paramsView.setFloat32(8, noiseAmount, true);
    paramsView.setFloat32(12, this.seed, true);
    paramsView.setFloat32(16, color[0], true);
    paramsView.setFloat32(20, color[1], true);
    paramsView.setFloat32(24, color[2], true);
    paramsView.setFloat32(28, color[3], true);
    paramsView.setUint32(32, widthFunc, true);
    paramsView.setFloat32(36, 0, true);
    paramsView.setFloat32(40, 0, true);
    paramsView.setFloat32(44, 0, true);

    this.device.queue.writeBuffer(this.paramsBuffer!, 0, new Uint8Array(paramsView.buffer));

    // 更新渲染参数
    const renderParams = new Float32Array([
      // viewProj (identity)
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      // color
      ...color,
      // softness, inkDensity, canvasWidth, canvasHeight
      softness,
      inkDensity,
      this.canvasWidth,
      this.canvasHeight,
    ]);
    this.device.queue.writeBuffer(this.renderParamsBuffer!, 0, renderParams);

    // 创建 bind groups
    this.computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer! } },
        { binding: 1, resource: { buffer: this.pathBuffer! } },
        { binding: 2, resource: { buffer: this.vertexBuffer! } },
        { binding: 3, resource: { buffer: this.indexBuffer! } },
      ],
    });

    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline!.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.renderParamsBuffer! } }],
    });

    // 执行 compute
    const commandEncoder = this.device.createCommandEncoder();

    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline!);
    computePass.setBindGroup(0, this.computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(pointCount / 64));
    computePass.end();

    // 执行 render
    const textureView = this.context.getCurrentTexture().createView();
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: "load",
          storeOp: "store",
        },
      ],
    });

    renderPass.setPipeline(this.renderPipeline!);
    renderPass.setBindGroup(0, this.renderBindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer!);
    renderPass.setIndexBuffer(this.indexBuffer!, "uint32");
    renderPass.drawIndexed((pointCount - 1) * 6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 清空画布
   */
  clear(color: [number, number, number, number] = [0.96, 0.94, 0.9, 1.0]): void {
    if (!this.device || !this.context) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: color[0], g: color[1], b: color[2], a: color[3] },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.paramsBuffer?.destroy();
    this.pathBuffer?.destroy();
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.renderParamsBuffer?.destroy();

    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

export default StrokeRenderer;
