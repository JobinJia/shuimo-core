import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import { Vector2 } from "../../../foundation/geometry/Vector2";
import type { CunFaStroke, InkFill, MistRegion, MountainLayer } from "../types";
import type { RenderBackend, RenderOutput } from "./types";
import { deformPolyline } from "../internal/hobbsDeform";

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
 * Build the closed mountain silhouette polygon: ridge line across the top,
 * then a horizontal bottom edge along the canvas baseline.
 */
function buildMountainPolygon(ridgeLine: Vector2[], canvasHeight: number): Vector2[] {
  const poly: Vector2[] = [];
  for (let i = 0; i < ridgeLine.length; i++) {
    poly.push(new Vector2(ridgeLine[i].x, ridgeLine[i].y));
  }
  poly.push(new Vector2(ridgeLine[ridgeLine.length - 1].x, canvasHeight));
  poly.push(new Vector2(ridgeLine[0].x, canvasHeight));
  return poly;
}

/** Tiny Park–Miller LCG, mirrors the seeded RNG used in InkWashLayer. */
function seededRand(seed: number): () => number {
  let s = Math.abs(Math.floor(seed)) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
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
  // Offscreen mask for the Hobbs-deformed mountain silhouette
  private maskCanvas: HTMLCanvasElement | OffscreenCanvas;
  private maskCtx: CanvasRenderingContext2D;

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

    if (typeof OffscreenCanvas !== "undefined") {
      this.maskCanvas = new OffscreenCanvas(options.width, options.height);
    } else {
      const el = document.createElement("canvas");
      el.width = options.width;
      el.height = options.height;
      this.maskCanvas = el;
    }
    this.maskCtx = this.maskCanvas.getContext("2d") as unknown as CanvasRenderingContext2D;
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

    const noise = new SimplexNoise(ink.noiseSeed);

    // --- Pass 1: Base ink wash — top-dark / bottom-light direction.
    // Mountain peaks hold the heaviest ink; the body fades toward paper
    // at its base. Both COLOR and ALPHA follow this direction so the
    // top saturates dark via overlapping stamps and the base barely
    // paints anything, letting paper show through. Sole source of body
    // gradient now — Pass 2.5 / Pass 2.7 are disabled to avoid the
    // opposite-direction conflicts that previously caused color bands.
    const passes = 8 + Math.floor(depth * 8);
    // Wider color spread (top very dark, base near-paper) + higher peak
    // alpha so the contrast actually reads. Previous values produced
    // ~rgb(149) at the peak and ~rgb(234) at the base after blending —
    // technically a gradient but visually too subtle. With the new
    // parameters the peak saturates closer to rgb(100) and the base
    // sits near paper, making the top-dark/bottom-light direction
    // clearly visible.
    const baseGrayTop = Math.floor(10 + (1 - depth) * 15); // 10 (near peak) .. 25 (far peak)
    const baseGrayBottom = Math.floor(130 + (1 - depth) * 60); // 130 (near base) .. 190 (far base)
    const baseGray = baseGrayTop; // stable reference (peak shade) for downstream
    for (let p = 0; p < passes; p++) {
      const t = p / (passes - 1); // 0 = top (peak), 1 = bottom (base)
      const bg = Math.round(baseGrayTop + (baseGrayBottom - baseGrayTop) * t);
      const y = bounds.y + t * (h - bounds.y);
      // Peak alpha lifted from 0.15 → 0.28 so overlapping stamps reach
      // higher cumulative alpha at the ridge band; base alpha kept low.
      const alpha = (0.28 - t * 0.25) * (0.4 + depth * 0.6);
      const stampRadius = w * (0.15 + Math.random() * 0.2);

      for (let x = -stampRadius; x < w + stampRadius; x += stampRadius * 0.6) {
        const nx = noise.noise2D(x * 0.003, y * 0.003 + ink.noiseSeed * 0.01);
        const offsetY = nx * h * 0.05;
        brushStamp(lctx, x, y + offsetY, stampRadius, bg, bg, bg + 3, alpha);
      }
    }

    // --- Pass 2: Noise-grain ink texture — DISABLED.
    // The 3x3 pixel-block noise fills read as visible grain/dither over
    // the Hobbs-edged wash.

    // --- Pass 2.5: REMOVED.
    // Previously a source-atop atmospheric gradient that darkened the
    // body bottom. Conflicts with the new top-dark/bottom-light direction
    // (would push the now-faded base back toward dark).
    void baseGray; // keep symbol referenced (reserved for future use)

    // --- Pass 2.7: REMOVED.
    // Previously a multiply pass that darkened the body bottom; same
    // direction conflict, and previously produced a visible color band
    // at the abrupt 0→0.25 stop transition.

    // --- Pass 3: Hobbs watercolor edge mask (mirrors /ink-bleed demo).
    // The original ridge is densely sampled (~150–200 points, segments
    // ~3–4px). Applying Hobbs midpoint-displacement directly produces
    // sawtooth spikes whenever variance > segment length — looks like a
    // forest. We decimate the ridge to a small number of anchors first so
    // initial segments are long (~50px, similar to /ink-bleed's 8-gon
    // sides), then let Hobbs recursion regenerate fine detail from large
    // scale down to small scale, exactly like the InkBleed demo does.
    const mctx = this.maskCtx;
    mctx.save();
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, w, h);

    const edgeRand = seededRand(ink.noiseSeed ^ 0x5e1f);

    const RIDGE_ANCHORS = 14;
    const anchorCount = Math.min(RIDGE_ANCHORS, ridgeLine.length);
    const anchors: Vector2[] = [];
    for (let i = 0; i < anchorCount; i++) {
      const t = i / (anchorCount - 1);
      const idx = Math.floor(t * (ridgeLine.length - 1));
      anchors.push(new Vector2(ridgeLine[idx].x, ridgeLine[idx].y));
    }

    // Open polyline: short vertical down to baseline at each end + decimated ridge.
    const visibleEdge: Vector2[] = [
      new Vector2(anchors[0].x, h),
      ...anchors,
      new Vector2(anchors[anchors.length - 1].x, h),
    ];

    // Variance scaled to anchor-segment length. Tighter than /ink-bleed's
    // 13% blob default — for a mountain silhouette the demo's blob ratio
    // reads as "chunky stamp impression"; refining the master amplitude
    // and keeping more layers close to it gives a finer wet-ink edge.
    const avgSegment = bounds.width / (anchorCount - 1);
    const masterVar = avgSegment * 0.06;
    const masterDepth = 5;
    const layerVar = avgSegment * 0.02;
    const layerDepth = 2;
    const decay = 0.78;
    const edgeLayers = 12;
    const edgeAlpha = 0.13;

    // Master deform establishes the jagged silhouette character.
    const masterEdge = deformPolyline(visibleEdge, masterVar, masterDepth, decay, edgeRand);

    mctx.fillStyle = `rgba(255,255,255,${edgeAlpha})`;
    for (let li = 0; li < edgeLayers; li++) {
      const layerEdge = deformPolyline(masterEdge, layerVar, layerDepth, decay, edgeRand);
      mctx.beginPath();
      mctx.moveTo(layerEdge[0].x, layerEdge[0].y);
      for (let i = 1; i < layerEdge.length; i++) {
        mctx.lineTo(layerEdge[i].x, layerEdge[i].y);
      }
      mctx.lineTo(layerEdge[layerEdge.length - 1].x, h);
      mctx.lineTo(layerEdge[0].x, h);
      mctx.closePath();
      mctx.fill();
    }
    mctx.restore();

    // Apply the soft mask to the painted layer.
    lctx.save();
    lctx.globalCompositeOperation = "destination-in";
    lctx.drawImage(this.maskCanvas, 0, 0);
    lctx.restore();

    // --- Pass 4: Light atmospheric blur via CSS filter.
    // Uses ctx.filter instead of the straight-alpha stackBlur: the latter
    // averages RGB across pixels including fully-transparent ones (whose
    // RGB is stored as 0,0,0), which drags the wash's edge tone toward
    // black and produced a visible dark halo at far-mountain silhouettes.
    // ctx.filter blurs in premultiplied alpha space, so transparent
    // pixels don't bleed black into the edges.
    const blurRadius = Math.max(0, Math.round(1.5 - depth * 1.5));
    if (blurRadius >= 1) {
      this.ctx.save();
      this.ctx.filter = `blur(${blurRadius}px)`;
      this.ctx.drawImage(this.layerCanvas, 0, 0);
      this.ctx.restore();
    } else {
      this.ctx.drawImage(this.layerCanvas, 0, 0);
    }
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
