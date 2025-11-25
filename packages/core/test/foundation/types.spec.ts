import { describe, it, expect } from 'vitest';
import type { Vec2, Vec3, Color, BoundingBox } from '../../src/foundation/types';

describe('Foundation Types', () => {
  describe('Vec2', () => {
    it('should have x and y properties', () => {
      const vec: Vec2 = { x: 10, y: 20 };
      expect(vec.x).toBe(10);
      expect(vec.y).toBe(20);
    });
  });

  describe('Vec3', () => {
    it('should have x, y, and z properties', () => {
      const vec: Vec3 = { x: 10, y: 20, z: 30 };
      expect(vec.x).toBe(10);
      expect(vec.y).toBe(20);
      expect(vec.z).toBe(30);
    });
  });

  describe('Color', () => {
    it('should have RGB properties', () => {
      const color: Color = { r: 255, g: 128, b: 64 };
      expect(color.r).toBe(255);
      expect(color.g).toBe(128);
      expect(color.b).toBe(64);
    });

    it('should support optional alpha', () => {
      const color: Color = { r: 255, g: 128, b: 64, a: 0.5 };
      expect(color.a).toBe(0.5);
    });
  });

  describe('BoundingBox', () => {
    it('should have position and size', () => {
      const bbox: BoundingBox = { x: 10, y: 20, width: 100, height: 50 };
      expect(bbox.x).toBe(10);
      expect(bbox.y).toBe(20);
      expect(bbox.width).toBe(100);
      expect(bbox.height).toBe(50);
    });
  });
});
