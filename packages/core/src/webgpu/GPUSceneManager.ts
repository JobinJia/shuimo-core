/**
 * WebGPU Scene Manager
 *
 * 管理无限滚动山水场景，使用 ShuimoRenderer 进行渲染
 */

import { ShuimoRenderer } from './ShuimoRenderer';

export interface GPUChunk {
  tag: string;
  x: number;
  y: number;
  seed: number;
  params: Record<string, unknown>;
}

export interface GPUSceneState {
  chunks: GPUChunk[];
  xmin: number;
  xmax: number;
  cwid: number;
  cursx: number;
  windx: number;
  windy: number;
  planmtx: number[];
}

interface PlanItem {
  tag: string;
  x: number;
  y: number;
  h: number;
  params?: Record<string, unknown>;
}

// 噪声函数
function noise(x: number, y: number = 0, seed: number = 0): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43.758) * 43758.5453;
  return n - Math.floor(n);
}

function fbmNoise(x: number, y: number = 0, seed: number = 0, octaves: number = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * (noise(x * frequency, y * frequency, seed + i) * 2 - 1);
    amplitude *= 0.5;
    frequency *= 2;
  }

  return value;
}

/**
 * 场景规划器
 */
class GPUMountPlanner {
  private static locmax(
    x: number,
    y: number,
    f: (x: number, y: number) => number,
    r: number
  ): boolean {
    const z0 = f(x, y);
    if (z0 <= 0.3) return false;

    for (let i = x - r; i < x + r; i++) {
      for (let j = y - r; j < y + r; j++) {
        if (f(i, j) > z0) return false;
      }
    }
    return true;
  }

  private static chadd(reg: PlanItem[], r: PlanItem, mind: number = 10): boolean {
    for (const item of reg) {
      if (Math.abs(item.x - r.x) < mind) return false;
    }
    reg.push(r);
    return true;
  }

