/**
 * WebGPU 墨水扩散模拟
 *
 * 使用 Compute Shader 模拟墨水在宣纸上的扩散效果
 * 基于流体动力学简化模型 + 纸纤维的各向异性扩散
 */

// Compute Shader: 墨水扩散核心算法
const inkDiffusionShader = /* wgsl */ `
  struct Params {
    width: u32,
    height: u32,
    diffusionRate: f32,    // 扩散速率
    evaporationRate: f32,  // 蒸发速率
    viscosity: f32,        // 粘度（影响扩散形态）
    paperAbsorption: f32,  // 纸张吸收率
    deltaTime: f32,        // 时间步长
    noiseScale: f32,       // 噪声缩放（纸纤维）
  }

  @group(0) @binding(0) var<uniform> params: Params;
  @group(0) @binding(1) var<storage, read> inkCurrent: array<f32>;
  @group(0) @binding(2) var<storage, read_write> inkNext: array<f32>;
  @group(0) @binding(3) var<storage, read> paperTexture: array<f32>;

  // 简单哈希函数用于噪声
  fn hash(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.13);
    p3 = p3 + dot(p3, p3.yzx + vec3<f32>(3.333));
    return fract((p3.x + p3.y) * p3.z);
  }

  // 获取像素索引
  fn getIndex(x: u32, y: u32) -> u32 {
    return y * params.width + x;
  }

  // 安全获取墨水浓度
  fn getInk(x: i32, y: i32) -> f32 {
    if (x < 0 || x >= i32(params.width) || y < 0 || y >= i32(params.height)) {
      return 0.0;
    }
    return inkCurrent[getIndex(u32(x), u32(y))];
  }

  // 获取纸张纹理（影响扩散方向）
  fn getPaper(x: u32, y: u32) -> f32 {
    return paperTexture[getIndex(x, y)];
  }

  @compute @workgroup_size(16, 16)
  fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= params.width || y >= params.height) {
      return;
    }

    let idx = getIndex(x, y);
    let ix = i32(x);
    let iy = i32(y);

    // 当前墨水浓度
    let currentInk = inkCurrent[idx];

    // 纸张纹理（0-1，影响扩散各向异性）
    let paper = getPaper(x, y);

    // 拉普拉斯算子计算扩散
    // 使用 9 点模板提高精度
    let center = currentInk;
    let left = getInk(ix - 1, iy);
    let right = getInk(ix + 1, iy);
    let up = getInk(ix, iy - 1);
    let down = getInk(ix, iy + 1);
    let upLeft = getInk(ix - 1, iy - 1);
    let upRight = getInk(ix + 1, iy - 1);
    let downLeft = getInk(ix - 1, iy + 1);
    let downRight = getInk(ix + 1, iy + 1);

    // 加权拉普拉斯（对角线权重较小）
    let laplacian = (left + right + up + down) * 0.2
                  + (upLeft + upRight + downLeft + downRight) * 0.05
                  - center * 1.0;

    // 纸纤维影响扩散速率（各向异性）
    let fiberInfluence = mix(0.5, 1.5, paper);
    let effectiveDiffusion = params.diffusionRate * fiberInfluence;

    // 扩散方程
    var newInk = currentInk + laplacian * effectiveDiffusion * params.deltaTime;

    // 蒸发（墨水浓度随时间减少）
    newInk = newInk * (1.0 - params.evaporationRate * params.deltaTime);

    // 纸张吸收（墨水被纸张固定）
    let absorbed = currentInk * params.paperAbsorption * paper * params.deltaTime;
    newInk = max(newInk - absorbed * 0.1, absorbed);

    // 粘度影响（高粘度墨水扩散更慢）
    newInk = mix(currentInk, newInk, 1.0 - params.viscosity * 0.5);

    // 钳制到有效范围
    inkNext[idx] = clamp(newInk, 0.0, 1.0);
  }
`;

