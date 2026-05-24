/**
 * WASM noise engine — batch-optimized Perlin, Worley, Gabor noise.
 * The Rust shuimo-noise module handles up to 3-5x faster than JS for batch ops.
 *
 * Usage:
 *   import { initWasmNoiseEngine } from '@shuimo/core/foundation';
 *
 *   // Load WASM module (call once)
 *   await initWasmNoiseEngine({ wasmUrl: '/shuimo_noise_bg.wasm' });
 *
 *   // Use synchronously after init
 *   const noise = new WasmNoise({ perlinSeed: 1234, worleySeed: 5678 });
 *   const v = noise.perlin2d(x, y);
 *   noise.perlin2dBatch(xs, ys, out);
 */

let NoiseWasm: {
  initSync: (input: { module: BufferSource | WebAssembly.Module }) => void;
  shuimo_noise_init: (ps: number, ws: number, o: number, f: number) => void;
  shuimo_perlin2d: (x: number, y: number) => number;
  shuimo_perlin2d_batch: (xs: Float64Array, ys: Float64Array, o: Float64Array) => void;
  shuimo_perlin3d: (x: number, y: number, z: number) => number;
  shuimo_perlin3d_batch: (
    xs: Float64Array,
    ys: Float64Array,
    zs: Float64Array,
    o: Float64Array,
  ) => void;
  shuimo_worley2d: (x: number, y: number) => number;
  shuimo_worley_edge2d: (x: number, y: number) => number;
  shuimo_worley_fbm2d: (x: number, y: number, oct: number, lac: number, g: number) => number;
  shuimo_gabor2d: (seed: number, x: number, y: number, kr: number) => number;
  shuimo_gabor2d_batch: (
    s: number,
    xs: Float64Array,
    ys: Float64Array,
    kr: number,
    o: Float64Array,
  ) => void;
} | null = null;

let initPromise: Promise<void> | null = null;

export interface WasmNoiseInitOptions {
  /** URL to the JS glue. Default: `./wasm/shuimo_noise.js` (relative to dist) */
  jsUrl?: string;
  /** URL to the WASM binary. Default: `./wasm/shuimo_noise_bg.wasm` (relative to dist) */
  wasmUrl?: string;
}

/**
 * Initialize the WASM noise engine. Call once before using WasmNoise.
 * The JS glue and WASM binary are copied to dist/wasm/ during build.
 */
export async function initWasmNoiseEngine(options: WasmNoiseInitOptions = {}): Promise<void> {
  if (NoiseWasm) return;
  if (!initPromise) {
    initPromise = (async () => {
      const jsUrl = options.jsUrl ?? "./wasm/shuimo_noise.js";
      const wasmUrl = options.wasmUrl ?? "./wasm/shuimo_noise_bg.wasm";
      const mod = await import(/* @vite-ignore */ jsUrl);
      const resp = await fetch(wasmUrl);
      const buf = await resp.arrayBuffer();
      mod.initSync({ module: buf });
      NoiseWasm = mod as typeof NoiseWasm;
    })();
  }
  await initPromise;
}

export interface WasmNoiseOptions {
  perlinSeed?: number;
  worleySeed?: number;
  octaves?: number;
  falloff?: number;
}

export class WasmNoise {
  constructor(options: WasmNoiseOptions = {}) {
    if (!NoiseWasm) {
      throw new Error("WASM noise engine not initialized. Call initWasmNoiseEngine() first.");
    }
    NoiseWasm.shuimo_noise_init(
      options.perlinSeed ?? 12345,
      options.worleySeed ?? options.perlinSeed ?? 12346,
      options.octaves ?? 4,
      options.falloff ?? 0.5,
    );
  }

  reinit(options: WasmNoiseOptions = {}): void {
    NoiseWasm!.shuimo_noise_init(
      options.perlinSeed ?? 12345,
      options.worleySeed ?? options.perlinSeed ?? 12346,
      options.octaves ?? 4,
      options.falloff ?? 0.5,
    );
  }

  // ---- Perlin 2D ----

  perlin2d(x: number, y: number): number {
    return NoiseWasm!.shuimo_perlin2d(x, y);
  }

  /** Batch 2D Perlin. xs, ys, out must be same-length Float64Array. */
  perlin2dBatch(xs: Float64Array, ys: Float64Array, out: Float64Array): void {
    NoiseWasm!.shuimo_perlin2d_batch(xs, ys, out);
  }

  // ---- Perlin 3D ----

  perlin3d(x: number, y: number, z: number): number {
    return NoiseWasm!.shuimo_perlin3d(x, y, z);
  }

  perlin3dBatch(xs: Float64Array, ys: Float64Array, zs: Float64Array, out: Float64Array): void {
    NoiseWasm!.shuimo_perlin3d_batch(xs, ys, zs, out);
  }

  // ---- Worley ----

  worley2d(x: number, y: number): number {
    return NoiseWasm!.shuimo_worley2d(x, y);
  }

  worleyEdge2d(x: number, y: number): number {
    return NoiseWasm!.shuimo_worley_edge2d(x, y);
  }

  worleyFbm2d(x: number, y: number, octaves: number, lacunarity: number, gain: number): number {
    return NoiseWasm!.shuimo_worley_fbm2d(x, y, octaves, lacunarity, gain);
  }

  // ---- Gabor (stateless per-sample) ----

  gabor2d(seed: number, x: number, y: number, kernelRadius: number = 2.5): number {
    return NoiseWasm!.shuimo_gabor2d(seed, x, y, kernelRadius);
  }

  gabor2dBatch(
    seed: number,
    xs: Float64Array,
    ys: Float64Array,
    kernelRadius: number,
    out: Float64Array,
  ): void {
    NoiseWasm!.shuimo_gabor2d_batch(seed, xs, ys, kernelRadius, out);
  }
}

/** Return a shared WasmNoise instance, creating if needed. */
let sharedInstance: WasmNoise | null = null;

export function getSharedWasmNoise(options?: WasmNoiseOptions): WasmNoise {
  if (!sharedInstance) {
    sharedInstance = new WasmNoise(options);
  }
  return sharedInstance;
}
