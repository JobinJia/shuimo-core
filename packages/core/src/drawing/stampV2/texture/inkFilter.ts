/**
 * SVG-filter-based 印泥 texture — the missing layer that made v1 visually
 * "feel like a stamp on paper" even though its geometry was simpler. Ports
 * the v1 spec's 9-step `stamp-ink-texture` chain (and the lighter border /
 * text variants) as standalone filter-def emitters that v2 can opt into per
 * mode.
 *
 * Why filter-based on top of geometric layers: feTurbulence produces dense,
 * continuous fractal noise that's expensive (and ugly) to express as
 * polygon-clipping output but trivial for the GPU/rasterizer. Reserved for
 * the things the eye reads as "paper grain" / "ink blotch" / "carved edge" —
 * the rest stays geometric so it can compose cleanly under evenodd.
 *
 * @since 2.0.4-beta.1
 * Every `baseFrequency` and pixel displacement in this module is now scaled
 * by the seal size via `internal/visualScale.ts` so the texture density and
 * relative edge bite are size-invariant. Old absolute values lived in
 * REF_SIZE = 480 space; smaller seals automatically use proportionally
 * higher frequencies and smaller displacements. See `scaleForSize()` for
 * the math.
 */
import { scaleForSize } from "../internal/visualScale";

export interface InkFilterOptions {
  /** Unique id to avoid collisions when multiple seals share a host SVG. */
  id: string;
  /** Drives feTurbulence `seed` (each sub-noise gets seed + small offset). */
  seed: number;
  /**
   * 0-1; intensity scale. 0 emits a no-op filter, 1 = v1-spec defaults.
   * Affects displacement scale + mask contrast.
   */
  intensity?: number;
  /** Stamp size in px; used to scale displacement so it looks proportional. */
  size: number;
  /** When set, use V1-style font-relative frequency scaling. */
  fontSize?: number;
}

export interface BorderFilterOptions {
  id: string;
  seed: number;
  intensity?: number;
  thickness: number;
  /**
   * Seal size in px (max of width / height). Required to size-adapt the
   * feTurbulence wavelength so the border noise pattern reads the same at
   * 200px and 480px. Defaults to REF_SIZE (frequency unchanged) for back-
   * compat with pre-2.0.4-beta.1 callers.
   */
  size?: number;
}

export interface TextFilterOptions {
  id: string;
  seed: number;
  intensity?: number;
  size: number;
  /**
   * When set, use V1-style font-relative scaling instead of stamp-size
   * scaling. Produces visible carving on SVG `<text>` elements where
   * browser text hinting absorbs the finer stamp-size-scaled values.
   */
  fontSize?: number;
}

/**
 * Body/印泥 filter for 阴章. Two-pass design:
 *
 *   1. Edge displacement — warp the silhouette so the rim reads as worn /
 *      irregular, then clip back to the original outline (so the warp can
 *      only carve INTO the source, never burst out of it).
 *   2. Low-frequency cloud mask — single fractalNoise layer turned into a
 *      smooth alpha mask via a `linear` componentTransfer. Composited `in`
 *      with the displaced shape to thin out ink-density unevenly across the
 *      body. Continuous (no `discrete` stepping) — that's specifically what
 *      avoids the polka-dot pattern v1's discrete-table-based mask produced
 *      at high intensity.
 *
 * Discrete sharp speckles ("missing ink dots") are handled by the separate
 * geometric `texture/ink.ts` layer rendered on top, not by this filter.
 */
/**
 * Faithful port of v1's 9-step `stamp-ink-texture` filter chain (spec §八).
 * The earlier "simplified" version used a single noise + linear transfer which
 * was too smooth — no visible white patches. V1's secret sauce was the
 * grain×blotch multiply + discrete alpha transfer that creates HARD cutoffs
 * where ink becomes fully transparent (= white paper showing through).
 */
