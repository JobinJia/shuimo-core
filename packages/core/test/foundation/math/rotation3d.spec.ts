import { describe, it, expect } from 'vitest';
import {
  rotateX,
  rotateY,
  rotateZ,
  rotateEuler,
  rotateAroundAxis,
  Axis,
} from '../../../src/foundation/math/rotation3d';
import { Vector3 } from '../../../src/foundation/math/vector';

const EPSILON = 1e-10;

function expectVec3Close(actual: Vector3, expected: { x: number; y: number; z: number }, epsilon = EPSILON) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(epsilon);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(epsilon);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(epsilon);
}

describe('rotation3d', () => {
  describe('rotateX', () => {
    it('should rotate around X axis by 90 degrees', () => {
      const vec = { x: 0, y: 1, z: 0 };
      const result = rotateX(vec, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 0, z: 1 });
    });

    it('should rotate around X axis by 180 degrees', () => {
      const vec = { x: 0, y: 1, z: 0 };
      const result = rotateX(vec, Math.PI);
      expectVec3Close(result, { x: 0, y: -1, z: 0 });
    });

    it('should not change X component', () => {
      const vec = { x: 5, y: 3, z: 2 };
      const result = rotateX(vec, Math.PI / 4);
      expect(result.x).toBe(5);
    });

    it('should handle zero rotation', () => {
      const vec = { x: 1, y: 2, z: 3 };
      const result = rotateX(vec, 0);
      expectVec3Close(result, vec);
    });

    it('should handle negative angles', () => {
      const vec = { x: 0, y: 1, z: 0 };
      const result = rotateX(vec, -Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 0, z: -1 });
    });
  });

  describe('rotateY', () => {
    it('should rotate around Y axis by 90 degrees', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateY(vec, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 0, z: -1 });
    });

    it('should rotate around Y axis by 180 degrees', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateY(vec, Math.PI);
      expectVec3Close(result, { x: -1, y: 0, z: 0 });
    });

    it('should not change Y component', () => {
      const vec = { x: 3, y: 5, z: 2 };
      const result = rotateY(vec, Math.PI / 4);
      expect(result.y).toBe(5);
    });

    it('should handle zero rotation', () => {
      const vec = { x: 1, y: 2, z: 3 };
      const result = rotateY(vec, 0);
      expectVec3Close(result, vec);
    });

    it('should handle negative angles', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateY(vec, -Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 0, z: 1 });
    });
  });

  describe('rotateZ', () => {
    it('should rotate around Z axis by 90 degrees', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateZ(vec, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 1, z: 0 });
    });

    it('should rotate around Z axis by 180 degrees', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateZ(vec, Math.PI);
      expectVec3Close(result, { x: -1, y: 0, z: 0 });
    });

    it('should not change Z component', () => {
      const vec = { x: 3, y: 2, z: 5 };
      const result = rotateZ(vec, Math.PI / 4);
      expect(result.z).toBe(5);
    });

    it('should handle zero rotation', () => {
      const vec = { x: 1, y: 2, z: 3 };
      const result = rotateZ(vec, 0);
      expectVec3Close(result, vec);
    });

    it('should handle negative angles', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateZ(vec, -Math.PI / 2);
      expectVec3Close(result, { x: 0, y: -1, z: 0 });
    });
  });

  describe('rotateEuler', () => {
    it('should handle single axis rotation (Z only)', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const angles = { x: 0, y: 0, z: Math.PI / 2 };
      const result = rotateEuler(vec, angles);
      expectVec3Close(result, { x: 0, y: 1, z: 0 });
    });

    it('should handle single axis rotation (X only)', () => {
      const vec = { x: 0, y: 1, z: 0 };
      const angles = { x: Math.PI / 2, y: 0, z: 0 };
      const result = rotateEuler(vec, angles);
      expectVec3Close(result, { x: 0, y: 0, z: 1 });
    });

    it('should handle single axis rotation (Y only)', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const angles = { x: 0, y: Math.PI / 2, z: 0 };
      const result = rotateEuler(vec, angles);
      expectVec3Close(result, { x: 0, y: 0, z: -1 });
    });

    it('should apply rotations in Z-X-Y order', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const angles = { x: Math.PI / 2, y: Math.PI / 2, z: Math.PI / 2 };

      // Manual calculation: Z first, then X, then Y
      let result = rotateZ(vec, Math.PI / 2); // (0, 1, 0)
      result = rotateX(result, Math.PI / 2);  // (0, 0, 1)
      result = rotateY(result, Math.PI / 2);  // (1, 0, 0)

      const eulerResult = rotateEuler(vec, angles);
      expectVec3Close(eulerResult, result);
    });

    it('should handle zero angles', () => {
      const vec = { x: 1, y: 2, z: 3 };
      const angles = { x: 0, y: 0, z: 0 };
      const result = rotateEuler(vec, angles);
      expectVec3Close(result, vec);
    });

    it('should handle complex rotation', () => {
      const vec = { x: 1, y: 1, z: 1 };
      const angles = { x: Math.PI / 4, y: Math.PI / 6, z: Math.PI / 3 };
      const result = rotateEuler(vec, angles);

      // Should be a valid rotation (length preserved)
      const originalLength = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
      const resultLength = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(Math.abs(originalLength - resultLength)).toBeLessThan(EPSILON);
    });

    it('should only apply non-zero rotations', () => {
      const vec = { x: 1, y: 0, z: 0 };

      // Only Y rotation should be applied
      const angles = { x: 0, y: Math.PI / 2, z: 0 };
      const result = rotateEuler(vec, angles);
      expectVec3Close(result, { x: 0, y: 0, z: -1 });
    });
  });

  describe('rotateAroundAxis', () => {
    it('should rotate around X axis', () => {
      const vec = { x: 0, y: 1, z: 0 };
      const result = rotateAroundAxis(vec, Axis.X, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 0, z: 1 });
    });

    it('should rotate around Y axis', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateAroundAxis(vec, Axis.Y, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 0, z: -1 });
    });

    it('should rotate around Z axis', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateAroundAxis(vec, Axis.Z, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 1, z: 0 });
    });

    it('should rotate around arbitrary axis', () => {
      const vec = { x: 1, y: 0, z: 0 };
      // Normalize (1,1,1)
      const axis = { x: 1 / Math.sqrt(3), y: 1 / Math.sqrt(3), z: 1 / Math.sqrt(3) };
      const result = rotateAroundAxis(vec, axis, Math.PI * 2 / 3);

      // Rotating around (1,1,1) by 120 degrees should cycle coordinates
      expectVec3Close(result, { x: 0, y: 1, z: 0 }, 1e-9);
    });

    it('should preserve vector length', () => {
      const vec = { x: 3, y: 4, z: 5 };
      const axis = { x: 0.6, y: 0.8, z: 0 }; // normalized
      const result = rotateAroundAxis(vec, axis, Math.PI / 3);

      const originalLength = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
      const resultLength = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(Math.abs(originalLength - resultLength)).toBeLessThan(EPSILON);
    });

    it('should handle zero rotation', () => {
      const vec = { x: 1, y: 2, z: 3 };
      const result = rotateAroundAxis(vec, Axis.X, 0);
      expectVec3Close(result, vec);
    });

    it('should handle 360 degree rotation', () => {
      const vec = { x: 1, y: 2, z: 3 };
      const result = rotateAroundAxis(vec, Axis.Y, Math.PI * 2);
      expectVec3Close(result, vec);
    });
  });

  describe('Axis constants', () => {
    it('should define X/RIGHT axis', () => {
      expect(Axis.X).toEqual({ x: 1, y: 0, z: 0 });
      expect(Axis.RIGHT).toEqual({ x: 1, y: 0, z: 0 });
    });

    it('should define Y/UP axis', () => {
      expect(Axis.Y).toEqual({ x: 0, y: 1, z: 0 });
      expect(Axis.UP).toEqual({ x: 0, y: 1, z: 0 });
    });

    it('should define Z/FORWARD axis', () => {
      expect(Axis.Z).toEqual({ x: 0, y: 0, z: 1 });
      expect(Axis.FORWARD).toEqual({ x: 0, y: 0, z: 1 });
    });
  });

  describe('Integration with Vector3', () => {
    it('should work with Vector3 instances', () => {
      const vec = new Vector3(1, 0, 0);
      const result = rotateZ(vec, Math.PI / 2);
      expectVec3Close(result, { x: 0, y: 1, z: 0 });
    });

    it('should return Vector3 instances', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateX(vec, Math.PI / 4);
      expect(result).toBeInstanceOf(Vector3);
    });

    it('should chain with Vector3 methods', () => {
      const vec = new Vector3(1, 0, 0);
      const rotated = rotateZ(vec, Math.PI / 2);
      const scaled = rotated.multiplyScalar(2);
      expectVec3Close(scaled, { x: 0, y: 2, z: 0 });
    });
  });

  describe('Edge cases', () => {
    it('should handle very small vectors', () => {
      const vec = { x: 1e-10, y: 1e-10, z: 1e-10 };
      const result = rotateX(vec, Math.PI / 2);
      expect(result).toBeInstanceOf(Vector3);
    });

    it('should handle very large angles', () => {
      const vec = { x: 1, y: 0, z: 0 };
      const result = rotateZ(vec, Math.PI * 100);
      expectVec3Close(result, vec, 1e-9); // Should return to original after full rotations
    });

    it('should handle negative vectors', () => {
      const vec = { x: -1, y: -2, z: -3 };
      const result = rotateY(vec, Math.PI / 4);

      // Should preserve length
      const originalLength = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
      const resultLength = Math.sqrt(result.x * result.x + result.y * result.y + result.z * result.z);
      expect(Math.abs(originalLength - resultLength)).toBeLessThan(EPSILON);
    });
  });
});
