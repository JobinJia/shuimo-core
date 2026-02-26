/**
 * WebGPU 树木渲染器
 *
 * 使用 GPU 加速渲染水墨风格的树木
 * 支持多种树型：竖直树、弯曲树、分形树、松树等
 */

import { prng } from '../foundation/random';

export enum TreeType {
  Simple = 0,      // 简单竖直树
  Curved = 1,      // 弯曲树干
  Branching = 2,   // 分支树
  Pine = 3,        // 松树
  Willow = 4,      // 柳树
  Bush = 5,        // 灌木
}

export interface TreeOptions {
  /** 树高 */
  height?: number;
  /** 树宽（树冠） */
  width?: number;
  /** 树型 */
  type?: TreeType;
  /** 树干弯曲度 0-1 */
  curvature?: number;
  /** 分支层数 */
  branchLevels?: number;
  /** 叶子密度 0-1 */
  leafDensity?: number;
  /** 墨色浓度 0-1 */
  inkDensity?: number;
  /** 随机种子 */
  seed?: number;
}

// 树木渲染 Shader
const treeShader = /* wgsl */ `
  struct TreeParams {
    centerX: f32,
    centerY: f32,
    height: f32,
    width: f32,
    treeType: u32,
    curvature: f32,
    branchLevels: u32,
    leafDensity: f32,
    inkDensity: f32,
    seed: f32,
    canvasWidth: f32,
    canvasHeight: f32,
  }

  struct TreeSegment {
    x1: f32, y1: f32,
    x2: f32, y2: f32,
    width: f32,
    opacity: f32,
    segmentType: u32,  // 0: trunk, 1: branch, 2: leaf
    padding: f32,
  }

  @group(0) @binding(0) var<uniform> params: TreeParams;
  @group(0) @binding(1) var<storage, read_write> segments: array<TreeSegment>;
  @group(0) @binding(2) var<uniform> segmentCount: u32;

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

  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) opacity: f32,
    @location(1) uv: f32,
    @location(2) segmentType: f32,
  }

  struct SegmentVertex {
    @location(0) pos: vec2<f32>,
    @location(1) opacity: f32,
    @location(2) uv: f32,
    @location(3) segmentType: f32,
  }

  @vertex
  fn vertexMain(input: SegmentVertex) -> VertexOutput {
    var output: VertexOutput;
    let x = (input.pos.x / params.canvasWidth) * 2.0 - 1.0;
    let y = 1.0 - (input.pos.y / params.canvasHeight) * 2.0;
    output.position = vec4<f32>(x, y, 0.0, 1.0);
    output.opacity = input.opacity;
    output.uv = input.uv;
    output.segmentType = input.segmentType;
    return output;
  }

  @fragment
  fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let edgeFade = 1.0 - smoothstep(0.6, 1.0, abs(input.uv * 2.0 - 1.0));
    let alpha = input.opacity * edgeFade;

    // 根据类型选择颜色
    var inkColor: vec3<f32>;
    if (input.segmentType < 0.5) {
      // 树干 - 深褐色
      inkColor = vec3<f32>(0.12, 0.08, 0.05);
    } else if (input.segmentType < 1.5) {
      // 树枝 - 褐色
      inkColor = vec3<f32>(0.18, 0.12, 0.08);
    } else {
      // 叶子 - 墨绿
      inkColor = vec3<f32>(0.08, 0.12, 0.08);
    }

    return vec4<f32>(inkColor, alpha);
  }
`;

/**
 * WebGPU 树木渲染器
 */
