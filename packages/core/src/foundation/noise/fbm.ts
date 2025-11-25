/**
 * Fractal Brownian Motion (FBM)
 *
 * Combines multiple octaves of noise to create natural-looking patterns.
 * Used for terrain generation, clouds, textures, etc.
 */

import type { INoise, FBMOptions } from '../types';
import { PerlinNoise } from './perlin';

/**
 * Default FBM options
 */
const DEFAULT_FBM_OPTIONS: Required<FBMOptions> = {
  octaves: 4,
  lacunarity: 2.0, // Frequency multiplier per octave
  gain: 0.5, // Amplitude multiplier per octave
  amplitude: 1.0,
  frequency: 1.0
};

/**
 * Fractal Brownian Motion generator
 *
 * Combines multiple octaves of Perlin noise with decreasing amplitude
 * and increasing frequency to create natural-looking fractal patterns.
 */
export class FBM {
  private noise: INoise;
  private options: Required<FBMOptions>;

  constructor(noise?: INoise, options?: FBMOptions) {
    this.noise = noise || new PerlinNoise();
    this.options = { ...DEFAULT_FBM_OPTIONS, ...options };
  }

  /**
   * Generate 1D FBM noise
   */
  noise1D(x: number): number {
    let value = 0;
    let amplitude = this.options.amplitude;
    let frequency = this.options.frequency;

    for (let i = 0; i < this.options.octaves; i++) {
      value += amplitude * this.noise.noise1D(x * frequency);
      amplitude *= this.options.gain;
      frequency *= this.options.lacunarity;
    }

    return value;
  }

  /**
   * Generate 2D FBM noise
   */
  noise2D(x: number, y: number): number {
    let value = 0;
    let amplitude = this.options.amplitude;
    let frequency = this.options.frequency;

    for (let i = 0; i < this.options.octaves; i++) {
      value += amplitude * this.noise.noise2D(x * frequency, y * frequency);
      amplitude *= this.options.gain;
      frequency *= this.options.lacunarity;
    }

    return value;
  }

  /**
   * Generate 3D FBM noise
   */
  noise3D(x: number, y: number, z: number): number {
    let value = 0;
    let amplitude = this.options.amplitude;
    let frequency = this.options.frequency;

    for (let i = 0; i < this.options.octaves; i++) {
      value += amplitude * this.noise.noise3D(x * frequency, y * frequency, z * frequency);
      amplitude *= this.options.gain;
      frequency *= this.options.lacunarity;
    }

    return value;
  }

  /**
   * Update FBM options
   */
  setOptions(options: Partial<FBMOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): Required<FBMOptions> {
    return { ...this.options };
  }
}

/**
 * Turbulence noise (absolute value of FBM)
 *
 * Creates more chaotic patterns by taking absolute value of each octave.
 * Useful for marble textures, clouds, etc.
 */
export class Turbulence extends FBM {
  noise1D(x: number): number {
    let value = 0;
    let amplitude = this.getOptions().amplitude;
    let frequency = this.getOptions().frequency;
    const options = this.getOptions();

    for (let i = 0; i < options.octaves; i++) {
      value += amplitude * Math.abs(this['noise'].noise1D(x * frequency));
      amplitude *= options.gain;
      frequency *= options.lacunarity;
    }

    return value;
  }

  noise2D(x: number, y: number): number {
    let value = 0;
    let amplitude = this.getOptions().amplitude;
    let frequency = this.getOptions().frequency;
    const options = this.getOptions();

    for (let i = 0; i < options.octaves; i++) {
      value += amplitude * Math.abs(this['noise'].noise2D(x * frequency, y * frequency));
      amplitude *= options.gain;
      frequency *= options.lacunarity;
    }

    return value;
  }

  noise3D(x: number, y: number, z: number): number {
    let value = 0;
    let amplitude = this.getOptions().amplitude;
    let frequency = this.getOptions().frequency;
    const options = this.getOptions();

    for (let i = 0; i < options.octaves; i++) {
      value += amplitude * Math.abs(
        this['noise'].noise3D(x * frequency, y * frequency, z * frequency)
      );
      amplitude *= options.gain;
      frequency *= options.lacunarity;
    }

    return value;
  }
}

/**
 * Ridge noise (1 - abs(FBM))
 *
 * Creates ridged patterns useful for mountain ranges and erosion effects.
 */
export class RidgeNoise extends FBM {
  noise2D(x: number, y: number): number {
    let value = 0;
    let amplitude = this.getOptions().amplitude;
    let frequency = this.getOptions().frequency;
    const options = this.getOptions();

    for (let i = 0; i < options.octaves; i++) {
      const signal = this['noise'].noise2D(x * frequency, y * frequency);
      const ridge = 1.0 - Math.abs(signal);
      value += amplitude * ridge * ridge; // Square for sharper ridges
      amplitude *= options.gain;
      frequency *= options.lacunarity;
    }

    return value;
  }
}
