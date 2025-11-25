/**
 * Base Renderer
 *
 * Abstract base class for all renderers (Canvas, SVG)
 * Provides common functionality and enforces interface
 */

import type { IRenderer, RendererType, DrawStyle, BrushEffect, ExportFormat, Vec2 } from '../foundation/types';

/**
 * Simple 2D transformation matrix
 * Compatible interface with DOMMatrix but works in Node.js/jsdom
 */
class Matrix2D {
  constructor(
    public a: number = 1,
    public b: number = 0,
    public c: number = 0,
    public d: number = 1,
    public e: number = 0,
    public f: number = 0
  ) {}

  translate(x: number, y: number): Matrix2D {
    return new Matrix2D(
      this.a,
      this.b,
      this.c,
      this.d,
      this.e + this.a * x + this.c * y,
      this.f + this.b * x + this.d * y
    );
  }

  rotate(angleInDegrees: number): Matrix2D {
    const rad = (angleInDegrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return new Matrix2D(
      this.a * cos + this.c * sin,
      this.b * cos + this.d * sin,
      this.c * cos - this.a * sin,
      this.d * cos - this.b * sin,
      this.e,
      this.f
    );
  }

  scale(sx: number, sy: number): Matrix2D {
    return new Matrix2D(
      this.a * sx,
      this.b * sx,
      this.c * sy,
      this.d * sy,
      this.e,
      this.f
    );
  }

  transformPoint(x: number, y: number): { x: number; y: number } {
    return {
      x: this.a * x + this.c * y + this.e,
      y: this.b * x + this.d * y + this.f
    };
  }

  clone(): Matrix2D {
    return new Matrix2D(this.a, this.b, this.c, this.d, this.e, this.f);
  }
}

/**
 * Abstract renderer base class
 *
 * Implements common transform stack management and utility methods.
 * Subclasses must implement specific drawing methods.
 */
export abstract class Renderer implements IRenderer {
  protected transformStack: Matrix2D[] = [];
  protected currentTransform: Matrix2D;

  constructor(
    public readonly type: RendererType,
    public readonly width: number,
    public readonly height: number
  ) {
    this.currentTransform = new Matrix2D();
  }

  // ========== Abstract methods (must be implemented by subclasses) ==========

  abstract drawPath(points: Vec2[], style: DrawStyle): void;
  abstract drawPolygon(points: Vec2[], style: DrawStyle): void;
  abstract drawCircle(center: Vec2, radius: number, style: DrawStyle): void;
  abstract stroke(points: Vec2[], style: DrawStyle, brush?: BrushEffect): void;
  abstract export(format: ExportFormat): Promise<string | Blob>;
  abstract clear(): void;

  // ========== Transform management ==========

  save(): void {
    this.transformStack.push(this.currentTransform.clone());
  }

  restore(): void {
    const transform = this.transformStack.pop();
    if (transform) {
      this.currentTransform = transform;
    }
  }

  translate(x: number, y: number): void {
    this.currentTransform = this.currentTransform.translate(x, y);
  }

  rotate(angle: number): void {
    this.currentTransform = this.currentTransform.rotate(angle * 180 / Math.PI);
  }

  scale(x: number, y: number): void {
    this.currentTransform = this.currentTransform.scale(x, y);
  }

  protected resetTransform(): void {
    this.currentTransform = new Matrix2D();
    this.transformStack = [];
  }

  protected getTransformMatrix(): Matrix2D {
    return this.currentTransform;
  }

  // ========== Utility methods ==========

  protected applyTransform(point: Vec2): Vec2 {
    return this.currentTransform.transformPoint(point.x, point.y);
  }

  protected applyTransformToPoints(points: Vec2[]): Vec2[] {
    return points.map(p => this.applyTransform(p));
  }
}

/**
 * Render context
 *
 * Holds rendering state including transform and style
 */
export class RenderContext {
  constructor(
    public renderer: IRenderer,
    public transform: {
      translate: Vec2;
      rotate: number;
      scale: Vec2;
    } = {
      translate: { x: 0, y: 0 },
      rotate: 0,
      scale: { x: 1, y: 1 }
    },
    public style: DrawStyle = {}
  ) {}

  /**
   * Apply context transform to renderer
   */
  applyTransform(): void {
    this.renderer.save();
    this.renderer.translate(this.transform.translate.x, this.transform.translate.y);
    this.renderer.rotate(this.transform.rotate);
    this.renderer.scale(this.transform.scale.x, this.transform.scale.y);
  }

  /**
   * Restore renderer transform
   */
  restoreTransform(): void {
    this.renderer.restore();
  }

  /**
   * Create a new context with merged style
   */
  withStyle(style: DrawStyle): RenderContext {
    return new RenderContext(
      this.renderer,
      this.transform,
      { ...this.style, ...style }
    );
  }

  /**
   * Create a new context with additional transform
   */
  withTransform(
    translate?: Vec2,
    rotate?: number,
    scale?: Vec2
  ): RenderContext {
    return new RenderContext(
      this.renderer,
      {
        translate: translate || this.transform.translate,
        rotate: rotate !== undefined ? rotate : this.transform.rotate,
        scale: scale || this.transform.scale
      },
      this.style
    );
  }
}
