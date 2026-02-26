/**
 * WebGPU 纹理渲染器（皴法）
 *
 * 使用 GPU 加速渲染水墨风格的纹理效果
 * 模拟传统国画中的皴法技法
 */

import { prng } from '../foundation/random';

export interface TextureOptions {
  /** 纹理线数量 */
  lineCount?: number;
  /** 笔宽 */
  strokeWidth?: number;
  /** 阴影宽度 */
  shadowWidth?: number;
  /** 墨色浓度 0-1 */
  inkDensity?: number;
  /** 纹理方向（弧度）*/
  direction?: number;
  /** 噪声强度 0-1 */
  noiseAmount?: number;
  /** 随机种子 */
  seed?: number;
}

export interface TextureRegion {
  /** 区域多边形顶点 */
  points: Array<{ x: number; y: number }>;
  /** 层深度 0-1（用于颜色变化）*/
  depth?: number;
}

// 纹理渲染 Shader
const textureShader = /* wgsl */ `
  struct TextureParams {
    lineCount: u32,
    strokeWidth: f32,
    shadowWidth: f32,
    inkDensity: f32,
    direction: f32,
    noiseAmount: f32,
    seed: f32,
    depth: f32,
    minX: f32,
    minY: f32,
    maxX: f32,
    maxY: f32,
    canvasWidth: f32,
    canvasHeight: f32,
    padding1: f32,
    padding2: f32,
  }

  struct TextureLine {
    x1: f32, y1: f32,
    x2: f32, y2: f32,
    width: f32,
    opacity: f32,
    padding1: f32,
    padding2: f32,
  }

  @group(0) @binding(0) var<uniform> params: TextureParams;
  @group(0) @binding(1) var<storage, read_write> lines: array<TextureLine>;

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

  // 生成纹理线
  @compute @workgroup_size(64)
  fn generateTexture(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.lineCount) { return; }

    let t = f32(idx) / f32(params.lineCount);

    // 基于深度的分布
    let regionWidth = params.maxX - params.minX;
    let regionHeight = params.maxY - params.minY;

    // 使用噪声确定位置
    let noise1 = noise2D(vec2<f32>(f32(idx) * 0.1, params.seed));
    let noise2 = noise2D(vec2<f32>(params.seed, f32(idx) * 0.15));
    let noise3 = noise2D(vec2<f32>(f32(idx) * 0.2, params.seed * 1.5));

    // 基础位置
    let baseX = params.minX + (noise1 + 1.0) * 0.5 * regionWidth;
    let baseY = params.minY + t * regionHeight;

    // 纹理线长度和方向
    let lineLen = 10.0 + abs(noise2) * 30.0;
    let angle = params.direction + noise3 * params.noiseAmount * 0.5;

    // 计算起点和终点
    let dx = cos(angle) * lineLen;
    let dy = sin(angle) * lineLen;

    let x1 = baseX - dx * 0.5;
    let y1 = baseY - dy * 0.5;
    let x2 = baseX + dx * 0.5;
    let y2 = baseY + dy * 0.5;

    // 宽度变化
    let width = params.strokeWidth * (0.5 + abs(noise1) * 0.5);

    // 透明度（根据深度和噪声）
    let depthFactor = 0.3 + params.depth * 0.7;
    let opacity = params.inkDensity * depthFactor * (0.4 + abs(noise2) * 0.4);

    lines[idx] = TextureLine(x1, y1, x2, y2, width, opacity, 0.0, 0.0);
  }

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) opacity: f32,
    @location(1) uv: f32,
  }

  struct LineVertex {
    @location(0) pos: vec2<f32>,
    @location(1) opacity: f32,
    @location(2) uv: f32,
  }

  @vertex
  fn vertexMain(input: LineVertex) -> VertexOutput {
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
    let edgeFade = 1.0 - smoothstep(0.5, 1.0, abs(input.uv * 2.0 - 1.0));
    let alpha = input.opacity * edgeFade;

    // 墨色（根据深度略有变化）
    let depthTint = 1.0 - params.depth * 0.3;
    let inkColor = vec3<f32>(0.1, 0.1, 0.12) * depthTint;

    return vec4<f32>(inkColor, alpha);
  }
`;

/**
 * WebGPU 纹理渲染器
 */
