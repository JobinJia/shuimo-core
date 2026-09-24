/**
 * Scratch-canvas pool and pre-rendered sprites for the Canvas2D backend.
 *
 * Rendering is synchronous, so one scratch set per canvas size can be
 * shared by every backend instance: regenerating a scene no longer
 * allocates two fresh full-size offscreen canvases (≈7.7 MB at 1200×800).
 * `releaseInkMountResources()` drops everything for callers that want the
 * memory back (e.g. when a view unmounts).
 */

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export function createScratchCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const el = document.createElement("canvas");
  el.width = width;
  el.height = height;
  return el;
}

export function context2d(canvas: AnyCanvas): CanvasRenderingContext2D {
  return canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
}

export interface ScratchSet {
  /** Per-mountain compositing layer (full size). */
  layer: AnyCanvas;
  layerCtx: CanvasRenderingContext2D;
  /** Soft Hobbs silhouette mask (full size). */
  mask: AnyCanvas;
  maskCtx: CanvasRenderingContext2D;
}

export interface ToneScratch {
  canvas: AnyCanvas;
  ctx: CanvasRenderingContext2D;
  image: ImageData;
}

/** Keep at most this many sizes alive (e.g. preview + export). */
const MAX_SIZES = 2;
const scratchBySize = new Map<string, ScratchSet>();
const toneBySize = new Map<string, ToneScratch>();

function touch<T>(map: Map<string, T>, key: string, make: () => T): T {
  let entry = map.get(key);
  if (entry) {
    // Re-insert to mark as most recently used.
    map.delete(key);
    map.set(key, entry);
    return entry;
  }
  entry = make();
  map.set(key, entry);
  while (map.size > MAX_SIZES) {
    const oldest = map.keys().next().value as string;
    map.delete(oldest);
  }
  return entry;
}

export function acquireScratch(width: number, height: number): ScratchSet {
  return touch(scratchBySize, `${width}x${height}`, () => {
    const layer = createScratchCanvas(width, height);
    const mask = createScratchCanvas(width, height);
    return { layer, layerCtx: context2d(layer), mask, maskCtx: context2d(mask) };
  });
}

export function acquireTone(width: number, height: number): ToneScratch {
  return touch(toneBySize, `${width}x${height}`, () => {
    const canvas = createScratchCanvas(width, height);
    const ctx = context2d(canvas);
    return { canvas, ctx, image: ctx.createImageData(width, height) };
  });
}

const SPRITE_SIZE = 128;
let mistSprite: AnyCanvas | null = null;

/**
 * Soft round falloff in paper white, drawn once and stretched with
 * `drawImage` for every mist wisp — replaces a fresh radial gradient and
 * a full-canvas blur per patch.
 */
export function getMistSprite(): AnyCanvas {
  if (mistSprite) return mistSprite;
  const c = createScratchCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = context2d(c);
  const r = SPRITE_SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  // Roughly gaussian falloff so stretched sprites have no visible rim.
  const stops: [number, number][] = [
    [0, 1],
    [0.2, 0.86],
    [0.4, 0.56],
    [0.6, 0.26],
    [0.8, 0.07],
    [1, 0],
  ];
  for (const [t, a] of stops) g.addColorStop(t, `rgba(250,248,245,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  mistSprite = c;
  return c;
}

const releaseHooks: (() => void)[] = [];

/** Register extra caches (e.g. mask paths) to clear on release. */
export function onRelease(hook: () => void): void {
  releaseHooks.push(hook);
}

/** Drop pooled canvases, sprites and cached mask paths. */
export function releaseInkMountResources(): void {
  scratchBySize.clear();
  toneBySize.clear();
  mistSprite = null;
  for (const hook of releaseHooks) hook();
}
