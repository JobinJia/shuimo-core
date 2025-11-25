import { describe, it, expect, beforeEach } from 'vitest';
import { BlumBlumShubPRNG } from '../../../src/foundation/random/prng';

describe('BlumBlumShubPRNG', () => {
  let prng: BlumBlumShubPRNG;

  beforeEach(() => {
    prng = new BlumBlumShubPRNG(12345);
  });

  describe('reproducibility', () => {
    it('should generate same sequence with same seed', () => {
      const prng1 = new BlumBlumShubPRNG(12345);
      const prng2 = new BlumBlumShubPRNG(12345);

      const seq1 = Array.from({ length: 100 }, () => prng1.random());
      const seq2 = Array.from({ length: 100 }, () => prng2.random());

      expect(seq1).toEqual(seq2);
    });

    it('should generate different sequences with different seeds', () => {
      const prng1 = new BlumBlumShubPRNG(12345);
      const prng2 = new BlumBlumShubPRNG(54321);

      const val1 = prng1.random();
      const val2 = prng2.random();

      expect(val1).not.toBe(val2);
    });

    it('should allow resetting seed', () => {
      const prng1 = new BlumBlumShubPRNG(12345);
      const val1 = prng1.random();

      prng1.setSeed(12345);
      const val2 = prng1.random();

      expect(val1).toBe(val2);
    });
  });

  describe('random()', () => {
    it('should return values in [0, 1)', () => {
      for (let i = 0; i < 1000; i++) {
        const value = prng.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should not return same value repeatedly', () => {
      const values = Array.from({ length: 100 }, () => prng.random());
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBeGreaterThan(90); // Allow some collision
    });
  });

  describe('randomInt()', () => {
    it('should return integers in specified range', () => {
      for (let i = 0; i < 100; i++) {
        const value = prng.randomInt(1, 10);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should include both endpoints', () => {
      const prng = new BlumBlumShubPRNG(12345);
      const values = Array.from({ length: 1000 }, () => prng.randomInt(0, 1));
      expect(values).toContain(0);
      expect(values).toContain(1);
    });
  });

  describe('randomRange()', () => {
    it('should return values in specified range', () => {
      for (let i = 0; i < 100; i++) {
        const value = prng.randomRange(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThan(20);
      }
    });
  });

  describe('randomBool()', () => {
    it('should return boolean values', () => {
      for (let i = 0; i < 100; i++) {
        const value = prng.randomBool();
        expect(typeof value).toBe('boolean');
      }
    });

    it('should respect probability', () => {
      const prng = new BlumBlumShubPRNG(12345);
      const results = Array.from({ length: 1000 }, () => prng.randomBool(0.7));
      const trueCount = results.filter(v => v).length;
      const ratio = trueCount / results.length;
      // Should be close to 0.7, allow 10% deviation
      expect(ratio).toBeGreaterThan(0.6);
      expect(ratio).toBeLessThan(0.8);
    });
  });

  describe('randomGaussian()', () => {
    it('should generate values around mean', () => {
      const prng = new BlumBlumShubPRNG(12345);
      const values = Array.from({ length: 1000 }, () => prng.randomGaussian(100, 15));
      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      // Mean should be close to 100, allow 10% deviation
      expect(mean).toBeGreaterThan(90);
      expect(mean).toBeLessThan(110);
    });
  });

  describe('choice()', () => {
    it('should pick element from array', () => {
      const array = [1, 2, 3, 4, 5];
      for (let i = 0; i < 100; i++) {
        const value = prng.choice(array);
        expect(array).toContain(value);
      }
    });

    it('should eventually pick all elements', () => {
      const prng = new BlumBlumShubPRNG(12345);
      const array = [1, 2, 3, 4, 5];
      const picked = new Set<number>();
      for (let i = 0; i < 100; i++) {
        picked.add(prng.choice(array));
      }
      expect(picked.size).toBe(5);
    });
  });

  describe('weightedChoice()', () => {
    it('should pick elements according to weights', () => {
      const prng = new BlumBlumShubPRNG(12345);
      const items = ['a', 'b', 'c'];
      const weights = [0.1, 0.1, 0.8]; // 'c' should be picked ~80% of the time

      const results = Array.from({ length: 1000 }, () =>
        prng.weightedChoice(items, weights)
      );

      const countC = results.filter(v => v === 'c').length;
      const ratio = countC / results.length;

      // Should be close to 0.8, allow 15% deviation
      expect(ratio).toBeGreaterThan(0.65);
      expect(ratio).toBeLessThan(0.95);
    });

    it('should throw error if lengths mismatch', () => {
      expect(() => {
        prng.weightedChoice([1, 2, 3], [0.5, 0.5]);
      }).toThrow();
    });
  });

  describe('shuffle()', () => {
    it('should shuffle array', () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = prng.shuffle(array);

      // Should have same elements
      expect(shuffled.sort()).toEqual(array.sort());

      // Original should be unchanged
      expect(array).toEqual([1, 2, 3, 4, 5]);
    });

    it('should produce different shuffles with different seeds', () => {
      const array = [1, 2, 3, 4, 5];
      const prng1 = new BlumBlumShubPRNG(12345);
      const prng2 = new BlumBlumShubPRNG(54321);

      const shuffle1 = prng1.shuffle(array);
      const shuffle2 = prng2.shuffle(array);

      expect(shuffle1).not.toEqual(shuffle2);
    });
  });

  describe('randomInCircle()', () => {
    it('should generate points inside unit circle', () => {
      for (let i = 0; i < 100; i++) {
        const point = prng.randomInCircle();
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('randomOnCircle()', () => {
    it('should generate points on unit circle', () => {
      for (let i = 0; i < 100; i++) {
        const point = prng.randomOnCircle();
        const distance = Math.sqrt(point.x * point.x + point.y * point.y);
        expect(distance).toBeCloseTo(1, 10);
      }
    });
  });
});
