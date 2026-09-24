import { SimplexNoise } from "../../../foundation/noise/SimplexNoise";
import type { Vector2 } from "../../../foundation/geometry/Vector2";
import type { CunFaStroke, InkFill, MistRegion, MountainLayer, QualityPreset } from "../types";
import type { RenderBackend, RenderOutput } from "./types";
import { deformPolylineFlat } from "../internal/hobbsDeform";
import {
  SILHOUETTE_DECAY,
  seededRng,
  silhouetteSegment,
  smoothProfile,
  topProfile,
} from "../internal/silhouette";
import {
  acquireScratch,
  acquireTone,
  context2d,
  createScratchCanvas,
  getMistSprite,
  onRelease,
  type AnyCanvas,
  type ScratchSet,
} from "./canvasPool";

/**
 * Per-quality render cost knobs. Measured at 1200×800 × 5 layers, the
 * dominant costs are the tone field (noise samples ∝ 1/cell²), the mask
 * edge (layers × 4^depth vertices) and cunfa count (set by density in
 * InkMount); mist wisps are cheap sprite blits.
 */
interface RenderDetail {
  /** Tone-field cell size in px (the field is upsampled bilinearly). */
  toneCell: number;
  /** Mottle noise octaves in the tone field. */
  toneOctaves: 1 | 2;
  /** Jittered copies of the silhouette that build the soft mask edge. */
  maskLayers: number;
  /** Extra Hobbs recursion per mask copy (each level doubles vertices). */
  maskDepth: number;
  /** Stretched sprite wisps per mist region. */
  mistWisps: number;
}

const DETAIL: Record<QualityPreset, RenderDetail> = {
  // Mask copies: each is a full-area anti-aliased polygon fill, the most
  // expensive raster op here. The copies only jitter the edge by ±~2px,
  // and 4–5 copies are visually indistinguishable from the original 12.
  draft: { toneCell: 12, toneOctaves: 1, maskLayers: 2, maskDepth: 1, mistWisps: 3 },
  normal: { toneCell: 8, toneOctaves: 2, maskLayers: 4, maskDepth: 2, mistWisps: 5 },
  high: { toneCell: 6, toneOctaves: 2, maskLayers: 5, maskDepth: 2, mistWisps: 8 },
};

/**
 * Cumulative interior alpha of the mask. The far layer keeps the original
 * 12 × 0.13 recipe (≈0.81, slightly translucent); near layers approach
 * opaque so the ridge lines behind them don't show through their bodies.
 */
function maskInterior(depth: number): number {
  return 1 - Math.pow(1 - 0.13, 12) * (1 - depth * 0.85);
}
/** Extra depth blur (px) on the farthest layer; falls continuously to 0 at depth 1. */
const MAX_DEPTH_BLUR = 2.4;

// ---------------------------------------------------------------------------
// Mask path cache
// ---------------------------------------------------------------------------

interface MaskEntry {
  polys: Float64Array[];
  paths: Path2D[] | null;
}

const MASK_CACHE_LIMIT = 64;
const maskCache = new Map<string, MaskEntry>();
onRelease(() => maskCache.clear());

function hashSilhouette(points: Vector2[]): number {
  let h = 2166136261;
  for (const p of points) {
    h = Math.imul(h ^ Math.round(p.x * 8), 16777619);
    h = Math.imul(h ^ Math.round(p.y * 8), 16777619);
  }
  return h >>> 0;
}

/**
 * The jittered silhouette copies that make the soft watercolour edge
 * cost ~2k vertices each to build. They depend only on the
 * silhouette, seed and detail, so cache them (as Path2D where available)
 * across regenerations of the same scene.
 */
