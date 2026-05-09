/* tslint:disable */
/* eslint-disable */

/**
 * Gabor noise (anisotropic fiber texture) — single sample.
 */
export function shuimo_gabor2d(seed: number, x: number, y: number, kernel_radius: number): number;

/**
 * Gabor noise batch.
 */
export function shuimo_gabor2d_batch(seed: number, xs: Float64Array, ys: Float64Array, kernel_radius: number, out: Float64Array): void;

/**
 * Initialize noise engines from a seed. Must be called before sampling.
 */
export function shuimo_noise_init(perlin_seed: number, worley_seed: number, octaves: number, falloff: number): void;

/**
 * Single 2D Perlin noise sample.
 */
export function shuimo_perlin2d(x: number, y: number): number;

/**
 * Batch 2D Perlin noise. wasm-bindgen auto-copies slices from JS.
 */
export function shuimo_perlin2d_batch(xs: Float64Array, ys: Float64Array, out: Float64Array): void;

/**
 * Single 3D Perlin noise sample.
 */
export function shuimo_perlin3d(x: number, y: number, z: number): number;

/**
 * Batch 3D Perlin noise.
 */
export function shuimo_perlin3d_batch(xs: Float64Array, ys: Float64Array, zs: Float64Array, out: Float64Array): void;

/**
 * Single Worley noise sample.
 */
export function shuimo_worley2d(x: number, y: number): number;

/**
 * Worley edge noise (F2 - F1).
 */
export function shuimo_worley_edge2d(x: number, y: number): number;

/**
 * Worley fBm (multi-octave).
 */
export function shuimo_worley_fbm2d(x: number, y: number, octaves: number, lacunarity: number, gain: number): number;

export function stamp_circle_path(radius: number, border_points: number, noise_amount: number, seed: number, regular: boolean, noise_octaves: number, noise_falloff: number): string;

export function stamp_ellipse_path(w: number, h: number, border_points: number, noise_amount: number, seed: number, regular: boolean, noise_octaves: number, noise_falloff: number): string;

export function stamp_rect_path(w: number, h: number, border_points: number, corner_radius: number, noise_amount: number, seed: number, regular: boolean, noise_octaves: number, noise_falloff: number): string;

export function stamp_square_path(size: number, border_points: number, corner_radius: number, noise_amount: number, seed: number, regular: boolean, noise_octaves: number, noise_falloff: number): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly shuimo_gabor2d: (a: number, b: number, c: number, d: number) => number;
    readonly shuimo_gabor2d_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly shuimo_noise_init: (a: number, b: number, c: number, d: number) => void;
    readonly shuimo_perlin2d: (a: number, b: number) => number;
    readonly shuimo_perlin2d_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly shuimo_perlin3d: (a: number, b: number, c: number) => number;
    readonly shuimo_perlin3d_batch: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly shuimo_worley2d: (a: number, b: number) => number;
    readonly shuimo_worley_edge2d: (a: number, b: number) => number;
    readonly shuimo_worley_fbm2d: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly stamp_circle_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly stamp_ellipse_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly stamp_rect_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly stamp_square_path: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
