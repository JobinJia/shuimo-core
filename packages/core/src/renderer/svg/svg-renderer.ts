/**
 * SVG Renderer
 *
 * Implements rendering using SVG (Scalable Vector Graphics)
 * Produces resolution-independent vector output
 */

import type { Vec2, DrawStyle, BrushEffect, ExportFormat } from '../../foundation/types';
import { Renderer } from '../renderer';
import { colorToCSS } from '../types';

/**
 * SVG-based renderer
 *
 * Renders to SVG elements, producing scalable vector graphics
 */
export class SVGRenderer extends Renderer {
  private svg: SVGSVGElement;
  private rootGroup: SVGGElement;
  private currentGroup: SVGGElement;
  private groupStack: SVGGElement[] = [];
  private defsElement: SVGDefsElement;
  private filterId = 0;

  constructor(svg: SVGSVGElement);
  constructor(width: number, height: number);
  constructor(svgOrWidth: SVGSVGElement | number, height?: number) {
    let svg: SVGSVGElement;

    if (typeof svgOrWidth === 'number') {
      // Create new SVG element
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', svgOrWidth.toString());
      svg.setAttribute('height', height!.toString());
      svg.setAttribute('viewBox', `0 0 ${svgOrWidth} ${height}`);
    } else {
      // Use existing SVG element
      svg = svgOrWidth;
    }

    const svgWidth = parseFloat(svg.getAttribute('width') || '800');
    const svgHeight = parseFloat(svg.getAttribute('height') || '600');

    super('svg', svgWidth, svgHeight);
    this.svg = svg;

    // Create root group
    this.rootGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.svg.appendChild(this.rootGroup);
    this.currentGroup = this.rootGroup;

    // Create defs element for filters and gradients
    this.defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    this.svg.insertBefore(this.defsElement, this.rootGroup);
  }

  /**
   * Get the SVG element
   */
  getSVG(): SVGSVGElement {
    return this.svg;
  }

  // ========== Drawing methods ==========

  drawPath(points: Vec2[], style: DrawStyle): void {
    if (points.length < 2) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const transformedPoints = this.applyTransformToPoints(points);

    let d = `M ${transformedPoints[0]!.x} ${transformedPoints[0]!.y}`;
    for (let i = 1; i < transformedPoints.length; i++) {
      d += ` L ${transformedPoints[i]!.x} ${transformedPoints[i]!.y}`;
    }

    path.setAttribute('d', d);
    this.applyStyleToElement(path, style);
    this.currentGroup.appendChild(path);
  }

  drawPolygon(points: Vec2[], style: DrawStyle): void {
    if (points.length < 3) return;

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const transformedPoints = this.applyTransformToPoints(points);

    const pointsStr = transformedPoints
      .map(p => `${p.x},${p.y}`)
      .join(' ');

    polygon.setAttribute('points', pointsStr);
    this.applyStyleToElement(polygon, style);
    this.currentGroup.appendChild(polygon);
  }

  drawCircle(center: Vec2, radius: number, style: DrawStyle): void {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    const transformed = this.applyTransform(center);

    circle.setAttribute('cx', transformed.x.toString());
    circle.setAttribute('cy', transformed.y.toString());
    circle.setAttribute('r', radius.toString());

    this.applyStyleToElement(circle, style);
    this.currentGroup.appendChild(circle);
  }

  stroke(points: Vec2[], style: DrawStyle, brush?: BrushEffect): void {
    if (points.length < 2) return;

    if (brush) {
      this.drawBrushStroke(points, style, brush);
    } else {
      this.drawPath(points, { ...style, fillColor: undefined });
    }
  }

