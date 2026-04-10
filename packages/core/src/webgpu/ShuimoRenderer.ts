/**
 * Shuimo WebGPU Renderer
 *
 * 使用与原版 SVG 相同的算法，通过 WebGPU 渲染水墨画效果
 * 核心算法：多层轮廓线 + 皴法纹理采样
 */

import { prng } from "../foundation/random";

type Point = [number, number];
type Polygon = Point[];

export interface RendererOptions {
  backgroundColor?: [number, number, number, number];
}

// 多边形填充 Shader
const polygonShader = /* wgsl */ `
  struct Params {
    canvasWidth: f32,
    canvasHeight: f32,
    padding1: f32,
    padding2: f32,
    color: vec4<f32>,
  }

  @group(0) @binding(0) var<uniform> params: Params;

  struct VertexInput {
    @location(0) position: vec2<f32>,
  }

  struct VertexOutput {
    @builtin(position) clipPosition: vec4<f32>,
  }

  @vertex
  fn vertexMain(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    let x = (input.position.x / params.canvasWidth) * 2.0 - 1.0;
    let y = 1.0 - (input.position.y / params.canvasHeight) * 2.0;
    output.clipPosition = vec4<f32>(x, y, 0.0, 1.0);
    return output;
  }

  @fragment
  fn fragmentMain() -> @location(0) vec4<f32> {
    return params.color;
  }
`;

/**
 * 简化的 Perlin Noise 实现
 * 用于 WebGPU 渲染器，与原版 noise.noise() 行为类似
 */
class PerlinNoiseGen {
  private readonly PERLIN_YWRAPB = 4;
  private readonly PERLIN_YWRAP = 1 << this.PERLIN_YWRAPB;
  private readonly PERLIN_ZWRAPB = 8;
  private readonly PERLIN_ZWRAP = 1 << this.PERLIN_ZWRAPB;
  private readonly PERLIN_SIZE = 4095;
  private perlin_octaves = 4;
  private perlin_amp_falloff = 0.5;
  private perlin: number[] | null = null;

  private scaledCosine(i: number): number {
    return 0.5 * (1.0 - Math.cos(i * Math.PI));
  }

  noise(x: number, y: number = 0, z: number = 0): number {
    if (this.perlin == null) {
      this.perlin = new Array(this.PERLIN_SIZE + 1);
      for (let i = 0; i < this.PERLIN_SIZE + 1; i++) {
        this.perlin[i] = prng.random();
      }
    }

    if (x < 0) x = -x;
    if (y < 0) y = -y;
    if (z < 0) z = -z;

    let xi = Math.floor(x);
    let yi = Math.floor(y);
    let zi = Math.floor(z);
    let xf = x - xi;
    let yf = y - yi;
    let zf = z - zi;

    let rxf: number, ryf: number;
    let r = 0;
    let ampl = 0.5;
    let n1: number, n2: number, n3: number;

    for (let o = 0; o < this.perlin_octaves; o++) {
      let of = xi + (yi << this.PERLIN_YWRAPB) + (zi << this.PERLIN_ZWRAPB);
      rxf = this.scaledCosine(xf);
      ryf = this.scaledCosine(yf);

      n1 = this.perlin[of & this.PERLIN_SIZE];
      n1 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n1);
      n2 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
      n2 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n2);
      n1 += ryf * (n2 - n1);

      of += this.PERLIN_ZWRAP;
      n2 = this.perlin[of & this.PERLIN_SIZE];
      n2 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n2);
      n3 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
      n3 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n3);
      n2 += ryf * (n3 - n2);

      n1 += this.scaledCosine(zf) * (n2 - n1);
      r += n1 * ampl;
      ampl *= this.perlin_amp_falloff;

      xi <<= 1;
      xf *= 2;
      yi <<= 1;
      yf *= 2;
      zi <<= 1;
      zf *= 2;

      if (xf >= 1.0) {
        xi++;
        xf--;
      }
      if (yf >= 1.0) {
        yi++;
        yf--;
      }
      if (zf >= 1.0) {
        zi++;
        zf--;
      }
    }

    return r;
  }
}

// 全局噪声实例
const perlinNoise = new PerlinNoiseGen();

// 兼容原版 noise.noise() 的调用方式
const noiseNoise = (x: number, y?: number, seed?: number): number => {
  return perlinNoise.noise(x, y ?? 0, seed ?? 0);
};

// 保留简单噪声用于快速计算
function simpleNoise(x: number, y: number = 0, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
  return n - Math.floor(n);
}

