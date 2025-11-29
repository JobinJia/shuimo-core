import { PRNG } from '../../foundation/random'
import { PerlinNoise } from '../../foundation/noise'

export interface CloudOptions {
  /** Width of the canvas */
  width?: number
  /** Height of the canvas */
  height?: number
  /** Size of the cloud (approximate width) */
  size?: number
  /** Color of the cloud in RGB format (e.g., "100,100,100") */
  color?: string
  /** Number of ellipse-like segments forming the boundary (default: 3-5) */
  numSegments?: number
  /** Particle density multiplier (default: 1.0) */
  density?: number
  /** Radiation height (default: size * 0.8) */
  radiationHeight?: number
  /** Radiation angle in degrees (default: 90, straight up; 0-180) */
  radiationAngle?: number
  /** Seed for random generation */
  seed?: number
}

/**
 * Cloud - Generate Chinese ink wash style clouds
 *
 * New Implementation (Boundary-based with unidirectional radiation):
 * 1. Generate multiple irregular ellipse-like curves as cloud boundary
 * 2. Merge/overlap these curves to form organic cloud outline
 * 3. Radiate particles from boundary points in one direction (upward)
 * 4. Particles fade with distance, creating ink wash effect
 */
export class Cloud {
  /**
   * Generate an irregular ellipse-like curve (one segment of cloud boundary)
   */
  private static generateEllipseCurve(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
    rng: PRNG,
    seed: number,
    offset: number,
  ): [number, number][] {
    const points: [number, number][] = []
    const perlin = new PerlinNoise()
    perlin.noiseSeed(seed + offset)

    const numPoints = 30 // Points around the ellipse
    const noiseScale = 0.4

    for (let i = 0; i <= numPoints; i++) {
      // Parametric ellipse: x = a*cos(t), y = b*sin(t)
      const t = (i / numPoints) * Math.PI * 2
      const baseX = centerX + (width / 2) * Math.cos(t)
      const baseY = centerY + (height / 2) * Math.sin(t)

      // Add Perlin noise distortion
      const noiseValue = perlin.noise(i * noiseScale, offset)
      const distortion = (noiseValue - 0.5) * Math.min(width, height) * 0.3

      // Apply distortion perpendicular to the radial direction
      const angle = Math.atan2(baseY - centerY, baseX - centerX)
      const perpAngle = angle + Math.PI / 2

      const x = baseX + Math.cos(perpAngle) * distortion
      const y = baseY + Math.sin(perpAngle) * distortion

      points.push([x, y])
    }

    return points
  }

  /**
   * Generate cloud boundary from multiple overlapping ellipse curves
   */
  private static generateCloudBoundary(
    centerX: number,
    centerY: number,
    size: number,
    numSegments: number,
    rng: PRNG,
    seed: number,
  ): [number, number][] {
    const allPoints: [number, number][] = []

    for (let i = 0; i < numSegments; i++) {
      // Random offset for each ellipse segment
      const offsetX = (rng.next() - 0.5) * size * 0.4
      const offsetY = (rng.next() - 0.5) * size * 0.3

      // Random ellipse dimensions
      const width = size * (0.5 + rng.next() * 0.5) // 50-100% of size
      const height = width * (0.4 + rng.next() * 0.4) // 40-80% of width

      const segmentPoints = this.generateEllipseCurve(
        centerX + offsetX,
        centerY + offsetY,
        width,
        height,
        rng,
        seed,
        i * 100,
      )

      allPoints.push(...segmentPoints)
    }

    return allPoints
  }

