/**
 * WebGPU 山峰渲染器
 *
 * 使用 GPU 加速渲染水墨山水效果
 * 包含轮廓生成、纹理绘制、墨色渲染
 */

import { prng } from "../foundation/random";

export interface MountOptions {
  /** 山峰高度 */
  height?: number;
  /** 山峰宽度 */
  width?: number;
  /** 层数（用于远近效果） */
  layers?: number;
  /** 纹理密度 */
  textureDensity?: number;
  /** 墨色浓度 0-1 */
  inkDensity?: number;
  /** 随机种子 */
  seed?: number;
  /** 是否显示轮廓 */
  showOutline?: boolean;
  /** 雾化程度 0-1 */
  mistAmount?: number;
}

// 山峰生成 Compute Shader
const mountGenerateShader = /* wgsl */ `
  struct MountParams {
    width: f32,
    height: f32,
    centerX: f32,
    centerY: f32,
    seed: f32,
    layers: u32,
    textureDensity: f32,
    inkDensity: f32,
    mistAmount: f32,
    time: f32,
    pointCount: u32,
    padding: f32,
  }

  struct MountPoint {
    x: f32,
    y: f32,
    layer: f32,      // 层索引 0-1
    intensity: f32,  // 墨色强度
  }

  @group(0) @binding(0) var<uniform> params: MountParams;
  @group(0) @binding(1) var<storage, read_write> outlinePoints: array<MountPoint>;
  @group(0) @binding(2) var<storage, read_write> texturePoints: array<MountPoint>;

  // Simplex 2D 噪声
  fn mod289_3(x: vec3<f32>) -> vec3<f32> {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }

  fn permute_3(x: vec3<f32>) -> vec3<f32> {
    return mod289_3(((x * 34.0) + 1.0) * x);
  }

  fn simplex2D(v: vec2<f32>) -> f32 {
    let C = vec4<f32>(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    var i = floor(v + dot(v, vec2<f32>(C.y, C.y)));
    let x0 = v - i + dot(i, vec2<f32>(C.x, C.x));
    var i1: vec2<f32>;
    if (x0.x > x0.y) { i1 = vec2<f32>(1.0, 0.0); } else { i1 = vec2<f32>(0.0, 1.0); }
    var x12 = x0.xyxy + C.xxzz;
    x12 = vec4<f32>(x12.xy - i1, x12.zw);
    i = i - floor(i * (1.0 / 289.0)) * 289.0;
    let p = permute_3(permute_3(i.y + vec3<f32>(0.0, i1.y, 1.0)) + i.x + vec3<f32>(0.0, i1.x, 1.0));
    var m = max(0.5 - vec3<f32>(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), vec3<f32>(0.0));
    m = m * m; m = m * m;
    let x = 2.0 * fract(p * C.www) - 1.0;
    let h = abs(x) - 0.5;
    let ox = floor(x + 0.5);
    let a0 = x - ox;
    m = m * (1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h));
    let g = vec3<f32>(a0.x * x0.x + h.x * x0.y, a0.y * x12.x + h.y * x12.y, a0.z * x12.z + h.z * x12.w);
    return 130.0 * dot(m, g);
  }

  // FBM
  fn fbm(p: vec2<f32>, octaves: i32) -> f32 {
    var value = 0.0;
    var amplitude = 0.5;
    var frequency = 1.0;
    var pp = p;
    for (var i = 0; i < octaves; i = i + 1) {
      value = value + amplitude * simplex2D(pp * frequency);
      frequency = frequency * 2.0;
      amplitude = amplitude * 0.5;
    }
    return value;
  }

  // 生成山峰轮廓
  @compute @workgroup_size(64)
  fn generateOutline(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    if (idx >= params.pointCount) { return; }

    let layers = params.layers;
    let pointsPerLayer = params.pointCount / layers;
    let layerIdx = idx / pointsPerLayer;
    let pointIdx = idx % pointsPerLayer;

    let t = f32(pointIdx) / f32(pointsPerLayer - 1u);
    let layerT = f32(layerIdx) / f32(layers - 1u);

    // 层的缩放和位置偏移
    let layerScale = 1.0 - layerT * 0.3;  // 远层更小
    let layerOffsetY = layerT * params.height * 0.2;  // 远层更高

    // 山峰轮廓函数
    let angle = t * 3.14159265;
    var baseY = sin(angle);  // 基础正弦轮廓

    // 添加 FBM 噪声
    let noiseCoord = vec2<f32>(t * 5.0 + params.seed + f32(layerIdx) * 10.0, params.seed);
    let noise = fbm(noiseCoord, 4);
    baseY = baseY * (0.7 + noise * 0.3);

    // 计算最终位置
    let x = params.centerX + (t - 0.5) * params.width * layerScale;
    let y = params.centerY - baseY * params.height * layerScale + layerOffsetY;

    // 墨色强度（近层更深）
    let intensity = (1.0 - layerT) * params.inkDensity;

    outlinePoints[idx] = MountPoint(x, y, layerT, intensity);
  }

  // 生成纹理点（皴法）
  @compute @workgroup_size(64)
  fn generateTexture(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let idx = global_id.x;
    let textureCount = u32(params.textureDensity * 1000.0);
    if (idx >= textureCount) { return; }

    // 使用噪声确定纹理位置
    let seed = params.seed + f32(idx) * 0.1;
    let noiseX = simplex2D(vec2<f32>(seed, 0.0));
    let noiseY = simplex2D(vec2<f32>(0.0, seed));

    // 映射到山体区域
    let t = (noiseX + 1.0) * 0.5;
    let angle = t * 3.14159265;
    let maxY = sin(angle) * params.height;

    let x = params.centerX + (t - 0.5) * params.width;
    let yOffset = (noiseY + 1.0) * 0.5 * maxY * 0.8;  // 限制在山体内
    let y = params.centerY - maxY + yOffset;

    // 纹理线长度和方向
    let lineNoise = simplex2D(vec2<f32>(seed * 2.0, seed));
    let intensity = 0.3 + abs(lineNoise) * 0.5;

    // 层深度（根据 y 位置估算）
    let layerDepth = yOffset / (maxY + 0.001);

    texturePoints[idx] = MountPoint(x, y, layerDepth, intensity * params.inkDensity);
  }
`;

