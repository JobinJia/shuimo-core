/**
 * WASM-accelerated stamp border path generation.
 * Uses Rust shuimo-noise for Perlin-noise-distorted SVG paths.
 */

import { initSync } from "../../wasm/shuimo-noise/pkg/shuimo_noise";
import {
  stamp_square_path,
  stamp_rect_path,
  stamp_circle_path,
  stamp_ellipse_path,
} from "../../wasm/shuimo-noise/pkg/shuimo_noise";
import { WASM_NOISE_BASE64 } from "../foundation/noise/wasm-noise-data";

let wasmReady = false;
function ensureStampWasm(): void {
  if (wasmReady) return;
  const bin = atob(WASM_NOISE_BASE64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  initSync(buf.buffer);
  wasmReady = true;
}

export function wasmSquarePath(
  size: number,
  borderPoints: number,
  cornerRadius: number,
  noiseAmount: number,
  seed: number,
  regular: boolean,
): string {
  ensureStampWasm();
  return stamp_square_path(
    size, borderPoints, cornerRadius, noiseAmount,
    seed >>> 0, regular, 4, 0.5,
  );
}

export function wasmRectPath(
  width: number,
  height: number,
  borderPoints: number,
  cornerRadius: number,
  noiseAmount: number,
  seed: number,
  regular: boolean,
): string {
  ensureStampWasm();
  return stamp_rect_path(
    width, height, borderPoints, cornerRadius, noiseAmount,
    seed >>> 0, regular, 4, 0.5,
  );
}

export function wasmCirclePath(
  radius: number,
  borderPoints: number,
  noiseAmount: number,
  seed: number,
  regular: boolean,
): string {
  ensureStampWasm();
  return stamp_circle_path(
    radius, borderPoints, noiseAmount,
    seed >>> 0, regular, 4, 0.5,
  );
}

export function wasmEllipsePath(
  width: number,
  height: number,
  borderPoints: number,
  noiseAmount: number,
  seed: number,
  regular: boolean,
): string {
  ensureStampWasm();
  return stamp_ellipse_path(
    width, height, borderPoints, noiseAmount,
    seed >>> 0, regular, 4, 0.5,
  );
}
