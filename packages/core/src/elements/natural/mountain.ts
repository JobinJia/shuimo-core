import { BaseElement } from '../base/element';
import { PerlinNoise } from '../../foundation/noise/perlin';
import { RenderContext } from '../../renderer/renderer';
import type {
  BoundingBox,
  Vec2,
  Color,
  IElement
} from '../../foundation/types';
import type {
  MountainParams,
  MountainLayer,
  ColorSchemeType
} from '../types';
import { COLOR_SCHEMES } from '../types';

/**
 * Mountain 元素 - 山脉生成器
 */
export class Mountain extends BaseElement {
  private params: MountainParams;
  private layers: MountainLayer[];
  private noise: PerlinNoise;
  private cachedPaths: Vec2[][] | null = null;

  constructor(params: Partial<MountainParams> = {}) {
    super(
      BaseElement.generateId('mountain'),
      'mountain'
    );

    // 设置默认参数
    this.params = {
      position: params.position || { x: 0, y: 0 },
      width: params.width || 800,
      height: params.height || 300,
      layerCount: params.layerCount || 3,
      complexity: params.complexity || 0.5,
      seed: params.seed || Date.now(),
      colorScheme: params.colorScheme || {
        type: 'blue-mist' as ColorSchemeType,
        ...COLOR_SCHEMES['blue-mist']
      }
    };

    // 初始化噪声生成器
    this.noise = new PerlinNoise(this.params.seed);

    // 生成层配置
    this.layers = this.generateLayers();

    // 计算边界框
    this._bounds = this.calculateBounds();
  }

  /**
   * 生成层配置
   */
  private generateLayers(): MountainLayer[] {
    const { layerCount, colorScheme } = this.params;
    const layers: MountainLayer[] = [];

    for (let i = 0; i < layerCount; i++) {
      const t = i / (layerCount - 1); // 0 到 1

      layers.push({
        baseHeight: 0.7 + t * 0.1,  // 70% → 80% 画布高度
        noiseFrequency: 0.003,       // 固定频率
        noiseAmplitude: 100,         // 固定振幅
        fillColor: this.interpolateColor(
          colorScheme.farColor,
          colorScheme.nearColor,
          t
        ),
        opacity: 0.3 + t * 0.5      // 0.3 → 0.8
      });
    }

    return layers;
  }

  /**
   * 颜色插值
   */
  private interpolateColor(c1: Color, c2: Color, t: number): Color {
    return {
      r: Math.floor(c1.r + (c2.r - c1.r) * t),
      g: Math.floor(c1.g + (c2.g - c1.g) * t),
      b: Math.floor(c1.b + (c2.b - c1.b) * t),
      a: c1.a !== undefined && c2.a !== undefined ? c1.a + (c2.a - c1.a) * t : undefined
    };
  }

  /**
   * 生成山脉轮廓
   */
  private generateProfile(layer: MountainLayer, layerIndex: number): Vec2[] {
    const { position, width, height } = this.params;
    const points: Vec2[] = [];

    // 起点（左下）
    points.push({
      x: position.x,
      y: position.y + height
    });

    // 采样间隔根据复杂度调整
    const step = 20 / (1 + this.params.complexity);

    // 生成山脉轮廓点
    for (let x = 0; x <= width; x += step) {
      const noiseValue = this.noise.noise2D(
        x * layer.noiseFrequency,
        layerIndex
      );

      const y = position.y +
                height * layer.baseHeight +
                noiseValue * layer.noiseAmplitude -
                layerIndex * 20;

      points.push({ x: position.x + x, y });
    }

    // 终点（右下）
    points.push({
      x: position.x + width,
      y: position.y + height
    });

    return points;
  }

  /**
   * 生成所有层的路径（带缓存）
   */
  private generateAllPaths(): Vec2[][] {
    if (this.cachedPaths) {
      return this.cachedPaths;
    }

    const paths: Vec2[][] = [];
    for (let i = 0; i < this.layers.length; i++) {
      paths.push(this.generateProfile(this.layers[i]!, i));
    }

    this.cachedPaths = paths;
    return paths;
  }

  /**
   * 渲染方法
   */
  render(context: RenderContext): void {
    const paths = this.generateAllPaths();

    context.applyTransform();

    // 按从远到近的顺序渲染
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i]!;
      const path = paths[i]!;

      context.renderer.drawPolygon(path, {
        fillColor: {
          ...layer.fillColor,
          a: layer.opacity
        },
        strokeColor: layer.strokeColor,
        strokeWidth: layer.strokeWidth
      });
    }

    context.restoreTransform();
  }

  /**
   * 克隆方法
   */
  clone(): IElement {
    return new Mountain({
      ...this.params,
      seed: this.params.seed !== undefined ? this.params.seed + 1 : Date.now()
    });
  }

  /**
   * 计算边界框
   */
  protected calculateBounds(): BoundingBox {
    return {
      x: this.params.position.x,
      y: this.params.position.y,
      width: this.params.width,
      height: this.params.height
    };
  }

  /**
   * 参数更新时清除缓存
   */
  protected onParameterChanged<T>(key: string, value: T): void {
    this.cachedPaths = null;
    super.onParameterChanged(key, value);
  }

  /**
   * 获取参数
   */
  getParams(): MountainParams {
    return { ...this.params };
  }

  /**
   * 更新参数
   */
  updateParams(newParams: Partial<MountainParams>): void {
    this.params = { ...this.params, ...newParams };
    this.layers = this.generateLayers();
    this.cachedPaths = null;
    this._bounds = this.calculateBounds();
  }
}
