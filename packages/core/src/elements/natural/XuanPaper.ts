/**
 * XuanPaper - Chinese Rice Paper / Xuan Paper Generator
 *
 * Generates realistic Xuan paper (宣纸) texture with:
 * - Natural fiber texture from plant materials
 * - Subtle color variations (off-white to light beige)
 * - Uneven thickness creating light/dark patches
 * - Optional deckle edge (毛边) effect
 * - Ink absorption characteristics
 */

import { PRNG } from "../../foundation/random";
import { PerlinNoise } from "../../foundation/noise";

export interface XuanPaperOptions {
  /** Width of the canvas */
  width?: number;
  /** Height of the canvas */
  height?: number;
  /** Base color [r, g, b] in range 0-255 (default: warm white) */
  baseColor?: [number, number, number];
  /** Fiber density - higher values create more visible fibers (default: 1.0) */
  fiberDensity?: number;
  /** Fiber length scale (default: 1.0) */
  fiberScale?: number;
  /** Texture intensity - paper grain roughness (default: 0.3) */
  textureIntensity?: number;
  /** Grain particle density - adds fine particles on surface (0-1, default: 0.5) */
  grainDensity?: number;
  /** Age effect - adds yellowing and spots (0-1, default: 0) */
  age?: number;
  /** Whether to add deckle edge (毛边) (default: false) */
  deckleEdge?: boolean;
  /** Deckle edge roughness (default: 0.5) */
  deckleRoughness?: number;
  /** Seed for random generation */
  seed?: number;
  /** Render mode: 'canvas' or 'svg' (default: 'canvas') */
  mode?: "canvas" | "svg";

  // Gold fleck options (撒金宣)
  /** Whether to add gold flecks (撒金效果) (default: false) */
  goldFlecks?: boolean;
  /** Gold fleck density - controls how many flecks appear (0-1, default: 0.5) */
  goldDensity?: number;
  /** Gold fleck size range [min, max] in pixels (default: [2, 12]) */
  goldSize?: [number, number];
  /** Gold color [r, g, b] (default: [218, 165, 32] - golden) */
  goldColor?: [number, number, number];
  /** Gold fleck clustering - higher values create more clustered distribution (0-1, default: 0.3) */
  goldClustering?: number;
}

// Default warm white color for Xuan paper
const DEFAULT_BASE_COLOR: [number, number, number] = [252, 250, 240];

export class XuanPaper {
  /**
   * Generate fiber texture layer
   * Simulates the natural plant fiber structure of Xuan paper
   * Based on real Xuan paper: long, curved, sparse fibers
   */
  private static generateFiberLayer(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    density: number,
    scale: number,
    seed: number,
    rng: PRNG,
  ): void {
    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed);

    const perlin2 = new PerlinNoise();
    perlin2.noiseSeed(seed + 100);

