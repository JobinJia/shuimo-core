import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import type { Vector2 } from "../../../foundation/geometry/Vector2";
import type { CunFaStroke, InkFill, MistRegion, MountainLayer } from "../types";
import type { RenderBackend, RenderOutput } from "./types";
import { InkDiffusionField } from "./InkDiffusionField";

export class Canvas2DBackend implements RenderBackend {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private w: number;
  private h: number;
  /** Accumulated ink field for the entire scene */
  private field: InkDiffusionField;
  private imageData: ImageData;

  constructor(options: { width: number; height: number; ctx?: CanvasRenderingContext2D }) {
    this.w = options.width;
    this.h = options.height;

    if (options.ctx) {
      this.ctx = options.ctx;
      this.canvas = options.ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
    } else {
      if (typeof OffscreenCanvas !== "undefined") {
        this.canvas = new OffscreenCanvas(this.w, this.h);
      } else {
        const el = document.createElement("canvas");
        el.width = this.w;
        el.height = this.h;
        this.canvas = el;
      }
      this.ctx = this.canvas.getContext("2d")!;
    }

    this.field = new InkDiffusionField(this.w, this.h, 12345);
    this.imageData = this.ctx.createImageData(this.w, this.h);

    // Fill background with warm paper color
    const pixels = this.imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 248;     // R
      pixels[i + 1] = 246; // G
      pixels[i + 2] = 241; // B
      pixels[i + 3] = 255; // A
    }
  }

  clear(): void {
    this.field = new InkDiffusionField(this.w, this.h, 12345);
    this.imageData = this.ctx.createImageData(this.w, this.h);
    const pixels = this.imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 248;
      pixels[i + 1] = 246;
      pixels[i + 2] = 241;
      pixels[i + 3] = 255;
    }
  }

  drawMountainFill(layer: MountainLayer, ink: InkFill): void {
    const { ridgeLine, depth, bounds } = layer;
    if (ridgeLine.length === 0) return;

    const noise = new SimplexNoise(ink.noiseSeed);
    const noise2 = new SimplexNoise(ink.noiseSeed + 333);

    // Build polygon: ridge line + canvas bottom
    const polygon = ridgeLine.map((p) => ({ x: p.x, y: p.y }));
    polygon.push({ x: ridgeLine[ridgeLine.length - 1].x, y: this.h });
    polygon.push({ x: ridgeLine[0].x, y: this.h });

    // --- Layer 1: Base wash with depth-dependent concentration ---
    // Far mountains: very light. Near mountains: heavier.
    const baseConcentration = 0.06 + depth * 0.2;
    this.field.fillPolygon(polygon, baseConcentration);

    // --- Layer 2: Vertical gradient — darker at bottom ---
    // Add extra ink in lower portions of the mountain
    const gradientSteps = 6;
    for (let s = 0; s < gradientSteps; s++) {
      const t = (s + 1) / gradientSteps; // 0..1, bottom-heavy
      const yLine = bounds.y + (this.h - bounds.y) * t * 0.7;
      const gradPoly = ridgeLine
        .filter((p) => p.y <= yLine + 50)
        .map((p) => ({ x: p.x, y: Math.max(p.y, yLine - 50) }));

      if (gradPoly.length > 2) {
        gradPoly.push({ x: gradPoly[gradPoly.length - 1].x, y: this.h });
        gradPoly.push({ x: gradPoly[0].x, y: this.h });
        this.field.fillPolygon(gradPoly, baseConcentration * t * 0.8);
      }
    }

    // --- Layer 3: Noise-modulated texture across the mountain ---
    const texStep = 4;
    const bx = Math.max(0, Math.floor(bounds.x));
    const bw = Math.min(this.w, Math.ceil(bounds.x + bounds.width));
    for (let y = Math.max(0, Math.floor(bounds.y)); y < this.h; y += texStep) {
      for (let x = bx; x < bw; x += texStep) {
        // Check if inside mountain (above ridge at this x)
        const ridgeIdx = Math.floor((x / this.w) * (ridgeLine.length - 1));
        const clampedIdx = Math.max(0, Math.min(ridgeLine.length - 1, ridgeIdx));
        if (y < ridgeLine[clampedIdx].y) continue;

        const n1 = noise.noise2D(x * 0.006, y * 0.006);
        const n2 = noise2.noise2D(x * 0.02, y * 0.015);
        const normalizedY = (y - bounds.y) / (this.h - bounds.y);

        // Combine for varied texture
        const texDensity = (n1 * 0.5 + n2 * 0.5) * normalizedY * (0.3 + depth * 0.5);

        if (texDensity > 0.03) {
          this.field.deposit(x, y, texStep * 0.8, texDensity * 0.06);
        }
      }
    }

    // --- Layer 4: Splash (泼墨) regions ---
    for (const splash of ink.splashes) {
      if (splash.length < 3) continue;
      let cx = 0, cy = 0;
      for (const p of splash) { cx += p.x; cy += p.y; }
      cx /= splash.length;
      cy /= splash.length;

      // Heavy deposit at splash center
      const splashConc = 0.15 + depth * 0.3;
      const splashR = bounds.height * (0.03 + depth * 0.05);
      this.field.deposit(cx, cy, splashR, splashConc);

      // Scatter around contour points
      for (const p of splash) {
        this.field.deposit(p.x, p.y, splashR * 0.6, splashConc * 0.4);
      }
    }

    // --- Diffuse ink to simulate paper absorption ---
    const diffuseSteps = 3 + Math.floor(depth * 4);
    this.field.diffuse(diffuseSteps, 0.12);
  }

  drawCunFaStrokes(strokes: CunFaStroke[], clipLayer?: MountainLayer): void {
    for (const stroke of strokes) {
      const { path, widths, opacity } = stroke;
      if (path.length < 2) continue;

      // Deposit ink along the stroke path
      for (let i = 0; i < path.length - 1; i++) {
        const w = widths[Math.min(i, widths.length - 1)];
        const brushR = Math.max(0.8, w * 1.2);
        const concentration = opacity * 0.12;
        this.field.depositLine(
          path[i].x, path[i].y,
          path[i + 1].x, path[i + 1].y,
          brushR, concentration,
        );
      }
    }

    // Light diffusion for cunfa strokes
    this.field.diffuse(1, 0.08);
  }

  drawMist(regions: MistRegion[]): void {
    for (const region of regions) {
      const { contour, opacity, fadeRadius } = region;
      if (contour.length < 3) continue;

      // Compute centroid
      let cx = 0, cy = 0;
      for (const p of contour) { cx += p.x; cy += p.y; }
      cx /= contour.length;
      cy /= contour.length;

      // Erase (whiten) the ink field in the mist region
      const radiusX = fadeRadius * 2;
      const radiusY = fadeRadius * 0.8;
      this.field.eraseRegion(cx, cy, radiusX, radiusY, opacity * 0.85);

      // Also erase around contour for irregular fog edges
      for (let i = 0; i < contour.length; i += 2) {
        const p = contour[i];
        this.field.eraseRegion(p.x, p.y, radiusX * 0.4, radiusY * 0.4, opacity * 0.5);
      }
    }

    // Blur after erasing to soften fog edges
    this.field.blur(6);
  }

  drawRidgeLine(points: Vector2[], opacity: number, lineWidth: number): void {
    if (points.length < 2) return;

    // Deposit a thin line of ink along the ridge
    const brushR = Math.max(0.5, lineWidth * 0.8);
    const concentration = opacity * 0.15;

    for (let i = 0; i < points.length - 1; i++) {
      this.field.depositLine(
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y,
        brushR, concentration,
      );
    }
  }

  toOutput(): RenderOutput {
    // Final blur pass for overall softness
    this.field.blur(2);

    // Composite ink field onto paper-colored ImageData
    this.field.compositeOnto(this.imageData, 12, 12, 18, 1);

    // Write to canvas
    this.ctx.putImageData(this.imageData, 0, 0);

    return { type: "canvas", canvas: this.canvas };
  }
}