function getMaskEntry(
  silhouette: Vector2[],
  seed: number,
  width: number,
  height: number,
  detail: RenderDetail,
): MaskEntry {
  const key = `${hashSilhouette(silhouette)}|${seed}|${width}x${height}|${detail.maskLayers}|${detail.maskDepth}`;
  const hit = maskCache.get(key);
  if (hit) {
    maskCache.delete(key);
    maskCache.set(key, hit);
    return hit;
  }

  const rand = seededRng(seed ^ 0x5e1f);
  const layerVar = silhouetteSegment(width) * 0.02;
  const bottom = height + 4;
  const base = new Float64Array(silhouette.length * 2);
  for (let i = 0; i < silhouette.length; i++) {
    base[i * 2] = silhouette[i].x;
    base[i * 2 + 1] = silhouette[i].y;
  }
  const polys: Float64Array[] = [];
  for (let li = 0; li < detail.maskLayers; li++) {
    const edge = deformPolylineFlat(base, layerVar, detail.maskDepth, SILHOUETTE_DECAY, rand);
    const coords = new Float64Array(edge.length + 4);
    coords.set(edge);
    const e = edge.length;
    coords[e] = edge[e - 2];
    coords[e + 1] = bottom;
    coords[e + 2] = edge[0];
    coords[e + 3] = bottom;
    polys.push(coords);
  }

  let paths: Path2D[] | null = null;
  if (typeof Path2D !== "undefined") {
    paths = polys.map((coords) => {
      const path = new Path2D();
      tracePolygon(path, coords);
      return path;
    });
  }

  const entry: MaskEntry = { polys, paths };
  maskCache.set(key, entry);
  while (maskCache.size > MASK_CACHE_LIMIT) {
    maskCache.delete(maskCache.keys().next().value as string);
  }
  return entry;
}

function tracePolygon(path: CanvasPath, coords: Float64Array): void {
  path.moveTo(coords[0], coords[1]);
  for (let i = 2; i < coords.length; i += 2) path.lineTo(coords[i], coords[i + 1]);
  path.closePath();
}

// ---------------------------------------------------------------------------
// Brush geometry
// ---------------------------------------------------------------------------

/**
 * Trace a closed ribbon around a centre line with per-point width —
 * a tapered brush stroke. Tangents are averaged over ±`smooth` points so
 * a jittery centre line doesn't flip the outline inside out.
 */
function traceRibbon(
  path: CanvasPath,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  ws: ArrayLike<number>,
  from: number,
  to: number,
  smooth: number,
): void {
  const count = to - from;
  if (count < 2) return;
  const lx = new Float32Array(count);
  const ly = new Float32Array(count);
  const rx = new Float32Array(count);
  const ry = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const i = from + k;
    const a = Math.max(from, i - smooth);
    const b = Math.min(to - 1, i + smooth);
    let tx = xs[b] - xs[a];
    let ty = ys[b] - ys[a];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const half = ws[i] * 0.5;
    lx[k] = xs[i] - ty * half;
    ly[k] = ys[i] + tx * half;
    rx[k] = xs[i] + ty * half;
    ry[k] = ys[i] - tx * half;
  }
  path.moveTo(lx[0], ly[0]);
  for (let k = 1; k < count; k++) path.lineTo(lx[k], ly[k]);
  for (let k = count - 1; k >= 0; k--) path.lineTo(rx[k], ry[k]);
  path.closePath();
}

