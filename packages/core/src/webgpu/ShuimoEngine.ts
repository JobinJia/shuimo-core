/**
 * Shuimo WebGPU 渲染引擎
 *
 * 统一管理 WebGPU 设备和上下文，提供完整的水墨画渲染能力
 */

import { prng } from '../foundation/random';

export interface ShuimoEngineOptions {
  /** 画布背景色 */
  backgroundColor?: [number, number, number, number];
}

// 笔触选项
export interface StrokeOptions {
  width?: number;
  color?: [number, number, number, number];
  noiseAmount?: number;
  softness?: number;
  inkDensity?: number;
}

// 路径点
export interface PathPoint {
  x: number;
  y: number;
  pressure?: number;
  velocity?: number;
}

// 山峰选项
export interface MountOptions {
  height?: number;
  width?: number;
  layers?: number;
  inkDensity?: number;
  mistAmount?: number;
  seed?: number;
}

// 水面选项
export interface WaterOptions {
  waveHeight?: number;
  length?: number;
  clusters?: number;
  density?: number;
  inkDensity?: number;
  seed?: number;
}

// 树木类型
export enum TreeType {
  Simple = 0,
  Curved = 1,
  Branching = 2,
  Pine = 3,
  Willow = 4,
  Bush = 5,
}

// 树木选项
export interface TreeOptions {
  height?: number;
  width?: number;
  type?: TreeType;
  curvature?: number;
  branchLevels?: number;
  leafDensity?: number;
  inkDensity?: number;
  seed?: number;
}

// 墨点选项
export interface BlobOptions {
  length?: number;
  width?: number;
  angle?: number;
  color?: [number, number, number, number];
  noiseAmount?: number;
  softness?: number;
  seed?: number;
}

// 纹理选项
export interface TextureOptions {
  lineCount?: number;
  strokeWidth?: number;
  inkDensity?: number;
  direction?: number;
  noiseAmount?: number;
  seed?: number;
}

// Stroke Shader
const strokeShader = /* wgsl */ `
  struct Params {
    canvasWidth: f32,
    canvasHeight: f32,
    color: vec4<f32>,
    softness: f32,
    inkDensity: f32,
    padding1: f32,
    padding2: f32,
  }

  @group(0) @binding(0) var<uniform> params: Params;

  struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) opacity: f32,
    @location(2) side: f32,
  }

  struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) opacity: f32,
    @location(1) side: f32,
  }

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let x = (input.position.x / params.canvasWidth) * 2.0 - 1.0;
    let y = 1.0 - (input.position.y / params.canvasHeight) * 2.0;
    output.clipPosition = vec4<f32>(x, y, 0.0, 1.0);
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

// Blob Shader
const blobShader = /* wgsl */ `
  struct Params {
    centerX: f32,
    centerY: f32,
    length: f32,
    width: f32,
    angle: f32,
    noiseAmount: f32,
    softness: f32,
    seed: f32,
    canvasWidth: f32,
    canvasHeight: f32,
    padding1: f32,
    padding2: f32,
    color: vec4<f32>,
  }

  @group(0) @binding(0) var<uniform> params: Params;

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
    @location(0) localPos: vec2<f32>,
  }

  @vertex
  fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
    var positions = array<vec2<f32>, 6>(
      vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
      vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    );

    let localPos = positions[vertexIndex];
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
    output.localPos = localPos;

    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let p = input.localPos;
    let cosA = cos(-params.angle);
    let sinA = sin(-params.angle);
    let rotP = vec2<f32>(
      p.x * cosA - p.y * sinA,
      p.x * sinA + p.y * cosA
    );

    let ellipseP = vec2<f32>(rotP.x / (params.length / max(params.length, params.width)),
                             rotP.y / (params.width / max(params.length, params.width)));
    var dist = length(ellipseP);

    let noiseCoord = rotP * 3.0 + vec2<f32>(params.seed, params.seed * 0.7);
    let noiseVal = fbm(noiseCoord, 3);
    dist = dist + noiseVal * params.noiseAmount * 0.3;

    let edge = 1.0 - smoothstep(0.8 - params.softness * 0.3, 1.0 + params.softness * 0.2, dist);

    if (edge <= 0.0) {
      discard;
    }

    let innerNoise = fbm(rotP * 5.0 + vec2<f32>(params.seed * 1.3, params.seed * 0.9), 2);
    let innerVariation = 0.85 + innerNoise * 0.15;

    let alpha = edge * params.color.a * innerVariation;

    return vec4<f32>(params.color.rgb * innerVariation, alpha);
  }
