import { PRNG } from '../../foundation/random'
import { PerlinNoise, fractalNoise } from '../../foundation/noise'

export interface CloudOptions {
  /** Width of the canvas */
  width?: number
  /** Height of the canvas */
  height?: number
  /** Size of the cloud (approximate width) */
  size?: number
  /** Color of the cloud in RGB format (e.g., "100,100,100") */
  color?: string
  /** Number of octaves for fractal noise (default: 4) */
  octaves?: number
  /** Frequency scale for noise (default: 0.005) */
  frequency?: number
  /** Density threshold - lower values create more dense clouds (default: 0.3) */
  threshold?: number
  /** Seed for random generation */
  seed?: number
  /** Render mode: 'particles' (default) or 'continuous' (pixel-based texture) */
  mode?: 'particles' | 'continuous'

  // Legacy options (for boundary-based method, kept for backwards compatibility)
  /** @deprecated Use octaves instead */
  numSegments?: number
  /** @deprecated Not used in fractal noise method */
  density?: number
  /** @deprecated Not used in fractal noise method */
  radiationHeight?: number
  /** @deprecated Not used in fractal noise method */
  radiationAngle?: number
}

/**
 * Cloud - Generate Chinese ink wash style clouds
 *
 * New Implementation (Fractal Noise / fBm based):
 * 1. Generate fractal noise by combining multiple octaves of Perlin noise
 * 2. Each octave has doubled frequency and halved amplitude
 * 3. Use noise values as density/opacity for cloud particles
 * 4. Create natural, billowy cloud formations similar to ink wash painting
 *
 * Technique: Fractional Brownian Motion (fBm)
 * - Octave 1: frequency × 1, amplitude × 1.0
 * - Octave 2: frequency × 2, amplitude × 0.5
 * - Octave 3: frequency × 4, amplitude × 0.25
 * - ... and so on
 */
export class Cloud {
  /**
   * Generate continuous fractal noise texture (simplified, high-performance version)
   * Uses basic fractal noise without expensive domain warping
   */
  private static generateContinuousCloud(
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    size: number,
    octaves: number,
    frequency: number,
    threshold: number,
    baseColor: string,
    seed: number,
  ): HTMLCanvasElement {
    // Performance optimization: render at lower resolution
    const scale = 0.5 // 50% resolution for balance between quality and speed
    const renderWidth = Math.floor(width * scale)
    const renderHeight = Math.floor(height * scale)

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = renderWidth
    tempCanvas.height = renderHeight
    const tempCtx = tempCanvas.getContext('2d')!

    const [r, g, b] = baseColor.split(',').map(c => Number.parseInt(c.trim()))

    // Create ImageData for pixel-level manipulation
    const imageData = tempCtx.createImageData(renderWidth, renderHeight)
    const data = imageData.data

    // Create a single Perlin noise instance and reuse it
    const perlin = new PerlinNoise()
    perlin.noiseSeed(seed)
    perlin.noiseDetail(octaves, 0.5) // Use built-in octave support

    // Calculate cloud bounds in render space
    const cloudCenterX = centerX * scale
    const cloudCenterY = centerY * scale
    const cloudRadius = (size / 2) * scale

    // Render pixels with simple fractal noise
    for (let y = 0; y < renderHeight; y++) {
      for (let x = 0; x < renderWidth; x++) {
        const index = (y * renderWidth + x) * 4

        // Distance from cloud center (for soft falloff)
        const dx = x - cloudCenterX
        const dy = y - cloudCenterY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const distFactor = Math.max(0, 1 - dist / cloudRadius)

        if (distFactor > 0.01) { // Skip pixels far from cloud
          // Get fractal noise value using the reusable Perlin instance
          const noiseValue = perlin.noise(x * frequency, y * frequency)

          // Apply threshold and distance falloff
          const density = Math.max(0, noiseValue - threshold) / (1 - threshold)
          const finalDensity = density * distFactor

          if (finalDensity > 0.02) {
            // Calculate alpha (opacity)
            const alpha = Math.floor(finalDensity * 180) // Max 180 for semi-transparency

            // Set pixel color
            data[index] = r
            data[index + 1] = g
            data[index + 2] = b
            data[index + 3] = alpha
          } else {
            // Transparent pixel
            data[index + 3] = 0
          }
        } else {
          // Transparent pixel
          data[index + 3] = 0
        }
      }
    }

    // Put the image data onto low-res canvas
    tempCtx.putImageData(imageData, 0, 0)

    // Scale up to final resolution
    const finalCanvas = document.createElement('canvas')
    finalCanvas.width = width
    finalCanvas.height = height
    const finalCtx = finalCanvas.getContext('2d')!

    // Use bilinear interpolation for smoother upscaling
    finalCtx.imageSmoothingEnabled = true
    finalCtx.imageSmoothingQuality = 'high'
    finalCtx.drawImage(tempCanvas, 0, 0, renderWidth, renderHeight, 0, 0, width, height)

    return finalCanvas
  }

