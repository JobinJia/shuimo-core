// Paper tone field shared by the WASM wrapper, the JS fallback and the SVG
// renderer's low-frequency raster.
//
// The per-pixel math mirrors `wasm/xuan-paper-tone/src/lib.rs` step by step:
// same lattice tables (f32), same cosine LUT, same grid strides, same hash.
// Keep the two in sync when changing either.
import type { TileRegion, XuanPaperScene } from "./types";

const PERLIN_SIZE = 4095;
const COS_LUT_SIZE = 1024;

export const TONE_FREQ = 0.004;
export const TONE_STRIDE = 16;
export const FORM_LOW_FREQ = 0.018;
export const FORM_LOW_STRIDE = 4;
export const FORM_MID_FREQ = 0.07;
export const FORM_MID_STRIDE = 2;
const FORM_HI_FREQ = 0.22;
const DETAIL_FREQ = 0.55;
export const PATINA_FREQ = 0.006;
export const PATINA_STRIDE = 8;

export const TONE_MEAN = 0.5 * (0.5 + 0.25 + 0.125 + 0.0625);
export const FORM_MEAN = 0.5 * (0.5 + 0.275 + 0.15125);
const FORM_HI_MEAN = 0.5 * (0.5 + 0.275);
const DETAIL_MEAN = 0.5 * (0.5 + 0.24);

export const FORM_LOW_W = 0.58;
export const FORM_MID_W = 0.26;
const FORM_HI_W = 0.16;

// Ageing tint per unit of patina amount (subtracted from r, g, b).
export const PATINA_TINT: readonly [number, number, number] = [6, 11, 22];

let cosLut: Float64Array | null = null;

function getCosLut(): Float64Array {
  if (!cosLut) {
    cosLut = new Float64Array(COS_LUT_SIZE + 1);
    for (let i = 0; i <= COS_LUT_SIZE; i++) {
      cosLut[i] = 0.5 * (1 - Math.cos((i / COS_LUT_SIZE) * Math.PI));
    }
  }
  return cosLut;
}

/** p5-style value noise with an f32 lattice, identical to the Rust `ValueNoise`. */
export class PaperValueNoise {
  private readonly table: Float32Array;
  private readonly lut: Float64Array;

  constructor(seed: number) {
    this.lut = getCosLut();
    this.table = new Float32Array(PERLIN_SIZE + 1);
    let z = seed >>> 0;
    for (let i = 0; i <= PERLIN_SIZE; i++) {
      z = (Math.imul(1664525, z) + 1013904223) >>> 0;
      this.table[i] = z / 4294967296;
    }
  }

  noise(x: number, y: number, octaves: number, falloff: number): number {
    const lut = this.lut;
    const t = this.table;
    x = Math.abs(x);
    y = Math.abs(y);
    let xi = Math.floor(x);
    let yi = Math.floor(y);
    let xf = x - xi;
    let yf = y - yi;
    let r = 0;
    let ampl = 0.5;

    for (let o = 0; o < octaves; o++) {
      const of = xi + yi * 16;
      const sx = xf * COS_LUT_SIZE;
      const ix = sx | 0;
      const rxf =
        ix >= COS_LUT_SIZE ? lut[COS_LUT_SIZE]! : lut[ix]! + (sx - ix) * (lut[ix + 1]! - lut[ix]!);
      const sy = yf * COS_LUT_SIZE;
      const iy = sy | 0;
      const ryf =
        iy >= COS_LUT_SIZE ? lut[COS_LUT_SIZE]! : lut[iy]! + (sy - iy) * (lut[iy + 1]! - lut[iy]!);

      const v0 = t[of & PERLIN_SIZE]!;
      const v1 = t[(of + 1) & PERLIN_SIZE]!;
      const v2 = t[(of + 16) & PERLIN_SIZE]!;
      const v3 = t[(of + 17) & PERLIN_SIZE]!;
      const n1 = v0 + rxf * (v1 - v0);
      const n2 = v2 + rxf * (v3 - v2);
      r += (n1 + ryf * (n2 - n1)) * ampl;
      ampl *= falloff;

      xi *= 2;
      xf *= 2;
      yi *= 2;
      yf *= 2;
      if (xf >= 1) {
        xi += 1;
        xf -= 1;
      }
      if (yf >= 1) {
        yi += 1;
        yf -= 1;
      }
    }
    return r;
  }
}

