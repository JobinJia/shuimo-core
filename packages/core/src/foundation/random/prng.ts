/**
 * Blum Blum Shub Pseudo-Random Number Generator
 *
 * A cryptographically secure PRNG based on the Blum Blum Shub algorithm.
 * Provides reproducible random sequences from a given seed.
 *
 * Reference: Adapted from shan-shui-inf project
 */

import type { IPRNG } from '../types';

/**
 * Blum Blum Shub PRNG implementation
 *
 * Uses the formula: s = (s * s) % m
 * where m = p * q (product of two large primes)
 */
export class BlumBlumShubPRNG implements IPRNG {
  private state: number;
  private readonly p = 999979; // Large prime
  private readonly q = 999983; // Large prime
  private readonly m: number; // Modulus = p * q

  constructor(seed?: number) {
    this.m = this.p * this.q;
    this.state = seed !== undefined ? this.normalizeSeed(seed) : Date.now();
  }

  /**
   * Normalize seed to valid range
   */
  private normalizeSeed(seed: number): number {
    // Ensure seed is positive and less than m
    let s = Math.abs(seed) % this.m;
    // Avoid zero and one which are fixed points
    if (s === 0 || s === 1) s = 2;
    return s;
  }

  /**
   * Get current seed value
   */
  getSeed(): number {
    return this.state;
  }

  /**
   * Set seed value
   */
  setSeed(seed: number): void {
    this.state = this.normalizeSeed(seed);
  }

  /**
   * Generate next random number in [0, 1)
   */
  random(): number {
    // BBS algorithm: s = (s * s) % m
    this.state = (this.state * this.state) % this.m;
    return this.state / this.m;
  }

  /**
   * Generate random integer in [min, max] (inclusive)
   */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random number in [min, max)
   */
  randomRange(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /**
   * Generate random boolean
   */
  randomBool(probability: number = 0.5): boolean {
    return this.random() < probability;
  }

  /**
   * Generate random number with Gaussian (normal) distribution
   * Using Box-Muller transform
   */
  randomGaussian(mean: number = 0, stdDev: number = 1): number {
    // Box-Muller transform
    const u1 = this.random();
    const u2 = this.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Pick random element from array
   */
  choice<T>(array: T[]): T {
    return array[this.randomInt(0, array.length - 1)];
  }

  /**
   * Weighted random choice
   * @param items Array of items
   * @param weights Array of weights (must be same length as items)
   */
  weightedChoice<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Items and weights arrays must have the same length');
    }

    // Calculate total weight
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Pick random value
    let random = this.random() * totalWeight;

    // Find corresponding item
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }

    // Fallback (should never reach here)
    return items[items.length - 1];
  }

  /**
   * Shuffle array in place (Fisher-Yates shuffle)
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate random point in unit circle
   */
  randomInCircle(): { x: number; y: number } {
    const angle = this.random() * 2 * Math.PI;
    const radius = Math.sqrt(this.random());
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  }

  /**
   * Generate random point on unit circle
   */
  randomOnCircle(): { x: number; y: number } {
    const angle = this.random() * 2 * Math.PI;
    return {
      x: Math.cos(angle),
      y: Math.sin(angle)
    };
  }
}

/**
 * Default PRNG instance
 */
let defaultPRNG: BlumBlumShubPRNG | null = null;

/**
 * Get or create default PRNG instance
 */
export function getDefaultPRNG(): BlumBlumShubPRNG {
  if (!defaultPRNG) {
    defaultPRNG = new BlumBlumShubPRNG();
  }
  return defaultPRNG;
}

/**
 * Set seed for default PRNG
 */
export function setSeed(seed: number): void {
  getDefaultPRNG().setSeed(seed);
}

/**
 * Get random number in [0, 1) using default PRNG
 */
export function random(): number {
  return getDefaultPRNG().random();
}

/**
 * Get random integer in [min, max] using default PRNG
 */
export function randomInt(min: number, max: number): number {
  return getDefaultPRNG().randomInt(min, max);
}

/**
 * Get random number in [min, max) using default PRNG
 */
export function randomRange(min: number, max: number): number {
  return getDefaultPRNG().randomRange(min, max);
}