// 渲染 Shader: 将墨水浓度转换为可视化颜色
const renderShader = /* wgsl */ `
  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
  }

  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // 全屏四边形
    var positions = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0),
      vec2<f32>(1.0, -1.0),
      vec2<f32>(-1.0, 1.0),
      vec2<f32>(-1.0, 1.0),
      vec2<f32>(1.0, -1.0),
      vec2<f32>(1.0, 1.0),
    );

    var uvs = array<vec2<f32>, 6>(
      vec2<f32>(0.0, 1.0),
      vec2<f32>(1.0, 1.0),
      vec2<f32>(0.0, 0.0),
      vec2<f32>(0.0, 0.0),
      vec2<f32>(1.0, 1.0),
      vec2<f32>(1.0, 0.0),
    );

    var output: VertexOutput;
    output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
    output.uv = uvs[vertexIndex];
    return output;
  }

  struct RenderParams {
    width: f32,
    height: f32,
    inkColor: vec3<f32>,
    paperColor: vec3<f32>,
  }

  @group(0) @binding(0) var<uniform> params: RenderParams;
  @group(0) @binding(1) var<storage, read> inkData: array<f32>;
  @group(0) @binding(2) var<storage, read> paperTexture: array<f32>;

  @fragment
  fn fragmentMain(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    let x = u32(uv.x * params.width);
    let y = u32(uv.y * params.height);
    let idx = y * u32(params.width) + x;

    let ink = inkData[idx];
    let paper = paperTexture[idx];

    // 宣纸底色（略带纹理）
    let paperVariation = mix(0.95, 1.0, paper);
    let basePaper = params.paperColor * paperVariation;

    // 墨色（根据浓度变化）
    // 浓墨偏黑，淡墨偏灰带青
    let inkDensity = pow(ink, 0.7); // gamma 校正
    let inkTint = mix(
      vec3<f32>(0.3, 0.32, 0.35),  // 淡墨：灰青色
      params.inkColor,              // 浓墨：纯黑
      inkDensity
    );

    // 混合墨和纸
    let finalColor = mix(basePaper, inkTint, ink);

    return vec4<f32>(finalColor, 1.0);
  }
`;

/**
 * 墨水扩散参数
 */
export interface InkDiffusionParams {
  /** 画布宽度 */
  width: number;
  /** 画布高度 */
  height: number;
  /** 扩散速率 (0-1) */
  diffusionRate?: number;
  /** 蒸发速率 (0-1) */
  evaporationRate?: number;
  /** 粘度 (0-1) */
  viscosity?: number;
  /** 纸张吸收率 (0-1) */
  paperAbsorption?: number;
  /** 墨色 RGB (0-1) */
  inkColor?: [number, number, number];
  /** 纸色 RGB (0-1) */
  paperColor?: [number, number, number];
}

/**
 * WebGPU 墨水扩散引擎
 */
export class InkDiffusionEngine {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";

  // Buffers
  private paramsBuffer: GPUBuffer | null = null;
  private inkBuffers: [GPUBuffer, GPUBuffer] | null = null;
  private paperBuffer: GPUBuffer | null = null;
  private renderParamsBuffer: GPUBuffer | null = null;

  // Pipelines
  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;

  // Bind Groups
  private computeBindGroups: [GPUBindGroup, GPUBindGroup] | null = null;
  private renderBindGroup: GPUBindGroup | null = null;

  // State
  private currentBuffer = 0;
  private params: Required<InkDiffusionParams>;
  private isInitialized = false;

  constructor(params: InkDiffusionParams) {
    this.params = {
      width: params.width,
      height: params.height,
      diffusionRate: params.diffusionRate ?? 0.15,
      evaporationRate: params.evaporationRate ?? 0.001,
      viscosity: params.viscosity ?? 0.3,
      paperAbsorption: params.paperAbsorption ?? 0.1,
      inkColor: params.inkColor ?? [0.05, 0.05, 0.08],
      paperColor: params.paperColor ?? [0.96, 0.94, 0.9],
    };
  }

  /**
   * 初始化 WebGPU
   */
  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    // 检查 WebGPU 支持
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

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    await this.createBuffers();
    await this.createPipelines();
    await this.createBindGroups();

