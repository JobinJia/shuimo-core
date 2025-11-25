import type {
  IElement,
  IParametric,
  RenderContext,
  BoundingBox,
  ElementType,
  ParameterValue
} from '../../foundation/types';

/**
 * 抽象基类 - 所有元素的基础
 */
export abstract class BaseElement implements IElement, IParametric {
  readonly id: string;
  readonly type: ElementType;
  protected _bounds: BoundingBox;
  protected parameters: Map<string, ParameterValue>;

  constructor(id: string, type: ElementType) {
    this.id = id;
    this.type = type;
    this._bounds = { x: 0, y: 0, width: 0, height: 0 };
    this.parameters = new Map();
  }

  /**
   * 边界框属性（只读）
   */
  get bounds(): BoundingBox {
    return { ...this._bounds };
  }

  /**
   * 抽象方法 - 子类必须实现
   */
  abstract render(context: RenderContext): void;
  abstract clone(): IElement;

  /**
   * 计算边界框
   */
  getBounds(): BoundingBox {
    return this.bounds;
  }

  /**
   * 参数管理 - IParametric 接口
   */
  getParameter<T = ParameterValue>(key: string): T {
    return this.parameters.get(key) as T;
  }

  setParameter<T = ParameterValue>(key: string, value: T): void {
    this.parameters.set(key, value as ParameterValue);
    this.onParameterChanged(key, value);
  }

  getParameterKeys(): string[] {
    return Array.from(this.parameters.keys());
  }

  /**
   * 参数变化回调 - 子类可重写
   */
  protected onParameterChanged<T>(_key: string, _value: T): void {
    // 参数变化时重新计算边界框
    this._bounds = this.calculateBounds();
  }

  /**
   * 计算边界框 - 子类必须实现
   */
  protected abstract calculateBounds(): BoundingBox;

  /**
   * 生成唯一 ID
   */
  protected static generateId(type: string): string {
    return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
