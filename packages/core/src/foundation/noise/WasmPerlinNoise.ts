/**
 * WASM-backed PerlinNoise — drop-in replacement for the JS implementation.
 * Sync-initialized from embedded base64 WASM bytes.
 */

import { prng } from "../random";
import { initSync, shuimo_noise_init, shuimo_perlin2d, shuimo_perlin3d } from "../../../wasm/shuimo-noise/pkg/shuimo_noise";
import { WASM_NOISE_BASE64 } from "./wasm-noise-data";

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

  /** Lazy-init: matches JS PerlinNoise behavior — fills table from PRNG on first use */
  private ensureInit(): void {
    if (this.wasmInitDone) return;
    // Seed from PRNG state (matching JS lazy-init from prng.random())
    const seed = Math.floor(prng.random() * 2147483647);
    this.currentSeed = seed;
    shuimo_noise_init(seed, seed + 1, this.perlinOctaves as number, this.perlinFalloff);
    this.wasmInitDone = true;
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

  /** Configure octaves and falloff */
  noiseDetail(lod: number, falloff: number): void {
    if (lod > 0) this.perlinOctaves = lod;
    if (falloff > 0) this.perlinFalloff = falloff;
    if (this.wasmInitDone) {
      shuimo_noise_init(this.currentSeed, this.currentSeed + 1, this.perlinOctaves as number, this.perlinFalloff);
    }
  }
}