export class TreeRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = 'bgra8unorm';

  private renderPipeline: GPURenderPipeline | null = null;

  private paramsBuffer: GPUBuffer | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private maxSegments = 5000;

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
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.vertexBuffer = this.device.createBuffer({
      size: this.maxSegments * 4 * 20,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.indexBuffer = this.device.createBuffer({
      size: this.maxSegments * 6 * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
  }

  private async createPipelines(): Promise<void> {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({
      code: treeShader,
    });

    this.renderPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32' },
            { shaderLocation: 2, offset: 12, format: 'float32' },
            { shaderLocation: 3, offset: 16, format: 'float32' },
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
   * 绘制树木
   */
  drawTree(x: number, y: number, options: TreeOptions = {}): void {
    if (!this.isInitialized || !this.device || !this.context) return;

    const {
      height = 150,
      width = 80,
      type = TreeType.Simple,
      curvature = 0.2,
      branchLevels = 3,
      leafDensity = 0.6,
      inkDensity = 0.85,
      seed = prng.random() * 1000,
    } = options;

    // 更新参数
    const paramsData = new ArrayBuffer(48);
    const view = new DataView(paramsData);
    view.setFloat32(0, x, true);
    view.setFloat32(4, y, true);
    view.setFloat32(8, height, true);
    view.setFloat32(12, width, true);
    view.setUint32(16, type, true);
    view.setFloat32(20, curvature, true);
    view.setUint32(24, branchLevels, true);
    view.setFloat32(28, leafDensity, true);
    view.setFloat32(32, inkDensity, true);
    view.setFloat32(36, seed, true);
    view.setFloat32(40, this.canvasWidth, true);
    view.setFloat32(44, this.canvasHeight, true);

    this.device.queue.writeBuffer(this.paramsBuffer!, 0, paramsData);

    // 生成树的几何数据
    const segmentCount = this.generateTreeGeometry(x, y, height, width, type, curvature, branchLevels, leafDensity, inkDensity, seed);

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
    renderPass.drawIndexed(segmentCount * 6);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  private generateTreeGeometry(
    centerX: number, centerY: number,
    height: number, width: number,
    type: TreeType, curvature: number,
    branchLevels: number, leafDensity: number,
    inkDensity: number, seed: number
  ): number {
    if (!this.device) return 0;

    const segments: Array<{
      x1: number; y1: number;
      x2: number; y2: number;
      width: number; opacity: number;
      type: number;
    }> = [];

    // 伪随机函数
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const noise = (x: number) => hash(x * 0.1, seed) * 2 - 1;

    // 根据树型生成不同结构
    switch (type) {
      case TreeType.Simple:
      case TreeType.Curved:
        this.generateSimpleTree(segments, centerX, centerY, height, width, curvature, leafDensity, inkDensity, noise);
        break;
      case TreeType.Branching:
        this.generateBranchingTree(segments, centerX, centerY, height, width, branchLevels, leafDensity, inkDensity, noise);
        break;
      case TreeType.Pine:
        this.generatePineTree(segments, centerX, centerY, height, width, leafDensity, inkDensity, noise);
        break;
      case TreeType.Willow:
        this.generateWillowTree(segments, centerX, centerY, height, width, leafDensity, inkDensity, noise);
        break;
      case TreeType.Bush:
        this.generateBush(segments, centerX, centerY, height, width, leafDensity, inkDensity, noise);
        break;
    }

    // 转换为顶点数据
    const segmentCount = Math.min(segments.length, this.maxSegments);
    const vertices = new Float32Array(segmentCount * 4 * 5);
    const indices = new Uint32Array(segmentCount * 6);

    for (let i = 0; i < segmentCount; i++) {
      const seg = segments[i];

      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len * seg.width;
      const ny = dx / len * seg.width;

      const vi = i * 20;
      // 4 顶点 x 5 floats
      vertices[vi + 0] = seg.x1 + nx; vertices[vi + 1] = seg.y1 + ny;
      vertices[vi + 2] = seg.opacity; vertices[vi + 3] = 0; vertices[vi + 4] = seg.type;

      vertices[vi + 5] = seg.x1 - nx; vertices[vi + 6] = seg.y1 - ny;
      vertices[vi + 7] = seg.opacity; vertices[vi + 8] = 1; vertices[vi + 9] = seg.type;

      vertices[vi + 10] = seg.x2 + nx; vertices[vi + 11] = seg.y2 + ny;
      vertices[vi + 12] = seg.opacity; vertices[vi + 13] = 0; vertices[vi + 14] = seg.type;

      vertices[vi + 15] = seg.x2 - nx; vertices[vi + 16] = seg.y2 - ny;
      vertices[vi + 17] = seg.opacity; vertices[vi + 18] = 1; vertices[vi + 19] = seg.type;

      const ii = i * 6;
      const v = i * 4;
      indices[ii + 0] = v + 0; indices[ii + 1] = v + 1; indices[ii + 2] = v + 2;
      indices[ii + 3] = v + 2; indices[ii + 4] = v + 1; indices[ii + 5] = v + 3;
    }

    this.device.queue.writeBuffer(this.vertexBuffer!, 0, vertices);
    this.device.queue.writeBuffer(this.indexBuffer!, 0, indices);

    return segmentCount;
  }

  private generateSimpleTree(
    segments: Array<any>,
    x: number, y: number,
    height: number, width: number,
    curvature: number, leafDensity: number,
    inkDensity: number, noise: (x: number) => number
  ): void {
    // 树干
    const trunkSegments = 10;
    const trunkWidth = 4;
    let lastX = x, lastY = y;

    for (let i = 0; i < trunkSegments; i++) {
      const t = (i + 1) / trunkSegments;
      const bend = noise(i) * curvature * 20;
      const newX = x + bend * t;
      const newY = y - height * t;
      const w = trunkWidth * (1 - t * 0.6);

      segments.push({
        x1: lastX, y1: lastY,
        x2: newX, y2: newY,
        width: w, opacity: inkDensity,
        type: 0,
      });

      lastX = newX;
      lastY = newY;
    }

    // 树冠（叶子）
    const leafCount = Math.floor(leafDensity * 30);
    for (let i = 0; i < leafCount; i++) {
      const angle = noise(i * 10) * Math.PI * 2;
      const dist = (0.3 + noise(i * 20) * 0.7) * width * 0.5;
      const leafX = lastX + Math.cos(angle) * dist;
      const leafY = lastY - height * 0.2 + Math.sin(angle) * dist * 0.6;
      const leafLen = 5 + noise(i * 30) * 10;
      const leafAngle = angle + noise(i * 40) * 0.5;

      segments.push({
        x1: leafX, y1: leafY,
        x2: leafX + Math.cos(leafAngle) * leafLen,
        y2: leafY + Math.sin(leafAngle) * leafLen,
        width: 2 + noise(i * 50),
        opacity: inkDensity * (0.5 + noise(i * 60) * 0.3),
        type: 2,
      });
    }
  }

  private generateBranchingTree(
    segments: Array<any>,
    x: number, y: number,
    height: number, width: number,
    levels: number, leafDensity: number,
    inkDensity: number, noise: (x: number) => number
  ): void {
    const addBranch = (
      x1: number, y1: number,
      angle: number, length: number,
      w: number, level: number, idx: number
    ) => {
      if (level <= 0 || length < 5) return;

      const x2 = x1 + Math.cos(angle) * length;
      const y2 = y1 + Math.sin(angle) * length;

      segments.push({
        x1, y1, x2, y2,
        width: w,
        opacity: inkDensity * (0.7 + level / levels * 0.3),
        type: level === levels ? 0 : 1,
      });

      // 子分支
      const branchCount = 2 + Math.floor(noise(idx * 100) * 2);
      for (let i = 0; i < branchCount; i++) {
        const branchAngle = angle + (noise(idx * 100 + i * 10) - 0.5) * 1.2;
        const branchLen = length * (0.6 + noise(idx * 100 + i * 20) * 0.2);
        addBranch(x2, y2, branchAngle, branchLen, w * 0.7, level - 1, idx * 10 + i);
      }

      // 叶子（最后一层）
      if (level === 1) {
        for (let i = 0; i < 3 * leafDensity; i++) {
          const leafAngle = angle + (noise(idx * 1000 + i) - 0.5) * 2;
          const leafLen = 5 + noise(idx * 1000 + i * 10) * 8;
          segments.push({
            x1: x2, y1: y2,
            x2: x2 + Math.cos(leafAngle) * leafLen,
            y2: y2 + Math.sin(leafAngle) * leafLen,
            width: 1.5,
            opacity: inkDensity * 0.6,
            type: 2,
          });
        }
      }
    };

    addBranch(x, y, -Math.PI / 2, height, 5, levels, 0);
  }

  private generatePineTree(
    segments: Array<any>,
    x: number, y: number,
    height: number, width: number,
    leafDensity: number, inkDensity: number,
    noise: (x: number) => number
  ): void {
    // 树干
    segments.push({
      x1: x, y1: y,
      x2: x, y2: y - height,
      width: 3,
      opacity: inkDensity,
      type: 0,
    });

    // 松针层
    const layers = 6;
    for (let layer = 0; layer < layers; layer++) {
      const layerY = y - height * 0.2 - (height * 0.8 * layer / layers);
      const layerWidth = width * (1 - layer / layers * 0.7);

      const needles = Math.floor(8 * leafDensity);
      for (let i = 0; i < needles; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const baseAngle = side * (0.3 + noise(layer * 100 + i) * 0.4);
        const needleLen = layerWidth * 0.5 * (0.7 + noise(layer * 100 + i * 10) * 0.3);

        segments.push({
          x1: x, y1: layerY,
          x2: x + Math.cos(baseAngle - Math.PI / 2) * needleLen * side,
          y2: layerY + Math.sin(baseAngle - Math.PI / 2) * needleLen - 10,
          width: 1.5,
          opacity: inkDensity * (0.6 + noise(layer * 100 + i * 20) * 0.3),
          type: 2,
        });
      }
    }
  }

  private generateWillowTree(
    segments: Array<any>,
    x: number, y: number,
    height: number, width: number,
    leafDensity: number, inkDensity: number,
    noise: (x: number) => number
  ): void {
    // 弯曲的树干
    const trunkSegments = 8;
    let lastX = x, lastY = y;

    for (let i = 0; i < trunkSegments; i++) {
      const t = (i + 1) / trunkSegments;
      const newX = x + noise(i) * 15 * t;
      const newY = y - height * 0.4 * t;

      segments.push({
        x1: lastX, y1: lastY,
        x2: newX, y2: newY,
        width: 4 * (1 - t * 0.5),
        opacity: inkDensity,
        type: 0,
      });

      lastX = newX;
      lastY = newY;
    }

    // 垂柳枝条
    const branchCount = Math.floor(15 * leafDensity);
    for (let i = 0; i < branchCount; i++) {
      const branchStartAngle = (i / branchCount - 0.5) * Math.PI;
      const branchX = lastX + Math.cos(branchStartAngle) * 20;
      const branchY = lastY + Math.sin(branchStartAngle) * 10;

      // 下垂的枝条
      const segments_count = 8;
      let bx = branchX, by = branchY;
      for (let j = 0; j < segments_count; j++) {
        const t = j / segments_count;
        const newBx = bx + noise(i * 100 + j) * 5;
        const newBy = by + 15 + t * 10;

        segments.push({
          x1: bx, y1: by,
          x2: newBx, y2: newBy,
          width: 1 + (1 - t) * 1.5,
          opacity: inkDensity * (0.4 + noise(i * 100 + j * 10) * 0.3),
          type: 2,
        });

        bx = newBx;
        by = newBy;
      }
    }
  }

  private generateBush(
    segments: Array<any>,
    x: number, y: number,
    height: number, width: number,
    leafDensity: number, inkDensity: number,
    noise: (x: number) => number
  ): void {
    // 多个重叠的椭圆形墨点
    const blobCount = Math.floor(10 * leafDensity);

    for (let i = 0; i < blobCount; i++) {
      const angle = noise(i) * Math.PI * 2;
      const dist = noise(i * 10) * width * 0.4;
      const blobX = x + Math.cos(angle) * dist;
      const blobY = y - height * 0.3 - noise(i * 20) * height * 0.4;

      // 用多条线段模拟椭圆
      const blobSize = 10 + noise(i * 30) * 15;
      const segCount = 8;
      for (let j = 0; j < segCount; j++) {
        const a1 = (j / segCount) * Math.PI * 2;
        const a2 = ((j + 1) / segCount) * Math.PI * 2;

        segments.push({
          x1: blobX + Math.cos(a1) * blobSize,
          y1: blobY + Math.sin(a1) * blobSize * 0.7,
          x2: blobX + Math.cos(a2) * blobSize,
          y2: blobY + Math.sin(a2) * blobSize * 0.7,
          width: 3 + noise(i * 100 + j) * 2,
          opacity: inkDensity * (0.5 + noise(i * 100 + j * 10) * 0.3),
          type: 2,
        });
      }
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

export default TreeRenderer;