  /**
   * Draw a brush stroke with SVG filters
   */
  private drawBrushStroke(points: Vec2[], style: DrawStyle, brush: BrushEffect): void {
    if (points.length < 2) return;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const transformedPoints = this.applyTransformToPoints(points);

    let d = `M ${transformedPoints[0]!.x} ${transformedPoints[0]!.y}`;
    for (let i = 1; i < transformedPoints.length; i++) {
      d += ` L ${transformedPoints[i]!.x} ${transformedPoints[i]!.y}`;
    }

    path.setAttribute('d', d);

    // Apply brush effects via filters
    if (brush.wetness !== undefined && brush.wetness > 0.5) {
      const filterId = this.createBlurFilter((brush.wetness - 0.5) * 4);
      path.setAttribute('filter', `url(#${filterId})`);
    }

    const pressure = brush.pressure !== undefined ? brush.pressure : 1;
    const strokeWidth = (style.strokeWidth || 1) * pressure;

    this.applyStyleToElement(path, {
      ...style,
      strokeWidth,
      fillColor: undefined
    });

    this.currentGroup.appendChild(path);
  }

  clear(): void {
    while (this.rootGroup.firstChild) {
      this.rootGroup.removeChild(this.rootGroup.firstChild);
    }
    this.resetTransform();
  }

  // ========== Export methods ==========

  async export(format: ExportFormat): Promise<string | Blob> {
    switch (format) {
      case 'svg': {
        const serializer = new XMLSerializer();
        return serializer.serializeToString(this.svg);
      }

      case 'data-url': {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.svg);
        const encoded = btoa(unescape(encodeURIComponent(svgString)));
        return `data:image/svg+xml;base64,${encoded}`;
      }

      case 'png':
      case 'jpeg':
        throw new Error('SVG renderer does not support raster export. Use CanvasRenderer instead.');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // ========== Style application ==========

  private applyStyleToElement(element: SVGElement, style: DrawStyle): void {
    if (style.fillColor) {
      element.setAttribute('fill', colorToCSS(style.fillColor));
    } else {
      element.setAttribute('fill', 'none');
    }

    if (style.strokeColor) {
      element.setAttribute('stroke', colorToCSS(style.strokeColor));
    }

    if (style.strokeWidth !== undefined) {
      element.setAttribute('stroke-width', style.strokeWidth.toString());
    }

    if (style.lineCap) {
      element.setAttribute('stroke-linecap', style.lineCap);
    }

    if (style.lineJoin) {
      element.setAttribute('stroke-linejoin', style.lineJoin);
    }

    if (style.opacity !== undefined) {
      element.setAttribute('opacity', style.opacity.toString());
    }

    if (style.blur !== undefined && style.blur > 0) {
      const filterId = this.createBlurFilter(style.blur);
      element.setAttribute('filter', `url(#${filterId})`);
    }
  }

  // ========== Filter creation ==========

  private createBlurFilter(amount: number): string {
    const filterId = `blur-${this.filterId++}`;

    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', filterId);

    const blur = document.createElementNS('http://www.w3.org/2000/svg', 'feGaussianBlur');
    blur.setAttribute('stdDeviation', amount.toString());

    filter.appendChild(blur);
    this.defsElement.appendChild(filter);

    return filterId;
  }

  // ========== Transform overrides ==========

  save(): void {
    super.save();

    // Create new group for this transform state
    const newGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.currentGroup.appendChild(newGroup);
    this.groupStack.push(this.currentGroup);
    this.currentGroup = newGroup;
  }

  restore(): void {
    super.restore();

    // Restore previous group
    const previousGroup = this.groupStack.pop();
    if (previousGroup) {
      this.currentGroup = previousGroup;
    }
  }

  translate(x: number, y: number): void {
    super.translate(x, y);
    this.updateTransform();
  }

  rotate(angle: number): void {
    super.rotate(angle);
    this.updateTransform();
  }

  scale(x: number, y: number): void {
    super.scale(x, y);
    this.updateTransform();
  }

  private updateTransform(): void {
    const matrix = this.currentTransform;
    const transform = `matrix(${matrix.a}, ${matrix.b}, ${matrix.c}, ${matrix.d}, ${matrix.e}, ${matrix.f})`;
    this.currentGroup.setAttribute('transform', transform);
  }
}