export class TextureRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;

  private paramsBuffer: GPUBuffer | null = null;
  private linesBuffer: GPUBuffer | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private maxLines = 3000;

  private isInitialized = false;

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    if (!navigator.gpu) {
      console.error('WebGPU 不支持');
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.error('无法获取 GPU adapter');
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = canvas.getContext('webgpu');

    if (!this.context) {
      console.error('无法获取 WebGPU context');
      return false;
    }

    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'premultiplied',
    });

    await this.createBuffers();
    await this.createPipelines();

    this.isInitialized = true;
    return true;
  }

  private async createBuffers(): Promise<void> {
    if (!this.device) return;

    this.paramsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.linesBuffer = this.device.createBuffer({
      size: this.maxLines * 32,
      usage: GPUBufferUsage.STORAGE,
    });

    this.vertexBuffer = this.device.createBuffer({
      size: this.maxLines * 4 * 16,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.indexBuffer = this.device.createBuffer({
      size: this.maxLines * 6 * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({
      code: textureShader,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'generateTexture',
      },
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 16,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32' },
            { shaderLocation: 2, offset: 12, format: 'float32' },
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
  }

  /**
   * 绘制纹理区域
   */
  drawTexture(region: TextureRegion, options: TextureOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context) return;
    if (region.points.length < 3) return;

    const {
      lineCount = 200,
      strokeWidth = 1.5,
      shadowWidth = 0,
      inkDensity = 0.7,
      direction = -Math.PI / 4, // 默认斜向下
      noiseAmount = 0.5,
      seed = prng.random() * 1000,
    } = options;

    const depth = region.depth ?? 0.5;

    // 计算区域边界
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const p of region.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    const actualLineCount = Math.min(lineCount, this.maxLines);

    // 更新参数
    const paramsData = new ArrayBuffer(64);
    const view = new DataView(paramsData);
    view.setUint32(0, actualLineCount, true);
    view.setFloat32(4, strokeWidth, true);
    view.setFloat32(8, shadowWidth, true);
    view.setFloat32(12, inkDensity, true);
    view.setFloat32(16, direction, true);
    view.setFloat32(20, noiseAmount, true);
    view.setFloat32(24, seed, true);
    view.setFloat32(28, depth, true);
    view.setFloat32(32, minX, true);
    view.setFloat32(36, minY, true);
    view.setFloat32(40, maxX, true);
    view.setFloat32(44, maxY, true);
    view.setFloat32(48, this.canvasWidth, true);
    view.setFloat32(52, this.canvasHeight, true);

    this.device.queue.writeBuffer(this.paramsBuffer!, 0, paramsData);

    // 生成顶点数据
    this.generateVertices(minX, minY, maxX, maxY, actualLineCount, strokeWidth, direction, noiseAmount, inkDensity, depth, seed);

    // 渲染
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: 'load',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.renderPipeline!);
    renderPass.setVertexBuffer(0, this.vertexBuffer!);
    renderPass.setIndexBuffer(this.indexBuffer!, 'uint32');
    renderPass.drawIndexed(actualLineCount * 6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  private generateVertices(
    minX: number, minY: number,
    maxX: number, maxY: number,
    lineCount: number,
    strokeWidth: number,
    direction: number,
    noiseAmount: number,
    inkDensity: number,
    depth: number,
    seed: number
  ): void {
    if (!this.device) return;

    const vertices = new Float32Array(lineCount * 4 * 4);
    const indices = new Uint32Array(lineCount * 6);

    const regionWidth = maxX - minX;
    const regionHeight = maxY - minY;

    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let i = 0; i < lineCount; i++) {
      const t = i / lineCount;

      const noise1 = hash(i * 0.1, seed) * 2 - 1;
      const noise2 = hash(seed, i * 0.15) * 2 - 1;
      const noise3 = hash(i * 0.2, seed * 1.5) * 2 - 1;

      const baseX = minX + (noise1 + 1) * 0.5 * regionWidth;
      const baseY = minY + t * regionHeight;

      const lineLen = 10 + Math.abs(noise2) * 30;
      const angle = direction + noise3 * noiseAmount * 0.5;

      const dx = Math.cos(angle) * lineLen;
      const dy = Math.sin(angle) * lineLen;

      const x1 = baseX - dx * 0.5;
      const y1 = baseY - dy * 0.5;
      const x2 = baseX + dx * 0.5;
      const y2 = baseY + dy * 0.5;

      const width = strokeWidth * (0.5 + Math.abs(noise1) * 0.5);
      const depthFactor = 0.3 + depth * 0.7;
      const opacity = inkDensity * depthFactor * (0.4 + Math.abs(noise2) * 0.4);

      // 计算法向量
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len * width;
      const ny = dx / len * width;

      const vi = i * 16;
      vertices[vi + 0] = x1 + nx; vertices[vi + 1] = y1 + ny;
      vertices[vi + 2] = opacity; vertices[vi + 3] = 0;

      vertices[vi + 4] = x1 - nx; vertices[vi + 5] = y1 - ny;
      vertices[vi + 6] = opacity; vertices[vi + 7] = 1;

      vertices[vi + 8] = x2 + nx; vertices[vi + 9] = y2 + ny;
      vertices[vi + 10] = opacity; vertices[vi + 11] = 0;

      vertices[vi + 12] = x2 - nx; vertices[vi + 13] = y2 - ny;
      vertices[vi + 14] = opacity; vertices[vi + 15] = 1;

      const ii = i * 6;
      const v = i * 4;
      indices[ii + 0] = v + 0; indices[ii + 1] = v + 1; indices[ii + 2] = v + 2;
      indices[ii + 3] = v + 2; indices[ii + 4] = v + 1; indices[ii + 5] = v + 3;
    }

    this.device.queue.writeBuffer(this.vertexBuffer!, 0, vertices);
    this.device.queue.writeBuffer(this.indexBuffer!, 0, indices);
  }

  /**
   * 批量绘制多个纹理区域
   */
  drawTextures(regions: Array<{ region: TextureRegion; options?: TextureOptions }>): void {
    for (const { region, options } of regions) {
      this.drawTexture(region, options);
    }
  }

  clear(color: [number, number, number, number] = [0.96, 0.94, 0.9, 1.0]): void {
    if (!this.device || !this.context) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: color[0], g: color[1], b: color[2], a: color[3] },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  destroy(): void {
    this.paramsBuffer?.destroy();
    this.linesBuffer?.destroy();
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

export default TextureRenderer;
