import type { NormalizedCommand, BoundingBox } from "../../internal/glyphPath";
import type { PRNG } from "../../../foundation/random/prng";

/**
 * Per-seed "hand-carved" variation of one glyph (@since 3.0.0).
 *
 * Before 3.0.0 the only seed-dependent glyph geometry was the per-coordinate
 * angularize jitter (±0.45 px on a 480 px seal), so two seeds produced
 * practically the same seal (mean coordinate difference 0.30 px). A real
 * carver never cuts the same character twice: each glyph sits slightly off
 * its cell centre, leans a little, and its long strokes bow. This stage adds
 * exactly that, as three low-frequency terms, all proportional to the glyph
 * / cell size so the effect is size-invariant:
 *
 *   - offset: up to ±1.2% of the cell per axis
 *   - tilt:   up to ±1.3° about the glyph centre
 *   - warp:   a smooth two-term sine displacement field, amplitude ≈3% of
 *             the glyph half-size, wavelength ≈ the glyph size — strokes bow,
 *             they do not wiggle
 *
 * Control points go through the same transform as on-curve points, so
 * curves stay smooth. `amount` scales all three (0 = identity).
 */
export interface GlyphVariationOptions {
  /** 0..2; 1 = default strength. */
  amount: number;
  /** Cell size (user units) used for the offset term. */
  cellW: number;
  cellH: number;
  bbox: BoundingBox;
}

const MAX_OFFSET = 0.012;
const MAX_TILT = (1.3 * Math.PI) / 180;
const WARP = 0.03;

export function varyGlyph(
  commands: NormalizedCommand[],
  opts: GlyphVariationOptions,
  prng: PRNG,
): NormalizedCommand[] {
  const amount = opts.amount;
  if (!(amount > 0) || commands.length === 0) return commands;
  const bb = opts.bbox;
  const cx = (bb.x1 + bb.x2) / 2;
  const cy = (bb.y1 + bb.y2) / 2;
  const half = Math.max(bb.x2 - bb.x1, bb.y2 - bb.y1) / 2;
  if (!(half > 0)) return commands;

  const sym = () => prng.next() * 2 - 1;
  const ox = sym() * MAX_OFFSET * opts.cellW * amount;
  const oy = sym() * MAX_OFFSET * opts.cellH * amount;
  const theta = sym() * MAX_TILT * amount;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const amp = WARP * half * amount;
  const p1 = prng.next() * Math.PI * 2;
  const p2 = prng.next() * Math.PI * 2;
  const p3 = prng.next() * Math.PI * 2;
  const p4 = prng.next() * Math.PI * 2;
  const k1 = 1.8 + prng.next() * 0.9;
  const k2 = 2.6 + prng.next() * 1.0;

  const tx = (x: number, y: number): number => {
    const u = (x - cx) / half;
    const v = (y - cy) / half;
    const wx = amp * (0.7 * Math.sin(k1 * v + p1) + 0.3 * Math.sin(k2 * (u + v) + p2));
    return cx + (x - cx) * cos - (y - cy) * sin + wx + ox;
  };
  const ty = (x: number, y: number): number => {
    const u = (x - cx) / half;
    const v = (y - cy) / half;
    const wy = amp * (0.7 * Math.sin(k1 * u + p3) + 0.3 * Math.sin(k2 * (u - v) + p4));
    return cy + (x - cx) * sin + (y - cy) * cos + wy + oy;
  };

  const out: NormalizedCommand[] = new Array(commands.length);
  for (let i = 0; i < commands.length; i++) {
    const c = commands[i];
    const n: NormalizedCommand = { type: c.type };
    if (c.x != null && c.y != null) {
      n.x = tx(c.x, c.y);
      n.y = ty(c.x, c.y);
    }
    if (c.x1 != null && c.y1 != null) {
      n.x1 = tx(c.x1, c.y1);
      n.y1 = ty(c.x1, c.y1);
    }
    if (c.x2 != null && c.y2 != null) {
      n.x2 = tx(c.x2, c.y2);
      n.y2 = ty(c.x2, c.y2);
    }
    out[i] = n;
  }
  return out;
}