  static plan(xmin: number, xmax: number, planmtx: number[], seed: number): PlanItem[] {
    const reg: PlanItem[] = [];
    const samp = 0.03;

    const ns = (x: number, y: number): number => {
      return Math.max(fbmNoise(x * samp, y * samp, seed) * 0.5 + 0.5 - 0.55, 0) * 2;
    };

    const yr = (x: number): number => {
      return (fbmNoise(x * 0.01, Math.PI, seed) * 0.5 + 0.5);
    };

    const xstep = 5;
    const mwid = 200;

    // 初始化规划矩阵
    for (let i = xmin; i < xmax; i += xstep) {
      const i1 = Math.floor(i / xstep);
      planmtx[i1] = planmtx[i1] || 0;
    }

    // 放置主山峰
    for (let i = xmin; i < xmax; i += xstep) {
      for (let j = 0; j < yr(i) * 400; j += 40) {
        if (this.locmax(i, j, ns, 2)) {
          const xof = i + 2 * (noise(i, j, seed) - 0.5) * 400;
          const yof = j + 350;
          const r: PlanItem = {
            tag: 'mount',
            x: xof,
            y: yof,
            h: ns(i, j),
            params: {
              height: 150 + ns(i, j) * 150,
              width: 300 + noise(i, j, seed + 1) * 200,
              texture: 100 + noise(i, j, seed + 2) * 100,
            }
          };
          const res = this.chadd(reg, r, 300);
          if (res) {
            for (let k = Math.floor((xof - mwid) / xstep); k < (xof + mwid) / xstep; k++) {
              planmtx[k] = (planmtx[k] || 0) + 1;
            }
          }
        }
      }

      // 放置远山
      if (Math.abs(i) % 600 < Math.max(1, xstep - 1)) {
        const r: PlanItem = {
          tag: 'distmount',
          x: i,
          y: 220 - noise(i, 0, seed) * 40,
          h: ns(i, 0),
          params: {
            height: 80 + noise(i, 0, seed + 3) * 50,
            length: 400 + noise(i, 0, seed + 4) * 400,
          }
        };
        this.chadd(reg, r, 350);
      }

      // 放置平顶山
      if (Math.abs(i) % 800 < Math.max(1, xstep - 1) && noise(i, 700, seed) < 0.1) {
        const r: PlanItem = {
          tag: 'flatmount',
          x: i,
          y: 450 + noise(i, 0, seed) * 50,
          h: ns(i, 0),
          params: {
            height: 60 + noise(i, 0, seed + 80) * 100,
            width: 300 + noise(i, 0, seed + 81) * 200,
            texture: 60 + noise(i, 0, seed + 82) * 40,
          }
        };
        this.chadd(reg, r, 400);
      }

      // 放置雾气山
      if (Math.abs(i) % 1000 < Math.max(1, xstep - 1) && noise(i, 800, seed) < 0.08) {
        const r: PlanItem = {
          tag: 'mistymount',
          x: i,
          y: 400,
          h: ns(i, 0),
          params: {
            height: 150 + noise(i, 0, seed + 90) * 100,
            length: 800 + noise(i, 0, seed + 91) * 600,
            layers: 2 + Math.floor(noise(i, 0, seed + 92) * 2),
          }
        };
        this.chadd(reg, r, 500);
      }
    }

    // 填充空白区域
    for (let i = xmin; i < xmax; i += xstep) {
      if ((planmtx[Math.floor(i / xstep)] || 0) === 0) {
        if (noise(i, 0, seed + 10) < 0.015) {
          for (let j = 0; j < 3 * noise(i, 1, seed); j++) {
            const r: PlanItem = {
              tag: 'mount',
              x: i + 2 * (noise(i, j, seed + 5) - 0.5) * 500,
              y: 600 - j * 60,
              h: ns(i, j),
              params: {
                height: 80 + noise(i, j, seed + 6) * 100,
                width: 200 + noise(i, j, seed + 7) * 150,
                texture: 80,
              }
            };
            this.chadd(reg, r, 180);
          }
        }
      }
    }

    // 放置水面
    for (let i = xmin; i < xmax; i += 120) {
      if (noise(i, 100, seed) < 0.35) {
        const r: PlanItem = {
          tag: 'water',
          x: i,
          y: 720,
          h: 0,
          params: {
            length: 300 + noise(i, 0, seed + 8) * 250,
            clusters: 10 + Math.floor(noise(i, 1, seed + 9) * 8),
          }
        };
        this.chadd(reg, r, 150);
      }
    }

    // 放置树木 (多种类型 1-8)
    for (let i = xmin; i < xmax; i += 60) {
      if (noise(i, 50, seed + 20) < 0.25) {
        // 随机选择树木类型 1-8
        const treeType = 1 + Math.floor(noise(i, 100, seed + 25) * 8);
        const r: PlanItem = {
          tag: 'tree',
          x: i,
          y: 600 + noise(i, 0, seed + 21) * 60,
          h: 0,
          params: {
            height: 50 + noise(i, 0, seed + 22) * 100,
            type: treeType,
          }
        };
        this.chadd(reg, r, 40);
      }
    }

    // 放置岩石
    for (let i = xmin; i < xmax; i += 150) {
      if (noise(i, 200, seed + 30) < 0.15) {
        const r: PlanItem = {
          tag: 'rock',
          x: i,
          y: 640 + noise(i, 0, seed + 31) * 50,
          h: 0,
          params: {
            height: 30 + noise(i, 0, seed + 32) * 30,
            width: 50 + noise(i, 1, seed + 33) * 40,
            texture: 25 + noise(i, 2, seed + 34) * 15,
          }
        };
        this.chadd(reg, r, 60);
      }
    }

    // 放置云
    for (let i = xmin; i < xmax; i += 300) {
      if (noise(i, 300, seed + 40) < 0.2) {
        const r: PlanItem = {
          tag: 'cloud',
          x: i,
          y: 80 + noise(i, 0, seed + 41) * 100,
          h: 0,
          params: {
            size: 100 + noise(i, 1, seed + 42) * 100,
            opacity: 0.2 + noise(i, 2, seed + 43) * 0.2,
          }
        };
        this.chadd(reg, r, 200);
      }
    }

    // 放置小船
    for (let i = xmin; i < xmax; i += 400) {
      if (noise(i, 400, seed + 50) < 0.15) {
        const r: PlanItem = {
          tag: 'boat',
          x: i,
          y: 700 + noise(i, 0, seed + 51) * 40,
          h: 0,
          params: {
            length: 80 + noise(i, 1, seed + 52) * 40,
            scale: 0.8 + noise(i, 2, seed + 53) * 0.4,
            flip: noise(i, 3, seed + 54) > 0.5,
          }
        };
        this.chadd(reg, r, 120);
      }
    }

    // 放置亭子
    for (let i = xmin; i < xmax; i += 600) {
      if (noise(i, 500, seed + 60) < 0.1) {
        const r: PlanItem = {
          tag: 'pavilion',
          x: i,
          y: 580 + noise(i, 0, seed + 61) * 40,
          h: 0,
          params: {
            height: 60 + noise(i, 1, seed + 62) * 30,
            width: 140 + noise(i, 2, seed + 63) * 60,
          }
        };
        this.chadd(reg, r, 180);
      }
    }

    // 放置宝塔
    for (let i = xmin; i < xmax; i += 800) {
      if (noise(i, 600, seed + 70) < 0.08) {
        const r: PlanItem = {
          tag: 'pagoda',
          x: i,
          y: 520 + noise(i, 0, seed + 71) * 50,
          h: 0,
          params: {
            height: 12 + noise(i, 1, seed + 72) * 6,
            width: 40 + noise(i, 2, seed + 73) * 20,
            stories: 3 + Math.floor(noise(i, 3, seed + 74) * 3),
          }
        };
        this.chadd(reg, r, 150);
      }
    }

    return reg;
  }
}