function fbmNoise(x: number, y: number, seed: number, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * (perlinNoise.noise(x * frequency, y * frequency, seed + i) * 2 - 1);
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

// 简单三角形化（扇形法）- 适用于大多数山体形状
function triangulate(polygon: Polygon): number[] {
  if (polygon.length < 3) return [];
  const indices: number[] = [];
  for (let i = 1; i < polygon.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

/**
 * Shuimo WebGPU 渲染器
 */
export class ShuimoRenderer {
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private format: GPUTextureFormat = "bgra8unorm";

  private polygonPipeline: GPURenderPipeline | null = null;
  private polygonParamsBuffer: GPUBuffer | null = null;
  private polygonVertexBuffer: GPUBuffer | null = null;
  private polygonIndexBuffer: GPUBuffer | null = null;

  private canvasWidth = 0;
  private canvasHeight = 0;
  private backgroundColor: [number, number, number, number] = [0.96, 0.94, 0.88, 1.0];

  private isInitialized = false;
  private maxVertices = 50000;
  private maxIndices = 150000;

  constructor(options: RendererOptions = {}) {
    if (options.backgroundColor) {
      this.backgroundColor = options.backgroundColor;
    }
  }

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

    await this.createResources();
    this.isInitialized = true;
    this.clear();

    return true;
  }

  private async createResources(): Promise<void> {
    if (!this.device) return;

    // Polygon buffers
    this.polygonParamsBuffer = this.device.createBuffer({
      size: 32, // 2 floats + 2 padding + vec4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.polygonVertexBuffer = this.device.createBuffer({
      size: this.maxVertices * 8, // 2 floats per vertex
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.polygonIndexBuffer = this.device.createBuffer({
      size: this.maxIndices * 4,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    // Polygon pipeline
    const polygonModule = this.device.createShaderModule({ code: polygonShader });

    this.polygonPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: polygonModule,
        entryPoint: "vertexMain",
        buffers: [
          {
            arrayStride: 8,
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x2" }],
          },
        ],
      },
      fragment: {
        module: polygonModule,
        entryPoint: "fragmentMain",
        targets: [
          {
            format: this.format,
            blend: {
              color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
  }

  clear(): void {
    if (!this.device || !this.context) return;

    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: this.backgroundColor[0],
            g: this.backgroundColor[1],
            b: this.backgroundColor[2],
            a: this.backgroundColor[3],
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 绘制填充多边形
   */
  drawPolygon(polygon: Polygon, color: [number, number, number, number]): void {
    if (!this.isInitialized || !this.device || !this.context || polygon.length < 3) return;

    // 准备顶点数据
    const vertices = new Float32Array(polygon.length * 2);
    for (let i = 0; i < polygon.length; i++) {
      vertices[i * 2] = polygon[i][0];
      vertices[i * 2 + 1] = polygon[i][1];
    }

    // 三角形化
    const indices = triangulate(polygon);
    const indexData = new Uint32Array(indices);

    this.device.queue.writeBuffer(this.polygonVertexBuffer!, 0, vertices);
    this.device.queue.writeBuffer(this.polygonIndexBuffer!, 0, indexData);

    // 更新参数
    const params = new Float32Array([
      this.canvasWidth,
      this.canvasHeight,
      0,
      0, // padding for vec4 alignment
      ...color,
    ]);
    this.device.queue.writeBuffer(this.polygonParamsBuffer!, 0, params);

    // 渲染
    const bindGroup = this.device.createBindGroup({
      layout: this.polygonPipeline!.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.polygonParamsBuffer! } }],
    });

    const commandEncoder = this.device.createCommandEncoder();
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

    renderPass.setPipeline(this.polygonPipeline!);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, this.polygonVertexBuffer!);
    renderPass.setIndexBuffer(this.polygonIndexBuffer!, "uint32");
    renderPass.drawIndexed(indices.length);
    renderPass.end();

    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * 绘制笔触（生成闭合多边形然后填充）
   */
  drawStroke(
    points: Point[],
    width: number,
    color: [number, number, number, number],
    noiseAmount: number = 0.5,
  ): void {
    if (points.length < 2) return;

    const n0 = prng.random() * 10;
    const widthFunc = (t: number) => Math.sin(t * Math.PI);

    const leftSide: Point[] = [];
    const rightSide: Point[] = [];

    for (let i = 0; i < points.length; i++) {
      const t = i / (points.length - 1);
      let w = width * widthFunc(t);
      w = w * (1 - noiseAmount) + w * noiseAmount * simpleNoise(i * 0.5, n0);

      // 计算法线方向
      let dx: number, dy: number;
      if (i === 0) {
        dx = points[1][0] - points[0][0];
        dy = points[1][1] - points[0][1];
      } else if (i === points.length - 1) {
        dx = points[i][0] - points[i - 1][0];
        dy = points[i][1] - points[i - 1][1];
      } else {
        dx = points[i + 1][0] - points[i - 1][0];
        dy = points[i + 1][1] - points[i - 1][1];
      }

      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      leftSide.push([points[i][0] + nx * w, points[i][1] + ny * w]);
      rightSide.push([points[i][0] - nx * w, points[i][1] - ny * w]);
    }

    // 组合成闭合多边形
    const polygon: Polygon = [...leftSide, ...rightSide.reverse()];
    this.drawPolygon(polygon, color);
  }

  /**
   * 绘制山峰 - 100% 还原原版 Mount.mountain() 算法
   * 绘制顺序（关键！）：
   * 1. RIM 植被 (最外层边缘)
   * 2. 白色背景多边形
   * 3. 轮廓线
   * 4. 山脚 (foot)
   * 5. 皴法纹理 (texture)
   * 6. TOP 植被
   * 7. MIDDLE/BOTTOM 植被 (if veg=true)
   */
  drawMountain(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
      texture?: number;
      vegetation?: boolean;
    } = {},
  ): void {
    const h = options.height ?? 200;
    const w = options.width ?? 400;
    const tex = options.texture ?? 200;
    const veg = options.vegetation ?? true;

    // ===== Step 1: 生成多层轮廓线 (与原版完全相同) =====
    const reso: [number, number] = [10, 50]; // 10层，每层50个点
    const ptlist: Polygon[] = [];

    let hoff = 0;
    for (let j = 0; j < reso[0]; j++) {
      hoff += (prng.random() * yoff) / 100;
      ptlist.push([]);
      for (let i = 0; i < reso[1]; i++) {
        const x = (i / reso[1] - 0.5) * Math.PI;
        let y = Math.cos(x);
        y *= noiseNoise(x + 10, j * 0.15, seed);
        const p = 1 - j / reso[0];
        ptlist[ptlist.length - 1].push([(x / Math.PI) * w * p, -y * h * p + hoff]);
      }
    }

    // ===== Step 2: RIM 植被 (最外层边缘) - 在背景之前绘制！ =====
    this.drawMountainRimVegetation(ptlist, xoff, yoff, h, seed);

    // ===== Step 3: 白色背景多边形 =====
    const bgPolygon: Polygon = [...ptlist[0], [0, reso[0] * 4]];
    this.drawPolygon(
      bgPolygon.map((p) => [p[0] + xoff, p[1] + yoff]),
      [1, 1, 1, 1], // 白色
    );

    // ===== Step 4: 轮廓线 =====
    const outlinePoints: Point[] = ptlist[0].map((p) => [p[0] + xoff, p[1] + yoff]);
    this.drawStroke(outlinePoints, 3, [0.39, 0.39, 0.39, 0.3], 1);

    // ===== Step 5: 山脚 (foot) =====
    this.drawMountainFoot(ptlist, xoff, yoff, seed);

    // ===== Step 6: 皴法纹理 (texture) =====
    this.drawMountainTexture(ptlist, xoff, yoff, tex, seed);

    // ===== Step 7: TOP 植被 =====
    this.drawMountainTopVegetation(ptlist, xoff, yoff, h, seed);

    // ===== Step 8: MIDDLE/BOTTOM 植被 (if veg=true) =====
    if (veg) {
      this.drawMountainMiddleVegetation(ptlist, xoff, yoff, h, seed);
      this.drawMountainBottomVegetation(ptlist, xoff, yoff, h, seed);
    }
  }

  /**
   * RIM 植被 - 最外层边缘的树（在背景之前绘制）
   * 原版: tree02, clu=2, y-5, i===0 && ns^3<0.1 && abs(y)/h>0.2
   */
  private drawMountainRimVegetation(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    h: number,
    seed: number,
  ): void {
    for (let i = 0; i < ptlist.length; i++) {
      for (let j = 0; j < ptlist[i].length; j++) {
        const ns = noiseNoise(j * 0.1, seed);
        // 条件：最外层 && 噪声 && 高度 > 20%
        if (i === 0 && ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.2) {
          const x = ptlist[i][j][0];
          const y = ptlist[i][j][1];

          this.drawTree02(x + xoff, y + yoff - 5, seed + j, {
            height: 16,
            clusters: 2, // RIM 使用 clu=2
          });
        }
      }
    }
  }

  /**
   * TOP 植被 - 山顶树（在纹理之后绘制）
   * 原版: tree02, 默认 clu, ns^3<0.1 && abs(y)/h>0.5
   */
  private drawMountainTopVegetation(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    h: number,
    seed: number,
  ): void {
    for (let i = 0; i < ptlist.length; i++) {
      for (let j = 0; j < ptlist[i].length; j++) {
        const ns = noiseNoise(i * 0.1, j * 0.1, seed + 2);
        // 条件：噪声 && 高度 > 50%
        if (ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.5) {
          const x = ptlist[i][j][0];
          const y = ptlist[i][j][1];

          this.drawTree02(x + xoff, y + yoff, seed + i * 100 + j, {
            height: 16,
            clusters: 5, // 默认 clu
          });
        }
      }
    }
  }

  /**
   * MIDDLE 植被 - 山腰树
   * 原版: tree01, 随机 wid, j%2 && ns^4<0.012 && abs(y)/h<0.3
   * proofRule: counter>2 时返回 true (不绘制)
   */
  private drawMountainMiddleVegetation(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    h: number,
    seed: number,
  ): void {
    const veglist: Point[] = [];

    // 第一步：收集所有符合条件的位置
    for (let i = 0; i < ptlist.length; i++) {
      for (let j = 0; j < ptlist[i].length; j++) {
        const ns = noiseNoise(i * 0.2, j * 0.05, seed);
        // 条件：j%2 && 噪声 && 高度 < 30%
        if (j % 2 === 0 && ns * ns * ns * ns < 0.012 && Math.abs(ptlist[i][j][1]) / h < 0.3) {
          veglist.push([ptlist[i][j][0], ptlist[i][j][1]]);
        }
      }
    }

    // 第二步：proofRule - 过滤掉周围太密集的位置
    for (let i = 0; i < veglist.length; i++) {
      let counter = 0;
      for (let j = 0; j < veglist.length; j++) {
        if (i !== j) {
          const dx = veglist[i][0] - veglist[j][0];
          const dy = veglist[i][1] - veglist[j][1];
          if (dx * dx + dy * dy < 30 * 30) {
            counter++;
          }
          if (counter > 2) {
            break; // 太密集，跳过
          }
        }
      }

      // counter > 2 时不绘制（原版逻辑）
      if (counter <= 2) {
        const x = veglist[i][0];
        const y = veglist[i][1];

        let ht = ((h + y) / h) * 70;
        ht = ht * 0.3 + prng.random() * ht * 0.7;
        const wid = prng.random() * 3 + 1; // 随机宽度

        this.drawTree01(x + xoff, y + yoff, seed + i, {
          height: ht,
          width: wid,
        });
      }
    }
  }

  /**
   * BOTTOM 植被 - 山脚边缘树
   * 原版: tree03, 随机 ben, (j===0 || j===length-1) && ns^4<0.012
   */
  private drawMountainBottomVegetation(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    h: number,
    seed: number,
  ): void {
    for (let i = 0; i < ptlist.length; i++) {
      for (let j = 0; j < ptlist[i].length; j++) {
        const ns = noiseNoise(i * 0.2, j * 0.05, seed);
        // 条件：边缘 && 噪声
        if ((j === 0 || j === ptlist[i].length - 1) && ns * ns * ns * ns < 0.012) {
          const x = ptlist[i][j][0];
          const y = ptlist[i][j][1];

          let ht = ((h + y) / h) * 120;
          ht = ht * 0.5 + prng.random() * ht * 0.5;
          const bc = prng.random() * 0.1; // 弯曲系数

          this.drawTree03(x + xoff, y + yoff, seed + i * 100 + j, {
            height: ht,
            bend: bc, // 弯曲参数
          });
        }
      }
    }
  }

  /**
   * 绘制山脚 - 与原版 foot() 函数相同
   */
  private drawMountainFoot(ptlist: Polygon[], xoff: number, yoff: number, seed: number): void {
    const ftlist: Polygon[] = [];
    const span = 10;
    let ni = 0;

    for (let i = 0; i < ptlist.length - 2; i += 1) {
      if (i === ni) {
        ni = Math.min(ni + (prng.random() > 0.5 ? 1 : 2), ptlist.length - 1);

        ftlist.push([]);
        ftlist.push([]);

        const limit = Math.min(ptlist[i].length / 8, 10);
        for (let j = 0; j < limit; j++) {
          ftlist[ftlist.length - 2].push([
            ptlist[i][j][0] + noiseNoise(j * 0.1, i) * 10,
            ptlist[i][j][1],
          ]);
          ftlist[ftlist.length - 1].push([
            ptlist[i][ptlist[i].length - 1 - j][0] - noiseNoise(j * 0.1, i) * 10,
            ptlist[i][ptlist[i].length - 1 - j][1],
          ]);
        }

        ftlist[ftlist.length - 2] = ftlist[ftlist.length - 2].reverse();
        ftlist[ftlist.length - 1] = ftlist[ftlist.length - 1].reverse();

        for (let j = 0; j < span; j++) {
          const p = j / span;
          const x1 = ptlist[i][0][0] * (1 - p) + ptlist[ni][0][0] * p;
          let y1 = ptlist[i][0][1] * (1 - p) + ptlist[ni][0][1] * p;

          const x2 =
            ptlist[i][ptlist[i].length - 1][0] * (1 - p) + ptlist[ni][ptlist[i].length - 1][0] * p;
          let y2 =
            ptlist[i][ptlist[i].length - 1][1] * (1 - p) + ptlist[ni][ptlist[i].length - 1][1] * p;

          const vib = -1.7 * (p - 1) * Math.pow(p, 1 / 5);
          y1 += vib * 5 + noiseNoise(xoff * 0.05, i) * 5;
          y2 += vib * 5 + noiseNoise(xoff * 0.05, i) * 5;

          ftlist[ftlist.length - 2].push([x1, y1]);
          ftlist[ftlist.length - 1].push([x2, y2]);
        }
      }
    }

    // 绘制白色山脚多边形
    for (let i = 0; i < ftlist.length; i++) {
      this.drawPolygon(
        ftlist[i].map((p) => [p[0] + xoff, p[1] + yoff]),
        [1, 1, 1, 1],
      );
    }

    // 绘制山脚轮廓线
    for (let j = 0; j < ftlist.length; j++) {
      const opacity = 0.1 + prng.random() * 0.1;
      this.drawStroke(
        ftlist[j].map((p) => [p[0] + xoff, p[1] + yoff]),
        1,
        [0.39, 0.39, 0.39, opacity],
        0.5,
      );
    }
  }

  /**
   * 绘制皴法纹理 - 与原版 texture() 函数相同
   */
  private drawMountainTexture(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    tex: number,
    seed: number,
  ): void {
    const reso: [number, number] = [ptlist.length, ptlist[0].length];
    const texlist: Polygon[] = [];
    const wid = 1.5;
    const len = 0.2;

    const noi = (x: number) => 30 / x;

    // 分布函数 - 两侧密集，中间稀疏
    const dis = () => {
      if (prng.random() > 0.5) {
        return (1 / 3) * prng.random();
      } else {
        return 2 / 3 + (1 / 3) * prng.random();
      }
    };

    // 生成纹理笔触点
    for (let i = 0; i < tex; i++) {
      const mid = Math.floor(dis() * reso[1]);
      const hlen = Math.floor(prng.random() * (reso[1] * len));

      let start = mid - hlen;
      let end = mid + hlen;
      start = Math.min(Math.max(start, 0), reso[1]);
      end = Math.min(Math.max(end, 0), reso[1]);

      const layer = (i / tex) * (reso[0] - 1);
      const layerFloor = Math.floor(layer);
      const layerCeil = Math.min(Math.ceil(layer), reso[0] - 1);

      texlist.push([]);
      for (let j = start; j < end; j++) {
        const p = layer - layerFloor;

        const x = ptlist[layerFloor][j][0] * p + ptlist[layerCeil][j][0] * (1 - p);
        const y = ptlist[layerFloor][j][1] * p + ptlist[layerCeil][j][1] * (1 - p);

        const ns: [number, number] = [
          noi(layer + 1) * (noiseNoise(x, j * 0.5) - 0.5),
          noi(layer + 1) * (noiseNoise(y, j * 0.5) - 0.5),
        ];

        texlist[texlist.length - 1].push([x + ns[0], y + ns[1]]);
      }
    }

    // 绘制纹理笔触
    for (let j = 0; j < texlist.length; j++) {
      if (texlist[j].length < 2) continue;

      const layerDepth = j / texlist.length;
      // 颜色渐变：顶部浅，底部深
      const depthFactor = Math.pow(layerDepth, 1.5);
      const baseOpacity = 0.05 + depthFactor * 0.55;
      const opacity = baseOpacity + prng.random() * 0.15;

      this.drawStroke(
        texlist[j].map((p) => [p[0] + xoff, p[1] + yoff]),
        wid,
        [0.39, 0.39, 0.39, opacity],
        0.5,
      );
    }
  }

  /**
   * 绘制水面 - 与原版 Water.generate() 相同
   */
  drawWater(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      length?: number;
      clusters?: number;
    } = {},
  ): void {
    const hei = options.height ?? 2; // 与原版一致，支持 height 选项
    const len = options.length ?? 800;
    const clu = options.clusters ?? 10;

    const ptlist: Polygon[] = [];
    let yk = 0;

    // 生成波纹 clusters
    for (let i = 0; i < clu; i++) {
      ptlist.push([]);
      const xk = (prng.random() - 0.5) * (len / 8);
      yk += prng.random() * 5;
      const lk = len / 4 + prng.random() * (len / 4);
      const reso = 5;

      for (let j = -lk; j < lk; j += reso) {
        ptlist[ptlist.length - 1].push([
          j + xk,
          Math.sin(j * 0.2) * hei * noiseNoise(j * 0.1) - 20 + yk,
        ]);
      }
    }

    // 绘制波纹笔触
    for (let j = 1; j < ptlist.length; j += 1) {
      const opacity = 0.3 + prng.random() * 0.3;
      this.drawStroke(
        ptlist[j].map((p) => [p[0] + xoff, p[1] + yoff]),
        1,
        [0.39, 0.39, 0.39, opacity],
        0.5,
      );
    }
  }

  /**
   * 绘制平顶山 - 与原版 Mount.flatMount() 相同
   */
  drawFlatMount(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
      texture?: number;
      cho?: number;
    } = {},
  ): void {
    const hei = options.height ?? 40 + prng.random() * 400;
    const wid = options.width ?? 400 + prng.random() * 200;
    const tex = options.texture ?? 80;
    const cho = options.cho ?? 0.5; // 平顶比例

    const ptlist: Polygon[] = [];
    const reso: [number, number] = [5, 50];
    let hoff = 0;
    const flat: Polygon[] = [];

    for (let j = 0; j < reso[0]; j++) {
      hoff += (prng.random() * yoff) / 100;
      ptlist.push([]);
      flat.push([]);

      for (let i = 0; i < reso[1]; i++) {
        const x = (i / reso[1] - 0.5) * Math.PI;
        let y = Math.cos(x * 2) + 1;
        y *= noiseNoise(x + 10, j * 0.1, seed);
        const p = 1 - (j / reso[0]) * 0.6;
        const nx = (x / Math.PI) * wid * p;
        let ny = -y * hei * p + hoff;
        const h = 100;

        if (ny < -h * cho + hoff) {
          ny = -h * cho + hoff;
          if (flat[flat.length - 1].length % 2 === 0) {
            flat[flat.length - 1].push([nx, ny]);
          }
        } else {
          if (flat[flat.length - 1].length % 2 === 1) {
            flat[flat.length - 1].push(
              ptlist[ptlist.length - 1][ptlist[ptlist.length - 1].length - 1],
            );
          }
        }

        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }

    // 白色背景
    const bgPolygon: Polygon = [...ptlist[0], [0, reso[0] * 4]];
    this.drawPolygon(
      bgPolygon.map((p) => [p[0] + xoff, p[1] + yoff]),
      [1, 1, 1, 1],
    );

    // 轮廓线
    this.drawStroke(
      ptlist[0].map((p) => [p[0] + xoff, p[1] + yoff]),
      3,
      [0.39, 0.39, 0.39, 0.3],
      1,
    );

    // 皴法纹理
    this.drawFlatMountTexture(ptlist, xoff, yoff, tex, seed);

    // 绘制平顶区域和装饰
    const bounds = this.drawFlatMountTop(flat, xoff, yoff, seed);

    // 添加装饰（关键！必须与原版 flatDec() 一致）
    if (bounds) {
      this.drawFlatMountDecoration(xoff, yoff, bounds, seed);
    }
  }

  /**
   * 平顶山纹理
   */
  private drawFlatMountTexture(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    tex: number,
    seed: number,
  ): void {
    const reso: [number, number] = [ptlist.length, ptlist[0].length];
    const wid = 2;
    const len = 0.2;

    const noi = (x: number) => 30 / x;
    const dis = () => {
      if (prng.random() > 0.5) {
        return 0.1 + 0.4 * prng.random();
      } else {
        return 0.9 - 0.4 * prng.random();
      }
    };

    for (let i = 0; i < tex; i++) {
      const mid = Math.floor(dis() * reso[1]);
      const hlen = Math.floor(prng.random() * (reso[1] * len));

      let start = mid - hlen;
      let end = mid + hlen;
      start = Math.min(Math.max(start, 0), reso[1]);
      end = Math.min(Math.max(end, 0), reso[1]);

      const layer = (i / tex) * (reso[0] - 1);
      const layerFloor = Math.floor(layer);
      const layerCeil = Math.min(Math.ceil(layer), reso[0] - 1);

      const texPoints: Point[] = [];
      for (let j = start; j < end; j++) {
        const p = layer - layerFloor;
        const px = ptlist[layerFloor][j][0] * p + ptlist[layerCeil][j][0] * (1 - p);
        const py = ptlist[layerFloor][j][1] * p + ptlist[layerCeil][j][1] * (1 - p);

        const ns: [number, number] = [
          noi(layer + 1) * (noiseNoise(px, j * 0.5) - 0.5),
          noi(layer + 1) * (noiseNoise(py, j * 0.5) - 0.5),
        ];

        texPoints.push([px + ns[0] + xoff, py + ns[1] + yoff]);
      }

      if (texPoints.length >= 2) {
        const opacity = 0.2 + prng.random() * 0.2;
        this.drawStroke(texPoints, wid, [0.39, 0.39, 0.39, opacity], 0.5);
      }
    }
  }

  /**
   * 平顶山顶部装饰
   */
  private drawFlatMountTop(
    flat: Polygon[],
    xoff: number,
    yoff: number,
    seed: number,
  ): { xmin: number; xmax: number; ymin: number; ymax: number } | null {
    let grlist1: Polygon = [];
    let grlist2: Polygon = [];

    for (let i = 0; i < flat.length; i += 2) {
      if (flat[i].length >= 2) {
        grlist1.push(flat[i][0]);
        grlist2.push(flat[i][flat[i].length - 1]);
      }
    }

    if (grlist1.length === 0) return null;

    const wb = [grlist1[0][0], grlist2[0][0]];
    for (let i = 0; i < 3; i++) {
      const p = 0.8 - i * 0.2;
      grlist1.unshift([wb[0] * p, grlist1[0][1] - 5]);
      grlist2.unshift([wb[1] * p, grlist2[0][1] - 5]);
    }

    const wb2 = [grlist1[grlist1.length - 1][0], grlist2[grlist2.length - 1][0]];
    for (let i = 0; i < 3; i++) {
      const p = 0.6 - i * i * 0.1;
      grlist1.push([wb2[0] * p, grlist1[grlist1.length - 1][1] + 1]);
      grlist2.push([wb2[1] * p, grlist2[grlist2.length - 1][1] + 1]);
    }

    // 细分路径
    grlist1 = this.divPath(grlist1, 5);
    grlist2 = this.divPath(grlist2, 5);

    const grlist = grlist1.reverse().concat(grlist2.concat([grlist1[0]]));
    for (let i = 0; i < grlist.length; i++) {
      const v = (1 - Math.abs((i % 5) - 2.5) / 2.5) * 0.12;
      grlist[i][0] *= 1 - v + noiseNoise(grlist[i][1] * 0.5) * v;
    }

    // 绘制平顶区域
    this.drawPolygon(
      grlist.map((p) => [p[0] + xoff, p[1] + yoff]),
      [1, 1, 1, 1],
    );
    this.drawStroke(
      grlist.map((p) => [p[0] + xoff, p[1] + yoff]),
      3,
      [0.39, 0.39, 0.39, 0.2],
      0.5,
    );

    // 返回边界，供 flatDec 使用
    const bounds = this.getBounds(grlist);
    return bounds;
  }

  /**
   * 路径细分
   */
  private divPath(plist: Polygon, d: number): Polygon {
    if (plist.length < 2) return plist;
    const result: Polygon = [];

    for (let i = 0; i < plist.length - 1; i++) {
      const p0 = plist[i];
      const p1 = plist[i + 1];
      for (let j = 0; j < d; j++) {
        const t = j / d;
        result.push([p0[0] * (1 - t) + p1[0] * t, p0[1] * (1 - t) + p1[1] * t]);
      }
    }
    result.push(plist[plist.length - 1]);
    return result;
  }

  /**
   * 获取边界
   */
  private getBounds(plist: Polygon): { xmin: number; xmax: number; ymin: number; ymax: number } {
    let xmin = Infinity,
      xmax = -Infinity;
    let ymin = Infinity,
      ymax = -Infinity;

    for (const p of plist) {
      if (p[0] < xmin) xmin = p[0];
      if (p[0] > xmax) xmax = p[0];
      if (p[1] < ymin) ymin = p[1];
      if (p[1] > ymax) ymax = p[1];
    }

    return { xmin, xmax, ymin, ymax };
  }

  /**
   * 辅助函数：从数组中随机选择一个元素
   */
  private randChoice<T>(arr: T[]): T {
    return arr[Math.floor(arr.length * prng.random())];
  }

  /**
   * 辅助函数：在范围内生成随机数
   */
  private normRand(m: number, M: number): number {
    return m + prng.random() * (M - m);
  }

  /**
   * 平顶山装饰 - 与原版 Mount.flatDec() 100% 相同
   * 关键：包含背景岩石、树丛、5种类型的特定装饰、小树点缀
   */
  private drawFlatMountDecoration(
    xoff: number,
    yoff: number,
    grbd: { xmin: number; xmax: number; ymin: number; ymax: number },
    seed: number,
  ): void {
    const tt = this.randChoice([0, 0, 1, 2, 3, 4]);

    // 背景岩石
    for (let j = 0; j < prng.random() * 5; j++) {
      this.drawRock(
        xoff + this.normRand(grbd.xmin, grbd.xmax),
        yoff + (grbd.ymin + grbd.ymax) / 2 + this.normRand(-10, 10) + 10,
        prng.random() * 100,
        {
          width: 10 + prng.random() * 20,
          height: 10 + prng.random() * 20,
          shadow: 2,
        },
      );
    }

    // 树丛
    for (let j = 0; j < this.randChoice([0, 0, 1, 2]); j++) {
      const xr = xoff + this.normRand(grbd.xmin, grbd.xmax);
      const yr = yoff + (grbd.ymin + grbd.ymax) / 2 + this.normRand(-5, 5) + 20;
      for (let k = 0; k < 2 + prng.random() * 3; k++) {
        this.drawTree08(
          xr + Math.min(Math.max(this.normRand(-30, 30), grbd.xmin), grbd.xmax),
          yr,
          seed + j * 10 + k,
          { height: 60 + prng.random() * 40 },
        );
      }
    }

    // 类型特定装饰
    if (tt === 0) {
      // 类型 0: 大岩石
      for (let j = 0; j < prng.random() * 3; j++) {
        this.drawRock(
          xoff + this.normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + this.normRand(-5, 5) + 20,
          prng.random() * 100,
          {
            width: 50 + prng.random() * 20,
            height: 40 + prng.random() * 20,
            shadow: 5,
          },
        );
      }
    } else if (tt === 1) {
      // 类型 1: tree05 成排 + 岩石
      const pmin = prng.random() * 0.5;
      const pmax = prng.random() * 0.5 + 0.5;
      const xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
      const xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
      for (let i = xmin; i < xmax; i += 30) {
        this.drawTree05(
          xoff + i + 20 * this.normRand(-1, 1),
          yoff + (grbd.ymin + grbd.ymax) / 2 + 20,
          seed + Math.floor(i),
          { height: 100 + prng.random() * 200 },
        );
      }
      for (let j = 0; j < prng.random() * 4; j++) {
        this.drawRock(
          xoff + this.normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + this.normRand(-5, 5) + 20,
          prng.random() * 100,
          {
            width: 50 + prng.random() * 20,
            height: 40 + prng.random() * 20,
            shadow: 5,
          },
        );
      }
    } else if (tt === 2) {
      // 类型 2: tree04 + 周围岩石
      for (let i = 0; i < this.randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
        const xr = this.normRand(grbd.xmin, grbd.xmax);
        const yr = (grbd.ymin + grbd.ymax) / 2;
        this.drawTree04(xoff + xr, yoff + yr + 20, seed + i, {});
        for (let j = 0; j < prng.random() * 2; j++) {
          this.drawRock(
            xoff + Math.max(grbd.xmin, Math.min(grbd.xmax, xr + this.normRand(-50, 50))),
            yoff + yr + this.normRand(-5, 5) + 20,
            j * i * prng.random() * 100,
            {
              width: 50 + prng.random() * 20,
              height: 40 + prng.random() * 20,
              shadow: 5,
            },
          );
        }
      }
    } else if (tt === 3) {
      // 类型 3: tree06
      for (let i = 0; i < this.randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
        this.drawTree06(
          xoff + this.normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2,
          seed + i,
          { height: 60 + prng.random() * 60 },
        );
      }
    } else if (tt === 4) {
      // 类型 4: tree07 成排
      const pmin = prng.random() * 0.5;
      const pmax = prng.random() * 0.5 + 0.5;
      const xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
      const xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
      for (let i = xmin; i < xmax; i += 20) {
        this.drawTree07(
          xoff + i + 20 * this.normRand(-1, 1),
          yoff + (grbd.ymin + grbd.ymax) / 2 + this.normRand(-1, 1) + 0,
          seed + Math.floor(i),
          { height: this.normRand(40, 80) },
        );
      }
    }

    // 小树点缀
    for (let i = 0; i < 50 * prng.random(); i++) {
      this.drawTree02(
        xoff + this.normRand(grbd.xmin, grbd.xmax),
        yoff + this.normRand(grbd.ymin, grbd.ymax),
        seed + i + 1000,
        {},
      );
    }
  }

  /**
   * 绘制雾气山 - 与原版 Mount.mistyMount() 相同
   * 使用多层渐变和柔和的山脊轮廓
   */
  drawMistyMount(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      length?: number;
      layers?: number;
    } = {},
  ): void {
    const hei = options.height ?? 200;
    const len = options.length ?? 2000;
    const layers = options.layers ?? 3;

    // 假设画布高度为 len/2
    const canvasHeight = len / 2;

    // 为每一层生成山脊
    for (let layer = 0; layer < layers; layer++) {
      const layerDepth = layer / layers; // 0 = 远, 1 = 近

      // 每层的垂直偏移：远山高，近山低
      const layerVerticalOffset = -(1 - layerDepth) * hei * 1.5;

      // 画布底部 1/4 区域
      const bottomQuarterTop = canvasHeight * 0.75 + layerVerticalOffset;
      const bottomQuarterBottom = canvasHeight + layerVerticalOffset;
      const quarterRange = bottomQuarterBottom - bottomQuarterTop;

      // 左右边缘的随机高度
      const leftHeightFactor = (noiseNoise(seed + layer, 0.1, 0.2) + 1) / 2;
      const startY = bottomQuarterTop + quarterRange * leftHeightFactor;

      const rightHeightFactor = (noiseNoise(seed + layer, 0.3, 0.4) + 1) / 2;
      const endY = bottomQuarterTop + quarterRange * rightHeightFactor;

      // 生成山脊线
      const ridgeLine: Polygon = [];
      const resolution = 200; // 与原版一致

      for (let i = 0; i <= resolution; i++) {
        const t = i / resolution;
        const x = xoff - len / 2 + t * len;

        // 线性插值基准线
        const baselineY = startY * (1 - t) + endY * t;

        // 使用多层噪声生成自然的山脊
        let noiseValue = 0;
        let amplitude = 1.0;
        let frequency = 2.0;
        let maxValue = 0;

        for (let octave = 0; octave < 6; octave++) {
          noiseValue += fbmNoise(t * frequency, layerDepth, seed + layer + octave) * amplitude;
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2.0;
        }

        noiseValue = noiseValue / maxValue;

        // 山峰向上（Y 负方向）
        const amplitudeScale = 1.5 + layerDepth * 2.0;
        const mountainY = baselineY - Math.abs(noiseValue) * hei * amplitudeScale;

        ridgeLine.push([x, mountainY]);
      }

      // 创建闭合的山体多边形
      const mountainPoly: Polygon = [];
      const baseY = canvasHeight;

      // 从左下开始
      mountainPoly.push([ridgeLine[0][0], baseY + yoff]);

      // 添加整条山脊线
      for (const pt of ridgeLine) {
        mountainPoly.push([pt[0], pt[1] + yoff]);
      }

      // 右下闭合
      mountainPoly.push([ridgeLine[ridgeLine.length - 1][0], baseY + yoff]);

      // 根据层深度计算透明度和颜色
      const fillOpacity = 0.5 + layerDepth * 0.45;
      const strokeBaseOpacity = 0.2 + layerDepth * 0.45;

      // 墨青色调
      const r = Math.round(50 - layerDepth * 35) / 255;
      const g = Math.round(65 - layerDepth * 45) / 255;
      const b = Math.round(80 - layerDepth * 50) / 255;

      // 先绘制米色背景遮挡后面的山
      this.drawPolygon(mountainPoly, [0.96, 0.96, 0.86, 1]);

      // 再绘制半透明的山体
      this.drawPolygon(mountainPoly, [r, g, b, fillOpacity]);

      // 远山绘制轮廓线
      if (layerDepth <= 0.6) {
        this.drawStroke(
          ridgeLine.map((p) => [p[0], p[1] + yoff]),
          2,
          [0.2, 0.2, 0.2, strokeBaseOpacity * 1.5],
          0.3,
        );
      }

      // 添加皴法墨点效果
      const amplitudeScale = 1.5 + layerDepth * 2.0;
      const particleDensity = 0.5 + layerDepth * 1.0;
      const particleSize = 0.8 + layerDepth * 1.7;
      const particleCount = Math.floor(len * particleDensity * 0.35); // 与原版一致

      for (let p = 0; p < particleCount; p++) {
        const t = prng.random();
        const x = xoff - len / 2 + t * len;

        // 使用噪声决定是否放置墨点
        const worleyValue = simpleNoise(x * 0.008, seed + layer * 0.01);
        const threshold = 0.45 + layerDepth * 0.25;
        if (worleyValue > threshold) continue;

        // 获取对应的山脊 Y 位置
        const ridgeIndex = Math.floor(t * resolution);
        const baseRidgeY = ridgeLine[ridgeIndex]?.[1] ?? canvasHeight;

        // 墨点分布在山脊下方
        const maxVerticalOffset = hei * amplitudeScale * 0.6;
        const verticalOffset = (1 - worleyValue) * maxVerticalOffset * prng.random();
        const particleY = baseRidgeY + verticalOffset + yoff;

        // 墨点大小
        const pSize = particleSize * (0.6 + prng.random() * 0.8);

        // 墨点透明度
        const baseOpacity = 0.15 + layerDepth * 0.25;
        const opacity = baseOpacity * (0.5 + worleyValue);

        // 墨点颜色
        const particleR = Math.max(0, r - 0.04);
        const particleG = Math.max(0, g - 0.06);
        const particleB = Math.max(0, b - 0.04);

        // 绘制椭圆墨点
        const ellipsePoints: Polygon = [];
        const reso = 8;
        for (let j = 0; j <= reso; j++) {
          const a = (j / reso) * Math.PI * 2;
          ellipsePoints.push([
            x + Math.cos(a) * pSize * 1.5,
            particleY + Math.sin(a) * pSize * 0.8,
          ]);
        }
        this.drawPolygon(ellipsePoints, [particleR, particleG, particleB, opacity]);
      }

      // 添加垂直皴法纹理
      if (layerDepth > 0.4) {
        const strokeDensity = 0.4 + layerDepth * 0.6;
        const strokeCount = Math.floor(len * strokeDensity * 0.08); // 与原版一致

        for (let s = 0; s < strokeCount; s++) {
          const t = prng.random();
          const x = xoff - len / 2 + t * len;

          const worleyValue = simpleNoise(x * 0.015, seed + layer * 0.015);
          if (worleyValue > 0.4) continue;

          const ridgeIndex = Math.floor(t * resolution);
          const ridgeY = ridgeLine[ridgeIndex]?.[1] ?? canvasHeight;

          // 纹理从山脊向下延伸
          const lengthNoise = fbmNoise(x * 0.02, layer * 0.1, seed + layer);
          const strokeLength = hei * amplitudeScale * (0.2 + Math.abs(lengthNoise) * 0.5);

          const startOffset = hei * 0.1 * prng.random();
          const startStrokeY = ridgeY + startOffset + yoff;
          const endStrokeY = ridgeY + strokeLength + yoff;

          // 纹理透明度
          const opacityNoise = fbmNoise(x * 0.025, layer * 0.15, seed + layer + 200);
          const baseStrokeOpacity = 0.12 + layerDepth * 0.18;
          const strokeOpacity = baseStrokeOpacity * (0.6 + Math.abs(opacityNoise) * 0.4);

          // 纹理宽度
          const strokeWidth = (0.5 + prng.random() * 1.0) * (1 + layerDepth * 0.5);

          // 绘制垂直线条
          this.drawStroke(
            [
              [x, startStrokeY],
              [x, endStrokeY],
            ],
            strokeWidth,
            [r - 0.06, g - 0.08, b - 0.06, strokeOpacity],
            0.3,
          );
        }
      }
    }
  }

  /**
   * 绘制远山 - 100% 还原原版 Mount.distMount()
   * 关键：需要对每个多边形进行三角化，每个三角形根据中点计算灰度
   */
  drawDistantMount(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      length?: number;
      seg?: number;
    } = {},
  ): void {
    const hei = options.height ?? 300;
    const len = options.length ?? 2000;
    const seg = options.seg ?? 5;
    const span = 10;

    const ptlist: Polygon[] = [];

    // 生成多边形段
    for (let i = 0; i < len / span / seg; i++) {
      ptlist.push([]);

      // 生成山脊线点（上半部分）
      for (let j = 0; j < seg + 1; j++) {
        const k = i * seg + j;
        const x = xoff + k * span;
        const y =
          yoff -
          hei * noiseNoise(k * 0.05, seed) * Math.pow(Math.sin((Math.PI * k) / (len / span)), 0.5);
        ptlist[ptlist.length - 1].push([x, y]);
      }

      // 生成底部点（下半部分）- unshift 插入到前面
      for (let j = 0; j < seg / 2 + 1; j++) {
        const k = i * seg + j * 2;
        const x = xoff + k * span;
        const y =
          yoff +
          24 * noiseNoise(k * 0.05, 2, seed) * Math.pow(Math.sin((Math.PI * k) / (len / span)), 1);
        ptlist[ptlist.length - 1].unshift([x, y]);
      }
    }

    // 颜色计算函数
    const getCol = (x: number, y: number): number => {
      return (noiseNoise(x * 0.02, y * 0.02, yoff) * 55 + 200) / 255;
    };

    // 绘制每个分段
    for (let i = 0; i < ptlist.length; i++) {
      const polygon = ptlist[i];

      // 1. 先绘制整体填充（基础色）
      const lastPt = polygon[polygon.length - 1];
      const baseC = getCol(lastPt[0], lastPt[1]);
      this.drawPolygon(polygon, [baseC, baseC, baseC, 1]);

      // 2. 三角化并为每个三角形单独计算颜色（关键！）
      const triangles = this.triangulatePolygon(polygon);
      for (const tri of triangles) {
        // 计算三角形中点
        const midX = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
        const midY = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;

        // 根据中点位置计算灰度
        const c = getCol(midX, midY);

        // 绘制三角形（填充和描边颜色相同）
        this.drawPolygon(tri, [c, c, c, 1]);
      }
    }
  }

  /**
   * 三角化多边形（简单扇形法）
   */
  private triangulatePolygon(polygon: Polygon): Polygon[] {
    const triangles: Polygon[] = [];
    if (polygon.length < 3) return triangles;

    // 扇形三角化：从第一个点出发
    for (let i = 1; i < polygon.length - 1; i++) {
      triangles.push([polygon[0], polygon[i], polygon[i + 1]]);
    }

    return triangles;
  }

  /**
   * 绘制树木 - 根据类型选择不同样式
   * type: 1-8 对应原版 tree01-tree08
   */
  drawTree(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
      type?: number;
    } = {},
  ): void {
    const type = options.type ?? 1;
    switch (type) {
      case 1:
        this.drawTree01(x, y, seed, options);
        break;
      case 2:
        this.drawTree02(x, y, seed, options);
        break;
      case 3:
        this.drawTree03(x, y, seed, options);
        break;
      case 4:
        this.drawTree04(x, y, seed, options);
        break;
      case 5:
        this.drawTree05(x, y, seed, options);
        break;
      case 6:
        this.drawTree06(x, y, seed, options);
        break;
      case 7:
        this.drawTree07(x, y, seed, options);
        break;
      case 8:
        this.drawTree08(x, y, seed, options);
        break;
      default:
        this.drawTree01(x, y, seed, options);
    }
  }

  /**
   * tree01 - 简单树，顶部有叶子 (与原版 Tree.tree01 相同)
   */
  private drawTree01(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
    } = {},
  ): void {
    const hei = options.height ?? 50;
    const wid = options.width ?? 3; // 支持自定义宽度
    const reso = 10;

    const nslist: [number, number][] = [];
    for (let i = 0; i < reso; i++) {
      nslist.push([noiseNoise(i * 0.5), noiseNoise(i * 0.5, 0.5)]);
    }

    const line1: Point[] = [];
    const line2: Point[] = [];

    for (let i = 0; i < reso; i++) {
      const nx = x;
      const ny = y - (i * hei) / reso;

      // 绘制叶子 (blob)
      if (i >= reso / 4) {
        for (let j = 0; j < (reso - i) / 5; j++) {
          const blobX = nx + (prng.random() - 0.5) * wid * 1.2 * (reso - i);
          const blobY = ny + (prng.random() - 0.5) * wid;
          this.drawBlob(blobX, blobY, seed + i * 10 + j, {
            length: prng.random() * 20 * (reso - i) * 0.2 + 10,
            width: prng.random() * 6 + 3,
            angle: ((prng.random() - 0.5) * Math.PI) / 6,
            opacity: prng.random() * 0.2 + 0.5,
          });
        }
      }

      line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
      line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
    }

    // 绘制树干轮廓
    this.drawStroke(line1, 1.5, [0.39, 0.39, 0.39, 0.5], 0.3);
    this.drawStroke(line2, 1.5, [0.39, 0.39, 0.39, 0.5], 0.3);
  }

  /**
   * tree02 - 聚类墨点树 (与原版 Tree.tree02 相同)
   */
  private drawTree02(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
      clusters?: number;
    } = {},
  ): void {
    const hei = options.height ?? 16;
    const wid = 8;
    const clu = options.clusters ?? 5; // 支持自定义聚类数量

    for (let i = 0; i < clu; i++) {
      const bx = x + this.randGaussian(seed + i) * clu * 4;
      const by = y + this.randGaussian(seed + i + 100) * clu * 4;
      this.drawBlob(bx, by, seed + i, {
        width: prng.random() * wid * 0.75 + wid * 0.5,
        length: prng.random() * hei * 0.75 + hei * 0.5,
        angle: Math.PI / 2,
        opacity: 0.5,
      });
    }
  }

  /**
   * tree03 - 弯曲树干的树 (与原版 Tree.tree03 相同)
   */
  private drawTree03(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
      bend?: number;
    } = {},
  ): void {
    const hei = options.height ?? 50;
    const wid = 5;
    const reso = 10;

    const nslist: [number, number][] = [];
    for (let i = 0; i < reso; i++) {
      nslist.push([noiseNoise(i * 0.5, seed), noiseNoise(i * 0.5, 0.5, seed)]);
    }

    // 弯曲函数 - 支持自定义弯曲系数
    const bc = options.bend ?? 0.1;
    const bp = 1;
    const ben = (t: number) => Math.pow(t * bc, bp);

    const line1: Point[] = [];
    const line2: Point[] = [];

    for (let i = 0; i < reso; i++) {
      const nx = x + ben(i / reso) * 100;
      const ny = y - (i * hei) / reso;

      // 绘制叶子
      if (i >= reso / 5) {
        for (let j = 0; j < (reso - i) * 2; j++) {
          const shape = (t: number) => Math.log(50 * t + 1) / 3.95;
          const ox = prng.random() * wid * 2 * shape((reso - i) / reso);
          const dir = prng.random() > 0.5 ? 1 : -1;
          this.drawBlob(nx + ox * dir, ny + (prng.random() - 0.5) * wid * 2, seed + i * 10 + j, {
            length: ox * 2,
            width: prng.random() * 6 + 3,
            angle: ((prng.random() - 0.5) * Math.PI) / 6,
            opacity: prng.random() * 0.2 + 0.5,
          });
        }
      }

      line1.push([nx + (((nslist[i][0] - 0.5) * wid - wid / 2) * (reso - i)) / reso, ny]);
      line2.push([nx + (((nslist[i][1] - 0.5) * wid + wid / 2) * (reso - i)) / reso, ny]);
    }

    // 绘制树干（白色填充 + 轮廓）
    const trunkPolygon: Polygon = [...line1, ...line2.reverse()];
    this.drawPolygon(trunkPolygon, [1, 1, 1, 1]);
    this.drawStroke([...line1, ...line2.reverse()], 1.5, [0.39, 0.39, 0.39, 0.5], 0.3);
  }

  /**
   * tree04 - 有分枝的详细树 (与原版 Tree.tree04 相同)
   */
  private drawTree04(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
    } = {},
  ): void {
    const hei = options.height ?? 300;
    const wid = 6;

    // 生成主干分枝
    const trlist = this.generateBranch(hei, wid, -Math.PI / 2, Math.PI * 0.2, 10);

    // 绘制主干（白色填充）
    const trunkPolygon: Polygon = [...trlist[0], ...trlist[1].reverse()];
    this.drawPolygon(
      trunkPolygon.map((p) => [p[0] + x, p[1] + y]),
      [1, 1, 1, 1],
    );

    // 绘制轮廓
    this.drawStroke(
      trunkPolygon.map((p) => [p[0] + x, p[1] + y]),
      2.5,
      [0.39, 0.39, 0.39, 0.4 + prng.random() * 0.1],
      0.9,
    );

    // 绘制树皮纹理
    this.drawBarkTexture(x, y, trlist);

    // 在主干上添加分枝和树枝
    const trlistMerged = trlist[0].concat(trlist[1].reverse());
    for (let i = 0; i < trlistMerged.length; i++) {
      const p = Math.abs(i - trlistMerged.length * 0.5) / (trlistMerged.length * 0.5);
      if (
        (i >= trlistMerged.length * 0.3 && i <= trlistMerged.length * 0.7 && prng.random() < 0.1) ||
        i === Math.floor(trlistMerged.length / 2) - 1
      ) {
        const ba = Math.PI * 0.2 - Math.PI * 1.4 * (i > trlistMerged.length / 2 ? 1 : 0);
        const brlist = this.generateBranch(
          hei * (prng.random() + 1) * 0.3,
          wid * 0.5,
          ba,
          Math.PI * 0.2,
          5,
        );

        // 绘制分枝
        const brPolygon: Polygon = [...brlist[0], ...brlist[1].reverse()];
        this.drawPolygon(
          brPolygon.map((pp) => [pp[0] + trlistMerged[i][0] + x, pp[1] + trlistMerged[i][1] + y]),
          [1, 1, 1, 1],
        );

        // 绘制分枝纹理
        this.drawBarkTexture(trlistMerged[i][0] + x, trlistMerged[i][1] + y, brlist);

        // 绘制树枝和叶子
        for (let j = 0; j < brlist[0].length; j++) {
          if (prng.random() < 0.2 || j === brlist[0].length - 1) {
            this.drawTwig(
              brlist[0][j][0] + trlistMerged[i][0] + x,
              brlist[0][j][1] + trlistMerged[i][1] + y,
              1,
              seed + i * 100 + j,
              {
                wid: hei / 300,
                ang: ba > -Math.PI / 2 ? ba : ba + Math.PI,
                sca: (0.5 * hei) / 300,
                dir: ba > -Math.PI / 2 ? 1 : -1,
              },
            );
          }
        }
      }
    }
  }

  /**
   * tree05 - 松树风格 (与原版 Tree.tree05 相同)
   */
  private drawTree05(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
    } = {},
  ): void {
    const hei = options.height ?? 300;
    const wid = 5;

    // 生成直的主干
    const trlist = this.generateBranch(hei, wid, -Math.PI / 2, 0, 10);

    // 绘制主干
    const trunkPolygon: Polygon = [...trlist[0], ...trlist[1].reverse()];
    this.drawPolygon(
      trunkPolygon.map((p) => [p[0] + x, p[1] + y]),
      [1, 1, 1, 1],
    );

    this.drawStroke(
      trunkPolygon.map((p) => [p[0] + x, p[1] + y]),
      2.5,
      [0.39, 0.39, 0.39, 0.4 + prng.random() * 0.1],
      0.9,
    );

    this.drawBarkTexture(x, y, trlist);

    // 密集的水平分枝（松树特征）
    const trlistMerged = trlist[0].concat(trlist[1].reverse());
    for (let i = 0; i < trlistMerged.length; i++) {
      const p = Math.abs(i - trlistMerged.length * 0.5) / (trlistMerged.length * 0.5);
      if (
        i >= trlistMerged.length * 0.2 &&
        i <= trlistMerged.length * 0.8 &&
        i % 3 === 0 &&
        prng.random() > p
      ) {
        const bar = prng.random() * 0.2;
        const ba = -bar * Math.PI - (1 - bar * 2) * Math.PI * (i > trlistMerged.length / 2 ? 1 : 0);
        const brlist = this.generateBranch(
          hei * (0.3 * p - prng.random() * 0.05),
          wid * 0.5,
          ba,
          0.5,
          5,
        );

        // 绘制分枝上的松针（叶子）
        for (let j = 0; j < brlist[0].length; j++) {
          if (j % 20 === 0 || j === brlist[0].length - 1) {
            this.drawTwig(
              brlist[0][j][0] + trlistMerged[i][0] + x,
              brlist[0][j][1] + trlistMerged[i][1] + y,
              0,
              seed + i * 100 + j,
              {
                wid: hei / 300,
                ang: ba > -Math.PI / 2 ? ba : ba + Math.PI,
                sca: (0.2 * hei) / 300,
                dir: ba > -Math.PI / 2 ? 1 : -1,
                leafSize: 5,
              },
            );
          }
        }
      }
    }
  }

  /**
   * tree06 - 分形分枝树 (与原版 Tree.tree06 相同)
   */
  private drawTree06(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
    } = {},
  ): void {
    const hei = options.height ?? 100;
    const wid = 6;

    // 递归绘制分形树
    this.drawFractalTree(x, y, 3, seed, {
      hei: hei,
      wid: wid,
      ang: -Math.PI / 2,
      ben: 0,
    });
  }

  /**
   * 递归分形树
   */
  private drawFractalTree(
    xoff: number,
    yoff: number,
    dep: number,
    seed: number,
    args: {
      hei?: number;
      wid?: number;
      ang?: number;
      ben?: number;
    } = {},
  ): Polygon {
    const hei = args.hei ?? 300;
    const wid = args.wid ?? 5;
    const ang = args.ang ?? 0;
    const ben = args.ben ?? Math.PI * 0.2;

    const trlist = this.generateBranch(hei, wid, ang, ben, Math.max(5, hei / 20));

    // 绘制主干
    const trunkPolygon: Polygon = [...trlist[0], ...trlist[1].reverse()];
    this.drawPolygon(
      trunkPolygon.map((p) => [p[0] + xoff, p[1] + yoff]),
      [1, 1, 1, 1],
    );

    this.drawBarkTexture(xoff, yoff, trlist);

    const trlistMerged = trlist[0].concat(trlist[1].reverse());
    const trmlist: Polygon = [];

    for (let i = 0; i < trlistMerged.length; i++) {
      const p = Math.abs(i - trlistMerged.length * 0.5) / (trlistMerged.length * 0.5);
      if (
        ((prng.random() < 0.025 &&
          i >= trlistMerged.length * 0.2 &&
          i <= trlistMerged.length * 0.8) ||
          i === Math.floor(trlistMerged.length / 2) - 1 ||
          i === Math.floor(trlistMerged.length / 2) + 1) &&
        dep > 0
      ) {
        const bar = 0.02 + prng.random() * 0.08;
        const ba = bar * Math.PI - bar * 2 * Math.PI * (i > trlistMerged.length / 2 ? 1 : 0);

        const brlist = this.drawFractalTree(
          trlistMerged[i][0] + xoff,
          trlistMerged[i][1] + yoff,
          dep - 1,
          seed + i,
          {
            hei: hei * (0.7 + prng.random() * 0.2),
            wid: wid * 0.6,
            ang: ang + ba,
            ben: 0.55,
          },
        );

        // 添加树枝装饰
        for (let j = 0; j < brlist.length; j++) {
          if (prng.random() < 0.03) {
            this.drawTwig(
              brlist[j][0] + trlistMerged[i][0] + xoff,
              brlist[j][1] + trlistMerged[i][1] + yoff,
              2,
              seed + i * 100 + j,
              {
                ang: ba * (prng.random() * 0.5 + 0.75),
                sca: 0.3,
                dir: ba > 0 ? 1 : -1,
                hasLeaf: false,
              },
            );
          }
        }

        trmlist.push(
          ...brlist.map((v) => [v[0] + trlistMerged[i][0], v[1] + trlistMerged[i][1]] as Point),
        );
      } else {
        trmlist.push(trlistMerged[i]);
      }
    }

    // 绘制轮廓
    this.drawStroke(
      trmlist.map((v) => [v[0] + xoff, v[1] + yoff]),
      2.5,
      [0.39, 0.39, 0.39, 0.4 + prng.random() * 0.1],
      0.9,
    );

    return trmlist;
  }

  /**
   * tree07 - 三角化纹理树 (与原版 Tree.tree07 相同)
   */
  private drawTree07(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
    } = {},
  ): void {
    const hei = options.height ?? 60;
    const wid = 4;
    const reso = 10;

    const nslist: [number, number][] = [];
    for (let i = 0; i < reso; i++) {
      nslist.push([noiseNoise(i * 0.5, seed), noiseNoise(i * 0.5, 0.5, seed)]);
    }

    // 弯曲函数
    const ben = (t: number) => Math.sqrt(t) * 0.2;

    const line1: Point[] = [];
    const line2: Point[] = [];

    for (let i = 0; i < reso; i++) {
      const nx = x + ben(i / reso) * 100;
      const ny = y - (i * hei) / reso;

      // 绘制三角化叶子
      if (i >= reso / 4) {
        const blobX = nx + (prng.random() - 0.5) * wid * 1.2 * (reso - i) * 0.5;
        const blobY = ny + (prng.random() - 0.5) * wid * 0.5;
        const blobLen = prng.random() * 50 + 20;
        const blobWid = prng.random() * 12 + 12;
        const blobAng = (-prng.random() * Math.PI) / 6;

        // 绘制三角化的叶子形状
        this.drawTriangulatedBlob(blobX, blobY, blobLen, blobWid, blobAng, seed + i);
      }

      line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
      line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
    }

    // 绘制三角化树干
    const trunkPolygon: Polygon = [...line1, ...line2.reverse()];
    this.drawTriangulatedPolygon(trunkPolygon, seed);
  }

  /**
   * tree08 - 精细分枝树 (与原版 Tree.tree08 相同)
   */
  private drawTree08(
    x: number,
    y: number,
    seed: number,
    options: {
      height?: number;
    } = {},
  ): void {
    const hei = options.height ?? 80;
    const wid = 1;

    const ang = (simpleNoise(seed, 0) - 0.5) * 2 * Math.PI * 0.2;
    const trlist = this.generateBranch(
      hei,
      wid,
      -Math.PI / 2 + ang,
      Math.PI * 0.2,
      Math.max(5, hei / 20),
    );

    const trlistMerged = trlist[0].concat(trlist[1].reverse());

    // 绘制主干
    const trunkPolygon: Polygon = [...trlist[0], ...trlist[1].reverse()];
    this.drawPolygon(
      trunkPolygon.map((p) => [p[0] + x, p[1] + y]),
      [1, 1, 1, 1],
    );

    this.drawStroke(
      trlistMerged.map((v) => [v[0] + x, v[1] + y]),
      2.5,
      [0.39, 0.39, 0.39, 0.6 + prng.random() * 0.1],
      0.9,
    );

    // 在主干上添加分形分枝
    for (let i = 0; i < trlistMerged.length; i++) {
      if (prng.random() < 0.2) {
        this.drawFracTree08(
          x + trlistMerged[i][0],
          y + trlistMerged[i][1],
          Math.floor(4 * prng.random()),
          seed + i,
          {
            ang: -Math.PI / 2 - ang * prng.random(),
          },
        );
      } else if (i === Math.floor(trlistMerged.length / 2)) {
        this.drawFracTree08(x + trlistMerged[i][0], y + trlistMerged[i][1], 3, seed + i, {
          ang: -Math.PI / 2 + ang,
        });
      }
    }
  }

  /**
   * tree08 的分形分枝
   */
  private drawFracTree08(
    xoff: number,
    yoff: number,
    dep: number,
    seed: number,
    args: {
      ang?: number;
      len?: number;
      ben?: number;
    } = {},
  ): void {
    const ang = args.ang ?? -Math.PI / 2;
    const len = args.len ?? 15;
    const ben = args.ben ?? 0;

    const fun = dep === 0 ? (t: number) => Math.cos(0.5 * Math.PI * t) : (_t: number) => 1;
    const ept: Point = [xoff + Math.cos(ang) * len, yoff + Math.sin(ang) * len];

    let trmlist: Polygon = [
      [xoff, yoff],
      [xoff + len, yoff],
    ];

    const bfun =
      prng.random() > 0.5
        ? (t: number) => Math.sin(t * Math.PI)
        : (t: number) => -Math.sin(t * Math.PI);

    trmlist = this.divPath(trmlist, 10);

    for (let i = 0; i < trmlist.length; i++) {
      trmlist[i][1] += bfun(i / trmlist.length) * 2;
    }

    // 旋转到正确角度
    for (let i = 0; i < trmlist.length; i++) {
      const d = Math.sqrt(Math.pow(trmlist[i][0] - xoff, 2) + Math.pow(trmlist[i][1] - yoff, 2));
      const a = Math.atan2(trmlist[i][1] - yoff, trmlist[i][0] - xoff);
      trmlist[i][0] = xoff + d * Math.cos(a + ang);
      trmlist[i][1] = yoff + d * Math.sin(a + ang);
    }

    // 绘制线条
    this.drawStroke(trmlist, 0.8 * fun(0.5), [0.39, 0.39, 0.39, 0.5], 0.3);

    if (dep !== 0) {
      const nben = ben + (prng.random() > 0.5 ? 1 : -1) * Math.PI * 0.001 * dep * dep;
      if (prng.random() < 0.5) {
        const randDir1 = prng.random() < 0.5 ? -1 + prng.random() * 1.5 : 0.5 + prng.random() * 0.5;
        const randDir2 = prng.random() < 0.5 ? -1 + prng.random() * 0.5 : 0.5 + prng.random() * 0.5;

        this.drawFracTree08(ept[0], ept[1], dep - 1, seed + 1, {
          ang: ang + ben + Math.PI * randDir1 * 0.2,
          len: len * (0.8 + prng.random() * 0.1),
          ben: nben,
        });
        this.drawFracTree08(ept[0], ept[1], dep - 1, seed + 2, {
          ang: ang + ben + Math.PI * randDir2 * 0.2,
          len: len * (0.8 + prng.random() * 0.1),
          ben: nben,
        });
      } else {
        this.drawFracTree08(ept[0], ept[1], dep - 1, seed + 1, {
          ang: ang + ben,
          len: len * (0.8 + prng.random() * 0.1),
          ben: nben,
        });
      }
    }
  }

  // ==================== 辅助绘制方法 ====================

  /**
   * 生成分枝结构
   */
  private generateBranch(
    hei: number,
    wid: number,
    ang: number,
    ben: number,
    det: number,
  ): [Polygon, Polygon] {
    let nx = 0;
    let ny = 0;
    const tlist: Polygon = [[nx, ny]];
    let a0 = 0;
    const g = 3;

    for (let i = 0; i < g; i++) {
      a0 += (ben / 2 + (prng.random() * ben) / 2) * (prng.random() > 0.5 ? 1 : -1);
      nx += (Math.cos(a0) * hei) / g;
      ny -= (Math.sin(a0) * hei) / g;
      tlist.push([nx, ny]);
    }

    const ta = Math.atan2(tlist[tlist.length - 1][1], tlist[tlist.length - 1][0]);

    for (let i = 0; i < tlist.length; i++) {
      const a = Math.atan2(tlist[i][1], tlist[i][0]);
      const d = Math.sqrt(tlist[i][0] * tlist[i][0] + tlist[i][1] * tlist[i][1]);
      tlist[i][0] = d * Math.cos(a - ta + ang);
      tlist[i][1] = d * Math.sin(a - ta + ang);
    }

    const trlist1: Polygon = [];
    const trlist2: Polygon = [];
    const span = det;
    const tl = (tlist.length - 1) * span;
    let lx = 0;
    let ly = 0;

    for (let i = 0; i < tl; i += 1) {
      const lastp = tlist[Math.floor(i / span)];
      const nextp = tlist[Math.ceil(i / span)];
      const p = (i % span) / span;
      nx = lastp[0] * (1 - p) + nextp[0] * p;
      ny = lastp[1] * (1 - p) + nextp[1] * p;

      const angle = Math.atan2(ny - ly, nx - lx);
      const woff = ((noiseNoise(i * 0.3) - 0.5) * wid * hei) / 80;

      let b = 0;
      if (p === 0) {
        b = prng.random() * wid;
      }

      const nw = wid * (((tl - i) / tl) * 0.5 + 0.5);
      trlist1.push([
        nx + Math.cos(angle + Math.PI / 2) * (nw + woff + b),
        ny + Math.sin(angle + Math.PI / 2) * (nw + woff + b),
      ]);
      trlist2.push([
        nx + Math.cos(angle - Math.PI / 2) * (nw - woff + b),
        ny + Math.sin(angle - Math.PI / 2) * (nw - woff + b),
      ]);
      lx = nx;
      ly = ny;
    }

    return [trlist1, trlist2];
  }

  /**
   * 绘制树皮纹理
   */
  private drawBarkTexture(x: number, y: number, trlist: [Polygon, Polygon]): void {
    for (let i = 2; i < trlist[0].length - 1; i++) {
      const a0 = Math.atan2(
        trlist[0][i][1] - trlist[0][i - 1][1],
        trlist[0][i][0] - trlist[0][i - 1][0],
      );
      const a1 = Math.atan2(
        trlist[1][i][1] - trlist[1][i - 1][1],
        trlist[1][i][0] - trlist[1][i - 1][0],
      );
      const p = prng.random();
      const nx = trlist[0][i][0] * (1 - p) + trlist[1][i][0] * p;
      const ny = trlist[0][i][1] * (1 - p) + trlist[1][i][1] * p;

      if (prng.random() < 0.2) {
        this.drawBlob(nx + x, ny + y, i, {
          length: 15,
          width: 6 - Math.abs(p - 0.5) * 10,
          angle: (a0 + a1) / 2,
          opacity: 0.6,
        });
      }
    }
  }

  /**
   * 绘制树枝
   */
  private drawTwig(
    tx: number,
    ty: number,
    dep: number,
    seed: number,
    options: {
      dir?: number;
      sca?: number;
      wid?: number;
      ang?: number;
      hasLeaf?: boolean;
      leafSize?: number;
    } = {},
  ): void {
    const dir = options.dir ?? 1;
    const sca = options.sca ?? 1;
    const wid = options.wid ?? 1;
    const ang = options.ang ?? 0;
    const hasLeaf = options.hasLeaf ?? true;
    const leafSize = options.leafSize ?? 12;

    const twlist: Polygon = [];
    const tl = 10;
    const hs = prng.random() * 0.5 + 0.5;

    const tfun = (t: number, i: number) => -1 / Math.pow(i / tl + 1, 5) + 1;
    const a0 = ((prng.random() * Math.PI) / 6) * dir + ang;

    for (let i = 0; i < tl; i++) {
      const mx = dir * tfun(i / tl, i) * 50 * sca * hs;
      const my = -i * 5 * sca;

      const a = Math.atan2(my, mx);
      const d = Math.sqrt(mx * mx + my * my);

      const nx = Math.cos(a + a0) * d;
      const ny = Math.sin(a + a0) * d;

      twlist.push([nx + tx, ny + ty]);

      if ((i === Math.floor(tl / 3) || i === Math.floor((tl * 2) / 3)) && dep > 0) {
        this.drawTwig(nx + tx, ny + ty, dep - 1, seed + i, {
          ang: ang,
          sca: sca * 0.8,
          wid: wid,
          dir: dir * (prng.random() > 0.5 ? 1 : -1),
          hasLeaf: hasLeaf,
          leafSize: leafSize,
        });
      }

      if (i === tl - 1 && hasLeaf) {
        for (let j = 0; j < 5; j++) {
          const dj = (j - 2.5) * 5;
          this.drawBlob(
            nx + tx + Math.cos(ang) * dj * wid,
            ny + ty + (Math.sin(ang) * dj - leafSize / (dep + 1)) * wid,
            seed + i * 10 + j,
            {
              width: (6 + 3 * prng.random()) * wid,
              length: (15 + 12 * prng.random()) * wid,
              angle: ang / 2 + Math.PI / 2 + Math.PI * 0.2 * (prng.random() - 0.5),
              opacity: 0.5 + dep * 0.2,
            },
          );
        }
      }
    }

    this.drawStroke(twlist, 1, [0.39, 0.39, 0.39, 0.5], 0.3);
  }

  /**
   * 绘制三角化blob（用于tree07）
   */
  private drawTriangulatedBlob(
    x: number,
    y: number,
    len: number,
    wid: number,
    ang: number,
    seed: number,
  ): void {
    const reso = 20;
    const blobPoints: Polygon = [];

    const fun = (t: number) =>
      t <= 1 ? 2.75 * t * Math.pow(1 - t, 1 / 1.8) : 2.75 * (t - 2) * Math.pow(t - 1, 1 / 1.8);

    for (let i = 0; i <= reso; i++) {
      const p = (i / reso) * 2;
      const xo = len / 2 - Math.abs(p - 1) * len;
      const yo = (fun(p) * wid) / 2;
      const a = Math.atan2(yo, xo);
      const l = Math.sqrt(xo * xo + yo * yo);

      const nx = x + Math.cos(a + ang) * l;
      const ny = y + Math.sin(a + ang) * l;
      blobPoints.push([nx, ny]);
    }

    this.drawTriangulatedPolygon(blobPoints, seed);
  }

  /**
   * 绘制三角化多边形（用于tree07）
   */
  private drawTriangulatedPolygon(polygon: Polygon, seed: number): void {
    if (polygon.length < 3) return;

    // 简单三角化（扇形法）
    for (let i = 1; i < polygon.length - 1; i++) {
      const tri: Polygon = [polygon[0], polygon[i], polygon[i + 1]];
      const midX = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      const midY = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;

      const c = (noiseNoise(midX * 0.02, midY * 0.02, seed) * 200 + 50) / 255;
      this.drawPolygon(tri, [c, c, c, 0.8]);
    }
  }

  /**
   * 绘制墨点 (blob) - 与原版 blob() 函数相同
   */
  private drawBlob(
    x: number,
    y: number,
    seed: number,
    options: {
      length?: number;
      width?: number;
      angle?: number;
      opacity?: number;
    } = {},
  ): void {
    const len = options.length ?? 20;
    const wid = options.width ?? 5;
    const ang = options.angle ?? 0;
    const opacity = options.opacity ?? 0.5;

    const reso = 20;
    const lalist: [number, number][] = [];

    // blob 形状函数
    const fun = (t: number) =>
      t <= 1
        ? Math.pow(Math.sin(t * Math.PI) * t, 0.5)
        : -Math.pow(Math.sin((t - 2) * Math.PI * (t - 2)), 0.5);

    for (let i = 0; i <= reso; i++) {
      const p = (i / reso) * 2;
      const xo = len / 2 - Math.abs(p - 1) * len;
      const yo = (fun(p) * wid) / 2;
      const a = Math.atan2(yo, xo);
      const l = Math.sqrt(xo * xo + yo * yo);
      lalist.push([l, a]);
    }

    // 添加噪声
    const nslist: number[] = [];
    const n0 = simpleNoise(seed, 0) * 10;
    for (let i = 0; i <= reso; i++) {
      nslist.push(noiseNoise(i * 0.05, n0));
    }

    const blobPoints: Polygon = [];
    const noi = 0.5;
    for (let i = 0; i < lalist.length; i++) {
      const ns = nslist[i] * noi + (1 - noi);
      const nx = x + Math.cos(lalist[i][1] + ang) * lalist[i][0] * ns;
      const ny = y + Math.sin(lalist[i][1] + ang) * lalist[i][0] * ns;
      blobPoints.push([nx, ny]);
    }

    this.drawPolygon(blobPoints, [0.39, 0.39, 0.39, opacity]);
  }

  /**
   * 绘制岩石 - 与原版 Mount.rock() 相同
   */
  drawRock(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
      texture?: number;
      shadow?: number;
    } = {},
  ): void {
    const hei = options.height ?? 80;
    const wid = options.width ?? 100;
    const tex = options.texture ?? 40;
    const sha = options.shadow ?? 10;

    const reso: [number, number] = [10, 50];
    const ptlist: Polygon[] = [];

    for (let i = 0; i < reso[0]; i++) {
      ptlist.push([]);

      const nslist: number[] = [];
      for (let j = 0; j < reso[1]; j++) {
        nslist.push(noiseNoise(i, j * 0.2, seed));
      }
      this.loopNoise(nslist);

      for (let j = 0; j < reso[1]; j++) {
        const a = (j / reso[1]) * Math.PI * 2 - Math.PI / 2;
        let l =
          (wid * hei) / Math.sqrt(Math.pow(hei * Math.cos(a), 2) + Math.pow(wid * Math.sin(a), 2));
        l *= 0.7 + 0.3 * nslist[j];

        const p = 1 - i / reso[0];
        let nx = Math.cos(a) * l * p;
        let ny = -Math.sin(a) * l * p;

        if (Math.PI < a || a < 0) {
          ny *= 0.2;
        }
        ny += hei * (i / reso[0]) * 0.2;

        ptlist[ptlist.length - 1].push([nx, ny]);
      }
    }

    // 白色背景
    const bgPolygon: Polygon = [...ptlist[0], [0, 0]];
    this.drawPolygon(
      bgPolygon.map((p) => [p[0] + xoff, p[1] + yoff]),
      [1, 1, 1, 1],
    );

    // 轮廓线
    this.drawStroke(
      ptlist[0].map((p) => [p[0] + xoff, p[1] + yoff]),
      3,
      [0.39, 0.39, 0.39, 0.3],
      1,
    );

    // 皴法纹理（关键：传递 sha 参数！）
    this.drawRockTexture(ptlist, xoff, yoff, tex, seed, sha);
  }

  /**
   * 岩石纹理 - 与原版 Texture.generate() 100% 一致
   * 关键：支持 shadow 参数，先绘制阴影再绘制主纹理
   */
  private drawRockTexture(
    ptlist: Polygon[],
    xoff: number,
    yoff: number,
    tex: number,
    seed: number,
    sha: number,
  ): void {
    const reso: [number, number] = [ptlist.length, ptlist[0].length];
    const wid = 3;
    const len = 0.2;

    const noi = (x: number) => 30 / x;
    const dis = () => {
      if (prng.random() > 0.5) {
        return 0.15 + 0.15 * prng.random();
      } else {
        return 0.85 - 0.15 * prng.random();
      }
    };

    // 生成所有纹理线条
    const texlist: Polygon[] = [];
    const layerDepths: number[] = [];

    for (let i = 0; i < tex; i++) {
      const mid = Math.floor(dis() * reso[1]);
      const hlen = Math.floor(prng.random() * (reso[1] * len));

      let start = mid - hlen;
      let end = mid + hlen;
      start = Math.min(Math.max(start, 0), reso[1]);
      end = Math.min(Math.max(end, 0), reso[1]);

      const layer = (i / tex) * (reso[0] - 1);
      const layerFloor = Math.floor(layer);
      const layerCeil = Math.min(Math.ceil(layer), reso[0] - 1);

      // 记录层深度（0=顶层，1=底层）
      layerDepths.push(layer / (reso[0] - 1));

      const texPoints: Point[] = [];
      for (let j = start; j < end; j++) {
        const p = layer - layerFloor;
        const px = ptlist[layerFloor][j][0] * p + ptlist[layerCeil][j][0] * (1 - p);
        const py = ptlist[layerFloor][j][1] * p + ptlist[layerCeil][j][1] * (1 - p);

        const ns: [number, number] = [
          noi(layer + 1) * (noiseNoise(px, j * 0.5) - 0.5),
          noi(layer + 1) * (noiseNoise(py, j * 0.5) - 0.5),
        ];

        texPoints.push([px + ns[0] + xoff, py + ns[1] + yoff]);
      }

      texlist.push(texPoints);
    }

    // 第一步：绘制阴影（如果 sha > 0）
    if (sha > 0) {
      for (let j = 0; j < texlist.length; j += 1 + (sha !== 0 ? 1 : 0)) {
        if (texlist[j].length >= 2) {
          this.drawStroke(texlist[j], sha, [0.39, 0.39, 0.39, 0.1], 0.5);
        }
      }
    }

    // 第二步：绘制主纹理
    for (let j = sha > 0 ? 1 : 0; j < texlist.length; j += 1 + (sha > 0 ? 1 : 0)) {
      if (texlist[j].length >= 2) {
        const opacity = 0.3 + prng.random() * 0.3;
        // 颜色使用 rgba(180,180,180,...) = (0.706, 0.706, 0.706)
        this.drawStroke(texlist[j], wid, [0.706, 0.706, 0.706, opacity], 0.5);
      }
    }
  }

  /**
   * 高斯随机数
   */
  private randGaussian(seed: number): number {
    const u1 = simpleNoise(seed, 0);
    const u2 = simpleNoise(seed, 1);
    return Math.sqrt(-2 * Math.log(u1 + 0.001)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * 循环平滑噪声数组
   */
  private loopNoise(nslist: number[]): void {
    const dif = nslist[nslist.length - 1] - nslist[0];
    const len = nslist.length;
    for (let i = 0; i < len; i++) {
      nslist[i] += (dif * (len - 1 - i)) / (len - 1);
    }
  }

  // ==================== 云 (Cloud) ====================

  /**
   * 绘制云 - 简化版，减少粒子数量
   */
  drawCloud(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      size?: number;
      opacity?: number;
    } = {},
  ): void {
    const size = options.size ?? 200;
    const baseOpacity = options.opacity ?? 0.3;

    // 大幅减少粒子数量，使用更大的粒子
    const particleCount = Math.floor(size * 0.3);

    for (let i = 0; i < particleCount; i++) {
      const angle = simpleNoise(i, seed) * Math.PI * 2;
      const dist = simpleNoise(i * 2, seed) * size * 0.5;

      const px = xoff + Math.cos(angle) * dist;
      const py = yoff + Math.sin(angle) * dist * 0.4;

      const density = 0.5 + simpleNoise(i * 3, seed) * 0.5;
      const particleSize = 5 + density * 8;
      const opacity = baseOpacity * density;

      // 直接绘制椭圆多边形，不使用 drawBlob
      const ellipsePoints: Polygon = [];
      const reso = 8;
      for (let j = 0; j <= reso; j++) {
        const a = (j / reso) * Math.PI * 2;
        ellipsePoints.push([
          px + Math.cos(a) * particleSize * 1.5,
          py + Math.sin(a) * particleSize * 0.8,
        ]);
      }
      this.drawPolygon(ellipsePoints, [0.5, 0.5, 0.5, opacity]);
    }
  }

  // ==================== 人物 (Man) ====================

  /**
   * 绘制人物 - 简化的骨骼人物
   */
  drawMan(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      scale?: number;
      flip?: boolean;
      hasHat?: boolean;
      hasStick?: boolean;
    } = {},
  ): void {
    const sca = options.scale ?? 0.5;
    const fli = options.flip ?? false;
    const hasHat = options.hasHat ?? true;
    const hasStick = options.hasStick ?? false;
    const dir = fli ? -1 : 1;

    // 身体各部分角度
    const ang = [
      0, // 0: 躯干
      -Math.PI / 2, // 1: 脖子
      simpleNoise(seed, 0) * 0.2, // 2: 头
      (Math.PI / 4) * simpleNoise(seed, 1), // 3: 左腿
      ((Math.PI * 3) / 4) * simpleNoise(seed, 2), // 4: 左脚
      (Math.PI * 3) / 4, // 5: 右臂
      -Math.PI / 4, // 6: 右手
      (-Math.PI * 3) / 4 - (Math.PI / 4) * simpleNoise(seed, 3), // 7: 左臂
      -Math.PI / 4, // 8: 左手
    ];

    // 身体各部分长度
    const len = [0, 30, 20, 30, 30, 30, 30, 30, 30].map((v) => v * sca);

    // 计算关节位置
    const pts: Point[] = [];
    let cumAng = 0;
    let cumX = 0;
    let cumY = 0;

    for (let i = 0; i < ang.length; i++) {
      cumAng += ang[i];
      cumX += len[i] * Math.cos(cumAng);
      cumY += len[i] * Math.sin(cumAng);
      pts.push([cumX * dir + xoff, cumY + yoff]);
    }

    // 调整 yoff 使脚着地
    const footY = Math.max(pts[4][1], pts[6][1]);
    const yAdjust = yoff - footY + yoff;

    // 绘制身体
    const bodyColor: [number, number, number, number] = [0.39, 0.39, 0.39, 0.5];

    // 躯干
    this.drawStroke([pts[1], pts[0], pts[3]], 3 * sca, bodyColor, 0.3);
    // 左腿
    this.drawStroke([pts[3], pts[4]], 2 * sca, bodyColor, 0.3);
    // 右臂
    this.drawStroke([pts[1], pts[5], pts[6]], 2 * sca, bodyColor, 0.3);
    // 左臂
    this.drawStroke([pts[1], pts[7], pts[8]], 2 * sca, bodyColor, 0.3);
    // 头
    this.drawStroke([pts[1], pts[2]], 4 * sca, bodyColor, 0.3);

    // 绘制帽子
    if (hasHat) {
      this.drawHat(pts[1][0], pts[1][1], pts[2][0], pts[2][1], seed, sca);
    }

    // 绘制手杖
    if (hasStick) {
      const stickLen = 40 * sca;
      const stickAngle = -Math.PI / 6;
      this.drawStroke(
        [
          pts[8],
          [
            pts[8][0] + Math.cos(stickAngle) * stickLen * dir,
            pts[8][1] + Math.sin(stickAngle) * stickLen,
          ],
        ],
        1,
        [0.39, 0.39, 0.39, 0.5],
        0.2,
      );
    }
  }

  /**
   * 绘制帽子
   */
  private drawHat(x1: number, y1: number, x2: number, y2: number, seed: number, sca: number): void {
    const hatPoints: Polygon = [
      [x2 - 10 * sca, y2],
      [x2 - 5 * sca, y2 - 15 * sca],
      [x2, y2 - 18 * sca],
      [x2 + 5 * sca, y2 - 15 * sca],
      [x2 + 10 * sca, y2],
    ];
    this.drawPolygon(hatPoints, [0.39, 0.39, 0.39, 0.8]);
  }

  // ==================== 船 (Boat) ====================

  /**
   * 绘制小船 - 与原版 Arch.boat01 相同
   */
  drawBoat(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      length?: number;
      scale?: number;
      flip?: boolean;
      hasMan?: boolean;
    } = {},
  ): void {
    const len = options.length ?? 120;
    const sca = options.scale ?? 1;
    const fli = options.flip ?? false;
    const hasMan = options.hasMan ?? true;
    const dir = fli ? -1 : 1;

    // 绘制船体轮廓
    const plist1: Point[] = [];
    const plist2: Point[] = [];
    const fun1 = (x: number) => Math.pow(Math.sin(x * Math.PI), 0.5) * 7 * sca;
    const fun2 = (x: number) => Math.pow(Math.sin(x * Math.PI), 0.5) * 10 * sca;

    for (let i = 0; i < len * sca; i += 5 * sca) {
      plist1.push([xoff + i * dir, yoff + fun1(i / len)]);
      plist2.push([xoff + i * dir, yoff + fun2(i / len)]);
    }

    // 绘制船体
    const boatPolygon: Polygon = [...plist1, ...plist2.reverse()];
    this.drawPolygon(boatPolygon, [1, 1, 1, 1]);
    this.drawStroke(boatPolygon, 1, [0.39, 0.39, 0.39, 0.4], 0.3);

    // 绘制船上的人
    if (hasMan) {
      this.drawMan(xoff + 20 * sca * dir, yoff, seed, {
        scale: 0.5 * sca,
        flip: !fli,
        hasHat: true,
        hasStick: true,
      });
    }
  }

  // ==================== 建筑基础构件 ====================

  /**
   * 绘制茅屋 - 与原版 Arch.hut 相同
   */
  drawHut(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
      texture?: number;
    } = {},
  ): void {
    const hei = options.height ?? 40;
    const wid = options.width ?? 180;
    const tex = options.texture ?? 100;

    const reso: [number, number] = [10, 10];
    const ptlist: Polygon[] = [];

    for (let i = 0; i < reso[0]; i++) {
      ptlist.push([]);
      const heir = hei + hei * 0.2 * simpleNoise(i, seed);
      for (let j = 0; j < reso[1]; j++) {
        const nx = wid * (i / (reso[0] - 1) - 0.5) * Math.pow(j / (reso[1] - 1), 0.7);
        const ny = heir * (j / (reso[1] - 1));
        ptlist[ptlist.length - 1].push([nx + xoff, ny + yoff]);
      }
    }

    // 绘制白色背景
    const bgPolygon: Polygon = [
      ...ptlist[0].slice(0, -1),
      ...ptlist[ptlist.length - 1].slice(0, -1).reverse(),
    ];
    this.drawPolygon(bgPolygon, [1, 1, 1, 1]);

    // 绘制边缘轮廓
    this.drawStroke(ptlist[0], 2, [0.39, 0.39, 0.39, 0.3], 0.5);
    this.drawStroke(ptlist[ptlist.length - 1], 2, [0.39, 0.39, 0.39, 0.3], 0.5);

    // 绘制茅草纹理
    this.drawHutTexture(ptlist, tex, seed);
  }

  /**
   * 茅屋纹理
   */
  private drawHutTexture(ptlist: Polygon[], tex: number, seed: number): void {
    const reso: [number, number] = [ptlist.length, ptlist[0].length];

    for (let i = 0; i < tex; i++) {
      // 分布函数 - 更多在中间
      const wtrand = () => {
        const r = simpleNoise(i * 0.1, seed);
        return r * r;
      };

      const mid = Math.floor(wtrand() * reso[1]);
      const hlen = Math.floor(simpleNoise(i * 0.2, seed) * (reso[1] * 0.25));

      let start = mid - hlen;
      let end = mid + hlen;
      start = Math.max(start, 0);
      end = Math.min(end, reso[1] - 1);

      const layer = (i / tex) * (reso[0] - 1);
      const layerFloor = Math.floor(layer);
      const layerCeil = Math.min(Math.ceil(layer), reso[0] - 1);

      const texPoints: Point[] = [];
      for (let j = start; j < end; j++) {
        const p = layer - layerFloor;
        const px = ptlist[layerFloor][j][0] * (1 - p) + ptlist[layerCeil][j][0] * p;
        const py = ptlist[layerFloor][j][1] * (1 - p) + ptlist[layerCeil][j][1] * p;

        const noi = 5 / (layer + 1);
        const ns: [number, number] = [
          noi * (noiseNoise(px * 0.1, j * 0.5) - 0.5),
          noi * (noiseNoise(py * 0.1, j * 0.5) - 0.5),
        ];

        texPoints.push([px + ns[0], py + ns[1]]);
      }

      if (texPoints.length >= 2) {
        const opacity = 0.3 + simpleNoise(i * 0.3, seed) * 0.3;
        this.drawStroke(texPoints, 1, [0.47, 0.47, 0.47, opacity], 0.5);
      }
    }
  }

  /**
   * 绘制屋顶 - 与原版 Arch.roof 相同
   */
  drawRoof(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
      rotation?: number;
      perspective?: number;
    } = {},
  ): void {
    const hei = options.height ?? 20;
    const wid = options.width ?? 120;
    const rot = options.rotation ?? 0.7;
    const per = options.perspective ?? 4;
    const cor = 5; // 檐角延伸

    const rrot = rot < 0.5 ? 1 - rot : rot;
    const mid = -wid * 0.5 + wid * rrot;
    const quat = (mid + wid * 0.5) * 0.5 - mid;

    // 屋顶多边形
    const roofPolygon: Polygon = [
      [xoff - wid * 0.5, yoff],
      [xoff - wid * 0.5 + quat, yoff - hei - per / 2],
      [xoff + mid + quat, yoff - hei],
      [xoff + wid * 0.5, yoff],
      [xoff + mid, yoff + per],
    ];
    this.drawPolygon(roofPolygon, [1, 1, 1, 1]);

    // 屋顶轮廓线
    this.drawStroke(
      [
        [xoff - wid * 0.5 + quat, yoff - hei - per / 2],
        [xoff - wid * 0.5 + quat * 0.5, yoff - hei / 2 - per / 4],
        [xoff - wid * 0.5 - cor, yoff],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    this.drawStroke(
      [
        [xoff + mid + quat, yoff - hei],
        [xoff + (mid + quat + wid * 0.5) / 2, yoff - hei / 2],
        [xoff + wid * 0.5 + cor, yoff],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    this.drawStroke(
      [
        [xoff + mid + quat, yoff - hei],
        [xoff + mid + quat / 2, yoff - hei / 2 + per / 2],
        [xoff + mid + cor, yoff + per],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    this.drawStroke(
      [
        [xoff - wid * 0.5 - cor, yoff],
        [xoff + mid + cor, yoff + per],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    this.drawStroke(
      [
        [xoff + wid * 0.5 + cor, yoff],
        [xoff + mid + cor, yoff + per],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );
  }

  /**
   * 绘制亭子 (arch01) - 桥亭结构
   */
  drawPavilion(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
    } = {},
  ): void {
    const hei = options.height ?? 70;
    const wid = options.width ?? 180;

    const p = 0.4 + simpleNoise(seed, 0) * 0.2;
    const h0 = hei * p;
    const h1 = hei * (1 - p);

    // 绘制茅屋顶
    this.drawHut(xoff, yoff - hei, seed, { height: h0, width: wid });

    // 绘制立柱
    const per = 5;
    const mid = -wid * 0.5 + wid * 0.7;

    // 左柱
    this.drawStroke(
      [
        [xoff - wid * 0.5, yoff - h1],
        [xoff - wid * 0.5, yoff],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    // 右柱
    this.drawStroke(
      [
        [xoff + wid * 0.5, yoff - h1],
        [xoff + wid * 0.5, yoff],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    // 中柱
    this.drawStroke(
      [
        [xoff + mid, yoff - h1],
        [xoff + mid, yoff + per],
      ],
      3,
      [0.39, 0.39, 0.39, 0.4],
      0.5,
    );

    // 可能添加一个人物
    if (simpleNoise(seed * 2, 0) > 0.5) {
      this.drawMan(xoff + (simpleNoise(seed * 3, 0) - 0.5) * wid * 0.6, yoff, seed, {
        scale: 0.42,
        flip: simpleNoise(seed * 4, 0) > 0.5,
      });
    }
  }

  /**
   * 绘制宝塔 (arch03) - 多层塔式建筑
   */
  drawPagoda(
    xoff: number,
    yoff: number,
    seed: number,
    options: {
      height?: number;
      width?: number;
      stories?: number;
    } = {},
  ): void {
    const hei = options.height ?? 15;
    const wid = options.width ?? 50;
    const sto = options.stories ?? 5;

    let hoff = 0;

    for (let i = 0; i < sto; i++) {
      const storyWid = wid * Math.pow(0.85, i);
      const storyHei = hei;

      // 绘制层身（简化的盒子）
      const boxPolygon: Polygon = [
        [xoff - storyWid * 0.5, yoff - hoff - storyHei],
        [xoff + storyWid * 0.5, yoff - hoff - storyHei],
        [xoff + storyWid * 0.5, yoff - hoff],
        [xoff - storyWid * 0.5, yoff - hoff],
      ];
      this.drawPolygon(boxPolygon, [1, 1, 1, 1]);
      this.drawStroke(boxPolygon, 1.5, [0.39, 0.39, 0.39, 0.4], 0.5);

      // 绘制塔式屋顶
      const roofWid = storyWid * 1.2;
      const roofHei = hei * 0.8;
      const cor = 10;

      const roofPoints: Polygon = [
        [xoff, yoff - hoff - storyHei - roofHei],
        [xoff - roofWid * 0.5 - cor, yoff - hoff - storyHei],
        [xoff + roofWid * 0.5 + cor, yoff - hoff - storyHei],
      ];
      this.drawPolygon(roofPoints, [1, 1, 1, 1]);

      // 屋檐线条
      for (let j = 0; j < 4; j++) {
        const fx = roofWid * (j / 3 - 0.5);
        this.drawStroke(
          [
            [xoff, yoff - hoff - storyHei - roofHei],
            [xoff + fx * 0.5, yoff - hoff - storyHei - roofHei * 0.5],
            [xoff + (roofWid * 0.5 + cor) * (j / 3 - 0.5) * 2, yoff - hoff - storyHei],
          ],
          1.5,
          [0.39, 0.39, 0.39, 0.4],
          0.5,
        );
      }

      hoff += storyHei * 1.5;
    }
  }

  get width(): number {
    return this.canvasWidth;
  }

  get height(): number {
    return this.canvasHeight;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }

  destroy(): void {
    this.polygonParamsBuffer?.destroy();
    this.polygonVertexBuffer?.destroy();
    this.polygonIndexBuffer?.destroy();
    this.device = null;
    this.context = null;
    this.isInitialized = false;
  }
}

export default ShuimoRenderer;
