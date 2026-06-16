// All tunable numeric + colour constants for the lotus species.
// Kept in one place so visual tuning never touches algorithm modules.

export const CWID = 1200;

// ── Composition ──
export const FLOWER_COUNT_MIN = 2;
export const FLOWER_COUNT_MAX = 3;
export const FLOWER_Y_MIN = CWID * 0.1;
export const FLOWER_Y_MAX = CWID * 0.3;
export const FLOWER_X_MIN_FRAC = 0.2;
export const FLOWER_X_MAX_FRAC = 0.8;
export const FLOWER_X_SPREAD_FRAC = 0.18;

export const LEAF_COUNT_MIN = 4;
export const LEAF_COUNT_MAX = 7;
export const LEAF_CLUSTER_Y_MIN = CWID * 0.55;
export const LEAF_CLUSTER_Y_MAX = CWID * 0.9;
export const LEAF_X_MIN_FRAC = 0.1;
export const LEAF_X_MAX_FRAC = 0.92;
export const LEAF_R_MIN = 90;
export const LEAF_R_MAX = 230;

// ── Colours ──
// Petal: rose hue, wash goes near-white at base → saturated rose at tip.
export const ROSE_H = 345;
// Clean white centre → vivid (but still bright) magenta tip.
export const PETAL_WASH_BASE_S = 0.04;
export const PETAL_WASH_BASE_V = 1.0;
export const PETAL_WASH_TIP_S = 0.62;
export const PETAL_WASH_TIP_V = 0.9;
export const PETAL_CONTOUR_S = 0.6;
export const PETAL_CONTOUR_V = 0.6;

// Leaf: dark ink-green boneless mass.
export const LEAF_H = 140;
export const LEAF_S_MIN = 0.15;
export const LEAF_S_MAX = 0.3;
export const LEAF_V_MIN = 0.12;
export const LEAF_V_MAX = 0.26;

// Ink: stems, spurs, splatter.
export const INK_V = 0.18;
export const SPLATTER_V = 0.08;

// ── Petal geometry ──
export const PETAL_LEN = 195;
export const PETAL_HALFW = 50;
// Beta-profile half-width: w(t) = halfW · t^a (1-t)^b / peak. PETAL_FULLNESS is
// the total a+b — lower = fuller/rounder petal, higher = pointier. widePos sets
// the peak position (a = F·widePos, b = F·(1-widePos)).
export const PETAL_FULLNESS = 2.2;
export const PETAL_WIDEPOS_MIN = 0.42;
export const PETAL_WIDEPOS_MAX = 0.55;
// Single continuous contour stroke — thin and rose (not a heavy dark outline).
export const PETAL_CONTOUR_W = 1.4;
// Many fine radial veins fanning base→tip — the defining lotus-petal feature.
export const PETAL_VEIN_W = 0.7;
export const PETAL_VEIN_COUNT_MIN = 9;
export const PETAL_VEIN_COUNT_MAX = 14;

// Contour ink-density gradient (浓淡). The outline is NOT a uniform line: it
// runs deep (saturated, dark, opaque) near the tip and along noise-driven
// patches, and pale/thin near the base — like a real loaded-then-drying brush.
// `depth` 0 = palest, 1 = deepest; S/V/A interpolate between these endpoints.
export const PETAL_CONTOUR_S_LIGHT = 0.3;
export const PETAL_CONTOUR_S_DEEP = 0.68;
export const PETAL_CONTOUR_V_LIGHT = 0.88;
export const PETAL_CONTOUR_V_DEEP = 0.64; // stays a clear rose, never maroon/black
export const PETAL_CONTOUR_A_LIGHT = 0.32;
export const PETAL_CONTOUR_A_DEEP = 0.8;
export const PETAL_CONTOUR_NOISE_FREQ = 3.0;
export const PETAL_CONTOUR_NOISE_AMP = 0.4; // how much perlin pushes depth
export const PETAL_CONTOUR_TIP_BIAS = 0.55; // how much the tip deepens depth

// Tip shape: the lotus tip is NOT a knife point. The body follows the Beta
// profile up to PETAL_TIP_ROUND_START, then the edges follow a quarter-ellipse
// cap (vertical tangent at the apex) → rounded shoulders curving over to a soft
// dome (弧度). A per-petal sideways lean of the upper petal + a subtle perlin
// warp on the whole silhouette give the hand-painted irregularity (变形).
// Tip = a moderate soft point — the middle ground between a sharp knife
// (concave) and a round dome (blunt). The cap tapers wCap → 0 as (1-u)^TAPER:
//   TAPER ≈ 1 → straight-sided clean point (the middle); <1 rounder/blunter; >1 sharper.
export const PETAL_TIP_ROUND_START = 0.8;
export const PETAL_TIP_TAPER = 0.7;
export const PETAL_TIP_LEAN_FRAC = 0.45; // max upper-petal lean, × halfW
export const PETAL_TIP_WARP_AMP = 0.05; // subtle overall width warp of the silhouette
export const PETAL_TIP_WARP_FREQ = 5.0;

