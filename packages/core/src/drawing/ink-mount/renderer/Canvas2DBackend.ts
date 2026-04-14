import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import type { Vector2 } from "../../../foundation/geometry/Vector2";
import type { CunFaStroke, InkFill, MistRegion, MountainLayer } from "../types";
import type { RenderBackend, RenderOutput } from "./types";

export class Canvas2DBackend implements RenderBackend {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
  private ownsCanvas: boolean;

  constructor(options: { width: number; height: number; ctx?: CanvasRenderingContext2D }) {
    if (options.ctx) {
      this.ctx = options.ctx;
      this.canvas = options.ctx.canvas as HTMLCanvasElement | OffscreenCanvas;
      this.ownsCanvas = false;
    }
    else {
      if (typeof OffscreenCanvas !== "undefined") {
        this.canvas = new OffscreenCanvas(options.width, options.height);
      }
      else {
        const el = document.createElement("canvas");
        el.width = options.width;
        el.height = options.height;
        this.canvas = el;
      }
      this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
      this.ownsCanvas = true;
    }
  }

  clear(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
  }

  drawMountainFill(layer: MountainLayer, ink: InkFill): void {
    const ctx = this.ctx;
    const { ridgeLine, depth } = layer;
    const canvasHeight = this.canvas.height;

    if (ridgeLine.length === 0) return;

    // 1. Build clip path from ridgeLine + bottom edge
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ridgeLine[0].x, ridgeLine[0].y);
    for (let i = 1; i < ridgeLine.length; i++) {
      ctx.lineTo(ridgeLine[i].x, ridgeLine[i].y);
    }
    // Close along bottom edge
    ctx.lineTo(ridgeLine[ridgeLine.length - 1].x, canvasHeight);
    ctx.lineTo(ridgeLine[0].x, canvasHeight);
    ctx.closePath();
    ctx.clip();

    // 2. Create linear gradient from top of bounds to bottom
    const gray = Math.max(0, 20 - depth * 10);
    const gradient = ctx.createLinearGradient(0, layer.bounds.y, 0, canvasHeight);
    for (const stop of ink.gradient) {
      const r = gray;
      const g = gray;
      const b = Math.min(255, gray + 5);
      gradient.addColorStop(stop.stop, `rgba(${r},${g},${b},${stop.opacity})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(layer.bounds.x, layer.bounds.y, layer.bounds.width, canvasHeight - layer.bounds.y);

    // 4. Overlay ink noise texture
    const noise = new SimplexNoise(ink.noiseSeed);
    const step = 8;
    const bx = layer.bounds.x;
    const by = layer.bounds.y;
    const bw = layer.bounds.width;
    const bh = canvasHeight - by;
    for (let x = bx; x < bx + bw; x += step) {
      for (let y = by; y < by + bh; y += step) {
        const n = noise.noise2D(x * 0.02, y * 0.02);
        if (n > 0.1) {
          const alpha = n * 0.15 * (0.5 + depth * 0.5);
          ctx.fillStyle = `rgba(5,5,10,${alpha})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    // 5. Draw splash regions
    for (const splash of ink.splashes) {
      if (splash.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(splash[0].x, splash[0].y);
      for (let i = 0; i < splash.length; i++) {
        const curr = splash[i];
        const next = splash[(i + 1) % splash.length];
        const mx = (curr.x + next.x) / 2;
        const my = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(5,5,10,${0.3 + depth * 0.4})`;
      ctx.fill();
    }

    // 6. Restore to remove clip
    ctx.restore();
  }

  drawCunFaStrokes(strokes: CunFaStroke[], clipLayer?: MountainLayer): void {
    const ctx = this.ctx;
    const canvasHeight = this.canvas.height;

    // Clip strokes to mountain silhouette if provided
    if (clipLayer && clipLayer.ridgeLine.length > 0) {
      ctx.save();
      ctx.beginPath();
      const rl = clipLayer.ridgeLine;
      ctx.moveTo(rl[0].x, rl[0].y);
      for (let i = 1; i < rl.length; i++) {
        ctx.lineTo(rl[i].x, rl[i].y);
      }
      ctx.lineTo(rl[rl.length - 1].x, canvasHeight);
      ctx.lineTo(rl[0].x, canvasHeight);
      ctx.closePath();
      ctx.clip();
    }

    for (const stroke of strokes) {
      const { path, widths, opacity } = stroke;
      if (path.length < 2) continue;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = `rgba(10,10,15,${opacity})`;

      // Draw as a single smooth path with average width for performance
      ctx.beginPath();
      ctx.lineWidth = widths[Math.floor(widths.length / 2)];
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
    const ctx = this.ctx;

    for (const region of regions) {
      const { contour, opacity, fadeRadius } = region;
      if (contour.length < 3) continue;

      // Compute centroid
      let cx = 0;
      let cy = 0;
      for (const p of contour) {
        cx += p.x;
        cy += p.y;
      }
      cx /= contour.length;
      cy /= contour.length;

      // Build path from contour
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(contour[0].x, contour[0].y);
      for (let i = 1; i < contour.length; i++) {
        ctx.lineTo(contour[i].x, contour[i].y);
      }
      ctx.closePath();

      // Create radial gradient: center white at opacity -> edge transparent
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, fadeRadius);
      gradient.addColorStop(0, `rgba(255,255,255,${opacity})`);
      gradient.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();
    }
  }

  drawRidgeLine(points: Vector2[], opacity: number, lineWidth: number): void {
    if (points.length < 2) return;

    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = `rgba(15,15,20,${opacity})`;
    ctx.lineWidth = lineWidth;
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