  /**
   * Generate particles radiating from boundary points in one direction
   */
  private static generateRadiatingParticles(
    boundaryPoints: [number, number][],
    radiationHeight: number,
    radiationAngle: number,
    density: number,
    rng: PRNG,
    seed: number,
  ): Array<{ x: number; y: number; alpha: number; size: number }> {
    const particles: Array<{ x: number; y: number; alpha: number; size: number }> = []
    const perlin = new PerlinNoise()
    perlin.noiseSeed(seed + 500)

    // Convert angle to radians (90 degrees = straight up)
    const angleRad = (radiationAngle * Math.PI) / 180
    const dirX = Math.cos(angleRad - Math.PI / 2) // -PI/2 because 0° is right, we want up
    const dirY = Math.sin(angleRad - Math.PI / 2)

    const numLayers = 30 // Vertical layers
    const particlesPerPoint = Math.ceil(2 * density) // Particles per boundary point per layer

    for (const [baseX, baseY] of boundaryPoints) {
      for (let layer = 0; layer < numLayers; layer++) {
        const distanceRatio = layer / numLayers
        const distance = distanceRatio * radiationHeight

        // Layer position
        const layerX = baseX + dirX * distance
        const layerY = baseY + dirY * distance

        // Particle count decreases with distance
        const layerDensity = 1 - distanceRatio * 0.6 // Keep 40% at max distance
        const actualParticles = Math.ceil(particlesPerPoint * layerDensity)

        for (let p = 0; p < actualParticles; p++) {
          // Random offset perpendicular and along direction
          const offsetAlong = (rng.next() - 0.5) * 15
          const offsetPerp = (rng.next() - 0.5) * 20

          const perpX = -dirY
          const perpY = dirX

          const x = layerX + dirX * offsetAlong + perpX * offsetPerp
          const y = layerY + dirY * offsetAlong + perpY * offsetPerp

          // Alpha with quadratic falloff
          const distanceAlpha = Math.pow(1 - distanceRatio, 2)

          // Perlin noise variation
          const noiseValue = perlin.noise(x * 0.01, y * 0.01)
          const noiseAlpha = 0.5 + noiseValue * 0.5

          const alpha = distanceAlpha * noiseAlpha * 0.6

          // Particle size
          const baseSize = 0.8 + rng.next() * 2.2 // 0.8 to 3.0
          const size = baseSize * (1 - distanceRatio * 0.5)

          particles.push({ x, y, alpha, size })
        }
      }
    }

    return particles
  }

  /**
   * Draw particles with ink wash blur effect
   */
  private static drawParticles(
    ctx: CanvasRenderingContext2D,
    particles: Array<{ x: number; y: number; alpha: number; size: number }>,
    baseColor: string,
  ): void {
    const [r, g, b] = baseColor.split(',').map(c => Number.parseInt(c.trim()))

    // Sort particles by alpha (draw transparent ones first)
    particles.sort((a, b) => a.alpha - b.alpha)

    // Enable shadow blur for soft edges
    ctx.shadowBlur = 2
    ctx.shadowColor = `rgba(${r},${g},${b},0.3)`

    for (const particle of particles) {
      // Skip nearly transparent particles for performance
      if (particle.alpha < 0.02) continue

      ctx.fillStyle = `rgba(${r},${g},${b},${particle.alpha})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Reset shadow
    ctx.shadowBlur = 0
  }

  /**
   * Generate boundary-based cloud with unidirectional particle radiation
   */
  static generate(xoff: number, yoff: number, seed: number, options: CloudOptions = {}): HTMLCanvasElement {
    const width = options.width ?? 800
    const height = options.height ?? 600
    const size = options.size ?? 300
    const baseColor = options.color ?? '100,100,100'
    const density = options.density ?? 1.0
    const radiationHeight = options.radiationHeight ?? size * 0.8
    const radiationAngle = options.radiationAngle ?? 90 // 90 = straight up

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // Initialize random number generator
    const rng = new PRNG()
    rng.seed(seed)

    // Calculate center position
    const centerX = width / 2 + xoff
    const centerY = height / 2 + yoff

    // Determine number of ellipse segments (random if not specified)
    const numSegments = options.numSegments ?? Math.floor(3 + rng.next() * 3) // 3-5 segments

    // Step 1: Generate cloud boundary from multiple ellipse curves
    const boundaryPoints = this.generateCloudBoundary(centerX, centerY, size, numSegments, rng, seed)

    // Step 2: Generate particles radiating from boundary
    const particles = this.generateRadiatingParticles(
      boundaryPoints,
      radiationHeight,
      radiationAngle,
      density,
      rng,
      seed,
    )

    // Step 3: Draw particles
    this.drawParticles(ctx, particles, baseColor)

    return canvas
  }
}

// Export convenience function
export function cloud(xoff: number, yoff: number, seed: number, options: CloudOptions = {}): HTMLCanvasElement {
  return Cloud.generate(xoff, yoff, seed, options)
}
