import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import type { Vector2 } from "../../../foundation/geometry/Vector2";
import type { CunFaStroke, InkFill, MistRegion, MountainLayer } from "../types";
import type { RenderBackend, RenderOutput } from "./types";

/**
 * Stack-blur approximation of gaussian blur — fast O(n) per pixel.
 * Operates in-place on a Canvas2D context.
 */
function stackBlur(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number): void {
  if (radius < 1) return;
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;
  const wm = w - 1;
  const hm = h - 1;
  const div = radius + radius + 1;
  const r: number[] = Array.from({ length: w * h });
  const g: number[] = Array.from({ length: w * h });
  const b: number[] = Array.from({ length: w * h });
  const a: number[] = Array.from({ length: w * h });

  let rsum: number, gsum: number, bsum: number, asum: number;
  let p: number, p1: number, p2: number;
  let yi = 0;

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    rsum = gsum = bsum = asum = 0;
    // Accumulate initial window
    for (let i = -radius; i <= radius; i++) {
      p = (yi + Math.min(wm, Math.max(0, i))) * 4;
      rsum += pixels[p];
      gsum += pixels[p + 1];
      bsum += pixels[p + 2];
      asum += pixels[p + 3];
    }
    for (let x = 0; x < w; x++) {
      r[yi + x] = rsum / div;
      g[yi + x] = gsum / div;
      b[yi + x] = bsum / div;
      a[yi + x] = asum / div;

      p1 = (yi + Math.min(wm, x + radius + 1)) * 4;
      p2 = (yi + Math.max(0, x - radius)) * 4;
      rsum += pixels[p1] - pixels[p2];
      gsum += pixels[p1 + 1] - pixels[p2 + 1];
      bsum += pixels[p1 + 2] - pixels[p2 + 2];
      asum += pixels[p1 + 3] - pixels[p2 + 3];
    }
    yi += w;
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    rsum = gsum = bsum = asum = 0;
    let yp = -radius * w;
    for (let i = -radius; i <= radius; i++) {
      yi = Math.max(0, yp) + x;
      rsum += r[yi];
      gsum += g[yi];
      bsum += b[yi];
      asum += a[yi];
      yp += w;
    }
    yi = x;
    for (let y = 0; y < h; y++) {
      p = yi * 4;
      pixels[p] = rsum / div;
      pixels[p + 1] = gsum / div;
      pixels[p + 2] = bsum / div;
      pixels[p + 3] = asum / div;

      p1 = x + Math.min(hm, y + radius + 1) * w;
      p2 = x + Math.max(0, y - radius) * w;
      rsum += r[p1] - r[p2];
      gsum += g[p1] - g[p2];
      bsum += b[p1] - b[p2];
      asum += a[p1] - a[p2];
      yi += w;
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Build a clip path for a mountain silhouette.
 */
function clipToMountain(
  ctx: CanvasRenderingContext2D,
  ridgeLine: Vector2[],
  canvasHeight: number,
): void {
  ctx.beginPath();
  ctx.moveTo(ridgeLine[0].x, ridgeLine[0].y);
  for (let i = 1; i < ridgeLine.length; i++) {
    ctx.lineTo(ridgeLine[i].x, ridgeLine[i].y);
  }
  ctx.lineTo(ridgeLine[ridgeLine.length - 1].x, canvasHeight);
  ctx.lineTo(ridgeLine[0].x, canvasHeight);
  ctx.closePath();
  ctx.clip();
}

/**
 * Paint a soft brush stamp (radial gradient circle) at a position.
 */
function brushStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},${alpha * 0.6})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

export class Canvas2DBackend implements RenderBackend {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  // Offscreen layer for compositing with blur
  private layerCanvas: HTMLCanvasElement | OffscreenCanvas;
  private layerCtx: CanvasRenderingContext2D;

  constructor(options: { width: number; height: number; ctx?: CanvasRenderingContext2D }) {
    if (options.ctx) {
      this.ctx = options.ctx;
      this.canvas = options.ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
    } else {
      if (typeof OffscreenCanvas !== "undefined") {
        this.canvas = new OffscreenCanvas(options.width, options.height);
      } else {
        const el = document.createElement("canvas");
        el.width = options.width;
        el.height = options.height;
        this.canvas = el;
      }
      this.ctx = this.canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    }

    // Create offscreen layer for per-mountain compositing
    if (typeof OffscreenCanvas !== "undefined") {
      this.layerCanvas = new OffscreenCanvas(options.width, options.height);
    } else {
      const el = document.createElement("canvas");
      el.width = options.width;
      el.height = options.height;
      this.layerCanvas = el;
    }
    this.layerCtx = this.layerCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  }

  clear(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
  }

