/**
 * WebGPU 墨点渲染器
 *
 * 使用 GPU 加速渲染水墨风格的有机墨点/墨斑
 */

import { prng } from '../foundation/random';

export interface BlobOptions {
  /** 长度 */
  length?: number;
  /** 宽度 */
  width?: number;
  /** 旋转角度（弧度） */
  angle?: number;
  /** 颜色 RGBA 0-1 */
  color?: [number, number, number, number];
  /** 噪声强度 0-1 */
  noiseAmount?: number;
  /** 边缘柔和度 0-1 */
  softness?: number;
  /** 随机种子 */
  seed?: number;
  /** 分辨率（点数） */
  resolution?: number;
}

// Blob 渲染 Shader
const blobShader = /* wgsl */ `
  struct BlobParams {
    centerX: f32,
    centerY: f32,
    length: f32,
    width: f32,
    angle: f32,
    noiseAmount: f32,
    softness: f32,
    seed: f32,
    resolution: u32,
    canvasWidth: f32,
    canvasHeight: f32,
    padding: f32,
    color: vec4<f32>,
  }

  @group(0) @binding(0) var<uniform> params: BlobParams;

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

  // 多层噪声
  fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pp = p;
    for (var i = 0; i < octaves; i = i + 1) {
      value = value + amplitude * noise2D(pp * frequency);
      frequency = frequency * 2.0;
      amplitude = amplitude * 0.5;
    }
    return value;
  }

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) localPos: vec2<f32>,
  }

  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    // 生成覆盖 blob 的四边形
    var positions = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
      vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    );

    let localPos = positions[vertexIndex];

    // 计算世界坐标
    let maxDim = max(params.length, params.width) * 1.5;
    let cosA = cos(params.angle);
    let sinA = sin(params.angle);

    let rotatedPos = vec2<f32>(
      localPos.x * cosA - localPos.y * sinA,
      localPos.x * sinA + localPos.y * cosA
    ) * maxDim;

    let worldPos = vec2<f32>(params.centerX, params.centerY) + rotatedPos;

    var output: VertexOutput;
    output.position = vec4<f32>(
      (worldPos.x / params.canvasWidth) * 2.0 - 1.0,
      1.0 - (worldPos.y / params.canvasHeight) * 2.0,
      0.0, 1.0
    );
    output.uv = localPos * 0.5 + 0.5;
    output.localPos = localPos;

    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // 计算到中心的距离（椭圆）
    let p = input.localPos;

    // 旋转回局部坐标
    let cosA = cos(-params.angle);
    let sinA = sin(-params.angle);
    let rotP = vec2<f32>(
      p.x * cosA - p.y * sinA,
      p.x * sinA + p.y * cosA
    );

    // 椭圆距离
    let ellipseP = vec2<f32>(rotP.x / (params.length / max(params.length, params.width)),
                             rotP.y / (params.width / max(params.length, params.width)));
    var dist = length(ellipseP);

    // 添加噪声变形
    let noiseCoord = rotP * 3.0 + vec2<f32>(params.seed, params.seed * 0.7);
    let noiseVal = fbm(noiseCoord, 3);
    dist = dist + noiseVal * params.noiseAmount * 0.3;

    // 边缘柔和
    let edge = 1.0 - smoothstep(0.8 - params.softness * 0.3, 1.0 + params.softness * 0.2, dist);

    if (edge <= 0.0) {
      discard;
    }

    // 内部纹理变化
    let innerNoise = fbm(rotP * 5.0 + vec2<f32>(params.seed * 1.3, params.seed * 0.9), 2);
    let innerVariation = 0.85 + innerNoise * 0.15;

    let alpha = edge * params.color.a * innerVariation;

    return vec4<f32>(params.color.rgb * innerVariation, alpha);
  }
`;

/**
 * WebGPU 墨点渲染器
 */
export class BlobRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private renderPipeline: GPURenderPipeline | null = null;
  private paramsBuffer: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;

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

    await this.createResources();

    this.isInitialized = true;
    return true;
  }

  private async createResources(): Promise<void> {
    if (!this.device) return;

    // 参数缓冲区（64 bytes）
    this.paramsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const shaderModule = this.device.createShaderModule({
      code: blobShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
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

    this.bindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  /**
   * 绘制墨点
   */
  drawBlob(x: number, y: number, options: BlobOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context) return;

    const {
      length = 30,
      width = 20,
      angle = 0,
      color = [0.1, 0.1, 0.12, 0.9],
      noiseAmount = 0.5,
      softness = 0.3,
      seed = prng.random() * 1000,
    } = options;

    // 更新参数
    const paramsData = new Float32Array([
      x, y,
      length, width,
      angle, noiseAmount,
      softness, seed,
      0, // resolution (unused)
      this.canvasWidth,
      this.canvasHeight,
      0, // padding
      ...color,
    ]);

    this.device.queue.writeBuffer(this.paramsBuffer!, 0, paramsData);

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
    renderPass.setBindGroup(0, this.bindGroup!);
    renderPass.draw(6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 批量绘制墨点
   */
  drawBlobs(blobs: Array<{ x: number; y: number; options?: BlobOptions }>): void {
    for (const blob of blobs) {
      this.drawBlob(blob.x, blob.y, blob.options);
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
    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

export default BlobRenderer;