/** Integer hash → two uniforms in [0, 1). Mirrors `hash_pair` in lib.rs. */
function hashPair(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export interface PaperToneParams {
  baseR: number;
  baseG: number;
  baseB: number;
  textureBoost: number;
  grainBoost: number;
  absorbencyBoost: number;
  /** Ageing strength (age × patinaStrength); 0 disables the ageing field. */
  ageAmount: number;
  /** Deckle feather roughness, or -1 when the sheet has no deckle edge. */
  deckleRough: number;
}

/**
 * Scalar parameters of the tone pass. Contrast is ~2.5× the pre-2.x tone pass,
 * which left an 800×600 sheet with only ~9 distinct red values.
 */
export function paperToneParams(scene: XuanPaperScene): PaperToneParams {
  const { baseColor, textureIntensity, grainDensity, age } = scene.options;
  const { profile } = scene;
  const warmth = profile.warmth * 5 + age * 6 * profile.patinaStrength;
  return {
    baseR: baseColor[0] + warmth * 0.8,
    baseG: baseColor[1] + warmth * 0.4,
    baseB: baseColor[2] - warmth,
    textureBoost: textureIntensity * 64 * profile.formationContrast,
    grainBoost: (grainDensity * 34) / profile.grainSoftness,
    absorbencyBoost: profile.absorbency * 13,
    ageAmount: age * profile.patinaStrength,
    deckleRough: scene.deckleOutline ? scene.options.deckleRoughness : -1,
  };
}

/** Patina field (stains + edge browning) at global pixel (x, y), before × ageAmount. */
export function patinaAt(
  aging: PaperValueNoise,
  x: number,
  y: number,
  fullW: number,
  fullH: number,
): number {
  const edgeScale = 1 / (0.07 * Math.max(1, Math.min(fullW, fullH)));
  const p = aging.noise(x * PATINA_FREQ, y * PATINA_FREQ, 4, 0.52);
  const stain = smoothstep(0.36, 0.68, p);
  const d = Math.max(0, Math.min(x, y, fullW - 1 - x, fullH - 1 - y));
  const edge = Math.exp(-d * edgeScale);
  return stain * 0.55 + edge * (0.45 + 0.5 * p);
}

/** Coarse field grid aligned to multiples of `stride` in global pixel space. */
class Grid {
  stride = 1;
  ox = 0;
  oy = 0;
  nx = 0;
  ny = 0;
  data = new Float32Array(0);

  fill(
    stride: number,
    tileX: number,
    tileY: number,
    w: number,
    h: number,
    f: (x: number, y: number) => number,
  ): void {
    this.stride = stride;
    this.ox = Math.floor(tileX / stride) * stride;
    this.oy = Math.floor(tileY / stride) * stride;
    this.nx = Math.floor((tileX + w - 1 - this.ox) / stride) + 2;
    this.ny = Math.floor((tileY + h - 1 - this.oy) / stride) + 2;
    this.data = new Float32Array(this.nx * this.ny);
    let k = 0;
    for (let j = 0; j < this.ny; j++) {
      const gy = this.oy + j * stride;
      for (let i = 0; i < this.nx; i++) {
        this.data[k++] = f(this.ox + i * stride, gy);
      }
    }
  }

  addRow(row: Float64Array, tileX: number, gy: number, weight: number): void {
    if (this.nx === 0) return;
    const s = this.stride;
    const inv = 1 / s;
    const ly = gy - this.oy;
    const j = Math.floor(ly / s);
    const ty = (ly - j * s) * inv;
    const r0 = j * this.nx;
    const r1 = r0 + this.nx;
    const d = this.data;
    // Walk cells incrementally instead of dividing per pixel.
    const gx0 = tileX - this.ox;
    let i = Math.floor(gx0 / s);
    let k = gx0 - i * s;
    let a = d[r0 + i]! + ty * (d[r1 + i]! - d[r0 + i]!);
    let b = d[r0 + i + 1]! + ty * (d[r1 + i + 1]! - d[r0 + i + 1]!);
    for (let lx = 0; lx < row.length; lx++) {
      row[lx] = row[lx]! + weight * (a + k * inv * (b - a));
      k++;
      if (k === s) {
        k = 0;
        i++;
        a = b;
        if (i + 1 < this.nx) {
          b = d[r0 + i + 1]! + ty * (d[r1 + i + 1]! - d[r0 + i + 1]!);
        }
      }
    }
  }
}

function deckleErase(pos: number, inset: number, rough: number): number {
  if (inset <= 0 || pos >= inset) return 0;
  const t = pos / inset;
  const mid = 0.58 * rough;
  return t < 0.52 ? 1 + (mid - 1) * (t / 0.52) : mid * (1 - (t - 0.52) / 0.48);
}

/** Round an outline array to f32 like the WASM path does. */
function f32(values: number[]): Float32Array {
  return Float32Array.from(values);
}

/**
 * Pure-JS tone pass. Used when WebAssembly is unavailable; produces the same
 * image as `render_paper_tone` (up to last-bit float differences).
 */
export function renderPaperToneJS(
  scene: XuanPaperScene,
  tile: TileRegion | null,
): Uint8ClampedArray {
  const { width: fullW, height: fullH } = scene.options;
  const w = tile ? tile.width : fullW;
  const h = tile ? tile.height : fullH;
  const tx0 = tile ? tile.x : 0;
  const ty0 = tile ? tile.y : 0;
  const p = paperToneParams(scene);
  const out = new Uint8ClampedArray(w * h * 4);
  if (w === 0 || h === 0) return out;

  const useTexture = p.textureBoost !== 0;
  const useGrain = p.grainBoost !== 0;
  const useAge = p.ageAmount > 0;
  const formation = useTexture ? new PaperValueNoise(scene.seeds.formation) : null;
  const detail = useGrain ? new PaperValueNoise(scene.seeds.detail) : null;
  const detailSeed = scene.seeds.detail | 0;

  const toneGrid = new Grid();
  if (p.absorbencyBoost !== 0) {
    const tone = new PaperValueNoise(scene.seeds.tone);
    toneGrid.fill(TONE_STRIDE, tx0, ty0, w, h, (x, y) =>
      Math.fround(tone.noise(x * TONE_FREQ, y * TONE_FREQ, 4, 0.5) - TONE_MEAN),
    );
  }
  const formLow = new Grid();
  const formMid = new Grid();
  if (formation) {
    formLow.fill(FORM_LOW_STRIDE, tx0, ty0, w, h, (x, y) =>
      Math.fround(formation.noise(x * FORM_LOW_FREQ, y * FORM_LOW_FREQ, 3, 0.55) - FORM_MEAN),
    );
    formMid.fill(FORM_MID_STRIDE, tx0, ty0, w, h, (x, y) =>
      Math.fround(
        formation.noise(x * FORM_MID_FREQ + 20, y * FORM_MID_FREQ + 20, 3, 0.55) - FORM_MEAN,
      ),
    );
  }
  const patina = new Grid();
  if (useAge) {
    const aging = new PaperValueNoise(scene.seeds.aging);
    patina.fill(PATINA_STRIDE, tx0, ty0, w, h, (x, y) => patinaAt(aging, x, y, fullW, fullH));
  }

  const outline = p.deckleRough >= 0 ? scene.deckleOutline : null;
  const top = outline ? f32(outline.top) : null;
  const bottom = outline ? f32(outline.bottom) : null;
  const left = outline ? f32(outline.left) : null;
  const right = outline ? f32(outline.right) : null;

  const rowLum = new Float64Array(w);
  const rowPatina = new Float64Array(w);
  const [tr, tg, tb] = PATINA_TINT;

  for (let ly = 0; ly < h; ly++) {
    const gy = ty0 + ly;
    rowLum.fill(0);
    toneGrid.addRow(rowLum, tx0, gy, p.absorbencyBoost);
    formLow.addRow(rowLum, tx0, gy, FORM_LOW_W * p.textureBoost);
    formMid.addRow(rowLum, tx0, gy, FORM_MID_W * p.textureBoost);
    if (useAge) {
      rowPatina.fill(0);
      patina.addRow(rowPatina, tx0, gy, p.ageAmount);
    }

    for (let lx = 0; lx < w; lx++) {
      const gx = tx0 + lx;
      const hash = hashPair(gx, gy, detailSeed);
      const uGrain = (hash & 0xffff) / 65536;
      const uDither = (hash >>> 16) / 65536;

      let v = rowLum[lx]!;
      if (formation) {
        const hi =
          formation.noise(gx * FORM_HI_FREQ + 40, gy * FORM_HI_FREQ + 40, 2, 0.55) - FORM_HI_MEAN;
        v += hi * FORM_HI_W * p.textureBoost;
      }
      if (detail) {
        const g =
          detail.noise(gx * DETAIL_FREQ, gy * DETAIL_FREQ, 2, 0.48) -
          DETAIL_MEAN +
          (uGrain - 0.5) * 0.14;
        v += g * p.grainBoost;
      }

      let r = p.baseR + v;
      let g = p.baseG + v;
      let b = p.baseB + v;
      if (useAge) {
        const a = rowPatina[lx]!;
        r -= a * tr;
        g -= a * tg;
        b -= a * tb;
      }

      const d = uDither - 0.5;
      const i = (ly * w + lx) * 4;
      out[i] = Math.round(Math.min(255, Math.max(0, r + d)));
      out[i + 1] = Math.round(Math.min(255, Math.max(0, g + d)));
      out[i + 2] = Math.round(Math.min(255, Math.max(0, b + d)));

      let alpha = 1;
      if (top && bottom && left && right) {
        const py = gy + 0.5;
        const px = gx + 0.5;
        alpha *= 1 - deckleErase(py, top[Math.min(gx, fullW)]!, p.deckleRough);
        alpha *= 1 - deckleErase(fullH - py, bottom[Math.min(gx, fullW)]!, p.deckleRough);
        alpha *= 1 - deckleErase(px, left[Math.min(gy, fullH)]!, p.deckleRough);
        alpha *= 1 - deckleErase(fullW - px, right[Math.min(gy, fullH)]!, p.deckleRough);
      }
      out[i + 3] = Math.round(alpha * 255);
    }
  }

  return out;
}

export interface LowFrequencyTone {
  rgb: Uint8Array;
  width: number;
  height: number;
  stride: number;
}

/**
 * Low-frequency part of the tone pass (tone wave, coarse formation, ageing)
 * sampled at pixel centres of a `stride`-sized grid. The SVG renderer embeds it
 * as a tiny raster that the browser upsamples bilinearly; the finer bands are
 * approximated with a stitched feTurbulence tile. `lift` brightens every
 * sample to compensate for the darkening grain overlay.
 */
export function renderLowFrequencyTone(
  scene: XuanPaperScene,
  stride: number,
  lift: number,
): LowFrequencyTone {
  const { width: fullW, height: fullH } = scene.options;
  const p = paperToneParams(scene);
  const width = Math.ceil(fullW / stride);
  const height = Math.ceil(fullH / stride);
  const tone = p.absorbencyBoost !== 0 ? new PaperValueNoise(scene.seeds.tone) : null;
  const formation = p.textureBoost !== 0 ? new PaperValueNoise(scene.seeds.formation) : null;
  const aging = p.ageAmount > 0 ? new PaperValueNoise(scene.seeds.aging) : null;
  const [tr, tg, tb] = PATINA_TINT;
  const rgb = new Uint8Array(width * height * 3);

  let k = 0;
  for (let j = 0; j < height; j++) {
    const y = Math.min(fullH - 1, (j + 0.5) * stride);
    for (let i = 0; i < width; i++) {
      const x = Math.min(fullW - 1, (i + 0.5) * stride);
      let v = lift;
      if (tone) {
        v += (tone.noise(x * TONE_FREQ, y * TONE_FREQ, 4, 0.5) - TONE_MEAN) * p.absorbencyBoost;
      }
      if (formation) {
        // Two octaves only: the third is finer than the raster can hold.
        const f = formation.noise(x * FORM_LOW_FREQ, y * FORM_LOW_FREQ, 2, 0.55);
        v += (f - 0.5 * (0.5 + 0.275)) * FORM_LOW_W * p.textureBoost;
      }
      let a = 0;
      if (aging) {
        a = patinaAt(aging, x, y, fullW, fullH) * p.ageAmount;
      }
      rgb[k++] = Math.round(Math.min(255, Math.max(0, p.baseR + v - a * tr)));
      rgb[k++] = Math.round(Math.min(255, Math.max(0, p.baseG + v - a * tg)));
      rgb[k++] = Math.round(Math.min(255, Math.max(0, p.baseB + v - a * tb)));
    }
  }
  return { rgb, width, height, stride };
}