`;

/**
 * Shuimo WebGPU 渲染引擎
 */
export class ShuimoEngine {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private strokePipeline: GPURenderPipeline | null = null;
  private blobPipeline: GPURenderPipeline | null = null;

  private strokeParamsBuffer: GPUBuffer | null = null;
  private strokeVertexBuffer: GPUBuffer | null = null;
  private strokeIndexBuffer: GPUBuffer | null = null;

  private blobParamsBuffer: GPUBuffer | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private backgroundColor: [number, number, number, number] = [0.96, 0.94, 0.9, 1.0];

  private isInitialized = false;
  private maxStrokePoints = 2000;

  constructor(options: ShuimoEngineOptions = {}) {
    if (options.backgroundColor) {
      this.backgroundColor = options.backgroundColor;
    }
  }

  /**
   * 初始化引擎
   */
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

    // 初始清空
    this.clear();

    return true;
  }

  private async createBuffers(): Promise<void> {
    if (!this.device) return;

    // Stroke buffers
    this.strokeParamsBuffer = this.device.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.strokeVertexBuffer = this.device.createBuffer({
      size: this.maxStrokePoints * 2 * 16, // 2 vertices per point, 16 bytes each
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.strokeIndexBuffer = this.device.createBuffer({
      size: this.maxStrokePoints * 6 * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    // Blob buffer
    this.blobParamsBuffer = this.device.createBuffer({
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    // Stroke pipeline
    const strokeModule = this.device.createShaderModule({ code: strokeShader });

    this.strokePipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: strokeModule,
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
        module: strokeModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });

    // Blob pipeline
    const blobModule = this.device.createShaderModule({ code: blobShader });

    this.blobPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: blobModule,
        entryPoint: 'vertexMain',
      },
      fragment: {
        module: blobModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  /**
   * 清空画布
   */
  clear(): void {
    if (!this.device || !this.context) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: {
          r: this.backgroundColor[0],
          g: this.backgroundColor[1],
          b: this.backgroundColor[2],
          a: this.backgroundColor[3],
        },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 绘制笔触
   */
  drawStroke(points: PathPoint[], options: StrokeOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context || points.length < 2) return;

    const {
      width = 5,
      color = [0.1, 0.1, 0.12, 1.0],
      noiseAmount = 0.3,
      softness = 0.3,
      inkDensity = 0.9,
    } = options;

    const pointCount = Math.min(points.length, this.maxStrokePoints);

    // 生成顶点数据
    const vertices = new Float32Array(pointCount * 2 * 4);
    const indices = new Uint32Array((pointCount - 1) * 6);

    // 简单噪声
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let i = 0; i < pointCount; i++) {
      const t = i / (pointCount - 1);
      const curr = points[i];
      const pressure = curr.pressure ?? 1;

      // 计算切线
      let dx = 0, dy = 0;
      if (i === 0) {
        dx = points[1].x - curr.x;
        dy = points[1].y - curr.y;
      } else if (i === pointCount - 1) {
        dx = curr.x - points[i - 1].x;
        dy = curr.y - points[i - 1].y;
      } else {
        dx = points[i + 1].x - points[i - 1].x;
        dy = points[i + 1].y - points[i - 1].y;
      }

      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // 宽度函数（正弦）
      const widthMod = Math.sin(t * Math.PI);
      let w = width * widthMod * (0.3 + pressure * 0.7);

      // 噪声
      const noise = hash(i * 0.5, i * 0.3) * 2 - 1;
      w = w * (1 - noiseAmount) + w * noiseAmount * (0.5 + noise * 0.5);

      // 边缘渐变
      const edgeFade = Math.min(t * 10, (1 - t) * 10, 1);

      const vi = i * 8;
      // 左侧顶点
      vertices[vi + 0] = curr.x + nx * w;
      vertices[vi + 1] = curr.y + ny * w;
      vertices[vi + 2] = edgeFade;
      vertices[vi + 3] = -1;
      // 右侧顶点
      vertices[vi + 4] = curr.x - nx * w;
      vertices[vi + 5] = curr.y - ny * w;
      vertices[vi + 6] = edgeFade;
      vertices[vi + 7] = 1;

      // 索引
      if (i < pointCount - 1) {
        const ii = i * 6;
        const v = i * 2;
        indices[ii + 0] = v;
        indices[ii + 1] = v + 1;
        indices[ii + 2] = v + 2;
        indices[ii + 3] = v + 2;
        indices[ii + 4] = v + 1;
        indices[ii + 5] = v + 3;
      }
    }

    this.device.queue.writeBuffer(this.strokeVertexBuffer!, 0, vertices);
    this.device.queue.writeBuffer(this.strokeIndexBuffer!, 0, indices);

    // 更新参数 (vec4 需要 16 字节对齐)
    const params = new Float32Array([
      this.canvasWidth, this.canvasHeight,
      0, 0,  // padding for vec4 alignment
      ...color,
      softness, inkDensity,
      0, 0,
    ]);
    this.device.queue.writeBuffer(this.strokeParamsBuffer!, 0, params);

    // 渲染
    const bindGroup = this.device.createBindGroup({
      layout: this.strokePipeline!.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.strokeParamsBuffer! } }],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: 'load',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.strokePipeline!);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, this.strokeVertexBuffer!);
    renderPass.setIndexBuffer(this.strokeIndexBuffer!, 'uint32');
    renderPass.drawIndexed((pointCount - 1) * 6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
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

    const params = new Float32Array([
      x, y,
      length, width,
      angle, noiseAmount,
      softness, seed,
      this.canvasWidth, this.canvasHeight,
      0, 0,
      ...color,
    ]);
    this.device.queue.writeBuffer(this.blobParamsBuffer!, 0, params);

    const bindGroup = this.device.createBindGroup({
      layout: this.blobPipeline!.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.blobParamsBuffer! } }],
    });

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: 'load',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.blobPipeline!);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 绘制山峰（增强版）
   * 生成更真实的山峰轮廓，包含纹理和层次感
   */
  drawMount(x: number, y: number, options: MountOptions = {}): void {
    if (!this.isInitialized) return;

    const {
      height = 200,
      width = 400,
      layers = 3,
      inkDensity = 0.8,
      seed = prng.random() * 1000,
    } = options;

    // Noise functions
    const hash = (a: number, b: number) => {
      const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const fbm = (x: number, y: number, octaves: number = 4): number => {
      let value = 0;
      let amplitude = 0.5;
      let frequency = 1;
      for (let i = 0; i < octaves; i++) {
        value += amplitude * (hash(x * frequency + seed, y * frequency + seed * 0.7) * 2 - 1);
        amplitude *= 0.5;
        frequency *= 2;
      }
      return value;
    };

    // Generate mountain ridge contour
    const generateRidge = (baseY: number, ridgeWidth: number, ridgeHeight: number, layerSeed: number): PathPoint[] => {
      const points: PathPoint[] = [];
      const resolution = 50;

      for (let i = 0; i <= resolution; i++) {
        const t = i / resolution;
        const px = x + (t - 0.5) * ridgeWidth;

        // Base cosine shape for mountain
        const cosShape = Math.cos((t - 0.5) * Math.PI);
        const cosHeight = Math.max(0, cosShape);

        // Add noise for natural variation
        const noiseVal = fbm(t * 3 + layerSeed, layerSeed * 0.1, 4);

        // Final height
        const py = baseY - cosHeight * ridgeHeight * (0.7 + noiseVal * 0.3);

        // Pressure for stroke width variation
        const pressure = 0.8 + hash(i, layerSeed) * 0.4;

        points.push({ x: px, y: py, pressure });
      }

      return points;
    };

    // Draw each layer from back to front
    for (let layer = 0; layer < layers; layer++) {
      const layerT = layer / Math.max(layers - 1, 1);
      const layerSeed = seed + layer * 100;

      // Layer parameters - back layers are higher and wider
      const layerY = y - (1 - layerT) * height * 0.2;
      const layerWidth = width * (0.7 + layerT * 0.3);
      const layerHeight = height * (0.6 + layerT * 0.4);
      const layerOpacity = inkDensity * (0.4 + layerT * 0.5);

      // Generate ridge contour
      const ridge = generateRidge(layerY, layerWidth, layerHeight, layerSeed);

      // 1. Draw filled mountain body using overlapping blobs
      const fillDensity = 15 + layer * 5;
      for (let i = 0; i < fillDensity; i++) {
        const t = i / (fillDensity - 1);
        const ridgeIdx = Math.floor(t * (ridge.length - 1));
        const ridgePt = ridge[ridgeIdx];

        // Fill area from ridge down to base
        const fillHeight = layerY - ridgePt.y;
        const fillSteps = Math.max(1, Math.floor(fillHeight / 15));

        for (let j = 0; j < fillSteps; j++) {
          const fillT = j / Math.max(fillSteps - 1, 1);
          const fillY = ridgePt.y + fillT * fillHeight * 0.8;

          // Blob parameters with variation
          const blobWidth = 20 + hash(i + j, layerSeed) * 25;
          const blobHeight = 12 + hash(layerSeed, i + j) * 18;
          const blobAngle = (hash(i * 2 + j, layerSeed) - 0.5) * 0.6;

          // Opacity gradient - darker at bottom
          const fillOpacity = layerOpacity * (0.3 + fillT * 0.5);

          this.drawBlob(ridgePt.x, fillY, {
            length: blobWidth,
            width: blobHeight,
            angle: blobAngle,
            color: [0.1, 0.1, 0.12, fillOpacity],
            noiseAmount: 0.4,
            softness: 0.5,
            seed: layerSeed + i * 10 + j,
          });
        }
      }

      // 2. Draw ridge outline with stroke
      this.drawStroke(ridge, {
        width: 2 + layer * 0.5,
        color: [0.1, 0.1, 0.1, layerOpacity * 0.6],
        noiseAmount: 0.3,
        softness: 0.4,
        inkDensity: 0.8,
      });

      // 3. Add texture strokes (皴法)
      const textureCount = 20 + layer * 10;
      for (let i = 0; i < textureCount; i++) {
        const t = hash(i, layerSeed * 2);
        const ridgeIdx = Math.floor(t * (ridge.length - 1));
        const ridgePt = ridge[ridgeIdx];

        // Texture position below ridge
        const texY = ridgePt.y + hash(i * 2, layerSeed) * (layerY - ridgePt.y) * 0.7;
        const texX = ridgePt.x + (hash(layerSeed, i * 2) - 0.5) * 30;

        // Short texture stroke
        const texLen = 8 + hash(i * 3, layerSeed) * 15;
        const texAngle = -Math.PI / 4 + (hash(i, layerSeed * 3) - 0.5) * 0.5;

        const texPoints: PathPoint[] = [];
        for (let j = 0; j < 5; j++) {
          const jt = j / 4;
          texPoints.push({
            x: texX + Math.cos(texAngle) * texLen * (jt - 0.5),
            y: texY + Math.sin(texAngle) * texLen * (jt - 0.5),
            pressure: 0.5 + (1 - Math.abs(jt - 0.5) * 2) * 0.5,
          });
        }

        this.drawStroke(texPoints, {
          width: 1,
          color: [0.1, 0.1, 0.12, layerOpacity * (0.2 + hash(i * 4, layerSeed) * 0.3)],
          noiseAmount: 0.3,
          softness: 0.5,
        });
      }

      // 4. Add trees/vegetation on top layer
      if (layer === layers - 1 && inkDensity > 0.5) {
        const treeCount = Math.floor(3 + hash(layerSeed, 0) * 4);
        for (let i = 0; i < treeCount; i++) {
          const t = 0.2 + hash(i, layerSeed * 5) * 0.6;
          const ridgeIdx = Math.floor(t * (ridge.length - 1));
          const ridgePt = ridge[ridgeIdx];

          // Small tree cluster
          const treeX = ridgePt.x + (hash(i * 5, layerSeed) - 0.5) * 30;
          const treeY = ridgePt.y - 5;
          const treeHeight = 15 + hash(layerSeed * 6, i) * 25;

          // Tree trunk
          const trunkPoints: PathPoint[] = [];
          for (let j = 0; j < 8; j++) {
            const jt = j / 7;
            trunkPoints.push({
              x: treeX + (hash(j, layerSeed + i) - 0.5) * 3 * jt,
              y: treeY - jt * treeHeight * 0.5,
              pressure: 1 - jt * 0.7,
            });
          }

          this.drawStroke(trunkPoints, {
            width: 1.5,
            color: [0.1, 0.08, 0.05, layerOpacity * 0.8],
            noiseAmount: 0.2,
          });

          // Tree foliage (small blobs)
          for (let j = 0; j < 4; j++) {
            const angle = hash(j + i * 10, layerSeed) * Math.PI * 2;
            const dist = 3 + hash(layerSeed, j + i * 10) * 8;

            this.drawBlob(
              treeX + Math.cos(angle) * dist,
              treeY - treeHeight * 0.4 + Math.sin(angle) * dist * 0.5,
              {
                length: 5 + hash(j, layerSeed + i) * 6,
                width: 4 + hash(layerSeed + i, j) * 5,
                angle: hash(j * 2, layerSeed + i) * Math.PI,
                color: [0.08, 0.1, 0.08, layerOpacity * 0.6],
                noiseAmount: 0.4,
                softness: 0.5,
                seed: layerSeed + i * 100 + j,
              }
            );
          }
        }
      }
    }
  }

  /**
   * 绘制水面（简化版）
   */
  drawWater(x: number, y: number, options: WaterOptions = {}): void {
    if (!this.isInitialized) return;

    const {
      length = 600,
      clusters = 15,
      density = 5,
      inkDensity = 0.5,
      seed = prng.random() * 1000,
    } = options;

    const hash = (a: number, b: number) => {
      const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let c = 0; c < clusters; c++) {
      const clusterX = x - length / 2 + (c / clusters) * length;

      for (let d = 0; d < density; d++) {
        const points: PathPoint[] = [];
        const startX = clusterX + (hash(c, d + seed) - 0.5) * 30;
        const startY = y + d * 5 + (hash(d, c + seed) - 0.5) * 10;
        const strokeLen = 20 + hash(c + d, seed) * 40;

        for (let i = 0; i < 10; i++) {
          const t = i / 9;
          points.push({
            x: startX + t * strokeLen,
            y: startY + Math.sin(t * Math.PI * 2) * 2,
            pressure: 0.3 + (1 - Math.abs(t - 0.5) * 2) * 0.5,
          });
        }

        this.drawStroke(points, {
          width: 1.5,
          color: [0.15, 0.18, 0.2, inkDensity],
          noiseAmount: 0.2,
          softness: 0.4,
        });
      }
    }
  }

  /**
   * 绘制树木（简化版）
   */
  drawTree(x: number, y: number, options: TreeOptions = {}): void {
    if (!this.isInitialized) return;

    const {
      height = 150,
      width = 80,
      type = TreeType.Simple,
      leafDensity = 0.6,
      inkDensity = 0.85,
      seed = prng.random() * 1000,
    } = options;

    const hash = (a: number, b: number) => {
      const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    // 树干
    const trunkPoints: PathPoint[] = [];
    for (let i = 0; i < 15; i++) {
      const t = i / 14;
      trunkPoints.push({
        x: x + (hash(i, seed) - 0.5) * 10 * t,
        y: y - t * height * 0.4,
        pressure: 1 - t * 0.6,
      });
    }

    this.drawStroke(trunkPoints, {
      width: 4,
      color: [0.12, 0.08, 0.05, inkDensity],
      noiseAmount: 0.3,
    });

    // 树冠（墨点）
    const leafCount = Math.floor(20 * leafDensity);
    const topY = y - height * 0.4;

    for (let i = 0; i < leafCount; i++) {
      const angle = hash(i, seed) * Math.PI * 2;
      const dist = hash(seed, i) * width * 0.5;
      const leafX = x + Math.cos(angle) * dist;
      const leafY = topY - height * 0.3 + Math.sin(angle) * dist * 0.5;

      this.drawBlob(leafX, leafY, {
        length: 8 + hash(i * 2, seed) * 12,
        width: 6 + hash(seed, i * 2) * 8,
        angle: hash(i, seed * 2) * Math.PI,
        color: [0.08, 0.12, 0.08, inkDensity * (0.5 + hash(i * 3, seed) * 0.4)],
        noiseAmount: 0.5,
        softness: 0.4,
        seed: seed + i,
      });
    }
  }

  /**
   * 绘制纹理区域
   */
  drawTexture(
    region: { x: number; y: number; width: number; height: number },
    options: TextureOptions = {}
  ): void {
    if (!this.isInitialized) return;

    const {
      lineCount = 100,
      strokeWidth = 1.5,
      inkDensity = 0.6,
      direction = -Math.PI / 4,
      noiseAmount = 0.5,
      seed = prng.random() * 1000,
    } = options;

    const hash = (a: number, b: number) => {
      const n = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    for (let i = 0; i < lineCount; i++) {
      const t = i / lineCount;
      const noise1 = hash(i * 0.1, seed) * 2 - 1;
      const noise2 = hash(seed, i * 0.15) * 2 - 1;

      const baseX = region.x + (noise1 + 1) * 0.5 * region.width;
      const baseY = region.y + t * region.height;

      const lineLen = 8 + Math.abs(noise2) * 20;
      const angle = direction + noise2 * noiseAmount * 0.5;

      const points: PathPoint[] = [];
      for (let j = 0; j < 5; j++) {
        const lt = j / 4;
        points.push({
          x: baseX + Math.cos(angle) * lineLen * (lt - 0.5),
          y: baseY + Math.sin(angle) * lineLen * (lt - 0.5),
          pressure: 0.5 + (1 - Math.abs(lt - 0.5) * 2) * 0.5,
        });
      }

      this.drawStroke(points, {
        width: strokeWidth,
        color: [0.1, 0.1, 0.12, inkDensity * (0.3 + Math.abs(noise1) * 0.5)],
        noiseAmount: 0.3,
        softness: 0.5,
      });
    }
  }

  /**
   * 释放资源
   */
  destroy(): void {
    this.strokeParamsBuffer?.destroy();
    this.strokeVertexBuffer?.destroy();
    this.strokeIndexBuffer?.destroy();
    this.blobParamsBuffer?.destroy();

    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }
}

export default ShuimoEngine;