export function inkFilterDefs(opts: InkFilterOptions): string {
  const id = opts.id;
  const intensity = clamp01(opts.intensity ?? 0);
  const seedB = (opts.seed | 0) + 456;
  const seedC = (opts.seed | 0) + 789;
  // Size-adaptive frequencies: at REF_SIZE these match V1's tuned values;
  // smaller seals get proportionally higher frequencies so wavelengths
  // shrink with the seal and texture density stays visually constant.
  let grainFreq: number;
  let blotchFreq: number;
  if (opts.fontSize && opts.fontSize > 0) {
    // V1-style font-relative scaling: coarser noise that reads as natural
    // ink-pad unevenness rather than dense pixel noise.
    const freqK = 70 / opts.fontSize;
    grainFreq = 0.4 * freqK;
    blotchFreq = 0.08 * freqK;
  } else {
    const { frequencyScale: rawFreqScale } = scaleForSize(opts.size);
    const frequencyScale = Math.min(rawFreqScale, 2.5);
    grainFreq = 0.25 * frequencyScale;
    blotchFreq = 0.07 * frequencyScale;
  }
  // Discrete alpha table modulated by intensity: each base value is
  // interpolated toward 1.0 (fully opaque) as intensity drops, so fewer
  // noise bins produce transparent patches. intensity=1 → V1 defaults;
  // intensity=0 → all bins opaque (no white patches).
  // V1's hardcoded table — hard zero bins create distinct white patches
  // (natural ink-pad texture). NO intensity interpolation: interpolating
  // turns zeros into semi-transparent gray, losing the sharp ink/paper
  // contrast that makes the texture read as "stamp on paper."
  const tableStr = "0 0 0 0 0.2 0.4 0.6 0.75 0.88 0.95 1 1";
  return `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
  <feTurbulence type="fractalNoise" baseFrequency="${fmt(grainFreq)}" numOctaves="3" seed="${seedB}" result="grainNoise"/>
  <feTurbulence type="turbulence" baseFrequency="${fmt(blotchFreq)}" numOctaves="2" seed="${seedC}" result="blotchNoise"/>
  <feBlend in="grainNoise" in2="blotchNoise" mode="multiply" result="combinedNoise"/>
  <feColorMatrix in="combinedNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 0" result="noiseMask"/>
  <feComponentTransfer in="noiseMask" result="contrastMask">
    <feFuncA type="discrete" tableValues="${tableStr}"/>
  </feComponentTransfer>
  <feComposite in="SourceGraphic" in2="contrastMask" operator="in" result="texturedShape"/>
  <feColorMatrix in="texturedShape" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.98 0"/>
</filter>`;
}

/**
 * Lighter filter for 阳章 border: just edge displacement (no inner texture).
 * Border is thin so we don't want to chew through it with grain.
 */
export function borderFilterDefs(opts: BorderFilterOptions): string {
  const intensity = clamp01(opts.intensity ?? 0);
  // Displacement already scales with thickness, which seal.ts derives from
  // size by default. No extra lengthScale here — would double-attenuate when
  // thickness is auto-derived, and over-attenuate when a caller pins
  // thickness deliberately.
  const displacement = opts.thickness * 0.7 * intensity;
  const seedA = (opts.seed | 0) + 123;
  // Only frequency size-adapts (so the wave count around the rim stays the
  // same across sizes). When `size` is omitted we fall back to no-op for
  // backwards compatibility.
  const { frequencyScale: rawFS } = scaleForSize(opts.size ?? 0);
  const cappedFS = Math.min(rawFS, 2.5);
  const baseFreq = 0.04 * (opts.size ? cappedFS : 1);
  return `<filter id="${opts.id}" x="-15%" y="-15%" width="130%" height="130%">
  <feTurbulence type="fractalNoise" baseFrequency="${fmt(baseFreq)}" numOctaves="3" seed="${seedA}" result="borderNoise"/>
  <feDisplacementMap in="SourceGraphic" in2="borderNoise" scale="${fmt(displacement)}" xChannelSelector="R" yChannelSelector="G" result="rawDisplaced"/>
  <feComposite in="rawDisplaced" in2="SourceGraphic" operator="in"/>
</filter>`;
}

/**
 * 刀刻 filter — direct port of V1's `stamp-text-texture` stone-cut profile.
 *
 * Three-stage chain producing the "carved into stone" look:
 *   1. Displace edge band — wobble the stroke silhouette so the rim isn't
 *      mathematically smooth (uses turbulence + posterize for stepped, blocky
 *      displacement, not soft fractal blur).
 *   2. Chip subtraction — knock out medium-scale flakes along the edge by
 *      subtracting (`operator="out"`) a thresholded turbulence mask. Reads as
 *      "chunks broken off by the chisel."
 *   3. Grain subtraction — knock out fine-scale specks by subtracting a
 *      thresholded fractalNoise mask. Reads as "stone roughness."
 *
 * Stages 2-3 are the difference between "displaced edge" (looks like a smooth
 * but warped stroke — what v2 had before) and "carved edge" (looks broken in
 * pieces — what stone actually does to ink). Drop them and you get the same
 * laser-cut appearance as a plain stroke.
 *
 * intensity ∈ [0, 1] scales: edge displacement amplitude, plus chip/grain
 * thresholds (more negative threshold → fewer pixels above cutoff → fewer
 * chips). coreErode is held constant — widening it stretches the edge band
 * into long visible fringes that read as thinning, not carving.
 */