function sampleGradient(gradient: { stop: number; opacity: number }[], t: number): number {
  if (gradient.length === 0) return 1 - t * 0.7;
  if (t <= gradient[0].stop) return gradient[0].opacity;
  for (let i = 1; i < gradient.length; i++) {
    const b = gradient[i];
    if (t <= b.stop) {
      const a = gradient[i - 1];
      const f = (t - a.stop) / (b.stop - a.stop || 1);
      return a.opacity + (b.opacity - a.opacity) * f;
    }
  }
  return gradient[gradient.length - 1].opacity;
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

export interface Canvas2DBackendOptions {
  width: number;
  height: number;
  /**
   * Draw into this context. The backend then treats the canvas as the
   * caller's: `clear()` leaves it (and any background) untouched.
   */
  ctx?: CanvasRenderingContext2D;
  quality?: QualityPreset;
}

export class Canvas2DBackend implements RenderBackend {
  private ctx: CanvasRenderingContext2D;
  private canvas: AnyCanvas;
  private ownsCanvas: boolean;
  private width: number;
  private height: number;
  private detail: RenderDetail;
  private scratch: ScratchSet;

  constructor(options: Canvas2DBackendOptions) {
    this.width = Math.max(1, Math.round(options.width));
    this.height = Math.max(1, Math.round(options.height));
    this.detail = DETAIL[options.quality ?? "normal"];
    if (options.ctx) {
      this.ctx = options.ctx;
      this.canvas = options.ctx.canvas as AnyCanvas;
      this.ownsCanvas = false;
    } else {
      this.canvas = createScratchCanvas(this.width, this.height);
      this.ctx = context2d(this.canvas);
      this.ownsCanvas = true;
    }
    this.scratch = acquireScratch(this.width, this.height);
  }

  clear(): void {
    if (!this.ownsCanvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMountainLayer(layer: MountainLayer, ink: InkFill, strokes: CunFaStroke[]): void {
    const silhouette = layer.silhouette;
    if (!silhouette || silhouette.length < 2) return;
    const w = this.width;
    const h = this.height;
    const { layerCtx, maskCtx } = this.scratch;
    const top = topProfile(silhouette, w);

    let minTop = Infinity;
    for (let x = 0; x < top.length; x++) if (top[x] < minTop) minTop = top[x];
    // Rows above y0 are empty for this layer; skip them everywhere.
    const y0 = Math.max(0, Math.min(h - 1, Math.floor(minTop - 16)));
    const bandH = h - y0;

    layerCtx.save();
    layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    layerCtx.globalCompositeOperation = "source-over";
    layerCtx.globalAlpha = 1;
    layerCtx.clearRect(0, 0, w, h);

    // 1. Form-following wash.
    this.paintTone(layer, ink, top, y0);

    // 2. Cunfa texture, under the mask so it shares the soft edge.
    this.paintCunFa(strokes, layer.depth);

    // 3. Soft Hobbs silhouette mask.
    const mask = getMaskEntry(silhouette, ink.noiseSeed, w, h, this.detail);
    maskCtx.save();
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.clearRect(0, 0, w, h);
    const layerAlpha = 1 - Math.pow(1 - maskInterior(layer.depth), 1 / mask.polys.length);
    maskCtx.fillStyle = `rgba(255,255,255,${layerAlpha.toFixed(4)})`;
    for (let i = 0; i < mask.polys.length; i++) {
      if (mask.paths) {
        maskCtx.fill(mask.paths[i]);
      } else {
        maskCtx.beginPath();
        tracePolygon(maskCtx, mask.polys[i]);
        maskCtx.fill();
      }
    }
    maskCtx.restore();

    layerCtx.globalCompositeOperation = "destination-in";
    layerCtx.drawImage(this.scratch.mask, 0, y0, w, bandH, 0, y0, w, bandH);
    layerCtx.globalCompositeOperation = "source-over";

    // 4. Contour stroke on the deformed edge.
    this.paintContour(silhouette, layer.depth, ink.noiseSeed);
    layerCtx.restore();

    // 5. Composite with atmospheric blur that falls off continuously with depth.
    const blur = MAX_DEPTH_BLUR * Math.pow(1 - layer.depth, 1.4);
    this.ctx.save();
    if (blur >= 0.3) this.ctx.filter = `blur(${blur.toFixed(1)}px)`;
    this.ctx.drawImage(this.scratch.layer, 0, y0, w, bandH, 0, y0, w, bandH);
    this.ctx.restore();
  }

  /**
   * Ink tone measured from the local silhouette edge down to the canvas
   * bottom (not in horizontal bands), with a darker rim just under the
   * ridge and low-frequency mottling. Computed on a coarse grid and
   * upsampled — the mask supplies the sharp edge, so the field itself
   * only needs to be smooth.
   */
  private paintTone(layer: MountainLayer, ink: InkFill, rawTop: Float32Array, y0: number): void {
    const { toneCell: cell, toneOctaves } = this.detail;
    const top = smoothProfile(rawTop, 18);
    const w = this.width;
    const h = this.height;
    const tw = Math.ceil(w / cell) + 1;
    const th = Math.ceil(h / cell) + 1;
    const tone = acquireTone(tw, th);
    const data = tone.image.data;
    data.fill(0);

    const depth = layer.depth;
    const noise = new SimplexNoise(ink.noiseSeed);
    const nOff = (ink.noiseSeed % 997) * 0.37;
    // Far layers are lighter (atmospheric perspective); near ones carry
    // the darkest ink at the ridge.
    const gTop = 34 + (1 - depth) * 104;
    const gFoot = 112 + (1 - depth) * 88;
    const rimDark = 12 + depth * 14;
    const rimLen = 14 + depth * 26;
    const lastCol = top.length - 1;
    const startRow = Math.max(0, Math.floor(y0 / cell) - 1);

    for (let j = startRow; j < th; j++) {
      const y = (j + 0.5) * cell;
      let o = j * tw * 4;
      for (let i = 0; i < tw; i++, o += 4) {
        const x = (i + 0.5) * cell;
        const edgeY = top[Math.min(lastCol, Math.round(x))];
        const d = y - edgeY;
        const body = Math.max(1, h - edgeY);
        const t = d <= 0 ? 0 : Math.min(1, d / body);

        let n = noise.noise2D(x * 0.0055 + nOff, y * 0.0055);
        if (toneOctaves === 2) n = n * 0.65 + noise.noise2D(x * 0.017, y * 0.017 + nOff) * 0.35;

        const alpha = sampleGradient(ink.gradient, t) * (1 + n * 0.16);
        let g = gTop + (gFoot - gTop) * t + n * 14;
        if (d > 0) g -= rimDark * Math.exp(-d / rimLen);
        else g -= rimDark;

        const gi = g < 0 ? 0 : g > 255 ? 255 : g;
        data[o] = gi;
        data[o + 1] = gi;
        data[o + 2] = gi + 3;
        data[o + 3] = alpha <= 0 ? 0 : alpha >= 1 ? 255 : alpha * 255;
      }
    }

    tone.ctx.putImageData(tone.image, 0, 0);
    const lctx = this.scratch.layerCtx;
    lctx.imageSmoothingEnabled = true;
    lctx.drawImage(tone.canvas, 0, 0, tw, th, 0, 0, tw * cell, th * cell);
  }

  /**
   * Cunfa strokes as tapered brush ribbons. Strokes are bucketed by ink
   * strength so each layer needs only a handful of fills; overlaps inside
   * one fill merge like wet ink instead of stacking into dots.
   */
  private paintCunFa(strokes: CunFaStroke[], depth: number): void {
    if (strokes.length === 0) return;
    const lctx = this.scratch.layerCtx;
    const BUCKETS = 3;
    const gray = Math.round(20 + (1 - depth) * 70);
    const strength = 0.22 + depth * 0.33;

    // Flatten once; each bucket traces a wet halo pass and a core pass.
    const flat = strokes.map((stroke) => {
      const n = stroke.path.length;
      const xs = new Float32Array(n);
      const ys = new Float32Array(n);
      const wide = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        xs[i] = stroke.path[i].x;
        ys[i] = stroke.path[i].y;
        wide[i] = (stroke.widths[i] ?? stroke.widths[stroke.widths.length - 1]) * 2.2;
      }
      return { xs, ys, core: stroke.widths, wide, n, o: stroke.opacity };
    });

    for (let b = 0; b < BUCKETS; b++) {
      const lo = b / BUCKETS;
      const hi = b === BUCKETS - 1 ? Infinity : (b + 1) / BUCKETS;
      const members = flat.filter((f) => f.n >= 2 && f.o >= lo && f.o < hi);
      if (members.length === 0) continue;
      const alpha = Math.min(1, (lo + 0.5 / BUCKETS) * strength);

      lctx.beginPath();
      for (const f of members) traceRibbon(lctx, f.xs, f.ys, f.wide, 0, f.n, 1);
      lctx.fillStyle = `rgba(${gray},${gray},${gray + 4},${(alpha * 0.35).toFixed(3)})`;
      lctx.fill();

      lctx.beginPath();
      for (const f of members) traceRibbon(lctx, f.xs, f.ys, f.core, 0, f.n, 1);
      lctx.fillStyle = `rgba(${gray},${gray},${gray + 4},${alpha.toFixed(3)})`;
      lctx.fill();
    }
  }

  /**
   * The ridge contour (勾): a brush line riding the same deformed edge as
   * the mask, with pressure-varying width, dry-brush breaks and ink that
   * weakens with distance.
   */
  private paintContour(silhouette: Vector2[], depth: number, seed: number): void {
    const n = silhouette.length;
    const w = this.width;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const ws = new Float32Array(n);
    const open = new Uint8Array(n);
    const noise = new SimplexNoise(seed + 71);
    const baseWidth = 0.6 + depth * 1.7;

    // The stroke follows a lightly smoothed copy of the edge: the brush
    // line reads as one confident gesture while the mask's finer jags
    // bleed just past it like wet ink.
    const R = 3;
    let s = 0;
    for (let i = 0; i < n; i++) {
      let sx = 0;
      let sy = 0;
      let c = 0;
      for (let k = Math.max(0, i - R); k <= Math.min(n - 1, i + R); k++) {
        sx += silhouette[k].x;
        sy += silhouette[k].y;
        c++;
      }
      const p = { x: sx / c, y: sy / c };
      if (i > 0)
        s += Math.hypot(
          silhouette[i].x - silhouette[i - 1].x,
          silhouette[i].y - silhouette[i - 1].y,
        );
      const pressure = noise.noise2D(s * 0.012, 3.7) * 0.5 + 0.5;
      const dry = noise.noise2D(s * 0.006, 9.1) * 0.5 + 0.5;
      const width = baseWidth * (0.3 + pressure * 1.1);
      xs[i] = p.x;
      // Sit the stroke just inside the edge so the mask doesn't halve it.
      ys[i] = p.y + width * 0.3;
      ws[i] = dry < 0.2 ? 0 : width * Math.min(1, (dry - 0.2) / 0.08);
      open[i] = ws[i] > 0.05 && p.x > -8 && p.x < w + 8 ? 1 : 0;
    }

    const lctx = this.scratch.layerCtx;
    const gray = Math.round(12 + (1 - depth) * 60);
    const alpha = 0.2 + depth * 0.5;
    lctx.beginPath();
    let i = 0;
    while (i < n) {
      if (!open[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < n && open[j]) j++;
      if (j - i >= 3) traceRibbon(lctx, xs, ys, ws, i, j, 2);
      i = j;
    }
    lctx.fillStyle = `rgba(${gray},${gray},${gray + 4},${alpha.toFixed(3)})`;
    lctx.fill();
  }

  /**
   * Mist as horizontally stretched soft sprites: a broad veil per region
   * plus a few thin wisps seeded from its organic contour. No blur pass
   * and no pixel read-back.
   */
  drawMist(regions: MistRegion[]): void {
    const sprite = getMistSprite();
    const ctx = this.ctx;
    const wisps = this.detail.mistWisps;
    ctx.save();
    for (let r = 0; r < regions.length; r++) {
      const { contour, opacity } = regions[r];
      if (contour.length < 3 || opacity <= 0) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let cx = 0;
      let cy = 0;
      for (const p of contour) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        cx += p.x;
        cy += p.y;
      }
      cx /= contour.length;
      cy /= contour.length;
      const bw = maxX - minX;
      const bh = maxY - minY;
      const rand = seededRng(Math.round(contour[0].x * 131 + contour[0].y * 17) + r * 7919);

      // Broad veil.
      ctx.globalAlpha = Math.min(1, opacity * 0.62);
      ctx.drawImage(sprite, cx - bw * 0.6, cy - bh * 0.5, bw * 1.2, bh);

      // Wisps anchored on the contour and pulled toward the centre line:
      // soft lenses of varied size, not thin streaks.
      for (let k = 0; k < wisps; k++) {
        const p = contour[Math.floor(rand() * contour.length)];
        const ww = bw * (0.3 + rand() * 0.5);
        const wh = bh * (0.25 + rand() * 0.3);
        const wx = p.x * 0.55 + cx * 0.45 + (rand() - 0.5) * bw * 0.15;
        const wy = p.y * 0.5 + cy * 0.5;
        ctx.globalAlpha = Math.min(1, opacity * (0.15 + rand() * 0.3));
        ctx.drawImage(sprite, wx - ww / 2, wy - wh / 2, ww, wh);
      }
    }
    ctx.restore();
  }

  toOutput(): RenderOutput {
    return { type: "canvas", canvas: this.canvas };
  }
}
