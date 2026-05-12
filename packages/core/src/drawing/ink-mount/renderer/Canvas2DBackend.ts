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

    // --- Pass 1: Base ink wash with multiple soft overlapping fills.
    // The brush-stamp BASE COLOR itself now ramps top→bottom — without
    // this the many overlapping stamps saturate to a uniform dark patch
    // (especially for near mountains with baseGray ≈ 15), leaving no
    // tonal headroom for the body gradient in Pass 2.7 to render.
    // baseGrayBottom is lifted from 15 → 30 to leave room for multiply
    // to darken further at the base.
    const passes = 8 + Math.floor(depth * 8);
    const baseGrayBottom = Math.floor(30 + (1 - depth) * 20); // 30 (near) .. 50 (far)
    const baseGrayTop = baseGrayBottom + 60; // 60-shade lighter ridge
    // baseGray as a stable reference for color-tied helpers below
    const baseGray = baseGrayBottom;
    for (let p = 0; p < passes; p++) {
      const t = p / (passes - 1); // 0 = top, 1 = bottom
      const bg = Math.round(baseGrayTop + (baseGrayBottom - baseGrayTop) * t);
      const y = bounds.y + t * (h - bounds.y);
      const alpha = (0.03 + t * 0.12) * (0.4 + depth * 0.6);
      const stampRadius = w * (0.15 + Math.random() * 0.2);

      // Paint a wide horizontal band
      for (let x = -stampRadius; x < w + stampRadius; x += stampRadius * 0.6) {
        const nx = noise.noise2D(x * 0.003, y * 0.003 + ink.noiseSeed * 0.01);
        const offsetY = nx * h * 0.05;
        brushStamp(lctx, x, y + offsetY, stampRadius, bg, bg, bg + 3, alpha);
      }
    }

    // --- Pass 2: Noise-grain ink texture — DISABLED.
    // The 3x3 pixel-block noise fills read as visible grain/dither over
    // the Hobbs-edged wash. Tone variation now comes solely from the
    // overlapping brush stamps in Pass 1 plus the layered mask.

    // --- Pass 2.5: Atmospheric ink gradient (reads as "cloud layer").
    // Soft over-layer using ink.gradient's quadratic-eased opacity stops.
    // source-atop confines it to pixels Pass 1 already painted, so it
    // never bleeds outside the wash region. Intentionally subtle — it
    // sells atmosphere, not body.
    if (ink.gradient.length >= 2) {
      lctx.save();
      lctx.globalCompositeOperation = "source-atop";
      const grad = lctx.createLinearGradient(0, bounds.y, 0, h);
      for (const stop of ink.gradient) {
        grad.addColorStop(
          stop.stop,
          `rgba(${baseGray - 8},${baseGray - 8},${baseGray - 4},${stop.opacity})`,
        );
      }
      lctx.fillStyle = grad;
      lctx.fillRect(bounds.x, bounds.y, bounds.width, h - bounds.y);
      lctx.restore();
    }

    // --- Pass 2.7: Mountain body gradient (multiply).
    // Treats the silhouette as a single shape with a top→bottom fill:
    // white at the ridge (no darkening) → mid-dark at the base (strong
    // pigment). Multiply over the wash so brush-stamp texture and the
    // atmospheric layer above stay intact, only their tone is biased.
    {
      lctx.save();
      lctx.globalCompositeOperation = "multiply";
      const bodyGrad = lctx.createLinearGradient(0, bounds.y, 0, h);
      // Top: pure white = identity under multiply
      bodyGrad.addColorStop(0, "rgba(255,255,255,1)");
      // Mid: subtle shoulder so the upper third stays lifted
      bodyGrad.addColorStop(0.35, "rgba(220,222,228,1)");
      // Bottom: depth-keyed mid-dark — heavier for near mountains
      const baseShade = Math.floor(160 - depth * 70);
      bodyGrad.addColorStop(1, `rgba(${baseShade},${baseShade},${baseShade + 4},1)`);
      lctx.fillStyle = bodyGrad;
      lctx.fillRect(bounds.x, bounds.y, bounds.width, h - bounds.y);
      lctx.restore();
    }

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

    // --- Pass 4: Light antialiasing pass.
    // The Hobbs mask already produces soft watercolor edges, so this no
    // longer needs to do heavy bleeding. Direction is also flipped to
    // respect atmospheric perspective: far mountains (depth≈0) get a
    // touch of haze, near mountains (depth≈1) stay crisp.
    const blurRadius = Math.max(0, Math.round(1.5 - depth * 1.5));
    if (blurRadius >= 1) stackBlur(lctx, w, h, blurRadius);

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