export function textFilterDefs(opts: TextFilterOptions): string {
  const intensity = clamp01(opts.intensity ?? 0);
  const seedA = opts.seed | 0;
  const seedB = seedA + 999;
  const seedC = seedA + 321;

  let coreErode: number;
  let edgeDisp: number;
  let edgeFreq: number;
  let chipFreq: number;
  let grainFreq: number;

  if (opts.fontSize && opts.fontSize > 0) {
    // V1-style font-relative scaling: works on SVG <text> elements where
    // browser text hinting demands coarser noise and larger displacement
    // than stamp-size scaling produces.
    const REF_FONT = 70;
    const s = opts.fontSize / REF_FONT;
    const subCapped = Math.sqrt(Math.min(s, 1.5));
    const fineFreq = 1 / subCapped;
    const amplitude = subCapped;
    // V1 "normal" profile values — coarser, more readable at small sizes.
    coreErode = 0.18 * s;
    edgeDisp = 1.1 * intensity * amplitude;
    edgeFreq = 0.18 * fineFreq;
    chipFreq = 0.09 * fineFreq;
    grainFreq = 0.32 * fineFreq;
  } else {
    // Stamp-size scaling for geometric <path> rendering.
    const { lengthScale, frequencyScale: rawTFS } = scaleForSize(opts.size);
    const frequencyScale = Math.min(rawTFS, 2.5);
    coreErode = 0.12 * lengthScale;
    edgeDisp = 1.9 * intensity * lengthScale;
    edgeFreq = 0.28 * frequencyScale;
    chipFreq = 0.14 * frequencyScale;
    grainFreq = 0.46 * frequencyScale;
  }

  const chipThreshold = -0.18 - (1 - intensity) * 0.5;
  const grainThreshold = -0.5 - (1 - intensity) * 0.5;
  const alphaGain = 1 + 0.03 * intensity;
  const alphaBias = -0.04 * intensity;

  // V1 "normal" mode: fractalNoise without posterize → smooth continuous
  // displacement that works on anti-aliased <text> edges.
  // V2 "stone-cut" mode: turbulence with posterize → blocky stepped
  // displacement designed for geometric <path> edges.
  const useV1Noise = !!opts.fontSize;
  const edgeNoiseType = useV1Noise ? "fractalNoise" : "turbulence";
  const edgeNoiseRef = useV1Noise ? "textEdgeNoise" : "textEdgeNoiseStepped";

  return `<filter id="${opts.id}" x="-18%" y="-18%" width="136%" height="136%">
  <feMorphology in="SourceGraphic" operator="erode" radius="${fmt(coreErode)}" result="textCore"/>
  <feComposite in="SourceGraphic" in2="textCore" operator="out" result="textEdgeBand"/>

  <feTurbulence type="${edgeNoiseType}" baseFrequency="${fmt(edgeFreq)}" numOctaves="3" seed="${seedA}" result="textEdgeNoise"/>${useV1Noise ? "" : `
  <feComponentTransfer in="textEdgeNoise" result="textEdgeNoiseStepped">
    <feFuncR type="discrete" tableValues="0 0.18 0.18 0.5 0.5 0.82 0.82 1"/>
    <feFuncG type="discrete" tableValues="0 0.18 0.18 0.5 0.5 0.82 0.82 1"/>
    <feFuncB type="discrete" tableValues="0 0.18 0.18 0.5 0.5 0.82 0.82 1"/>
    <feFuncA type="table" tableValues="0 1"/>
  </feComponentTransfer>`}
  <feDisplacementMap in="textEdgeBand" in2="${edgeNoiseRef}" scale="${fmt(edgeDisp)}" xChannelSelector="R" yChannelSelector="G" result="textDisplacedEdgeRaw"/>
  <feComposite in="textDisplacedEdgeRaw" in2="SourceGraphic" operator="in" result="textDisplacedEdge"/>

  <feTurbulence type="turbulence" baseFrequency="${fmt(chipFreq)}" numOctaves="2" seed="${seedB}" result="textChipNoise"/>
  <feColorMatrix in="textChipNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 ${fmt(chipThreshold)}" result="textChipMaskRaw"/>
  <feComponentTransfer in="textChipMaskRaw" result="textChipMask">
    <feFuncA type="discrete" tableValues="0 0 0 1 1 1 1"/>
  </feComponentTransfer>
  <feComposite in="textDisplacedEdge" in2="textChipMask" operator="out" result="textChippedEdge"/>

  <feTurbulence type="fractalNoise" baseFrequency="${fmt(grainFreq)}" numOctaves="2" seed="${seedC}" result="textGrainNoise"/>
  <feColorMatrix in="textGrainNoise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 1 1 0 ${fmt(grainThreshold)}" result="textGrainMaskRaw"/>
  <feComponentTransfer in="textGrainMaskRaw" result="textGrainMask">
    <feFuncA type="discrete" tableValues="0 0 0 0 1 1"/>
  </feComponentTransfer>
  <feComposite in="textChippedEdge" in2="textGrainMask" operator="out" result="textCarvedEdge"/>

  <feMerge result="textCarved">
    <feMergeNode in="textCore"/>
    <feMergeNode in="textCarvedEdge"/>
  </feMerge>
  <feColorMatrix in="textCarved" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${fmt(alphaGain)} ${fmt(alphaBias)}"/>
</filter>`;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function fmt(v: number): string {
  if (Math.abs(v) < 1e-6) return "0";
  if (Math.round(v) === v) return String(Math.round(v));
  return v.toFixed(3);
}