/**
 * GPU 场景管理器
 */
export class GPUSceneManager {
  private state: GPUSceneState;
  private renderer: ShuimoRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private seed: number;
  private initialized = false;
  private contentDirty = true;
  private lastRenderX = -Infinity;

  // 缓存系统
  private webgpuCanvas: HTMLCanvasElement | null = null; // 隐藏的 WebGPU 渲染 canvas
  private bufferCanvas: HTMLCanvasElement | null = null;  // 大的离屏缓冲 canvas
  private bufferContext: CanvasRenderingContext2D | null = null;
  private displayContext: CanvasRenderingContext2D | null = null; // 显示 canvas 的 2D context
  private bufferWidth: number;
  private bufferOffsetX: number = 0; // 缓冲区在世界坐标中的起始位置
  private renderedChunks: Map<string, boolean> = new Map(); // 已渲染的 chunks

  constructor(windx: number = 3000, windy: number = 800, cwid: number = 512) {
    this.seed = Date.now();
    // 缓冲区宽度：2.5倍视口宽度，确保不超过 WebGPU 限制（通常 8192px）
    this.bufferWidth = Math.min(windx * 2.5, 7500);
    this.state = {
      chunks: [],
      xmin: 0,
      xmax: 0,
      cwid: cwid,
      cursx: 0,
      windx: windx,
      windy: windy,
      planmtx: [],
    };
  }

