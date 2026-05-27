/**
 * Size-adaptive scaling for V2 stamp visual parameters.
 *
 * Why this exists: pre-2.0.4-beta.1, every "visual texture" parameter in the
 * V2 pipeline (carving.intensity → angularize jitter, border.roughness →
 * erosion amp, feTurbulence baseFrequency in inkFilter/borderFilter/
 * textFilter, edge displacement amounts in textFilter) was treated as an
 * absolute user-unit / pixel quantity. The same `carving.intensity: 0.9`
 * looked good at the gallery's typical 400-600px sizes but rendered as
 * "mushy" / "edge-eaten" at the 100-200px small sizes downstream consumers
 * (blog signatures, UI badges) actually use — because the absolute
 * displacement was comparable to the stroke width at small sizes but only a
 * fraction of it at large sizes.
 *
 * This module defines a single reference size and exposes a `scaleForSize()`
 * helper returning the two multipliers consumers need:
 *
 *   - `lengthScale = size / REF_SIZE`
 *     Multiplied into ANY parameter that's "an absolute distance/amplitude in
 *     user units or pixels": angularize jitter, edge displacement, erosion
 *     amplitude. At small sizes, these get proportionally smaller, so they
 *     stay the same fraction of stroke/glyph dimensions.
 *
 *   - `frequencyScale = REF_SIZE / size`
 *     Multiplied into ANY `feTurbulence baseFrequency` or simplex-noise
 *     spatial frequency. At small sizes, frequency goes UP so the noise
 *     wavelength (= 1/frequency) shrinks proportionally with the seal — the
 *     *relative* texture density stays constant rather than getting coarser.
 *
 * REF_SIZE is the user's preferred "looks good" reference. 480 chosen because
 * the V1 stone-cut profile constants in `texture/inkFilter.ts` (edgeDisp 1.9,
 * coreErode 0.12, feTurbulence baseFrequency 0.25/0.28/0.46) were tuned to
 * look right at roughly that size range. Picking 480 means callers who were
 * already happy at 400-600px see ~zero visual change; callers at 100-200px
 * stop seeing their strokes eaten.
 *
 * The public API stays unchanged: `SealOptions.carving.intensity` is still a
 * 0..1 number, `SealOptions.border.roughness` is still 0..1, etc. The
 * *semantics* shifted from "absolute" to "relative to REF_SIZE". Callers who
 * want the old absolute behaviour can multiply their value by REF_SIZE/size
 * at the call site (rare — most users were calibrating against a single size
 * anyway).
 */

/** Reference seal size in pixels. */
export const REF_SIZE = 480;

export interface VisualScale {
  /** Multiplier for length / displacement / amplitude parameters. */
  lengthScale: number;
  /** Multiplier for spatial frequency parameters (1/length). */
  frequencyScale: number;
}

/**
 * Returns scale multipliers for visual-texture parameters at the given seal
 * size. See module-level docs for the semantics of each field.
 *
 * @param size Seal size in px (typically max(width, height) of the seal).
 *             Must be positive; falls back to no-op (1, 1) for non-positive.
 */
export function scaleForSize(size: number): VisualScale {
  if (!(size > 0)) return { lengthScale: 1, frequencyScale: 1 };
  const lengthScale = size / REF_SIZE;
  // frequencyScale = 1 / lengthScale by construction. Computing as the
  // explicit ratio avoids floating-point drift at edge cases (e.g.
  // size === REF_SIZE should give exactly 1.0).
  const frequencyScale = REF_SIZE / size;
  return { lengthScale, frequencyScale };
}
