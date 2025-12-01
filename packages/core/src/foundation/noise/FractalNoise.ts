import { PerlinNoise } from './PerlinNoise'

/**
 * Fractional Brownian Motion (fBm) - Fractal Noise Generator
 *
 * Combines multiple octaves of Perlin noise with different frequencies and amplitudes
 * to create natural-looking textures like clouds, terrain, and ink wash effects.
 *
 * Each octave:
 * - Doubles the frequency (creates finer details)
 * - Halves the amplitude (reduces influence)
 *
 * Example:
 * Octave 1: frequency=1, amplitude=1.0
 * Octave 2: frequency=2, amplitude=0.5
 * Octave 3: frequency=4, amplitude=0.25
 */

export interface FractalNoiseOptions {
  /** Number of octaves (layers) to combine. More octaves = more detail. Default: 4 */
  octaves?: number
  /** Base frequency of the first octave. Default: 1.0 */
  frequency?: number
  /** Amplitude of the first octave. Default: 1.0 */
  amplitude?: number
  /** Frequency multiplier for each octave. Default: 2.0 (doubles each time) */
  lacunarity?: number
  /** Amplitude multiplier for each octave. Default: 0.5 (halves each time) */
  persistence?: number
  /** Seed for reproducible noise. Default: random */
  seed?: number
}

/**
 * Generate fractal noise (fBm) at a given position
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param options - Fractal noise configuration
 * @returns Noise value (approximately in range [0, 1] but not strictly bounded)
 *
 * @example
 * // Simple cloud texture
 * const value = fractalNoise(x * 0.01, y * 0.01, { octaves: 3 })
 *
 * @example
 * // Detailed terrain with 6 octaves
 * const height = fractalNoise(x * 0.005, y * 0.005, {
 *   octaves: 6,
 *   frequency: 2,
 *   persistence: 0.5
 * })
 */
export function fractalNoise(
  x: number,
  y: number,
  options: FractalNoiseOptions = {}
): number {
  const {
    octaves = 4,
    frequency = 1.0,
    amplitude = 1.0,
    lacunarity = 2.0,  // Frequency multiplier
    persistence = 0.5,  // Amplitude multiplier
    seed = Date.now(),
  } = options

  // Create a Perlin noise instance
  const perlin = new PerlinNoise()
  perlin.noiseSeed(seed)

  // Disable built-in octaves - we'll handle them manually
  perlin.noiseDetail(1, 1.0)

  let total = 0
  let currentFrequency = frequency
  let currentAmplitude = amplitude
  let maxValue = 0  // Used for normalization

  // Combine multiple octaves
  for (let i = 0; i < octaves; i++) {
    // Sample noise at current frequency
    const noiseValue = perlin.noise(
      x * currentFrequency,
      y * currentFrequency
    )

    // Add weighted contribution
    total += noiseValue * currentAmplitude
    maxValue += currentAmplitude

    // Update frequency and amplitude for next octave
    currentFrequency *= lacunarity
    currentAmplitude *= persistence
  }

  // Normalize to approximate range [0, 1]
  return total / maxValue
}
