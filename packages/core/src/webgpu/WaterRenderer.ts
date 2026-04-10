/**
 * WebGPU 水面渲染器
 *
 * 使用 GPU 加速渲染水墨风格的水面波纹效果
 */

import { prng } from "../foundation/random";

export interface WaterOptions {
  /** 波高 */
  waveHeight?: number;
  /** 水面长度 */
  length?: number;
  /** 波簇数量 */
  clusters?: number;
  /** 波浪密度 */
  density?: number;
  /** 墨色浓度 0-1 */
  inkDensity?: number;
  /** 随机种子 */
  seed?: number;
  /** 动画时间 */
  time?: number;
}

// 水面生成和渲染 Shader
const waterShader = /* wgsl */ `
  struct WaterParams {
    centerX: f32,
    centerY: f32,
    length: f32,
    waveHeight: f32,
    clusters: u32,
    density: f32,
    inkDensity: f32,
    seed: f32,
    time: f32,
    strokeCount: u32,
    canvasWidth: f32,
    canvasHeight: f32,
  }

  struct WaterStroke {
    x1: f32, y1: f32,
    x2: f32, y2: f32,
    width: f32,
    opacity: f32,
    curve: f32,  // 曲率
    padding: f32,
  }

  @group(0) @binding(0) var<uniform> params: WaterParams;
  @group(0) @binding(1) var<storage, read_write> strokes: array<WaterStroke>;

  // 简化的噪声函数
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

  // 生成水面波纹
  @compute @workgroup_size(64)
  fn generateWater(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.strokeCount) { return; }

    let clusterIdx = idx / u32(params.density);
    let strokeInCluster = idx % u32(params.density);

    // 每个波簇的基础位置
    let clusterT = f32(clusterIdx) / f32(params.clusters);
    let baseX = params.centerX - params.length * 0.5 + clusterT * params.length;

    // 波纹长度和位置变化
    let noise1 = noise2D(vec2<f32>(f32(idx) * 0.1, params.seed));
    let noise2 = noise2D(vec2<f32>(params.seed, f32(idx) * 0.15));

    // 计算波纹起始和结束位置
    let strokeLen = 20.0 + noise1 * 30.0;
    let yOffset = sin(f32(strokeInCluster) * 0.5) * params.waveHeight * 0.5;
    let yNoise = noise2 * params.waveHeight;

    let x1 = baseX + noise1 * 20.0;
    let y1 = params.centerY + yOffset + yNoise + f32(strokeInCluster) * 3.0;
    let x2 = x1 + strokeLen;
    let y2 = y1 + sin(f32(idx) * 0.3 + params.time) * 2.0;

    // 笔触宽度（远处更细）
    let distFromCenter = abs(clusterT - 0.5) * 2.0;
    let width = (1.5 - distFromCenter * 0.5) * (0.8 + noise1 * 0.4);

    // 透明度
    let opacity = params.inkDensity * (0.3 + noise2 * 0.4) * (1.0 - distFromCenter * 0.3);

    // 曲率
    let curve = noise2 * 0.3;

    strokes[idx] = WaterStroke(x1, y1, x2, y2, width, opacity, curve, 0.0);
  }

  // 顶点结构
  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) opacity: f32,
    @location(1) uv: f32,
  }

  struct StrokeVertex {
    @location(0) pos: vec2<f32>,
    @location(1) opacity: f32,
    @location(2) uv: f32,
  }

  @vertex
  fn vertexMain(input: StrokeVertex) -> VertexOutput {
    var output: VertexOutput;
    let x = (input.pos.x / params.canvasWidth) * 2.0 - 1.0;
    let y = 1.0 - (input.pos.y / params.canvasHeight) * 2.0;
    output.position = vec4<f32>(x, y, 0.0, 1.0);
    output.opacity = input.opacity;
    output.uv = input.uv;
    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // 边缘柔和
    let edgeFade = 1.0 - smoothstep(0.7, 1.0, abs(input.uv * 2.0 - 1.0));
    let alpha = input.opacity * edgeFade;

    // 水墨色
    let inkColor = vec3<f32>(0.15, 0.18, 0.2);

    return vec4<f32>(inkColor, alpha);
  }
`;

/**
 * WebGPU 水面渲染器
 */