  drawMountainFill(layer: MountainLayer, ink: InkFill): void {
    const { ridgeLine, depth, bounds } = layer;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (ridgeLine.length === 0) return;

    const lctx = this.layerCtx;
    lctx.clearRect(0, 0, w, h);

    // Clip to mountain silhouette on the layer canvas
    lctx.save();
    clipToMountain(lctx, ridgeLine, h);

    const noise = new SimplexNoise(ink.noiseSeed);

    // --- Pass 1: Base ink wash with multiple soft overlapping fills ---
    // Paint from bottom (dark) to top (light) using large soft stamps
    const passes = 8 + Math.floor(depth * 8);
    const baseGray = Math.floor(15 + (1 - depth) * 30);
    for (let p = 0; p < passes; p++) {
      const t = p / (passes - 1); // 0 = top, 1 = bottom
      const y = bounds.y + t * (h - bounds.y);
      const alpha = (0.03 + t * 0.12) * (0.4 + depth * 0.6);
      const stampRadius = w * (0.15 + Math.random() * 0.2);

      // Paint a wide horizontal band
      for (let x = -stampRadius; x < w + stampRadius; x += stampRadius * 0.6) {
        const nx = noise.noise2D(x * 0.003, y * 0.003 + ink.noiseSeed * 0.01);
        const offsetY = nx * h * 0.05;
        brushStamp(lctx, x, y + offsetY, stampRadius, baseGray, baseGray, baseGray + 3, alpha);
      }
    }

    // --- Pass 2: Ink texture with noise-modulated density ---
    const texStep = 3;
    for (let y = bounds.y; y < h; y += texStep) {
      for (let x = bounds.x; x < bounds.x + bounds.width; x += texStep) {
        const n1 = noise.noise2D(x * 0.008, y * 0.008);
        const n2 = noise.noise2D(x * 0.025, y * 0.025 + 100);
        const normalizedY = (y - bounds.y) / (h - bounds.y);

        // Combine two octaves of noise for varied texture
        const inkDensity = (n1 * 0.6 + n2 * 0.4) * normalizedY * (0.3 + depth * 0.7);

        if (inkDensity > 0.05) {
          const a = Math.min(0.4, inkDensity * 0.5);
          lctx.fillStyle = `rgba(${baseGray - 5},${baseGray - 5},${baseGray},${a})`;
          lctx.fillRect(x, y, texStep, texStep);
        }
      }
    }

    // --- Pass 3: Splash / 泼墨 regions with soft edges ---
    for (const splash of ink.splashes) {
      if (splash.length < 3) continue;
      // Paint splash as overlapping soft stamps
      let cx = 0,
        cy = 0;
      for (const p of splash) {
        cx += p.x;
        cy += p.y;
      }
      cx /= splash.length;
      cy /= splash.length;

      const splashAlpha = 0.15 + depth * 0.25;
      const splashRadius = bounds.height * (0.06 + depth * 0.08);

      // Core
      brushStamp(lctx, cx, cy, splashRadius, 8, 8, 12, splashAlpha);
      // Scatter around
      for (const p of splash) {
        brushStamp(lctx, p.x, p.y, splashRadius * 0.5, 8, 8, 12, splashAlpha * 0.5);
      }
    }

    lctx.restore(); // remove clip

    // --- Pass 4: Blur the entire mountain layer for ink bleeding effect ---
    const blurRadius = Math.max(2, Math.floor(3 + depth * 5));
    stackBlur(lctx, w, h, blurRadius);

    // Composite onto main canvas
    this.ctx.drawImage(this.layerCanvas, 0, 0);
  }

  drawCunFaStrokes(strokes: CunFaStroke[], clipLayer?: MountainLayer): void {
    const ctx = this.ctx;
    const h = this.canvas.height;

    if (clipLayer && clipLayer.ridgeLine.length > 0) {
      ctx.save();
      clipToMountain(ctx, clipLayer.ridgeLine, h);
    }

    for (const stroke of strokes) {
      const { path, widths, opacity } = stroke;
      if (path.length < 2) continue;

      // Render each stroke as a series of soft brush stamps along the path
      const gray = Math.floor(10 + (1 - opacity) * 25);
      for (let i = 0; i < path.length; i++) {
        const w = widths[Math.min(i, widths.length - 1)];
        const stampR = Math.max(0.5, w * 1.5);
        brushStamp(ctx, path[i].x, path[i].y, stampR, gray, gray, gray + 3, opacity * 0.4);
      }

      // Also draw a thin line for crispness at ridges
      ctx.strokeStyle = `rgba(${gray},${gray},${gray + 3},${opacity * 0.3})`;
      ctx.lineWidth = widths[0] * 0.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }
      ctx.stroke();
    }

    if (clipLayer) {
      ctx.restore();
    }
  }

  drawMist(regions: MistRegion[]): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const lctx = this.layerCtx;

    lctx.clearRect(0, 0, w, h);

    for (const region of regions) {
      const { contour, opacity, fadeRadius } = region;
      if (contour.length < 3) continue;

      // Compute centroid and bounding box
      let cx = 0,
        cy = 0;
      for (const p of contour) {
        cx += p.x;
        cy += p.y;
      }
      cx /= contour.length;
      cy /= contour.length;

      // Paint multiple overlapping soft white stamps for natural fog
      const baseRadius = fadeRadius * 1.5;
      brushStamp(lctx, cx, cy, baseRadius, 255, 255, 255, opacity * 0.7);

      // Scatter secondary fog patches
      for (let i = 0; i < contour.length; i += 2) {
        const p = contour[i];
        const r = baseRadius * (0.4 + Math.random() * 0.4);
        brushStamp(lctx, p.x, p.y, r, 255, 255, 255, opacity * 0.4);
      }
    }

    // Heavy blur for soft fog edges
    stackBlur(lctx, w, h, 25);

    this.ctx.drawImage(this.layerCanvas, 0, 0);
  }

  drawRidgeLine(points: Vector2[], opacity: number, lineWidth: number): void {
    if (points.length < 2) return;

    const ctx = this.ctx;
    ctx.save();

    // Draw ridge as soft brush stamps + thin line for definition
    const gray = 20;
    for (let i = 0; i < points.length; i += 3) {
      brushStamp(
        ctx,
        points[i].x,
        points[i].y,
        lineWidth * 2,
        gray,
        gray,
        gray + 3,
        opacity * 0.15,
      );
    }

    ctx.strokeStyle = `rgba(${gray},${gray},${gray + 3},${opacity * 0.6})`;
    ctx.lineWidth = lineWidth * 0.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  toOutput(): RenderOutput {
    return { type: "canvas", canvas: this.canvas };
  }
}
