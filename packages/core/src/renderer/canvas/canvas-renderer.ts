/**
 * Canvas Renderer
 *
 * Implements rendering using HTML5 Canvas 2D API
 * Supports pixel-level operations and raster effects
 */

import type { Vec2, DrawStyle, BrushEffect, ExportFormat } from '../../foundation/types';
import { Renderer } from '../renderer';
import { colorToCSS } from '../types';

/**
 * Canvas-based renderer
 *
 * Renders to an HTML5 Canvas element using 2D context
 */
export class CanvasRenderer extends Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement);
  constructor(width: number, height: number);
  constructor(canvasOrWidth: HTMLCanvasElement | number, height?: number) {
    let canvas: HTMLCanvasElement;

    if (typeof canvasOrWidth === 'number') {
      // Create new canvas
      canvas = document.createElement('canvas');
      canvas.width = canvasOrWidth;
      canvas.height = height!;
    } else {
      // Use existing canvas
      canvas = canvasOrWidth;
    }

    super('canvas', canvas.width, canvas.height);
    this.canvas = canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the 2D context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  // ========== Drawing methods ==========

  drawPath(points: Vec2[], style: DrawStyle): void {
    if (points.length < 2) return;

    this.applyStyle(style);

    this.ctx.beginPath();
    const first = this.applyTransform(points[0]);
    this.ctx.moveTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const point = this.applyTransform(points[i]);
      this.ctx.lineTo(point.x, point.y);
    }

    if (style.fillColor) this.ctx.fill();
    if (style.strokeColor) this.ctx.stroke();
  }

  drawPolygon(points: Vec2[], style: DrawStyle): void {
    if (points.length < 3) return;

    this.applyStyle(style);

    this.ctx.beginPath();
    const first = this.applyTransform(points[0]);
    this.ctx.moveTo(first.x, first.y);

    for (let i = 1; i < points.length; i++) {
      const point = this.applyTransform(points[i]);
      this.ctx.lineTo(point.x, point.y);
    }

    this.ctx.closePath();

    if (style.fillColor) this.ctx.fill();
    if (style.strokeColor) this.ctx.stroke();
  }

  drawCircle(center: Vec2, radius: number, style: DrawStyle): void {
    this.applyStyle(style);

    const transformed = this.applyTransform(center);

    this.ctx.beginPath();
    this.ctx.arc(transformed.x, transformed.y, radius, 0, Math.PI * 2);

    if (style.fillColor) this.ctx.fill();
    if (style.strokeColor) this.ctx.stroke();
  }

  stroke(points: Vec2[], style: DrawStyle, brush?: BrushEffect): void {
    if (points.length < 2) return;

    if (brush) {
      this.drawBrushStroke(points, style, brush);
    } else {
      this.drawPath(points, style);
    }
  }

  /**
   * Draw a brush stroke with variable width and effects
   */
  private drawBrushStroke(points: Vec2[], style: DrawStyle, brush: BrushEffect): void {
    if (points.length < 2) return;

    const transformedPoints = this.applyTransformToPoints(points);
    const baseWidth = style.strokeWidth || 1;

    this.applyStyle(style);

    // Simple brush stroke implementation
    this.ctx.beginPath();
    this.ctx.moveTo(transformedPoints[0].x, transformedPoints[0].y);

    for (let i = 1; i < transformedPoints.length; i++) {
      const point = transformedPoints[i];
      this.ctx.lineTo(point.x, point.y);
    }

    // Apply brush effects
    const pressure = brush.pressure !== undefined ? brush.pressure : 1;
    this.ctx.lineWidth = baseWidth * pressure;

    if (brush.wetness !== undefined && brush.wetness > 0.5) {
      // Simulate wet brush with blur
      this.ctx.filter = `blur(${(brush.wetness - 0.5) * 4}px)`;
    }

    this.ctx.stroke();
    this.ctx.filter = 'none';
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.resetTransform();
  }

  // ========== Export methods ==========

  async export(format: ExportFormat): Promise<string | Blob> {
    switch (format) {
      case 'data-url':
        return this.canvas.toDataURL('image/png');

      case 'png':
      case 'jpeg': {
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        return new Promise((resolve, reject) => {
          this.canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Failed to create blob'));
            },
            mimeType
          );
        });
      }

      case 'svg':
        throw new Error('Canvas renderer does not support SVG export. Use SVGRenderer instead.');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ========== Style application ==========

  private applyStyle(style: DrawStyle): void {
    if (style.fillColor) {
      this.ctx.fillStyle = colorToCSS(style.fillColor);
    }

    if (style.strokeColor) {
      this.ctx.strokeStyle = colorToCSS(style.strokeColor);
    }

    if (style.strokeWidth !== undefined) {
      this.ctx.lineWidth = style.strokeWidth;
    }

    if (style.lineCap) {
      this.ctx.lineCap = style.lineCap;
    }

    if (style.lineJoin) {
      this.ctx.lineJoin = style.lineJoin;
    }

    if (style.opacity !== undefined) {
      this.ctx.globalAlpha = style.opacity;
    } else {
      this.ctx.globalAlpha = 1;
    }

    if (style.blur !== undefined && style.blur > 0) {
      this.ctx.filter = `blur(${style.blur}px)`;
    } else {
      this.ctx.filter = 'none';
    }
  }

  // ========== Transform overrides ==========

  save(): void {
    super.save();
    this.ctx.save();
  }

  restore(): void {
    super.restore();
    this.ctx.restore();
  }

  translate(x: number, y: number): void {
    super.translate(x, y);
    this.ctx.translate(x, y);
  }

  rotate(angle: number): void {
    super.rotate(angle);
    this.ctx.rotate(angle);
  }

  scale(x: number, y: number): void {
    super.scale(x, y);
    this.ctx.scale(x, y);
  }
}