export class WaterRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;

  private paramsBuffer: GPUBuffer | null = null;
  private strokesBuffer: GPUBuffer | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private maxStrokes = 2000;

  private isInitialized = false;

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

  private async createBuffers(): Promise<void> {
    if (!this.device) return;

    this.paramsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.strokesBuffer = this.device.createBuffer({
      size: this.maxStrokes * 32,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });

    // 每个笔触生成 4 个顶点（矩形）
    this.vertexBuffer = this.device.createBuffer({
      size: this.maxStrokes * 4 * 16,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.indexBuffer = this.device.createBuffer({
      size: this.maxStrokes * 6 * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({
      code: waterShader,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "generateWater",
      },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32" },
              { shaderLocation: 2, offset: 12, format: "float32" },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
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
   * 绘制水面
   */
  drawWater(x: number, y: number, options: WaterOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context) return;

    const {
      waveHeight = 3,
      length = 600,
      clusters = 15,
      density = 8,
      inkDensity = 0.6,
      seed = prng.random() * 1000,
      time = 0,
    } = options;

    const strokeCount = Math.min(clusters * density, this.maxStrokes);

    // 更新参数
    const paramsData = new ArrayBuffer(48);
    const view = new DataView(paramsData);
    view.setFloat32(0, x, true);
    view.setFloat32(4, y, true);
    view.setFloat32(8, length, true);
    view.setFloat32(12, waveHeight, true);
    view.setUint32(16, clusters, true);
    view.setFloat32(20, density, true);
    view.setFloat32(24, inkDensity, true);
    view.setFloat32(28, seed, true);
    view.setFloat32(32, time, true);
    view.setUint32(36, strokeCount, true);
    view.setFloat32(40, this.canvasWidth, true);
    view.setFloat32(44, this.canvasHeight, true);

    this.device.queue.writeBuffer(this.paramsBuffer!, 0, paramsData);

    // 生成顶点数据（在 CPU 端简化处理）
    this.generateVertices(
      x,
      y,
      length,
      waveHeight,
      clusters,
      density,
      inkDensity,
      seed,
      strokeCount,
    );

    // 创建 bind group
    const computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer! } },
        { binding: 1, resource: { buffer: this.strokesBuffer! } },
      ],
    });

    const commandEncoder = this.device.createCommandEncoder();

    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline!);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(strokeCount / 64));
    computePass.end();

    // Render pass
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
    renderPass.setVertexBuffer(0, this.vertexBuffer!);
    renderPass.setIndexBuffer(this.indexBuffer!, "uint32");
    renderPass.drawIndexed(strokeCount * 6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  private generateVertices(
    centerX: number,
    centerY: number,
    length: number,
    waveHeight: number,
    clusters: number,
    density: number,
    inkDensity: number,
    seed: number,
    strokeCount: number,
  ): void {
    if (!this.device) return;

    const vertices = new Float32Array(strokeCount * 4 * 4);
    const indices = new Uint32Array(strokeCount * 6);

    // 简单的伪随机
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let i = 0; i < strokeCount; i++) {
      const clusterIdx = Math.floor(i / density);
      const strokeInCluster = i % density;

      const clusterT = clusterIdx / clusters;
      const baseX = centerX - length * 0.5 + clusterT * length;

      const noise1 = hash(i * 0.1, seed) * 2 - 1;
      const noise2 = hash(seed, i * 0.15) * 2 - 1;

      const strokeLen = 20 + noise1 * 30;
      const yOffset = Math.sin(strokeInCluster * 0.5) * waveHeight * 0.5;
      const yNoise = noise2 * waveHeight;

      const x1 = baseX + noise1 * 20;
      const y1 = centerY + yOffset + yNoise + strokeInCluster * 3;
      const x2 = x1 + strokeLen;
      const y2 = y1 + Math.sin(i * 0.3) * 2;

      const distFromCenter = Math.abs(clusterT - 0.5) * 2;
      const width = (1.5 - distFromCenter * 0.5) * (0.8 + noise1 * 0.4);
      const opacity = inkDensity * (0.3 + noise2 * 0.4) * (1 - distFromCenter * 0.3);

      // 生成矩形的 4 个顶点
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = (-dy / len) * width;
      const ny = (dx / len) * width;

      const vi = i * 16;
      // 左下
      vertices[vi + 0] = x1 + nx;
      vertices[vi + 1] = y1 + ny;
      vertices[vi + 2] = opacity;
      vertices[vi + 3] = 0;
      // 右下
      vertices[vi + 4] = x1 - nx;
      vertices[vi + 5] = y1 - ny;
      vertices[vi + 6] = opacity;
      vertices[vi + 7] = 1;
      // 左上
      vertices[vi + 8] = x2 + nx;
      vertices[vi + 9] = y2 + ny;
      vertices[vi + 10] = opacity;
      vertices[vi + 11] = 0;
      // 右上
      vertices[vi + 12] = x2 - nx;
      vertices[vi + 13] = y2 - ny;
      vertices[vi + 14] = opacity;
      vertices[vi + 15] = 1;

      // 索引
      const ii = i * 6;
      const v = i * 4;
      indices[ii + 0] = v + 0;
      indices[ii + 1] = v + 1;
      indices[ii + 2] = v + 2;
      indices[ii + 3] = v + 2;
      indices[ii + 4] = v + 1;
      indices[ii + 5] = v + 3;
    }

    this.device.queue.writeBuffer(this.vertexBuffer!, 0, vertices);
    this.device.queue.writeBuffer(this.indexBuffer!, 0, indices);
  }

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

  destroy(): void {
    this.paramsBuffer?.destroy();
    this.strokesBuffer?.destroy();
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

export default WaterRenderer;