  /**
   * Generate fractal noise-based cloud with particles (original implementation)
   */
  private static generateFractalCloud(
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    size: number,
    octaves: number,
    frequency: number,
    threshold: number,
    baseColor: string,
    seed: number,
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    const [r, g, b] = baseColor.split(',').map(c => Number.parseInt(c.trim()))
    const rng = new PRNG()
    rng.seed(seed)

    // Calculate cloud bounding box
    const cloudLeft = centerX - size / 2
    const cloudTop = centerY - size / 2
    const cloudRight = centerX + size / 2
    const cloudBottom = centerY + size / 2

    // Particle generation
    const particles: Array<{ x: number; y: number; alpha: number; size: number }> = []

    // Sample noise across the cloud region
    const sampleStep = 3 // Sample every N pixels for performance
    for (let y = cloudTop; y < cloudBottom; y += sampleStep) {
      for (let x = cloudLeft; x < cloudRight; x += sampleStep) {
        // Generate fractal noise value at this position
        const noiseValue = fractalNoise(x, y, {
          octaves,
          frequency,
          seed,
        })

        // Convert noise to density (0 = transparent, 1 = opaque)
        // Apply threshold to create cloud shape
        const density = Math.max(0, noiseValue - threshold) / (1 - threshold)

        if (density > 0.05) { // Skip very transparent pixels
          // Add some randomness to particle positions
          const offsetX = (rng.next() - 0.5) * sampleStep * 1.5
          const offsetY = (rng.next() - 0.5) * sampleStep * 1.5

          // Calculate alpha with some variation
          const alphaVariation = 0.8 + rng.next() * 0.4 // 0.8-1.2
          const alpha = density * 0.4 * alphaVariation

          // Particle size varies with density
          const particleSize = 1 + density * 2.5 + rng.next()

          particles.push({
            x: x + offsetX,
            y: y + offsetY,
            alpha: Math.min(alpha, 1),
            size: particleSize,
          })
        }
      }
    }

    // Sort particles by alpha (draw transparent ones first)
    particles.sort((a, b) => a.alpha - b.alpha)

    // Enable shadow blur for soft edges
    ctx.shadowBlur = 3
    ctx.shadowColor = `rgba(${r},${g},${b},0.2)`

    // Draw particles
    for (const particle of particles) {
      ctx.fillStyle = `rgba(${r},${g},${b},${particle.alpha})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // Reset shadow
    ctx.shadowBlur = 0

    return canvas
  }
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
   * Generate cloud using fractal noise (fBm)
   */
  static generate(xoff: number, yoff: number, seed: number, options: CloudOptions = {}): HTMLCanvasElement {
    const width = options.width ?? 800
    const height = options.height ?? 600
    const size = options.size ?? 300
    const baseColor = options.color ?? '100,100,100'
    const octaves = options.octaves ?? 4
    const frequency = options.frequency ?? 0.005
    const threshold = options.threshold ?? 0.3
    const mode = options.mode ?? 'particles'

    // Calculate center position
    const centerX = width / 2 + xoff
    const centerY = height / 2 + yoff

    // Choose rendering method based on mode
    if (mode === 'continuous') {
      return this.generateContinuousCloud(
        width,
        height,
        centerX,
        centerY,
        size,
        octaves,
        frequency,
        threshold,
        baseColor,
        seed,
      )
    } else {
      return this.generateFractalCloud(
        width,
        height,
        centerX,
        centerY,
        size,
        octaves,
        frequency,
        threshold,
        baseColor,
        seed,
      )
    }
  }

  /**
   * Generate boundary-based cloud with unidirectional particle radiation
   * @deprecated Legacy method - kept for backwards compatibility
   */
  static generateLegacy(xoff: number, yoff: number, seed: number, options: CloudOptions = {}): HTMLCanvasElement {
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