// 山峰渲染 Shader
const mountRenderShader = /* wgsl */ `
  struct RenderParams {
    canvasWidth: f32,
    canvasHeight: f32,
    inkColor: vec3<f32>,
    paperColor: vec3<f32>,
    mistAmount: f32,
    padding: f32,
  }

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) intensity: f32,
    @location(1) layer: f32,
  }

  @group(0) @binding(0) var<uniform> params: RenderParams;

  // 全屏四边形顶点
  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var positions = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
      vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    );
    var output: VertexOutput;
    output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
    output.intensity = 1.0;
    output.layer = 0.0;
    return output;
  }

  // 山峰点渲染
  struct PointVertexInput {
    @location(0) position: vec2<f32>,
    @location(1) layer: f32,
    @location(2) intensity: f32,
  }

  @vertex
  fn pointVertexMain(input: PointVertexInput) -> VertexOutput {
    var output: VertexOutput;
    let x = (input.position.x / params.canvasWidth) * 2.0 - 1.0;
    let y = 1.0 - (input.position.y / params.canvasHeight) * 2.0;
    output.position = vec4<f32>(x, y, 0.0, 1.0);
    output.intensity = input.intensity;
    output.layer = input.layer;
    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    // 根据层深度混合颜色（远层更淡）
    let mistFade = mix(1.0, 0.3, input.layer * params.mistAmount);
    let inkAlpha = input.intensity * mistFade;

    // 墨色（根据深度变化）
    let inkTint = mix(params.inkColor, params.paperColor, input.layer * 0.5);

    return vec4<f32>(inkTint, inkAlpha);
  }
`;

/**
 * WebGPU 山峰渲染器
 */
export class MountRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";

  private computePipeline: GPUComputePipeline | null = null;
  private renderPipeline: GPURenderPipeline | null = null;

  private paramsBuffer: GPUBuffer | null = null;
  private outlineBuffer: GPUBuffer | null = null;
  private textureBuffer: GPUBuffer | null = null;
  private renderParamsBuffer: GPUBuffer | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private maxPoints = 10000;

  private isInitialized = false;

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

  private async createBuffers(): Promise<void> {
    if (!this.device) return;

    this.paramsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.outlineBuffer = this.device.createBuffer({
      size: this.maxPoints * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    });

    this.textureBuffer = this.device.createBuffer({
      size: this.maxPoints * 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
    });

    this.renderParamsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    const computeModule = this.device.createShaderModule({
      code: mountGenerateShader,
    });

    this.computePipeline = this.device.createComputePipeline({
      layout: "auto",
      compute: {
        module: computeModule,
        entryPoint: "generateOutline",
      },
    });

    const renderModule = this.device.createShaderModule({
      code: mountRenderShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: renderModule,
        entryPoint: "pointVertexMain",
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
        topology: "point-list",
      },
    });
  }

  /**
   * 绘制山峰
   */
  drawMount(x: number, y: number, options: MountOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context) return;

    const {
      height = 200,
      width = 400,
      layers = 3,
      textureDensity = 0.5,
      inkDensity = 0.8,
      seed = prng.random() * 1000,
      mistAmount = 0.3,
    } = options;

    const pointsPerLayer = 200;
    const totalPoints = pointsPerLayer * layers;

    // 更新参数
    const paramsData = new Float32Array([
      width,
      height,
      x,
      y,
      seed,
      layers,
      textureDensity,
      inkDensity,
      mistAmount,
      0,
      totalPoints,
      0,
    ]);
    this.device.queue.writeBuffer(this.paramsBuffer!, 0, paramsData);

    // 更新渲染参数
    const renderParamsData = new Float32Array([
      this.canvasWidth,
      this.canvasHeight,
      0.1,
      0.1,
      0.12, // inkColor
      0.96,
      0.94,
      0.9, // paperColor
      mistAmount,
      0,
    ]);
    this.device.queue.writeBuffer(this.renderParamsBuffer!, 0, renderParamsData);

    // 创建 bind groups
    const computeBindGroup = this.device.createBindGroup({
      layout: this.computePipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.paramsBuffer! } },
        { binding: 1, resource: { buffer: this.outlineBuffer! } },
        { binding: 2, resource: { buffer: this.textureBuffer! } },
      ],
    });

    const renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline!.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.renderParamsBuffer! } }],
    });

    const commandEncoder = this.device.createCommandEncoder();

    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.computePipeline!);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(totalPoints / 64));
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
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.setVertexBuffer(0, this.outlineBuffer!);
    renderPass.draw(totalPoints);
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

  destroy(): void {
    this.paramsBuffer?.destroy();
    this.outlineBuffer?.destroy();
    this.textureBuffer?.destroy();
    this.renderParamsBuffer?.destroy();
    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

export default MountRenderer;
