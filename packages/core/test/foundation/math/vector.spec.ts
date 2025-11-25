import { describe, it, expect } from 'vitest';
import { Vector2, Vector3 } from '../../../src/foundation/math/vector';

describe('Vector2', () => {
  describe('constructor', () => {
    it('should create a zero vector by default', () => {
      const v = new Vector2();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    it('should create a vector with given values', () => {
      const v = new Vector2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });
  });

  describe('factory methods', () => {
    it('should create zero vector', () => {
      const v = Vector2.zero();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });

    it('should create one vector', () => {
      const v = Vector2.one();
      expect(v.x).toBe(1);
      expect(v.y).toBe(1);
    });

    it('should create vector from angle', () => {
      const v = Vector2.fromAngle(0, 1);
      expect(v.x).toBeCloseTo(1);
      expect(v.y).toBeCloseTo(0);

      const v2 = Vector2.fromAngle(Math.PI / 2, 1);
      expect(v2.x).toBeCloseTo(0);
      expect(v2.y).toBeCloseTo(1);
    });
  });

  describe('arithmetic operations', () => {
    it('should add vectors', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(3, 4);
      const result = v1.add(v2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });

    it('should subtract vectors', () => {
      const v1 = new Vector2(5, 6);
      const v2 = new Vector2(2, 3);
      const result = v1.sub(v2);
      expect(result.x).toBe(3);
      expect(result.y).toBe(3);
    });

    it('should multiply by scalar', () => {
      const v = new Vector2(2, 3);
      const result = v.multiplyScalar(2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });

    it('should negate vector', () => {
      const v = new Vector2(2, -3);
      const result = v.negate();
      expect(result.x).toBe(-2);
      expect(result.y).toBe(3);
    });
  });

  describe('geometric operations', () => {
    it('should calculate length', () => {
      const v = new Vector2(3, 4);
      expect(v.length()).toBe(5);
    });

    it('should calculate distance', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(3, 4);
      expect(v1.distance(v2)).toBe(5);
    });

    it('should normalize vector', () => {
      const v = new Vector2(3, 4);
      const normalized = v.normalize();
      expect(normalized.length()).toBeCloseTo(1);
      expect(normalized.x).toBeCloseTo(0.6);
      expect(normalized.y).toBeCloseTo(0.8);
    });

    it('should calculate dot product', () => {
      const v1 = new Vector2(2, 3);
      const v2 = new Vector2(4, 5);
      expect(v1.dot(v2)).toBe(23); // 2*4 + 3*5
    });

    it('should calculate cross product (scalar)', () => {
      const v1 = new Vector2(2, 3);
      const v2 = new Vector2(4, 5);
      expect(v1.cross(v2)).toBe(-2); // 2*5 - 3*4
    });

    it('should rotate vector', () => {
      const v = new Vector2(1, 0);
      const rotated = v.rotate(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(1);
    });

    it('should lerp between vectors', () => {
      const v1 = new Vector2(0, 0);
      const v2 = new Vector2(10, 10);
      const mid = v1.lerp(v2, 0.5);
      expect(mid.x).toBe(5);
      expect(mid.y).toBe(5);
    });
  });

  describe('utility', () => {
    it('should check equality', () => {
      const v1 = new Vector2(1, 2);
      const v2 = new Vector2(1, 2);
      expect(v1.equals(v2)).toBe(true);

      // Test with custom epsilon
      const v3 = new Vector2(1.0001, 2.0001);
      expect(v1.equals(v3, 0.001)).toBe(true);
      expect(v1.equals(v3, 0.00001)).toBe(false);
    });

    it('should clone vector', () => {
      const v1 = new Vector2(1, 2);
      const v2 = v1.clone();
      expect(v2.x).toBe(v1.x);
      expect(v2.y).toBe(v1.y);
      expect(v2).not.toBe(v1);
    });
  });
});

describe('Vector3', () => {
  describe('constructor', () => {
    it('should create a zero vector by default', () => {
      const v = new Vector3();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
      expect(v.z).toBe(0);
    });

    it('should create a vector with given values', () => {
      const v = new Vector3(1, 2, 3);
      expect(v.x).toBe(1);
      expect(v.y).toBe(2);
      expect(v.z).toBe(3);
    });
  });

  describe('arithmetic operations', () => {
    it('should add vectors', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(4, 5, 6);
      const result = v1.add(v2);
      expect(result.x).toBe(5);
      expect(result.y).toBe(7);
      expect(result.z).toBe(9);
    });

    it('should multiply by scalar', () => {
      const v = new Vector3(1, 2, 3);
      const result = v.multiplyScalar(2);
      expect(result.x).toBe(2);
      expect(result.y).toBe(4);
      expect(result.z).toBe(6);
    });
  });

  describe('geometric operations', () => {
    it('should calculate length', () => {
      const v = new Vector3(2, 3, 6);
      expect(v.length()).toBe(7); // sqrt(4 + 9 + 36) = 7
    });

    it('should normalize vector', () => {
      const v = new Vector3(3, 4, 0);
      const normalized = v.normalize();
      expect(normalized.length()).toBeCloseTo(1);
    });

    it('should calculate dot product', () => {
      const v1 = new Vector3(1, 2, 3);
      const v2 = new Vector3(4, 5, 6);
      expect(v1.dot(v2)).toBe(32); // 1*4 + 2*5 + 3*6
    });

    it('should calculate cross product', () => {
      const v1 = new Vector3(1, 0, 0);
      const v2 = new Vector3(0, 1, 0);
      const result = v1.cross(v2);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.z).toBe(1);
    });

    it('should project to 2D', () => {
      const v = new Vector3(100, 100, 0);
      const projected = v.project(500, 0, 0);
      expect(projected.x).toBe(100);
      expect(projected.y).toBe(100);
    });
  });
});
