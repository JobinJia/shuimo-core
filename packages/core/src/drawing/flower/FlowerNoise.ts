/**
 * Flower Generator - Perlin Noise (re-exports from foundation)
 * Migrated to use shared foundation noise instance.
 */

import { noise as foundationNoise } from "../../foundation/noise";

/** Convenience: noise(x, y, z) → foundation.noise() */
export function noise(x: number, y?: number, z?: number): number {
  return foundationNoise.noise(x, y, z);
}

/** Reset noise table — forces re-init from current PRNG state */
export function resetNoise(): void {
  foundationNoise.reset();
}

/** Noise detail configuration */
export function noiseDetail(lod: number, falloff: number): void {
  foundationNoise.noiseDetail(lod, falloff);
}

/** Noise seed for reproducibility */
export function noiseSeed(seed: number): void {
  foundationNoise.noiseSeed(seed);
}
