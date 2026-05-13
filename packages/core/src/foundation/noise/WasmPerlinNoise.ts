/**
 * WASM-backed PerlinNoise — drop-in replacement for the JS implementation.
 * Sync-initialized from embedded base64 WASM bytes.
 */

import { prng } from "../random";
import {
  initSync,
  shuimo_noise_init,
  shuimo_perlin2d,
  shuimo_perlin3d,
  shuimo_perlin_init_from_table,
  shuimo_perlin_set_detail,
} from "../../../wasm/shuimo-noise/pkg/shuimo_noise";
import { WASM_NOISE_BASE64 } from "./wasm-noise-data";

const PERLIN_TABLE_LEN = 4096; // matches Rust TABLE_LEN = PERLIN_SIZE + 1

let wasmReady = false;

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function ensureWasm(): void {
  if (wasmReady) return;
  initSync({ module: b64ToBuf(WASM_NOISE_BASE64) });
  wasmReady = true;
}

export class WasmPerlinNoise {
  private perlinOctaves = 4;
  private perlinFalloff = 0.5;
  private currentSeed = 0;
  private wasmInitDone = false;

  constructor() {
    ensureWasm();
  }

  /** Lazy-init: matches JS PerlinNoise.noise() lazy init — fills the perlin table by
   *  4096 sequential prng.random() calls (not by an internal LCG seeded from one value).
   *  Without this, WASM produces a systematically-biased table vs the JS path even at
   *  identical seeds, which shows up as right-shoulder cliffs on every mountain peak. */
  private ensureInit(): void {
    if (this.wasmInitDone) return;
    const table = new Float64Array(PERLIN_TABLE_LEN);
    for (let i = 0; i < PERLIN_TABLE_LEN; i++) {
      table[i] = prng.random();
    }
    shuimo_perlin_init_from_table(table, this.perlinOctaves, this.perlinFalloff);
    this.wasmInitDone = true;
    this.currentSeed = 0; // unused on this path; kept for noiseSeed() back-compat
  }

  /** Matches JS PerlinNoise.noise(x, y, z) */
  noise(x: number, y: number = 0, z: number = 0): number {
    this.ensureInit();
    if (z === 0) return shuimo_perlin2d(x, y);
    return shuimo_perlin3d(x, y, z);
  }

  /** Reset noise table — forces reinit from current PRNG state on next noise() */
  reset(): void {
    this.perlinOctaves = 4;
    this.perlinFalloff = 0.5;
    this.wasmInitDone = false;
  }

  /** Seed the noise for reproducibility */
  noiseSeed(seed: number): void {
    this.currentSeed = seed;
    shuimo_noise_init(seed, seed + 1, this.perlinOctaves as number, this.perlinFalloff);
    this.wasmInitDone = true;
  }

  /** Configure octaves and falloff — sampling-time knobs, table is NOT rebuilt
   *  (rebuilding would lose the prng-derived lazy-init table values). */
  noiseDetail(lod: number, falloff: number): void {
    if (lod > 0) this.perlinOctaves = lod;
    if (falloff > 0) this.perlinFalloff = falloff;
    if (this.wasmInitDone) {
      shuimo_perlin_set_detail(this.perlinOctaves, this.perlinFalloff);
    }
  }
}
