/**
 * InkDiffusionField — 2D ink density field with diffusion simulation.
 *
 * Simulates ink spreading on paper by iteratively diffusing ink density
 * across a 2D grid, modulated by a paper fiber texture.
 */

import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";

export class InkDiffusionField {
  /** Ink density at each pixel, 0 = white, 1 = pure black */
  readonly density: Float32Array;
  /** Paper absorption resistance (fiber texture), 0 = absorbs freely, 1 = blocks */
  readonly paper: Float32Array;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number, paperSeed: number) {
    this.width = width;
    this.height = height;
    this.density = new Float32Array(width * height);
    this.paper = new Float32Array(width * height);

    // Generate paper fiber texture using multi-octave noise
    const noise = new SimplexNoise(paperSeed);
    const noise2 = new SimplexNoise(paperSeed + 777);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        // Horizontal fiber bias (rice paper has directional fibers)
        const n1 = noise.noise2D(x * 0.02, y * 0.05);
        const n2 = noise2.noise2D(x * 0.08, y * 0.03);
        // 0.2-0.8 range: some areas absorb more, some resist
        this.paper[idx] = 0.2 + (n1 * 0.4 + n2 * 0.2 + 0.5) * 0.6;
      }
    }
  }

  /**
   * Deposit ink at a point with given radius and concentration.
   * Uses a soft circular brush footprint.
   */
  deposit(cx: number, cy: number, radius: number, concentration: number): void {
    const r = Math.ceil(radius);
    const x0 = Math.max(0, Math.floor(cx) - r);
    const y0 = Math.max(0, Math.floor(cy) - r);
    const x1 = Math.min(this.width - 1, Math.floor(cx) + r);
    const y1 = Math.min(this.height - 1, Math.floor(cy) + r);
    const r2 = radius * radius;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;

        // Soft falloff: 1 at center, 0 at edge
        const falloff = 1 - Math.sqrt(d2) / radius;
        const amount = concentration * falloff * falloff;
        const idx = y * this.width + x;
        // Ink accumulates but paper resistance modulates absorption
        const absorption = 1 - this.paper[idx] * 0.5;
        this.density[idx] = Math.min(1, this.density[idx] + amount * absorption);
      }
    }
  }

  /**
   * Deposit ink along a line from (x0,y0) to (x1,y1).
   */
  depositLine(x0: number, y0: number, x1: number, y1: number, radius: number, concentration: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.deposit(x0 + dx * t, y0 + dy * t, radius, concentration / steps * 2);
    }
  }

  /**
   * Fill a polygon region with ink at given concentration.
   * Uses scanline fill.
   */
  fillPolygon(points: { x: number; y: number }[], concentration: number): void {
    if (points.length < 3) return;

    // Find bounding box
    let minY = Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.height - 1, Math.ceil(maxY));

    // Scanline fill
    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
          const t = (y - a.y) / (b.y - a.y);
          intersections.push(a.x + t * (b.x - a.x));
        }
      }
      intersections.sort((a, b) => a - b);

      for (let i = 0; i < intersections.length - 1; i += 2) {
        const xStart = Math.max(0, Math.floor(intersections[i]));
        const xEnd = Math.min(this.width - 1, Math.ceil(intersections[i + 1]));
        for (let x = xStart; x <= xEnd; x++) {
          const idx = y * this.width + x;
          const absorption = 1 - this.paper[idx] * 0.3;
          this.density[idx] = Math.min(1, this.density[idx] + concentration * absorption);
        }
      }
    }
  }

  /**
   * Run diffusion simulation steps.
   * Each step, ink spreads to neighboring pixels weighted by paper texture.
   */
  diffuse(iterations: number, spreadRate: number = 0.15): void {
    const w = this.width;
    const h = this.height;
    const temp = new Float32Array(w * h);

    for (let iter = 0; iter < iterations; iter++) {
      temp.set(this.density);

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const current = temp[idx];
          if (current < 0.001) continue;

          // Paper resistance at this pixel
          const resistance = this.paper[idx];
          const rate = spreadRate * (1 - resistance * 0.7);

          // Diffuse to 4 neighbors, weighted by their paper absorption
          const neighbors = [
            idx - 1,     // left
            idx + 1,     // right
            idx - w,     // up
            idx + w,     // down
          ];

          let totalSpread = 0;
          for (const ni of neighbors) {
            const neighborResist = this.paper[ni];
            const flow = rate * (1 - neighborResist * 0.5) * 0.25;
            this.density[ni] = Math.min(1, this.density[ni] + current * flow);
            totalSpread += flow;
          }

          this.density[idx] = Math.max(0, current * (1 - totalSpread));
        }
      }
    }
  }

  /**
   * Apply gaussian-like blur to soften the density field.
   */
  blur(radius: number): void {
    if (radius < 1) return;
    const w = this.width;
    const h = this.height;
    const temp = new Float32Array(w * h);

    // Horizontal pass (box blur approximation)
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const r = radius;
      // Init window
      for (let x = -r; x <= r; x++) {
        sum += this.density[y * w + Math.max(0, Math.min(w - 1, x))];
      }
      for (let x = 0; x < w; x++) {
        temp[y * w + x] = sum / (2 * r + 1);
        const addX = Math.min(w - 1, x + r + 1);
        const remX = Math.max(0, x - r);
        sum += this.density[y * w + addX] - this.density[y * w + remX];
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      let sum = 0;
      const r = radius;
      for (let y = -r; y <= r; y++) {
        sum += temp[Math.max(0, Math.min(h - 1, y)) * w + x];
      }
      for (let y = 0; y < h; y++) {
        this.density[y * w + x] = sum / (2 * r + 1);
        const addY = Math.min(h - 1, y + r + 1);
        const remY = Math.max(0, y - r);
        sum += temp[addY * w + x] - temp[remY * w + x];
      }
    }
  }

  /**
   * Composite this field onto an RGBA ImageData.
   * Ink is rendered as dark gray/black with alpha from density.
   */
  compositeOnto(imageData: ImageData, baseR: number, baseG: number, baseB: number, opacity: number = 1): void {
    const pixels = imageData.data;
    const len = this.width * this.height;

    for (let i = 0; i < len; i++) {
      const d = this.density[i] * opacity;
      if (d < 0.005) continue;

      const pi = i * 4;
      const srcR = baseR;
      const srcG = baseG;
      const srcB = baseB;
      const srcA = d;

      // Alpha compositing: src over dst
      const dstA = pixels[pi + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);

      if (outA > 0) {
        pixels[pi] = (srcR * srcA + pixels[pi] * dstA * (1 - srcA)) / outA;
        pixels[pi + 1] = (srcG * srcA + pixels[pi + 1] * dstA * (1 - srcA)) / outA;
        pixels[pi + 2] = (srcB * srcA + pixels[pi + 2] * dstA * (1 - srcA)) / outA;
        pixels[pi + 3] = outA * 255;
      }
    }
  }

  /**
   * Erase (whiten) a region — used for mist/fog.
   */
  eraseRegion(cx: number, cy: number, radiusX: number, radiusY: number, strength: number): void {
    const x0 = Math.max(0, Math.floor(cx - radiusX));
    const y0 = Math.max(0, Math.floor(cy - radiusY));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + radiusX));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + radiusY));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / radiusX;
        const dy = (y - cy) / radiusY;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;

        const falloff = 1 - Math.sqrt(d2);
        const erase = strength * falloff * falloff;
        const idx = y * this.width + x;
        this.density[idx] = Math.max(0, this.density[idx] * (1 - erase));
      }
    }
  }
}
