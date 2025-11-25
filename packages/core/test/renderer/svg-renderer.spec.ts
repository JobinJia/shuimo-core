import { describe, it, expect, beforeEach } from 'vitest';
import { SVGRenderer } from '../../src/renderer/svg/svg-renderer';
import type { Vec2 } from '../../src/foundation/types';

describe('SVGRenderer', () => {
  let renderer: SVGRenderer;

  beforeEach(() => {
    renderer = new SVGRenderer(800, 600);
  });

  describe('constructor', () => {
    it('should create renderer with specified dimensions', () => {
      expect(renderer.type).toBe('svg');
      expect(renderer.width).toBe(800);
      expect(renderer.height).toBe(600);
    });

    it('should create SVG element', () => {
      const svg = renderer.getSVG();
      expect(svg).toBeInstanceOf(SVGSVGElement);
      expect(svg.getAttribute('width')).toBe('800');
      expect(svg.getAttribute('height')).toBe('600');
    });

    it('should accept existing SVG element', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '400');
      svg.setAttribute('height', '300');

      const r = new SVGRenderer(svg);
      expect(r.width).toBe(400);
      expect(r.height).toBe(300);
      expect(r.getSVG()).toBe(svg);
    });
  });

  describe('drawPath', () => {
    it('should create path element', () => {
      const points: Vec2[] = [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
        { x: 100, y: 20 }
      ];

      renderer.drawPath(points, {
        strokeColor: { r: 0, g: 0, b: 0 },
        strokeWidth: 2
      });

      const svg = renderer.getSVG();
      const paths = svg.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should handle empty path', () => {
      expect(() => {
        renderer.drawPath([], { strokeColor: { r: 0, g: 0, b: 0 } });
      }).not.toThrow();
    });
  });

  describe('drawPolygon', () => {
    it('should create polygon element', () => {
      const points: Vec2[] = [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 50, y: 50 },
        { x: 10, y: 50 }
      ];

      renderer.drawPolygon(points, {
        fillColor: { r: 255, g: 0, b: 0 },
        strokeColor: { r: 0, g: 0, b: 0 },
        strokeWidth: 1
      });

      const svg = renderer.getSVG();
      const polygons = svg.querySelectorAll('polygon');
      expect(polygons.length).toBeGreaterThan(0);
    });
  });

  describe('drawCircle', () => {
    it('should create circle element', () => {
      renderer.drawCircle(
        { x: 100, y: 100 },
        50,
        {
          fillColor: { r: 0, g: 255, b: 0 },
          strokeColor: { r: 0, g: 0, b: 0 },
          strokeWidth: 2
        }
      );

      const svg = renderer.getSVG();
      const circles = svg.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);

      const circle = circles[0];
      expect(circle.getAttribute('cx')).toBe('100');
      expect(circle.getAttribute('cy')).toBe('100');
      expect(circle.getAttribute('r')).toBe('50');
    });
  });

  describe('stroke', () => {
    it('should create stroke path', () => {
      const points: Vec2[] = [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
        { x: 100, y: 20 }
      ];

      renderer.stroke(points, {
        strokeColor: { r: 0, g: 0, b: 0 },
        strokeWidth: 3
      });

      const svg = renderer.getSVG();
      const paths = svg.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should apply brush effect with filter', () => {
      const points: Vec2[] = [
        { x: 10, y: 10 },
        { x: 100, y: 100 }
      ];

      renderer.stroke(
        points,
        {
          strokeColor: { r: 0, g: 0, b: 0 },
          strokeWidth: 5
        },
        {
          type: 'ink',
          pressure: 0.8,
          wetness: 0.7
        }
      );

      const svg = renderer.getSVG();
      const paths = svg.querySelectorAll('path');
      expect(paths.length).toBeGreaterThan(0);

      // Should have filter applied
      const path = paths[0];
      const filter = path.getAttribute('filter');
      expect(filter).toBeTruthy();
    });
  });

  describe('transforms', () => {
    it('should create group for save/restore', () => {
      const svg = renderer.getSVG();
      const initialGroups = svg.querySelectorAll('g').length;

      renderer.save();
      renderer.translate(100, 100);

      const afterSaveGroups = svg.querySelectorAll('g').length;
      expect(afterSaveGroups).toBeGreaterThan(initialGroups);

      renderer.restore();
    });

    it('should apply translation to group', () => {
      renderer.save();
      renderer.translate(50, 50);

      const point: Vec2 = { x: 0, y: 0 };
      renderer.drawCircle(point, 10, {
        fillColor: { r: 255, g: 0, b: 0 }
      });

      renderer.restore();

      const svg = renderer.getSVG();
      const groups = svg.querySelectorAll('g');
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe('clear', () => {
    it('should remove all elements', () => {
      // Draw something
      renderer.drawCircle({ x: 100, y: 100 }, 50, {
        fillColor: { r: 255, g: 0, b: 0 }
      });

      const svg = renderer.getSVG();
      const beforeClear = svg.querySelectorAll('circle').length;
      expect(beforeClear).toBeGreaterThan(0);

      // Clear
      renderer.clear();

      const afterClear = svg.querySelectorAll('circle').length;
      expect(afterClear).toBe(0);
    });
  });

  describe('export', () => {
    it('should export as SVG string', async () => {
      renderer.drawCircle({ x: 100, y: 100 }, 50, {
        fillColor: { r: 255, g: 0, b: 0 }
      });

      const svgString = await renderer.export('svg');
      expect(typeof svgString).toBe('string');
      expect(svgString).toContain('svg');
      expect(svgString).toContain('circle');
    });

    it('should export as data URL', async () => {
      renderer.drawCircle({ x: 100, y: 100 }, 50, {
        fillColor: { r: 255, g: 0, b: 0 }
      });

      const dataUrl = await renderer.export('data-url');
      expect(typeof dataUrl).toBe('string');
      expect(dataUrl).toContain('data:image/svg+xml');
    });

    it('should throw error for raster export', async () => {
      await expect(renderer.export('png')).rejects.toThrow();
      await expect(renderer.export('jpeg')).rejects.toThrow();
    });
  });

  describe('style application', () => {
    it('should apply fill and stroke', () => {
      renderer.drawCircle({ x: 100, y: 100 }, 50, {
        fillColor: { r: 255, g: 0, b: 0 },
        strokeColor: { r: 0, g: 0, b: 255 },
        strokeWidth: 2
      });

      const svg = renderer.getSVG();
      const circle = svg.querySelector('circle');
      expect(circle).toBeTruthy();
      expect(circle!.getAttribute('fill')).toContain('rgb');
      expect(circle!.getAttribute('stroke')).toContain('rgb');
      expect(circle!.getAttribute('stroke-width')).toBe('2');
    });

    it('should apply opacity', () => {
      renderer.drawCircle({ x: 100, y: 100 }, 50, {
        fillColor: { r: 255, g: 0, b: 0 },
        opacity: 0.5
      });

      const svg = renderer.getSVG();
      const circle = svg.querySelector('circle');
      expect(circle!.getAttribute('opacity')).toBe('0.5');
    });

    it('should apply line cap and join', () => {
      const points: Vec2[] = [
        { x: 10, y: 10 },
        { x: 50, y: 50 }
      ];

      renderer.drawPath(points, {
        strokeColor: { r: 0, g: 0, b: 0 },
        strokeWidth: 5,
        lineCap: 'round',
        lineJoin: 'round'
      });

      const svg = renderer.getSVG();
      const path = svg.querySelector('path');
      expect(path!.getAttribute('stroke-linecap')).toBe('round');
      expect(path!.getAttribute('stroke-linejoin')).toBe('round');
    });
  });
});
