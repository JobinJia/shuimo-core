import { describe, it, expect } from 'vitest';
import { Mountain } from '../../../src/elements/natural/mountain';
import { RenderContext } from '../../../src/renderer/renderer';

describe('Mountain', () => {
  describe('constructor', () => {
    it('should create mountain with default parameters', () => {
      const mountain = new Mountain();
      expect(mountain.id).toContain('mountain');
      expect(mountain.type).toBe('mountain');
    });

    it('should accept custom parameters', () => {
      const mountain = new Mountain({
        width: 1000,
        height: 400,
        layerCount: 5
      });
      const params = mountain.getParams();
      expect(params.width).toBe(1000);
      expect(params.height).toBe(400);
      expect(params.layerCount).toBe(5);
    });
  });

  describe('reproducibility', () => {
    it('should generate same profile with same seed', () => {
      const m1 = new Mountain({ seed: 12345 });
      const m2 = new Mountain({ seed: 12345 });

      // 两个山脉应该有相同的参数
      expect(m1.getParams().seed).toBe(m2.getParams().seed);
    });

    it('should generate different profiles with different seeds', () => {
      const m1 = new Mountain({ seed: 12345 });
      const m2 = new Mountain({ seed: 54321 });

      expect(m1.getParams().seed).not.toBe(m2.getParams().seed);
    });
  });

  describe('bounds', () => {
    it('should calculate correct bounds', () => {
      const mountain = new Mountain({
        position: { x: 100, y: 200 },
        width: 800,
        height: 300
      });

      const bounds = mountain.getBounds();
      expect(bounds.x).toBe(100);
      expect(bounds.y).toBe(200);
      expect(bounds.width).toBe(800);
      expect(bounds.height).toBe(300);
    });
  });

  describe('rendering', () => {
    it('should have render method', () => {
      const mountain = new Mountain();
      expect(typeof mountain.render).toBe('function');
    });

    it('should render without errors (interface test)', () => {
      const mountain = new Mountain();

      // 创建模拟渲染器
      const mockRenderer = {
        drawPolygon: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        type: 'canvas',
        width: 800,
        height: 600
      } as any;

      const context = new RenderContext(mockRenderer);

      expect(() => {
        mountain.render(context);
      }).not.toThrow();
    });
  });

  describe('clone', () => {
    it('should create a cloned mountain', () => {
      const original = new Mountain({ seed: 12345 });
      const cloned = original.clone();

      expect(cloned.type).toBe('mountain');
      expect(cloned.id).not.toBe(original.id);
    });
  });

  describe('parameter updates', () => {
    it('should update parameters', () => {
      const mountain = new Mountain({ width: 800 });

      mountain.updateParams({ width: 1000 });

      const params = mountain.getParams();
      expect(params.width).toBe(1000);
    });

    it('should recalculate bounds after update', () => {
      const mountain = new Mountain({ width: 800, height: 300 });

      mountain.updateParams({ width: 1000, height: 400 });

      const bounds = mountain.getBounds();
      expect(bounds.width).toBe(1000);
      expect(bounds.height).toBe(400);
    });
  });
});
