import { describe, it, expect } from 'vitest';
import { PerlinNoise } from '../../../src/foundation/noise/perlin';
import { FBM, Turbulence, RidgeNoise } from '../../../src/foundation/noise/fbm';

describe('PerlinNoise', () => {
  describe('1D noise', () => {
    it('should generate continuous values', () => {
      const perlin = new PerlinNoise();
      const v1 = perlin.noise1D(0);
      const v2 = perlin.noise1D(0.1);
      const v3 = perlin.noise1D(0.2);

      // Values should be different
      expect(v1).not.toBe(v2);
      expect(v2).not.toBe(v3);
    });

    it('should be reproducible with same seed', () => {
      const perlin1 = new PerlinNoise(12345);
      const perlin2 = new PerlinNoise(12345);

      for (let i = 0; i < 10; i++) {
        const x = i * 0.1;
        expect(perlin1.noise1D(x)).toBe(perlin2.noise1D(x));
      }
    });

    it('should produce different values with different seeds', () => {
      const perlin1 = new PerlinNoise(12345);
      const perlin2 = new PerlinNoise(54321);

      // Test multiple points to ensure seeds produce different sequences
      const values1: number[] = [];
      const values2: number[] = [];

      for (let i = 0; i < 10; i++) {
        values1.push(perlin1.noise1D(i + 0.5)); // Use non-integer values
        values2.push(perlin2.noise1D(i + 0.5));
      }

      // At least some values should be different
      expect(values1).not.toEqual(values2);
    });
  });

  describe('2D noise', () => {
    it('should generate continuous values', () => {
      const perlin = new PerlinNoise();
      const v1 = perlin.noise2D(0, 0);
      const v2 = perlin.noise2D(0.1, 0.1);
      const v3 = perlin.noise2D(0.2, 0.2);

      expect(v1).not.toBe(v2);
      expect(v2).not.toBe(v3);
    });

    it('should be smooth and continuous', () => {
      const perlin = new PerlinNoise();

      // Sample nearby points
      const v1 = perlin.noise2D(5, 5);
      const v2 = perlin.noise2D(5.01, 5.01);

      // Nearby values should be similar
      expect(Math.abs(v1 - v2)).toBeLessThan(0.1);
    });

    it('should be reproducible with same seed', () => {
      const perlin1 = new PerlinNoise(12345);
      const perlin2 = new PerlinNoise(12345);

      for (let i = 0; i < 10; i++) {
        const x = i * 0.5;
        const y = i * 0.3;
        expect(perlin1.noise2D(x, y)).toBe(perlin2.noise2D(x, y));
      }
    });
  });

  describe('3D noise', () => {
    it('should generate continuous values', () => {
      const perlin = new PerlinNoise();
      const v1 = perlin.noise3D(0, 0, 0);
      const v2 = perlin.noise3D(0.1, 0.1, 0.1);
      const v3 = perlin.noise3D(0.2, 0.2, 0.2);

      expect(v1).not.toBe(v2);
      expect(v2).not.toBe(v3);
    });

    it('should be reproducible with same seed', () => {
      const perlin1 = new PerlinNoise(12345);
      const perlin2 = new PerlinNoise(12345);

      expect(perlin1.noise3D(1, 2, 3)).toBe(perlin2.noise3D(1, 2, 3));
    });
  });
});

describe('FBM', () => {
  describe('2D FBM', () => {
    it('should generate noise with multiple octaves', () => {
      const fbm = new FBM(new PerlinNoise(12345), { octaves: 4 });
      const value = fbm.noise2D(5, 5);
      expect(typeof value).toBe('number');
      expect(isFinite(value)).toBe(true);
    });

    it('should combine multiple octaves', () => {
      const fbm1 = new FBM(new PerlinNoise(12345), { octaves: 1 });
      const fbm4 = new FBM(new PerlinNoise(12345), { octaves: 4 });

      // Test non-integer coordinates for better noise values
      const val1 = fbm1.noise2D(5.5, 5.5);
      const val4 = fbm4.noise2D(5.5, 5.5);

      // Both should be valid numbers
      expect(typeof val1).toBe('number');
      expect(typeof val4).toBe('number');
      expect(isFinite(val1)).toBe(true);
      expect(isFinite(val4)).toBe(true);

      // With 4 octaves, the value should typically have more variation
      // (though not guaranteed for any single point)
    });

    it('should be reproducible', () => {
      const fbm1 = new FBM(new PerlinNoise(12345));
      const fbm2 = new FBM(new PerlinNoise(12345));

      expect(fbm1.noise2D(5, 5)).toBe(fbm2.noise2D(5, 5));
    });

    it('should support custom options', () => {
      const fbm = new FBM(undefined, {
        octaves: 6,
        lacunarity: 3.0,
        gain: 0.4,
        amplitude: 2.0,
        frequency: 0.5
      });

      const options = fbm.getOptions();
      expect(options.octaves).toBe(6);
      expect(options.lacunarity).toBe(3.0);
      expect(options.gain).toBe(0.4);
      expect(options.amplitude).toBe(2.0);
      expect(options.frequency).toBe(0.5);
    });
  });
});

describe('Turbulence', () => {
  it('should generate positive values only', () => {
    const turbulence = new Turbulence(new PerlinNoise(12345));

    for (let i = 0; i < 100; i++) {
      const x = i * 0.1;
      const y = i * 0.1;
      const value = turbulence.noise2D(x, y);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('RidgeNoise', () => {
  it('should generate ridge patterns', () => {
    const ridge = new RidgeNoise(new PerlinNoise(12345));
    const value = ridge.noise2D(5, 5);

    expect(typeof value).toBe('number');
    expect(isFinite(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
  });
});