// Per-edge silhouette noise: independent perlin wobble on the LEFT and RIGHT
// edges (enveloped to 0 at base & tip), so the outline isn't a perfectly smooth
// curve — a hand-painted brush edge.
export const PETAL_EDGE_NOISE_AMP = 0.22; // × halfW — visible but natural undulation
export const PETAL_EDGE_NOISE_FREQ = 4.5;

// ── Flower 3D arrangement (spherical projection into a balanced cup) ──
// Petals sit in concentric rings (outer→inner). Each has an azimuth (even
// around the ring + small jitter) and a pitch (tilt from the vertical axis —
// larger for outer rings → reflexed/outward, small for inner → upright). A
// 3D→screen projection with camera elevation PETAL_CAM turns this into a
// coherent, radially-balanced cup seen slightly from above-front; depth-sorting
// renders back→front. EVEN azimuth keeps the whole bloom symmetric (fixes the
// lopsided/"deformed" silhouette of the old per-petal-random arrangement).
export const PETAL_CAM = 0.5; // camera elevation above the flower axis (rad)
export const PETAL_FORESHORTEN_MIN = 0.4; // min width fraction for end-on petals

export interface PetalRing {
  countMin: number;
  countMax: number;
  pitch: number; // tilt from vertical (rad); larger = more reflexed/outward
  lengthScale: number;
  halfWScale: number;
  vShift: number; // outer lighter, inner deeper rose
}
export const PETAL_RINGS: PetalRing[] = [
  { countMin: 6, countMax: 7, pitch: 1.25, lengthScale: 1.0, halfWScale: 1.0, vShift: 0.05 },
  { countMin: 5, countMax: 6, pitch: 0.88, lengthScale: 0.9, halfWScale: 0.95, vShift: 0.0 },
  { countMin: 3, countMax: 4, pitch: 0.52, lengthScale: 0.78, halfWScale: 0.9, vShift: -0.05 },
  { countMin: 2, countMax: 3, pitch: 0.2, lengthScale: 0.62, halfWScale: 0.84, vShift: -0.09 },
];

// ── Stem ──
export const STEM_W = 3.6;
export const STEM_BOTTOM_OVERSHOOT = 30;
export const STEM_DRIFT_PX = 90;
export const STEM_BEND_PX = 90;
export const STEM_SPUR_MAX = 7; // 0..6 spurs per stem

// ── Splatter ──
export const SPLATTER_COUNT_MIN = 6;
export const SPLATTER_COUNT_MAX = 16;
export const SPLATTER_SPREAD_X = 220;
export const SPLATTER_SPREAD_Y = 160;

// ── Scene composition (atmospheric pond, tall vertical) ──
// A waterline divides plants (above) from their reflections (below). Each
// "stalk" is a tall stem topped by a leaf / flower / bud, placed at an x and a
// depth (0 = far/misty/pale, 1 = near/dark/sharp). Far elements fade toward the
// paper (atmospheric perspective); near elements are dark and crisp.
export const WATER_Y = CWID * 0.74;
export const STALK_COUNT_MIN = 9;
export const STALK_COUNT_MAX = 13;
export const STALK_X_MIN_FRAC = 0.06;
export const STALK_X_MAX_FRAC = 0.94;
export const STALK_TOP_MIN = CWID * 0.08; // highest a top can reach
export const STALK_TOP_MAX = CWID * 0.6; // lowest top (just above the water)
// Stalk type weights (sum need not be 1; normalised in code).
export const STALK_W_LEAF = 0.46;
export const STALK_W_FLOWER = 0.38;
export const STALK_W_BUD = 0.16;

// Depth → atmospheric alpha (whole-element opacity).
export const DEPTH_ALPHA_FAR = 0.3;
export const DEPTH_ALPHA_NEAR = 1.0;

// Big ink leaves (泼墨墨叶) — the dominant element. Neutral ink, dark in front,
// grey/faded in back; some tilted edge-on into thin ellipses.
export const LEAF_R_BIG_MIN = 120;
export const LEAF_R_BIG_MAX = 300;
export const LEAF_NEAR_V = 0.1; // dark front
export const LEAF_FAR_V = 0.46; // grey misty back
export const LEAF_NEUTRAL_S = 0.06; // near-neutral (faint green)
export const LEAF_TILT_CHANCE = 0.4; // chance a pad is seen edge-on
export const LEAF_TILT_MIN = 0.45; // y-squash for a tilted pad
export const LEAF_VEIN_COUNT_MIN = 9;
export const LEAF_VEIN_COUNT_MAX = 15;

// Flowers are small in this scene (the bloom is a detail, not the subject).
export const FLOWER_SCENE_SCALE_MIN = 0.3;
export const FLOWER_SCENE_SCALE_MAX = 0.46;

// Water reflection (flipped, squashed, faded, blurred copy below the waterline).
export const REFLECT_SQUASH = 0.55;
export const REFLECT_ALPHA = 0.2;
export const REFLECT_BLUR = 2.5;

// Falling petals (drifting pink dabs).
export const FALL_PETAL_COUNT_MIN = 5;
export const FALL_PETAL_COUNT_MAX = 12;
export const FALL_PETAL_LEN_MIN = 10;
export const FALL_PETAL_LEN_MAX = 22;
