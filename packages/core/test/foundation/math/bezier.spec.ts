import { describe, it, expect } from 'vitest';
import {
  quadraticBezier,
  cubicBezier,
  quadraticBezierPoints,
  cubicBezierPoints,
  catmullRomSpline,
  simplifyPath,
  cubicBezierLength
} from '../../../src/foundation/math/bezier';
import type { Vec2 } from '../../../src/foundation/types';

describe('Bézier Curves', () => {
  describe('quadraticBezier', () => {
    it('should return start point at t=0', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 50, y: 100 };
      const p2: Vec2 = { x: 100, y: 0 };

      const result = quadraticBezier(p0, p1, p2, 0);
      expect(result.x).toBe(p0.x);
      expect(result.y).toBe(p0.y);
    });

    it('should return end point at t=1', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 50, y: 100 };
      const p2: Vec2 = { x: 100, y: 0 };

      const result = quadraticBezier(p0, p1, p2, 1);
      expect(result.x).toBe(p2.x);
      expect(result.y).toBe(p2.y);
    });

    it('should pass through midpoint at t=0.5', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 50, y: 100 };
      const p2: Vec2 = { x: 100, y: 0 };

      const result = quadraticBezier(p0, p1, p2, 0.5);
      expect(result.x).toBe(50);
      expect(result.y).toBe(50); // Quadratic Bézier formula at t=0.5
    });
  });

  describe('cubicBezier', () => {
    it('should return start point at t=0', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 30, y: 100 };
      const p2: Vec2 = { x: 70, y: 100 };
      const p3: Vec2 = { x: 100, y: 0 };

      const result = cubicBezier(p0, p1, p2, p3, 0);
      expect(result.x).toBe(p0.x);
      expect(result.y).toBe(p0.y);
    });

    it('should return end point at t=1', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 30, y: 100 };
      const p2: Vec2 = { x: 70, y: 100 };
      const p3: Vec2 = { x: 100, y: 0 };

      const result = cubicBezier(p0, p1, p2, p3, 1);
      expect(result.x).toBe(p3.x);
      expect(result.y).toBe(p3.y);
    });

    it('should generate smooth curve', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 30, y: 100 };
      const p2: Vec2 = { x: 70, y: 100 };
      const p3: Vec2 = { x: 100, y: 0 };

      const points = cubicBezierPoints(p0, p1, p2, p3, 10);
      expect(points.length).toBe(11); // 10 segments = 11 points
      expect(points[0]).toEqual(p0);
      expect(points[points.length - 1]).toEqual(p3);
    });
  });

  describe('quadraticBezierPoints', () => {
    it('should generate correct number of points', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 50, y: 100 };
      const p2: Vec2 = { x: 100, y: 0 };

      const points = quadraticBezierPoints(p0, p1, p2, 10);
      expect(points.length).toBe(11);
    });

    it('should start and end at correct points', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 50, y: 100 };
      const p2: Vec2 = { x: 100, y: 0 };

      const points = quadraticBezierPoints(p0, p1, p2, 10);
      expect(points[0]).toEqual(p0);
      expect(points[points.length - 1]).toEqual(p2);
    });
  });

  describe('catmullRomSpline', () => {
    it('should pass through all control points', () => {
      const points: Vec2[] = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 100, y: 50 },
        { x: 150, y: 0 }
      ];

      const spline = catmullRomSpline(points, 0, 10);

      // Should contain all control points (approximately)
      for (const cp of points) {
        const found = spline.some(p =>
          Math.abs(p.x - cp.x) < 1 && Math.abs(p.y - cp.y) < 1
        );
        expect(found).toBe(true);
      }
    });

    it('should handle two points', () => {
      const points: Vec2[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      ];

      const spline = catmullRomSpline(points, 0, 10);
      expect(spline.length).toBeGreaterThan(0);
      expect(spline[0]).toEqual(points[0]);
      expect(spline[spline.length - 1]).toEqual(points[1]);
    });
  });

  describe('simplifyPath', () => {
    it('should reduce number of points', () => {
      // Create a straight line with many points
      const points: Vec2[] = [];
      for (let i = 0; i <= 100; i++) {
        points.push({ x: i, y: 0 });
      }

      const simplified = simplifyPath(points, 0.1);
      expect(simplified.length).toBeLessThan(points.length);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should preserve start and end points', () => {
      const points: Vec2[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 5 },
        { x: 30, y: 0 }
      ];

      const simplified = simplifyPath(points, 1);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should handle small arrays', () => {
      const points: Vec2[] = [{ x: 0, y: 0 }, { x: 100, y: 100 }];
      const simplified = simplifyPath(points, 1);
      expect(simplified).toEqual(points);
    });
  });

  describe('cubicBezierLength', () => {
    it('should calculate approximate length', () => {
      // Straight line from (0,0) to (100,0)
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 33, y: 0 };
      const p2: Vec2 = { x: 67, y: 0 };
      const p3: Vec2 = { x: 100, y: 0 };

      const length = cubicBezierLength(p0, p1, p2, p3, 100);
      expect(length).toBeCloseTo(100, 0); // Should be close to 100
    });

    it('should give positive length', () => {
      const p0: Vec2 = { x: 0, y: 0 };
      const p1: Vec2 = { x: 30, y: 100 };
      const p2: Vec2 = { x: 70, y: 100 };
      const p3: Vec2 = { x: 100, y: 0 };

      const length = cubicBezierLength(p0, p1, p2, p3);
      expect(length).toBeGreaterThan(0);
    });
  });
});