  async initialize(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas;
    this.renderer = new ShuimoRenderer();

    // 创建隐藏的 WebGPU 渲染 canvas（保持视口大小，避免超限）
    this.webgpuCanvas = document.createElement('canvas');
    this.webgpuCanvas.width = this.state.windx;  // 使用视口宽度，不是缓冲区宽度
    this.webgpuCanvas.height = this.state.windy;

    // 在 WebGPU canvas 上初始化渲染器
    const success = await this.renderer.initialize(this.webgpuCanvas);
    if (!success) {
      console.error('Failed to initialize WebGPU renderer');
      return false;
    }

    // 创建离屏缓冲 Canvas（用于缓存已渲染的内容，2D Canvas 可以更大）
    this.bufferCanvas = document.createElement('canvas');
    this.bufferCanvas.width = this.bufferWidth;
    this.bufferCanvas.height = this.state.windy;
    this.bufferContext = this.bufferCanvas.getContext('2d', {
      willReadFrequently: false,
      alpha: true
    });

    if (!this.bufferContext) {
      console.error('Failed to create buffer context');
      return false;
    }

    // 获取显示 canvas 的 2D context
    this.displayContext = this.canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: true
    });

    if (!this.displayContext) {
      console.error('Failed to create display context');
      return false;
    }

    this.initialized = true;
    return true;
  }

  setSeed(seed: number): void {
    this.seed = seed;
    this.state.chunks = [];
    this.state.xmin = 0;
    this.state.xmax = 0;
    this.state.planmtx = [];
    this.contentDirty = true;
    this.lastRenderX = -Infinity;
    this.bufferOffsetX = 0;
    this.renderedChunks.clear();

    // 清空缓冲区
    if (this.bufferContext) {
      this.bufferContext.clearRect(0, 0, this.bufferWidth, this.state.windy);
    }
  }

  getState(): GPUSceneState {
    return this.state;
  }

  private addChunk(chunk: GPUChunk): void {
    // 按 y 坐标排序插入（控制绘制顺序）
    for (let i = 0; i < this.state.chunks.length; i++) {
      if (chunk.y <= this.state.chunks[i].y) {
        this.state.chunks.splice(i, 0, chunk);
        return;
      }
    }
    this.state.chunks.push(chunk);
  }

  private chunkLoader(xmin: number, xmax: number): void {
    while (xmax > this.state.xmax - this.state.cwid || xmin < this.state.xmin + this.state.cwid) {
      let plan: PlanItem[];

      if (xmax > this.state.xmax - this.state.cwid) {
        plan = GPUMountPlanner.plan(
          this.state.xmax,
          this.state.xmax + this.state.cwid,
          this.state.planmtx,
          this.seed
        );
        this.state.xmax = this.state.xmax + this.state.cwid;
      } else {
        plan = GPUMountPlanner.plan(
          this.state.xmin - this.state.cwid,
          this.state.xmin,
          this.state.planmtx,
          this.seed
        );
        this.state.xmin = this.state.xmin - this.state.cwid;
      }

      for (let i = 0; i < plan.length; i++) {
        this.addChunk({
          tag: plan[i].tag,
          x: plan[i].x,
          y: plan[i].y,
          seed: this.seed + i + Math.abs(plan[i].x),
          params: plan[i].params || {},
        });
      }

      this.contentDirty = true;
    }
  }

  private cleanupDistantChunks(xmin: number, xmax: number): void {
    const maxDistance = this.state.cwid * 6;
    this.state.chunks = this.state.chunks.filter(chunk =>
      chunk.x > xmin - maxDistance && chunk.x < xmax + maxDistance
    );
  }

  needUpdate(): boolean {
    return this.state.xmin >= this.state.cursx ||
           this.state.cursx >= this.state.xmax - this.state.windx;
  }

  update(): void {
    this.chunkLoader(this.state.cursx, this.state.cursx + this.state.windx);
    this.cleanupDistantChunks(this.state.cursx, this.state.cursx + this.state.windx);
    this.contentDirty = true;
  }

  setViewportX(x: number): void {
    this.state.cursx = x;
  }

  scroll(delta: number): void {
    this.state.cursx += delta;
    if (this.needUpdate()) {
      this.update();
    }
  }

  /**
   * 渲染可见的 chunks（优化版：减少渲染频率，使用缓冲区）
   */
  render(): void {
    if (!this.initialized || !this.renderer || !this.canvas || !this.bufferContext) return;

    const viewLeft = this.state.cursx;
    const viewRight = this.state.cursx + this.state.windx;

    // 检查是否需要重新渲染整个缓冲区（视口真正移出缓冲区）
    const bufferLeft = this.bufferOffsetX;
    const bufferRight = this.bufferOffsetX + this.bufferWidth;
    const safeMargin = 500;  // 安全边距，只有真正接近边界时才重新定位

    const needFullRender = viewLeft < bufferLeft + safeMargin ||
                          viewRight > bufferRight - safeMargin ||
                          this.renderedChunks.size === 0;

    if (needFullRender) {
      // 重新定位缓冲区：让当前视口居中（不是靠左）
      // 确保 bufferOffsetX 不会为负数（初始化时 viewLeft 可能是 0）
      const newBufferLeft = Math.max(0, viewLeft - (this.bufferWidth - this.state.windx) / 2);

      // 只清理移出新缓冲区范围的 chunks
      const newBufferRight = newBufferLeft + this.bufferWidth;
      const chunksToKeep = new Map<string, boolean>();

      for (const [key, value] of this.renderedChunks) {
        // 解析 chunk key 获取位置
        const parts = key.split('_');
        const chunkX = parseFloat(parts[1]);

        // 保留仍在新缓冲区范围内的 chunks
        if (chunkX >= newBufferLeft - 1000 && chunkX <= newBufferRight + 1000) {
          chunksToKeep.set(key, value);
        }
      }

      this.renderedChunks = chunksToKeep;

      // 只清空需要重新绘制的区域（移动缓冲区内容）
      if (this.bufferContext && this.bufferCanvas) {
        const offsetDelta = newBufferLeft - this.bufferOffsetX;

        if (Math.abs(offsetDelta) < this.bufferWidth) {
          // 移动现有内容
          const imageData = this.bufferContext.getImageData(0, 0, this.bufferWidth, this.state.windy);
          this.bufferContext.clearRect(0, 0, this.bufferWidth, this.state.windy);
          this.bufferContext.putImageData(imageData, -offsetDelta, 0);
        } else {
          // 偏移太大，直接清空
          this.bufferContext.clearRect(0, 0, this.bufferWidth, this.state.windy);
          this.renderedChunks.clear();
        }
      }

      this.bufferOffsetX = newBufferLeft;

      // 渲染新区域的 chunks
      this.renderToBuffer(this.bufferOffsetX, this.bufferOffsetX + this.bufferWidth);
    } else {
      // 增量渲染：只渲染新出现的 chunks
      this.renderNewChunks(viewLeft, viewRight);
    }

    // 从缓冲区复制可见区域到主 canvas
    this.copyBufferToCanvas();
  }

  /**
   * 渲染指定范围内的所有 chunks 到缓冲区
   */
  private renderToBuffer(worldLeft: number, worldRight: number): void {
    if (!this.renderer || !this.webgpuCanvas || !this.bufferContext) return;

    const margin = 600;

    // 将范围分段渲染（每段宽度 = 视口宽度）
    const segmentWidth = this.state.windx;
    const numSegments = Math.ceil((worldRight - worldLeft) / segmentWidth);

    for (let i = 0; i < numSegments; i++) {
      const segmentLeft = worldLeft + i * segmentWidth;
      const segmentRight = Math.min(segmentLeft + segmentWidth, worldRight);

      // 筛选当前段内的 chunks
      const chunks = this.state.chunks.filter(chunk =>
        chunk.x > segmentLeft - margin && chunk.x < segmentRight + margin
      );

      if (chunks.length === 0) continue;

      // 按 y 排序（远处先画）
      chunks.sort((a, b) => a.y - b.y);

      // 清空 WebGPU canvas
      this.renderer.clear();

      // 渲染每个 chunk（相对于当前段的坐标）
      for (const chunk of chunks) {
        const localX = chunk.x - segmentLeft;
        const screenY = chunk.y;
        this.renderChunk(chunk, localX, screenY);

        // 标记为已渲染
        this.renderedChunks.set(this.getChunkKey(chunk), true);
      }

      // 将 WebGPU 渲染结果复制到缓冲区的相应位置
      const bufferX = segmentLeft - this.bufferOffsetX;
      this.bufferContext.drawImage(this.webgpuCanvas, bufferX, 0);
    }
  }

  /**
   * 增量渲染新出现的 chunks
   */
  private renderNewChunks(viewLeft: number, viewRight: number): void {
    if (!this.renderer || !this.webgpuCanvas || !this.bufferContext) return;

    const margin = 600;
    const bufferLeft = this.bufferOffsetX;
    const bufferRight = this.bufferOffsetX + this.bufferWidth;

    // 找出缓冲区范围内未渲染的 chunks
    const newChunks = this.state.chunks.filter(chunk => {
      const inBuffer = chunk.x > bufferLeft - margin && chunk.x < bufferRight + margin;
      const notRendered = !this.renderedChunks.has(this.getChunkKey(chunk));
      return inBuffer && notRendered;
    });

    if (newChunks.length === 0) return;

    // 按位置分组（每组宽度 = 视口宽度）
    const segmentWidth = this.state.windx;
    const segments = new Map<number, typeof newChunks>();

    for (const chunk of newChunks) {
      const segmentIndex = Math.floor((chunk.x - bufferLeft) / segmentWidth);
      if (!segments.has(segmentIndex)) {
        segments.set(segmentIndex, []);
      }
      segments.get(segmentIndex)!.push(chunk);
    }

    // 渲染每个段
    for (const [segmentIndex, chunks] of segments) {
      const segmentLeft = bufferLeft + segmentIndex * segmentWidth;

      // 按 y 排序
      chunks.sort((a, b) => a.y - b.y);

      // 清空 WebGPU canvas
      this.renderer.clear();

      // 渲染新 chunks（相对于段的坐标）
      for (const chunk of chunks) {
        const localX = chunk.x - segmentLeft;
        const screenY = chunk.y;
        this.renderChunk(chunk, localX, screenY);

        // 标记为已渲染
        this.renderedChunks.set(this.getChunkKey(chunk), true);
      }

      // 将新渲染的内容叠加到缓冲区的相应位置
      const bufferX = segmentLeft - this.bufferOffsetX;
      this.bufferContext.drawImage(this.webgpuCanvas, bufferX, 0);
    }
  }

  /**
   * 从缓冲区复制可见区域到显示 canvas
   */
  private copyBufferToCanvas(): void {
    if (!this.displayContext || !this.bufferCanvas) return;

    // 计算需要复制的区域（在缓冲区中的位置）
    let sourceX = this.state.cursx - this.bufferOffsetX;
    const sourceY = 0;
    let sourceWidth = this.state.windx;
    const sourceHeight = this.state.windy;

    // 边界检查：确保不超出缓冲区范围
    if (sourceX < 0) {
      // 左边超出：只复制可见部分
      sourceWidth += sourceX;  // 减少宽度
      sourceX = 0;
    }

    if (sourceX + sourceWidth > this.bufferWidth) {
      // 右边超出：裁剪宽度
      sourceWidth = this.bufferWidth - sourceX;
    }

    // 如果完全超出范围，不复制
    if (sourceWidth <= 0 || sourceX >= this.bufferWidth) {
      console.warn('View completely outside buffer range', {
        cursx: this.state.cursx,
        bufferOffsetX: this.bufferOffsetX,
        bufferWidth: this.bufferWidth
      });
      return;
    }

    // 清空显示 canvas
    this.displayContext.clearRect(0, 0, this.state.windx, this.state.windy);

    // 复制缓冲区的可见部分到显示 canvas
    const destX = sourceX === 0 && sourceWidth < this.state.windx
      ? (this.state.cursx - this.bufferOffsetX < 0 ? Math.abs(this.state.cursx - this.bufferOffsetX) : 0)
      : 0;

    this.displayContext.drawImage(
      this.bufferCanvas,
      sourceX, sourceY, sourceWidth, sourceHeight,
      destX, 0, sourceWidth, sourceHeight
    );
  }

  /**
   * 生成 chunk 的唯一标识
   */
  private getChunkKey(chunk: GPUChunk): string {
    return `${chunk.tag}_${chunk.x}_${chunk.y}_${chunk.seed}`;
  }

  private renderChunk(chunk: GPUChunk, screenX: number, screenY: number): void {
    if (!this.renderer) return;

    const params = chunk.params;

    switch (chunk.tag) {
      case 'mount':
        this.renderer.drawMountain(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 200,
          width: (params.width as number) || 400,
          texture: Math.min((params.texture as number) || 100, 80), // 限制纹理数量
        });
        break;

      case 'distmount':
        this.renderer.drawDistantMount(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 100,
          length: (params.length as number) || 600,
        });
        break;

      case 'water':
        this.renderer.drawWater(screenX, screenY, chunk.seed, {
          length: (params.length as number) || 400,
          clusters: (params.clusters as number) || 10,
        });
        break;

      case 'tree':
        this.renderer.drawTree(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 80,
          type: (params.type as number) || 1,
        });
        break;

      case 'rock':
        this.renderer.drawRock(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 60,
          width: (params.width as number) || 80,
          texture: (params.texture as number) || 40,
        });
        break;

      case 'cloud':
        this.renderer.drawCloud(screenX, screenY, chunk.seed, {
          size: (params.size as number) || 150,
          opacity: (params.opacity as number) || 0.3,
        });
        break;

      case 'boat':
        this.renderer.drawBoat(screenX, screenY, chunk.seed, {
          length: (params.length as number) || 120,
          scale: (params.scale as number) || 1,
          flip: (params.flip as boolean) || false,
        });
        break;

      case 'pavilion':
        this.renderer.drawPavilion(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 70,
          width: (params.width as number) || 180,
        });
        break;

      case 'pagoda':
        this.renderer.drawPagoda(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 15,
          width: (params.width as number) || 50,
          stories: (params.stories as number) || 5,
        });
        break;

      case 'flatmount':
        this.renderer.drawFlatMount(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 100,
          width: (params.width as number) || 400,
          texture: (params.texture as number) || 80,
        });
        break;

      case 'mistymount':
        this.renderer.drawMistyMount(screenX, screenY, chunk.seed, {
          height: (params.height as number) || 200,
          length: (params.length as number) || 1000,
          layers: (params.layers as number) || 3,
        });
        break;
    }
  }

  isContentDirty(): boolean {
    return this.contentDirty;
  }

  markContentClean(): void {
    this.contentDirty = false;
  }

  get width(): number {
    return this.state.windx;
  }

  get height(): number {
    return this.state.windy;
  }

  destroy(): void {
    this.renderer?.destroy();
    this.renderer = null;
    this.initialized = false;
  }
}

export default GPUSceneManager;