    this.isInitialized = true;
    return true;
  }

  /**
   * 创建 GPU 缓冲区
   */
  private async createBuffers(): Promise<void> {
    if (!this.device) return;

    const { width, height } = this.params;
    const pixelCount = width * height;

    // 参数缓冲区
    this.paramsBuffer = this.device.createBuffer({
      size: 32, // 8 个 f32
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 墨水双缓冲
    const inkBufferSize = pixelCount * 4; // f32
    this.inkBuffers = [
      this.device.createBuffer({
        size: inkBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
      this.device.createBuffer({
        size: inkBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      }),
    ];

    // 纸张纹理缓冲区
    this.paperBuffer = this.device.createBuffer({
      size: inkBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // 渲染参数缓冲区
    this.renderParamsBuffer = this.device.createBuffer({
      size: 48, // 对齐到 16 字节
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // 生成纸张纹理（简单 Perlin 噪声）
    this.generatePaperTexture();

    // 更新参数
    this.updateParams();
  }

  /**
   * 生成纸张纤维纹理
   */
  private generatePaperTexture(): void {
    if (!this.device || !this.paperBuffer) return;

    const { width, height } = this.params;
    const data = new Float32Array(width * height);

    // 简单的多层噪声模拟纸纤维
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        // 多频率噪声叠加
        let noise = 0;
        noise += this.simplex2D(x * 0.01, y * 0.01) * 0.5;
        noise += this.simplex2D(x * 0.03, y * 0.03) * 0.3;
        noise += this.simplex2D(x * 0.1, y * 0.1) * 0.2;
        // 归一化到 0-1
        data[idx] = (noise + 1) * 0.5;
      }
    }

    this.device.queue.writeBuffer(this.paperBuffer, 0, data);
  }

  /**
   * 简单 2D 噪声（用于纸张纹理）
   */
  private simplex2D(x: number, y: number): number {
    // 简化的 gradient noise
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const fracX = x - floorX;
    const fracY = y - floorY;

    const hash = (px: number, py: number) => {
      const n = Math.sin(px * 12.9898 + py * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const a = hash(floorX, floorY);
    const b = hash(floorX + 1, floorY);
    const c = hash(floorX, floorY + 1);
    const d = hash(floorX + 1, floorY + 1);

    const smoothX = fracX * fracX * (3 - 2 * fracX);
    const smoothY = fracY * fracY * (3 - 2 * fracY);

    return (
      (a * (1 - smoothX) * (1 - smoothY) +
        b * smoothX * (1 - smoothY) +
        c * (1 - smoothX) * smoothY +
        d * smoothX * smoothY) *
        2 -
      1
    );
  }

  /**
   * 更新参数到 GPU
   */
  private updateParams(): void {
    if (!this.device || !this.paramsBuffer || !this.renderParamsBuffer) return;

    const {
      width,
      height,
      diffusionRate,
      evaporationRate,
      viscosity,
      paperAbsorption,
      inkColor,
      paperColor,
    } = this.params;

    // Compute 参数
    const computeParams = new Float32Array([
      width,
      height,
      diffusionRate,
      evaporationRate,
      viscosity,
      paperAbsorption,
      0.016, // deltaTime
      1.0, // noiseScale
    ]);
    this.device.queue.writeBuffer(this.paramsBuffer, 0, computeParams);

    // Render 参数
    const renderParams = new Float32Array([
      width,
      height,
      0,
      0, // padding
      ...inkColor,
      0, // padding
      ...paperColor,
      0, // padding
    ]);
    this.device.queue.writeBuffer(this.renderParamsBuffer, 0, renderParams);
  }

  /**
   * 创建渲染管线
   */
  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    // Compute 管线
    const computeModule = this.device.createShaderModule({
      code: inkDiffusionShader,
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
      code: renderShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderModule,
        entryPoint: "vertexMain",
      },
      fragment: {
        module: renderModule,
        entryPoint: "fragmentMain",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
      },
    });
  }

  /**
   * 创建绑定组
   */
  private async createBindGroups(): Promise<void> {
    if (!this.device || !this.computePipeline || !this.renderPipeline) return;
    if (!this.paramsBuffer || !this.inkBuffers || !this.paperBuffer || !this.renderParamsBuffer)
      return;

    // Compute 绑定组（双缓冲）
    this.computeBindGroups = [
      this.device.createBindGroup({
        layout: this.computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: { buffer: this.inkBuffers[0] } },
          { binding: 2, resource: { buffer: this.inkBuffers[1] } },
          { binding: 3, resource: { buffer: this.paperBuffer } },
        ],
      }),
      this.device.createBindGroup({
        layout: this.computePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: { buffer: this.inkBuffers[1] } },
          { binding: 2, resource: { buffer: this.inkBuffers[0] } },
          { binding: 3, resource: { buffer: this.paperBuffer } },
        ],
      }),
    ];

    // Render 绑定组
    this.renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.renderParamsBuffer } },
        { binding: 1, resource: { buffer: this.inkBuffers[0] } },
        { binding: 2, resource: { buffer: this.paperBuffer } },
      ],
    });
  }

  /**
   * 添加墨点
   */
  addInk(x: number, y: number, radius: number, intensity: number = 1.0): void {
    if (!this.device || !this.inkBuffers) return;

    const { width, height } = this.params;
    const data = new Float32Array(width * height);

    // 创建圆形墨点
    const centerX = Math.floor(x);
    const centerY = Math.floor(y);
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = centerX + dx;
        const py = centerY + dy;

        if (px < 0 || px >= width || py < 0 || py >= height) continue;

        const dist2 = dx * dx + dy * dy;
        if (dist2 <= r2) {
          const idx = py * width + px;
          // 高斯衰减
          const falloff = Math.exp(-dist2 / (r2 * 0.5)) * intensity;
          data[idx] = Math.min(data[idx] + falloff, 1.0);
        }
      }
    }

    // 写入当前缓冲
    this.device.queue.writeBuffer(this.inkBuffers[this.currentBuffer], 0, data);
  }

  /**
   * 添加笔画（多个墨点连线）
   */
  addStroke(points: Array<{ x: number; y: number; pressure?: number }>): void {
    if (!this.device || !this.inkBuffers || points.length === 0) return;

    const { width, height } = this.params;
    const data = new Float32Array(width * height);

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const pressure = point.pressure ?? 1.0;
      const radius = 5 + pressure * 15; // 根据压力调整大小

      const centerX = Math.floor(point.x);
      const centerY = Math.floor(point.y);
      const r2 = radius * radius;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = centerX + dx;
          const py = centerY + dy;

          if (px < 0 || px >= width || py < 0 || py >= height) continue;

          const dist2 = dx * dx + dy * dy;
          if (dist2 <= r2) {
            const idx = py * width + px;
            const falloff = Math.exp(-dist2 / (r2 * 0.3)) * pressure;
            data[idx] = Math.min(data[idx] + falloff, 1.0);
          }
        }
      }
    }

    this.device.queue.writeBuffer(this.inkBuffers[this.currentBuffer], 0, data);
  }

  /**
   * 执行一步扩散模拟
   */
  step(): void {
    if (!this.device || !this.computePipeline || !this.computeBindGroups) return;

    const { width, height } = this.params;

    const commandEncoder = this.device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    passEncoder.setPipeline(this.computePipeline);
    passEncoder.setBindGroup(0, this.computeBindGroups[this.currentBuffer]);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);

    // 切换缓冲
    this.currentBuffer = 1 - this.currentBuffer;

    // 更新渲染绑定组以使用新的缓冲
    if (this.renderPipeline && this.renderParamsBuffer && this.inkBuffers && this.paperBuffer) {
      this.renderBindGroup = this.device.createBindGroup({
        layout: this.renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderParamsBuffer } },
          { binding: 1, resource: { buffer: this.inkBuffers[this.currentBuffer] } },
          { binding: 2, resource: { buffer: this.paperBuffer } },
        ],
      });
    }
  }

  /**
   * 渲染当前状态
   */
  render(): void {
    if (!this.device || !this.context || !this.renderPipeline || !this.renderBindGroup) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0.96, g: 0.94, b: 0.9, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    passEncoder.setPipeline(this.renderPipeline);
    passEncoder.setBindGroup(0, this.renderBindGroup);
    passEncoder.draw(6);
    passEncoder.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 清空画布
   */
  clear(): void {
    if (!this.device || !this.inkBuffers) return;

    const { width, height } = this.params;
    const emptyData = new Float32Array(width * height);

    this.device.queue.writeBuffer(this.inkBuffers[0], 0, emptyData);
    this.device.queue.writeBuffer(this.inkBuffers[1], 0, emptyData);
  }

  /**
   * 更新扩散参数
   */
  setParams(params: Partial<InkDiffusionParams>): void {
    Object.assign(this.params, params);
    this.updateParams();
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.paramsBuffer?.destroy();
    this.inkBuffers?.[0].destroy();
    this.inkBuffers?.[1].destroy();
    this.paperBuffer?.destroy();
    this.renderParamsBuffer?.destroy();

    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }

  /**
   * 是否已初始化
   */
  get initialized(): boolean {
    return this.isInitialized;
  }
}

export default InkDiffusionEngine;
