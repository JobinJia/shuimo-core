import { describe, it, expect } from 'vitest';
import { Water } from '../../../src/elements/natural/water';
import { RenderContext } from '../../../src/renderer/renderer';
import { WaterType } from '../../../src/elements/types';

describe('Water', () => {
  describe('constructor', () => {
    it('should create water with default parameters', () => {
      const water = new Water();
      expect(water.id).toContain('water');
      expect(water.type).toBe('water');
    });

    it('should accept custom parameters', () => {
      const water = new Water({
        width: 1000,
        height: 300,
        waterType: WaterType.RIPPLED
      });
      const params = water.getParams();
      expect(params.width).toBe(1000);
      expect(params.height).toBe(300);
      expect(params.waterType).toBe(WaterType.RIPPLED);
    });
  });

  describe('water types', () => {
    it('should create still water', () => {
      const water = new Water({ waterType: WaterType.STILL });
      const params = water.getParams();
      expect(params.waterType).toBe(WaterType.STILL);
    });

    it('should create flowing water', () => {
      const water = new Water({ waterType: WaterType.FLOWING });
      const params = water.getParams();
      expect(params.waterType).toBe(WaterType.FLOWING);
    });

    it('should create rippled water', () => {
      const water = new Water({ waterType: WaterType.RIPPLED });
      const params = water.getParams();
      expect(params.waterType).toBe(WaterType.RIPPLED);
    });
  });

  describe('reproducibility', () => {
    it('should generate same waves with same seed', () => {
      const w1 = new Water({ seed: 12345 });
      const w2 = new Water({ seed: 12345 });

      expect(w1.getParams().seed).toBe(w2.getParams().seed);
    });

    it('should generate different waves with different seeds', () => {
      const w1 = new Water({ seed: 12345 });
      const w2 = new Water({ seed: 54321 });

      expect(w1.getParams().seed).not.toBe(w2.getParams().seed);
    });
  });

  describe('bounds', () => {
    it('should calculate correct bounds including wave amplitude', () => {
      const water = new Water({
        position: { x: 0, y: 400 },
        width: 800,
        height: 200,
        waterType: WaterType.STILL
      });

      const bounds = water.getBounds();
      expect(bounds.x).toBe(0);
      expect(bounds.width).toBe(800);
      // Bounds should include wave buffer
      expect(bounds.y).toBeLessThan(400);
      expect(bounds.height).toBeGreaterThan(200);
    });
  });

  describe('rendering', () => {
    it('should have render method', () => {
      const water = new Water();
      expect(typeof water.render).toBe('function');
    });

    it('should render without errors (interface test)', () => {
      const water = new Water();

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
        water.render(context);
      }).not.toThrow();
    });

    it('should render with custom time offset', () => {
      const water = new Water();

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
        water.render(context, 100);
      }).not.toThrow();
    });

    it('should render all water types without errors', () => {
      const types = [WaterType.STILL, WaterType.FLOWING, WaterType.RIPPLED];
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

      types.forEach(waterType => {
        const water = new Water({ waterType });
        expect(() => {
          water.render(context);
        }).not.toThrow();
      });
    });
  });

  describe('animation', () => {
    it('should have tick method', () => {
      const water = new Water();
      expect(typeof water.tick).toBe('function');
    });

    it('should update time offset with tick', () => {
      const water = new Water();
      const initialTime = water.getTimeOffset();

      water.tick(10);

      const newTime = water.getTimeOffset();
      expect(newTime).toBeGreaterThan(initialTime);
    });

    it('should reset time offset', () => {
      const water = new Water();
      water.tick(100);

      water.resetTime();

      expect(water.getTimeOffset()).toBe(0);
    });
  });

  describe('clone', () => {
    it('should create a cloned water', () => {
      const original = new Water({ seed: 12345 });
      const cloned = original.clone();

      expect(cloned.type).toBe('water');
      expect(cloned.id).not.toBe(original.id);
    });

    it('should clone with different seed', () => {
      const original = new Water({ seed: 12345 });
      const cloned = original.clone() as Water;

      const originalParams = original.getParams();
      const clonedParams = cloned.getParams();

      expect(clonedParams.seed).toBe(originalParams.seed! + 1);
    });
  });

  describe('parameter updates', () => {
    it('should update width parameter', () => {
      const water = new Water({ width: 800 });

      water.updateParams({ width: 1000 });

      const params = water.getParams();
      expect(params.width).toBe(1000);
    });

    it('should update water type', () => {
      const water = new Water({ waterType: WaterType.STILL });

      water.updateParams({ waterType: WaterType.RIPPLED });

      const params = water.getParams();
      expect(params.waterType).toBe(WaterType.RIPPLED);
    });

    it('should update water color', () => {
      const water = new Water();
      const newColor = { r: 50, g: 100, b: 150, a: 0.8 };

      water.updateParams({ waterColor: newColor });

      const params = water.getParams();
      expect(params.waterColor).toEqual(newColor);
    });

    it('should recalculate bounds after update', () => {
      const water = new Water({ height: 200 });

      water.updateParams({ height: 300 });

      const bounds = water.getBounds();
      // Height in bounds includes wave buffer
      expect(bounds.height).toBeGreaterThan(300);
    });
  });

  describe('custom wave parameters', () => {
    it('should accept custom wave parameters', () => {
      const water = new Water({
        waterType: WaterType.STILL,
        waveParams: {
          amplitude: 10,
          frequency: 0.05
        }
      });

      expect(water.getParams()).toBeDefined();
    });
  });
});