    // Fewer but longer fibers for realistic look
    const fiberCount = Math.floor(width * height * density * 0.00015);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (let i = 0; i < fiberCount; i++) {
      // Random starting position
      const startX = rng.next() * width;
      const startY = rng.next() * height;

      // Long fibers with natural curves
      const fiberLength = (80 + rng.next() * 150) * scale;

      // Fiber opacity - subtle but visible
      const alpha = 0.06 + rng.next() * 0.08;

      // Fiber color - brownish gray, slightly darker than paper
      const brightness = 160 + Math.floor(rng.next() * 40);
      ctx.strokeStyle = `rgba(${brightness}, ${brightness - 10}, ${brightness - 20}, ${alpha})`;
      ctx.lineWidth = 0.3 + rng.next() * 0.5;

      // Draw naturally curved fiber using Perlin noise
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      let x = startX;
      let y = startY;
      const segments = 15 + Math.floor(rng.next() * 15);
      const segmentLength = fiberLength / segments;

      // Initial direction from noise
      let angle = perlin.noise(startX * 0.005, startY * 0.005) * Math.PI * 2;

      for (let j = 0; j < segments; j++) {
        // Smoothly varying angle using Perlin noise
        const noiseX = x * 0.008 + i * 0.1;
        const noiseY = y * 0.008;
        const angleChange = (perlin2.noise(noiseX, noiseY) - 0.5) * 0.4;
        angle += angleChange;

        x += Math.cos(angle) * segmentLength;
        y += Math.sin(angle) * segmentLength;

        ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

    // Add some shorter, more visible fiber fragments
    const fragmentCount = Math.floor(fiberCount * 0.3);

    for (let i = 0; i < fragmentCount; i++) {
      const startX = rng.next() * width;
      const startY = rng.next() * height;

      const fiberLength = (30 + rng.next() * 60) * scale;
      const alpha = 0.08 + rng.next() * 0.1;

      const brightness = 140 + Math.floor(rng.next() * 50);
      ctx.strokeStyle = `rgba(${brightness}, ${brightness - 15}, ${brightness - 25}, ${alpha})`;
      ctx.lineWidth = 0.4 + rng.next() * 0.6;

      ctx.beginPath();
      ctx.moveTo(startX, startY);

      let x = startX;
      let y = startY;
      const segments = 8 + Math.floor(rng.next() * 8);
      const segmentLength = fiberLength / segments;
      let angle = rng.next() * Math.PI * 2;

      for (let j = 0; j < segments; j++) {
        angle += (rng.next() - 0.5) * 0.5;
        x += Math.cos(angle) * segmentLength;
        y += Math.sin(angle) * segmentLength;
        ctx.lineTo(x, y);
      }

      ctx.stroke();
    }
  }

  /**
   * Generate paper grain texture
   * Creates the subtle surface roughness of Xuan paper
   */
  private static generateGrainTexture(
    imageData: ImageData,
    width: number,
    height: number,
    intensity: number,
    seed: number,
  ): void {
    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 1000);
    perlin.noiseDetail(4, 0.5);

    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        // Multi-scale noise for natural variation
        const noise1 = perlin.noise(x * 0.02, y * 0.02); // Large scale variation
        const noise2 = perlin.noise(x * 0.1, y * 0.1); // Medium scale
        const noise3 = perlin.noise(x * 0.5, y * 0.5); // Fine grain

        // Combine noise at different scales
        const combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;

        // Apply texture as brightness variation
        const variation = (combinedNoise - 0.5) * intensity * 30;

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        if (r !== undefined) data[index] = Math.min(255, Math.max(0, r + variation));
        if (g !== undefined) data[index + 1] = Math.min(255, Math.max(0, g + variation));
        if (b !== undefined) data[index + 2] = Math.min(255, Math.max(0, b + variation));
      }
    }
  }

  /**
   * Generate grain particles (颗粒感)
   * Adds fine particles like fiber fragments and mineral particles on paper surface
   */
  private static generateGrainParticles(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    density: number,
    seed: number,
    rng: PRNG,
  ): void {
    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 5000);

    // Number of particles based on area and density
    const particleCount = Math.floor(width * height * density * 0.002);

    for (let i = 0; i < particleCount; i++) {
      const x = rng.next() * width;
      const y = rng.next() * height;

      // Use noise to vary density in different areas
      const noiseVal = perlin.noise(x * 0.01, y * 0.01);
      if (noiseVal < 0.3) continue; // Skip some areas for natural distribution

      // Particle size - very small
      const size = 0.5 + rng.next() * 1.5;

      // Particle color - some darker, some lighter than paper
      const isDark = rng.next() < 0.6;
      const brightness = isDark
        ? 120 + Math.floor(rng.next() * 60) // Dark particles
        : 220 + Math.floor(rng.next() * 35); // Light particles

      // Low opacity for subtle effect
      const alpha = 0.08 + rng.next() * 0.15;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 5}, ${brightness - 10}, ${alpha})`;
      ctx.fill();
    }

    // Add some larger, more visible fiber fragments
    const fragmentCount = Math.floor(particleCount * 0.05);

    for (let i = 0; i < fragmentCount; i++) {
      const x = rng.next() * width;
      const y = rng.next() * height;

      // Irregular fragment shape
      const size = 1 + rng.next() * 3;
      const angle = rng.next() * Math.PI * 2;
      const stretch = 1.5 + rng.next() * 2; // Elongated

      const brightness = 140 + Math.floor(rng.next() * 50);
      const alpha = 0.1 + rng.next() * 0.15;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(stretch, 1);

      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${brightness}, ${brightness - 8}, ${brightness - 15}, ${alpha})`;
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Apply aging effect
   * Adds yellowing, spots, and wear marks
   */
  private static applyAgingEffect(
    imageData: ImageData,
    width: number,
    height: number,
    age: number,
    seed: number,
    rng: PRNG,
  ): void {
    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 2000);

    const data = imageData.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;

        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        if (r === undefined || g === undefined || b === undefined) continue;

        // Yellowing effect - reduces blue channel
        const yellowNoise = perlin.noise(x * 0.005, y * 0.005);
        const yellowAmount = age * yellowNoise * 20;

        data[index] = Math.min(255, r + yellowAmount * 0.3); // Slight red increase
        data[index + 2] = Math.max(0, b - yellowAmount); // Blue decrease

        // Random age spots
        if (rng.next() < age * 0.0005) {
          const spotIntensity = 20 + rng.next() * 30;
          data[index] = Math.max(0, data[index]! - spotIntensity);
          data[index + 1] = Math.max(0, g - spotIntensity * 1.2);
          data[index + 2] = Math.max(0, data[index + 2]! - spotIntensity * 0.5);
        }
      }
    }
  }

  /**
   * Generate deckle edge (毛边) effect
   * Creates the rough, irregular edge typical of handmade paper
   */
  private static generateDeckleEdge(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    roughness: number,
    seed: number,
  ): void {
    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 3000);

    const edgeWidth = 15 + roughness * 20;

    ctx.globalCompositeOperation = "destination-out";

    // Top edge
    for (let x = 0; x < width; x++) {
      const noise = perlin.noise(x * 0.05, 0);
      const edgeHeight = edgeWidth * (0.3 + noise * roughness);

      const gradient = ctx.createLinearGradient(x, 0, x, edgeHeight);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.5, `rgba(0,0,0,${0.5 * roughness})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, 1, edgeHeight);
    }

    // Bottom edge
    for (let x = 0; x < width; x++) {
      const noise = perlin.noise(x * 0.05, 100);
      const edgeHeight = edgeWidth * (0.3 + noise * roughness);

      const gradient = ctx.createLinearGradient(x, height, x, height - edgeHeight);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.5, `rgba(0,0,0,${0.5 * roughness})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, height - edgeHeight, 1, edgeHeight);
    }

    // Left edge
    for (let y = 0; y < height; y++) {
      const noise = perlin.noise(0, y * 0.05);
      const edgeW = edgeWidth * (0.3 + noise * roughness);

      const gradient = ctx.createLinearGradient(0, y, edgeW, y);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.5, `rgba(0,0,0,${0.5 * roughness})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, edgeW, 1);
    }

    // Right edge
    for (let y = 0; y < height; y++) {
      const noise = perlin.noise(100, y * 0.05);
      const edgeW = edgeWidth * (0.3 + noise * roughness);

      const gradient = ctx.createLinearGradient(width, y, width - edgeW, y);
      gradient.addColorStop(0, "rgba(0,0,0,1)");
      gradient.addColorStop(0.5, `rgba(0,0,0,${0.5 * roughness})`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(width - edgeW, y, edgeW, 1);
    }

    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * Generate a single irregular gold foil fragment shape
   * Simulates torn/broken gold leaf pieces
   */
  private static generateFoilPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    rng: PRNG,
    perlin: PerlinNoise,
  ): void {
    const numPoints = 6 + Math.floor(rng.next() * 6); // 6-11 points
    const points: Array<[number, number]> = [];

    // Generate irregular polygon vertices
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      // Use noise to vary the radius for each point
      const noiseVal = perlin.noise(x * 0.1 + Math.cos(angle) * 10, y * 0.1 + Math.sin(angle) * 10);
      const radiusVariation = 0.4 + noiseVal * 0.8; // 0.4 to 1.2
      const radius = size * radiusVariation * (0.3 + rng.next() * 0.7);

      // Add jagged edges by randomly offsetting
      const jagged = (rng.next() - 0.5) * size * 0.3;
      const px = x + Math.cos(angle) * radius + jagged * Math.cos(angle + Math.PI / 2);
      const py = y + Math.sin(angle) * radius + jagged * Math.sin(angle + Math.PI / 2);

      points.push([px, py]);
    }

    // Draw the irregular polygon
    if (points.length === 0) return;

    const firstPoint = points[0]!;
    ctx.beginPath();
    ctx.moveTo(firstPoint[0], firstPoint[1]);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;

      // Occasionally add slight curves for more natural edges
      if (rng.next() < 0.3) {
        const cpx = (prev[0] + curr[0]) / 2 + (rng.next() - 0.5) * size * 0.2;
        const cpy = (prev[1] + curr[1]) / 2 + (rng.next() - 0.5) * size * 0.2;
        ctx.quadraticCurveTo(cpx, cpy, curr[0], curr[1]);
      } else {
        ctx.lineTo(curr[0], curr[1]);
      }
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Generate gold flecks (洒金效果) using Perlin noise for natural distribution
   * Creates realistic torn gold foil fragments like real 洒金宣
   */
  private static generateGoldFlecks(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    density: number,
    sizeRange: [number, number],
    color: [number, number, number],
    clustering: number,
    seed: number,
    rng: PRNG,
  ): void {
    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 4000);

    const perlin2 = new PerlinNoise();
    perlin2.noiseSeed(seed + 4500);

    // Calculate number of gold flecks - more for realistic look
    const area = width * height;
    const baseCount = area * density * 0.0006;
    const fleckCount = Math.floor(baseCount);

    const [goldR, goldG, goldB] = color;

    ctx.save();

    for (let i = 0; i < fleckCount; i++) {
      let x: number, y: number;

      // Use Perlin noise for natural clustering
      if (clustering > 0) {
        let attempts = 0;
        const maxAttempts = 15;

        do {
          x = rng.next() * width;
          y = rng.next() * height;
          const noiseVal = perlin.noise(x * 0.008, y * 0.008);
          const clusterThreshold = 1 - clustering;

          if (noiseVal > clusterThreshold || attempts >= maxAttempts) {
            break;
          }
          attempts++;
        } while (attempts < maxAttempts);
      } else {
        x = rng.next() * width;
        y = rng.next() * height;
      }

      // Size variation - power distribution for more small pieces, fewer large
      const sizeRandom = Math.pow(rng.next(), 0.7); // Bias towards smaller
      const baseSize = sizeRange[0] + sizeRandom * (sizeRange[1] - sizeRange[0]);

      // Additional size variation from noise
      const sizeNoise = perlin2.noise(x! * 0.03, y! * 0.03);
      const size = baseSize * (0.6 + sizeNoise * 0.8);

      // Metallic color variation - simulate light reflection
      const colorNoise = perlin.noise(x! * 0.05 + 100, y! * 0.05 + 100);
      const brightness = 0.75 + colorNoise * 0.5;

      // Some pieces are brighter (highlights)
      const isHighlight = rng.next() < 0.15;
      const highlightBoost = isHighlight ? 1.2 : 1.0;

      const r = Math.min(255, Math.floor(goldR * brightness * highlightBoost));
      const g = Math.min(255, Math.floor(goldG * brightness * highlightBoost));
      const b = Math.min(255, Math.floor(goldB * brightness * highlightBoost * 0.9));

      // High opacity for metallic look
      const alpha = 0.85 + rng.next() * 0.15;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

      // Draw irregular foil fragment
      this.generateFoilPath(ctx, x!, y!, size, rng, perlin2);
    }

    ctx.restore();
  }

  /**
   * Generate Xuan paper as Canvas
   */
  static generate(options: XuanPaperOptions = {}): HTMLCanvasElement {
    const {
      width = 800,
      height = 600,
      baseColor = DEFAULT_BASE_COLOR,
      fiberDensity = 1.0,
      fiberScale = 1.0,
      textureIntensity = 0.3,
      grainDensity = 0.5,
      age = 0,
      deckleEdge = false,
      deckleRoughness = 0.5,
      seed = Date.now(),
      // Gold fleck options
      goldFlecks = false,
      goldDensity = 0.5,
      goldSize = [2, 12] as [number, number],
      goldColor = [218, 165, 32] as [number, number, number],
      goldClustering = 0.3,
    } = options;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    const rng = new PRNG();
    rng.seed(seed);

    // Step 1: Fill with base color
    ctx.fillStyle = `rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})`;
    ctx.fillRect(0, 0, width, height);

    // Step 2: Add fiber texture
    this.generateFiberLayer(ctx, width, height, fiberDensity, fiberScale, seed, rng);

    // Step 3: Add grain particles (颗粒感)
    if (grainDensity > 0) {
      this.generateGrainParticles(ctx, width, height, grainDensity, seed, rng);
    }

    // Step 4: Get image data for pixel manipulation
    const imageData = ctx.getImageData(0, 0, width, height);

    // Step 5: Add grain texture (brightness variation)
    this.generateGrainTexture(imageData, width, height, textureIntensity, seed);

    // Step 6: Apply aging effect if specified
    if (age > 0) {
      this.applyAgingEffect(imageData, width, height, age, seed, rng);
    }

    // Put modified image data back
    ctx.putImageData(imageData, 0, 0);

    // Step 7: Add gold flecks if specified (撒金宣)
    if (goldFlecks) {
      this.generateGoldFlecks(
        ctx,
        width,
        height,
        goldDensity,
        goldSize,
        goldColor,
        goldClustering,
        seed,
        rng,
      );
    }

    // Step 8: Add deckle edge if specified
    if (deckleEdge) {
      this.generateDeckleEdge(ctx, width, height, deckleRoughness, seed);
    }

    return canvas;
  }

  /**
   * Generate Xuan paper as SVG element
   * Uses SVG filters for a pure SVG implementation
   */
  static generateSVG(options: XuanPaperOptions = {}): SVGSVGElement {
    const {
      width = 800,
      height = 600,
      baseColor = DEFAULT_BASE_COLOR,
      fiberDensity = 1.0,
      fiberScale = 1.0,
      textureIntensity = 0.3,
      grainDensity = 0.5,
      seed = Date.now(),
      // Gold fleck options
      goldFlecks = false,
      goldDensity = 0.5,
      goldSize = [2, 12] as [number, number],
      goldColor = [218, 165, 32] as [number, number, number],
      goldClustering = 0.3,
    } = options;

    const SVG_NS = "http://www.w3.org/2000/svg";

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("width", width.toString());
    svg.setAttribute("height", height.toString());
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("xmlns", SVG_NS);

    const filterId = `xuan-paper-filter-${seed}`;

    // Create defs
    const defs = document.createElementNS(SVG_NS, "defs");

    // Create filter for paper texture
    const filter = document.createElementNS(SVG_NS, "filter");
    filter.setAttribute("id", filterId);
    filter.setAttribute("x", "0%");
    filter.setAttribute("y", "0%");
    filter.setAttribute("width", "100%");
    filter.setAttribute("height", "100%");

    // Base turbulence for grain texture
    const feTurbulence = document.createElementNS(SVG_NS, "feTurbulence");
    feTurbulence.setAttribute("type", "fractalNoise");
    feTurbulence.setAttribute("baseFrequency", "0.04 0.08");
    feTurbulence.setAttribute("numOctaves", "4");
    feTurbulence.setAttribute("seed", seed.toString());
    feTurbulence.setAttribute("result", "noise");
    filter.appendChild(feTurbulence);

    // Convert to grayscale and adjust intensity
    const feColorMatrix = document.createElementNS(SVG_NS, "feColorMatrix");
    feColorMatrix.setAttribute("in", "noise");
    feColorMatrix.setAttribute("type", "matrix");
    const intensity = textureIntensity * 0.12;
    feColorMatrix.setAttribute(
      "values",
      `
      0 0 0 0 ${1 - intensity}
      0 0 0 0 ${1 - intensity}
      0 0 0 0 ${1 - intensity}
      0 0 0 1 0
    `,
    );
    feColorMatrix.setAttribute("result", "monoNoise");
    filter.appendChild(feColorMatrix);

    // Flood with base color
    const feFlood = document.createElementNS(SVG_NS, "feFlood");
    feFlood.setAttribute("flood-color", `rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})`);
    feFlood.setAttribute("result", "baseColor");
    filter.appendChild(feFlood);

    // Blend noise with base color
    const feBlend = document.createElementNS(SVG_NS, "feBlend");
    feBlend.setAttribute("in", "baseColor");
    feBlend.setAttribute("in2", "monoNoise");
    feBlend.setAttribute("mode", "multiply");
    feBlend.setAttribute("result", "paper");
    filter.appendChild(feBlend);

    defs.appendChild(filter);
    svg.appendChild(defs);

    // Create background rect with filter
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("width", width.toString());
    rect.setAttribute("height", height.toString());
    rect.setAttribute("fill", `rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})`);
    rect.setAttribute("filter", `url(#${filterId})`);
    svg.appendChild(rect);

    // Add fiber texture
    if (fiberDensity > 0) {
      const fiberGroup = this.generateFiberLayerSVG(
        width,
        height,
        fiberDensity,
        fiberScale,
        seed,
        SVG_NS,
      );
      svg.appendChild(fiberGroup);
    }

    // Add grain particles
    if (grainDensity > 0) {
      const grainGroup = this.generateGrainParticlesSVG(width, height, grainDensity, seed, SVG_NS);
      svg.appendChild(grainGroup);
    }

    // Add gold flecks if specified (撒金宣)
    if (goldFlecks) {
      const goldGroup = this.generateGoldFlecksSVG(
        width,
        height,
        goldDensity,
        goldSize,
        goldColor,
        goldClustering,
        seed,
        SVG_NS,
      );
      svg.appendChild(goldGroup);
    }

    return svg;
  }

  /**
   * Generate fiber layer as SVG paths
   */
  private static generateFiberLayerSVG(
    width: number,
    height: number,
    density: number,
    scale: number,
    seed: number,
    SVG_NS: string,
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g") as SVGGElement;

    const rng = new PRNG();
    rng.seed(seed);

    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed);

    const perlin2 = new PerlinNoise();
    perlin2.noiseSeed(seed + 100);

    // Fewer but longer fibers
    const fiberCount = Math.floor(width * height * density * 0.00015);

    for (let i = 0; i < fiberCount; i++) {
      const startX = rng.next() * width;
      const startY = rng.next() * height;
      const fiberLength = (80 + rng.next() * 150) * scale;
      const alpha = 0.06 + rng.next() * 0.08;
      const brightness = 160 + Math.floor(rng.next() * 40);
      const strokeWidth = 0.3 + rng.next() * 0.5;

      // Build curved path
      let x = startX;
      let y = startY;
      const segments = 15 + Math.floor(rng.next() * 15);
      const segmentLength = fiberLength / segments;
      let angle = perlin.noise(startX * 0.005, startY * 0.005) * Math.PI * 2;

      let d = `M ${x} ${y}`;

      for (let j = 0; j < segments; j++) {
        const noiseX = x * 0.008 + i * 0.1;
        const noiseY = y * 0.008;
        const angleChange = (perlin2.noise(noiseX, noiseY) - 0.5) * 0.4;
        angle += angleChange;
        x += Math.cos(angle) * segmentLength;
        y += Math.sin(angle) * segmentLength;
        d += ` L ${x} ${y}`;
      }

      const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute(
        "stroke",
        `rgba(${brightness}, ${brightness - 10}, ${brightness - 20}, ${alpha})`,
      );
      path.setAttribute("stroke-width", strokeWidth.toString());
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      group.appendChild(path);
    }

    // Add shorter fiber fragments
    const fragmentCount = Math.floor(fiberCount * 0.3);

    for (let i = 0; i < fragmentCount; i++) {
      const startX = rng.next() * width;
      const startY = rng.next() * height;
      const fiberLength = (30 + rng.next() * 60) * scale;
      const alpha = 0.08 + rng.next() * 0.1;
      const brightness = 140 + Math.floor(rng.next() * 50);
      const strokeWidth = 0.4 + rng.next() * 0.6;

      let x = startX;
      let y = startY;
      const segments = 8 + Math.floor(rng.next() * 8);
      const segmentLength = fiberLength / segments;
      let angle = rng.next() * Math.PI * 2;

      let d = `M ${x} ${y}`;

      for (let j = 0; j < segments; j++) {
        angle += (rng.next() - 0.5) * 0.5;
        x += Math.cos(angle) * segmentLength;
        y += Math.sin(angle) * segmentLength;
        d += ` L ${x} ${y}`;
      }

      const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute(
        "stroke",
        `rgba(${brightness}, ${brightness - 15}, ${brightness - 25}, ${alpha})`,
      );
      path.setAttribute("stroke-width", strokeWidth.toString());
      path.setAttribute("stroke-linecap", "round");
      group.appendChild(path);
    }

    return group;
  }

  /**
   * Generate grain particles as SVG circles
   */
  private static generateGrainParticlesSVG(
    width: number,
    height: number,
    density: number,
    seed: number,
    SVG_NS: string,
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g") as SVGGElement;

    const rng = new PRNG();
    rng.seed(seed + 5000);

    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 5000);

    const particleCount = Math.floor(width * height * density * 0.002);

    for (let i = 0; i < particleCount; i++) {
      const x = rng.next() * width;
      const y = rng.next() * height;

      const noiseVal = perlin.noise(x * 0.01, y * 0.01);
      if (noiseVal < 0.3) continue;

      const size = 0.5 + rng.next() * 1.5;
      const isDark = rng.next() < 0.6;
      const brightness = isDark
        ? 120 + Math.floor(rng.next() * 60)
        : 220 + Math.floor(rng.next() * 35);
      const alpha = 0.08 + rng.next() * 0.15;

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", x.toString());
      circle.setAttribute("cy", y.toString());
      circle.setAttribute("r", size.toString());
      circle.setAttribute(
        "fill",
        `rgba(${brightness}, ${brightness - 5}, ${brightness - 10}, ${alpha})`,
      );
      group.appendChild(circle);
    }

    // Add larger fiber fragments
    const fragmentCount = Math.floor(particleCount * 0.05);

    for (let i = 0; i < fragmentCount; i++) {
      const x = rng.next() * width;
      const y = rng.next() * height;
      const rx = (1 + rng.next() * 3) * (1.5 + rng.next() * 2);
      const ry = 1 + rng.next() * 3;
      const angle = rng.next() * 180;
      const brightness = 140 + Math.floor(rng.next() * 50);
      const alpha = 0.1 + rng.next() * 0.15;

      const ellipse = document.createElementNS(SVG_NS, "ellipse");
      ellipse.setAttribute("cx", x.toString());
      ellipse.setAttribute("cy", y.toString());
      ellipse.setAttribute("rx", rx.toString());
      ellipse.setAttribute("ry", ry.toString());
      ellipse.setAttribute(
        "fill",
        `rgba(${brightness}, ${brightness - 8}, ${brightness - 15}, ${alpha})`,
      );
      ellipse.setAttribute("transform", `rotate(${angle} ${x} ${y})`);
      group.appendChild(ellipse);
    }

    return group;
  }

  /**
   * Generate gold flecks as SVG elements
   */
  private static generateGoldFlecksSVG(
    width: number,
    height: number,
    density: number,
    sizeRange: [number, number],
    color: [number, number, number],
    clustering: number,
    seed: number,
    SVG_NS: string,
  ): SVGGElement {
    const group = document.createElementNS(SVG_NS, "g") as SVGGElement;

    const rng = new PRNG();
    rng.seed(seed + 4000);

    const perlin = new PerlinNoise();
    perlin.noiseSeed(seed + 4000);

    const perlin2 = new PerlinNoise();
    perlin2.noiseSeed(seed + 4500);

    // Calculate number of gold flecks
    const area = width * height;
    const baseCount = area * density * 0.0006;
    const fleckCount = Math.floor(baseCount);

    const [goldR, goldG, goldB] = color;

    for (let i = 0; i < fleckCount; i++) {
      let x: number, y: number;

      // Use Perlin noise for natural clustering
      if (clustering > 0) {
        let attempts = 0;
        const maxAttempts = 15;

        do {
          x = rng.next() * width;
          y = rng.next() * height;
          const noiseVal = perlin.noise(x * 0.008, y * 0.008);
          const clusterThreshold = 1 - clustering;

          if (noiseVal > clusterThreshold || attempts >= maxAttempts) {
            break;
          }
          attempts++;
        } while (attempts < maxAttempts);
      } else {
        x = rng.next() * width;
        y = rng.next() * height;
      }

      // Size variation
      const sizeRandom = Math.pow(rng.next(), 0.7);
      const baseSize = sizeRange[0] + sizeRandom * (sizeRange[1] - sizeRange[0]);
      const sizeNoise = perlin2.noise(x! * 0.03, y! * 0.03);
      const size = baseSize * (0.6 + sizeNoise * 0.8);

      // Color variation
      const colorNoise = perlin.noise(x! * 0.05 + 100, y! * 0.05 + 100);
      const brightness = 0.75 + colorNoise * 0.5;
      const isHighlight = rng.next() < 0.15;
      const highlightBoost = isHighlight ? 1.2 : 1.0;

      const r = Math.min(255, Math.floor(goldR * brightness * highlightBoost));
      const g = Math.min(255, Math.floor(goldG * brightness * highlightBoost));
      const b = Math.min(255, Math.floor(goldB * brightness * highlightBoost * 0.9));
      const alpha = 0.85 + rng.next() * 0.15;

      // Generate irregular polygon path
      const path = this.generateFoilPathSVG(x!, y!, size, rng, perlin2, SVG_NS);
      path.setAttribute("fill", `rgba(${r}, ${g}, ${b}, ${alpha})`);
      group.appendChild(path);
    }

    return group;
  }

  /**
   * Generate a single irregular gold foil fragment as SVG path
   */
  private static generateFoilPathSVG(
    x: number,
    y: number,
    size: number,
    rng: PRNG,
    perlin: PerlinNoise,
    SVG_NS: string,
  ): SVGPathElement {
    const numPoints = 6 + Math.floor(rng.next() * 6);
    const points: Array<[number, number]> = [];

    // Generate irregular polygon vertices
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const noiseVal = perlin.noise(x * 0.1 + Math.cos(angle) * 10, y * 0.1 + Math.sin(angle) * 10);
      const radiusVariation = 0.4 + noiseVal * 0.8;
      const radius = size * radiusVariation * (0.3 + rng.next() * 0.7);

      const jagged = (rng.next() - 0.5) * size * 0.3;
      const px = x + Math.cos(angle) * radius + jagged * Math.cos(angle + Math.PI / 2);
      const py = y + Math.sin(angle) * radius + jagged * Math.sin(angle + Math.PI / 2);

      points.push([px, py]);
    }

    // Build path data
    if (points.length === 0) {
      const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
      path.setAttribute("d", "");
      return path;
    }

    let d = `M ${points[0]![0]} ${points[0]![1]}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;

      // Occasionally add curves
      if (rng.next() < 0.3) {
        const cpx = (prev[0] + curr[0]) / 2 + (rng.next() - 0.5) * size * 0.2;
        const cpy = (prev[1] + curr[1]) / 2 + (rng.next() - 0.5) * size * 0.2;
        d += ` Q ${cpx} ${cpy} ${curr[0]} ${curr[1]}`;
      } else {
        d += ` L ${curr[0]} ${curr[1]}`;
      }
    }

    d += " Z";

    const path = document.createElementNS(SVG_NS, "path") as SVGPathElement;
    path.setAttribute("d", d);
    return path;
  }

  /**
   * Generate Xuan paper as data URL
   * Useful for embedding in other elements
   */
  static generateDataURL(options: XuanPaperOptions = {}): string {
    const canvas = this.generate(options);
    return canvas.toDataURL("image/png");
  }

  /**
   * Create SVG pattern element for tiling
   */
  static createPattern(id: string, options: XuanPaperOptions = {}): SVGPatternElement {
    const { width = 256, height = 256 } = options;

    const SVG_NS = "http://www.w3.org/2000/svg";

    const pattern = document.createElementNS(SVG_NS, "pattern");
    pattern.setAttribute("id", id);
    pattern.setAttribute("x", "0");
    pattern.setAttribute("y", "0");
    pattern.setAttribute("width", width.toString());
    pattern.setAttribute("height", height.toString());
    pattern.setAttribute("patternUnits", "userSpaceOnUse");

    const img = document.createElementNS(SVG_NS, "image");
    img.setAttribute("width", width.toString());
    img.setAttribute("height", height.toString());
    img.setAttribute("href", this.generateDataURL({ ...options, width, height }));

    pattern.appendChild(img);

    return pattern;
  }
}

// Convenience function
export function xuanPaper(options: XuanPaperOptions = {}): HTMLCanvasElement {
  return XuanPaper.generate(options);
}

// SVG convenience function
export function xuanPaperSVG(options: XuanPaperOptions = {}): SVGSVGElement {
  return XuanPaper.generateSVG(options);
}

// Preset color palettes
export const XuanPaperColors = {
  /** Pure white Xuan paper (生宣) */
  raw: [255, 253, 248] as [number, number, number],
  /** Warm white (熟宣) */
  processed: [252, 250, 240] as [number, number, number],
  /** Antique/aged (古宣) */
  antique: [245, 235, 215] as [number, number, number],
  /** Tea-stained (茶染) */
  teaStained: [240, 228, 200] as [number, number, number],
  /** Moon white (月白) */
  moonWhite: [248, 250, 252] as [number, number, number],
};

// Gold fleck color presets (撒金颜色)
export const GoldFleckColors = {
  /** Classic gold (经典金) */
  gold: [218, 165, 32] as [number, number, number],
  /** Pale gold (淡金) */
  paleGold: [238, 201, 0] as [number, number, number],
  /** Rose gold (玫瑰金) */
  roseGold: [183, 110, 121] as [number, number, number],
  /** Copper (古铜) */
  copper: [184, 115, 51] as [number, number, number],
  /** Silver (银) */
  silver: [192, 192, 192] as [number, number, number],
  /** Bronze (青铜) */
  bronze: [205, 127, 50] as [number, number, number],
};
