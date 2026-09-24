import { Vector2 } from "../../../foundation/geometry/Vector2";
import { deformPolyline } from "./hobbsDeform";

/** Uniform anchor spacing of the decimated ridge, as a fraction of the span. */
const UNIFORM_ANCHORS = 15;
/** Master Hobbs amplitude relative to the average anchor segment. */
const MASTER_VARIANCE = 0.06;
const MASTER_DEPTH = 5;
export const SILHOUETTE_DECAY = 0.78;

/**
 * Mulberry32 — small, fast, deterministic PRNG with no global state.
 * (Integer-only; the previous Park–Miller `%` on doubles showed up as the
 * single hottest function when building mask edges.)
 */
export function seededRng(seed: number): () => number {
  let a = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ridgeYAt(ridgeLine: Vector2[], x: number): number {
  const n = ridgeLine.length;
  if (x <= ridgeLine[0].x) return ridgeLine[0].y;
  if (x >= ridgeLine[n - 1].x) return ridgeLine[n - 1].y;
  // Ridge points are evenly spaced in x, so the segment index is direct.
  const span = ridgeLine[n - 1].x - ridgeLine[0].x;
  const f = ((x - ridgeLine[0].x) / span) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const t = f - i;
  return ridgeLine[i].y * (1 - t) + ridgeLine[i + 1].y * t;
}

/**
 * Pick the ridge apexes worth preserving as anchors: local minima of y
 * (screen space, so peaks) that stand out from their surroundings.
 */
function findPeaks(ridgeLine: Vector2[], minProminence: number, window: number): Vector2[] {
  const peaks: Vector2[] = [];
  const n = ridgeLine.length;
  for (let i = 1; i < n - 1; i++) {
    const p = ridgeLine[i];
    let isMin = true;
    let maxAround = p.y;
    for (let j = Math.max(0, i - window); j <= Math.min(n - 1, i + window); j++) {
      if (ridgeLine[j].y < p.y) {
        isMin = false;
        break;
      }
      if (ridgeLine[j].y > maxAround) maxAround = ridgeLine[j].y;
    }
    if (isMin && maxAround - p.y >= minProminence) peaks.push(p);
  }
  return peaks;
}

/**
 * Build the Hobbs-deformed visible silhouette of a mountain layer.
 *
 * The ridge is first decimated to long anchor segments (uniform spacing
 * plus the prominent apexes, so sharp peaks survive), then recursively
 * midpoint-deformed. The anchors overscan both canvas edges so the ragged
 * side drop of the silhouette never shows inside the painting.
 *
 * The result is the single source of truth for the mountain edge: the
 * renderer's mask, the contour stroke and the cunfa placement all use it,
 * so the lines sit on the same edge as the wash.
 */
export function buildSilhouette(
  ridgeLine: Vector2[],
  width: number,
  height: number,
  seed: number,
): Vector2[] {
  if (ridgeLine.length < 2) return ridgeLine.slice();
  const overscan = Math.max(24, width * 0.03);
  const x0 = -overscan;
  const span = width + overscan * 2;
  const step = span / UNIFORM_ANCHORS;

  const peakWindow = Math.max(2, Math.round(ridgeLine.length * 0.04));
  const peaks = findPeaks(ridgeLine, height * 0.02, peakWindow);

  const xs: number[] = [];
  for (let i = 0; i <= UNIFORM_ANCHORS; i++) {
    const x = x0 + i * step;
    // Drop uniform anchors that crowd a preserved apex — a short segment
    // next to a peak would turn the Hobbs displacement into a spike.
    const nearPeak =
      i > 0 && i < UNIFORM_ANCHORS && peaks.some((p) => Math.abs(p.x - x) < step * 0.35);
    if (!nearPeak) xs.push(x);
  }
  for (const p of peaks) xs.push(p.x);
  xs.sort((a, b) => a - b);

  const anchors = xs.map((x) => new Vector2(x, ridgeYAt(ridgeLine, x)));
  const masterVar = step * MASTER_VARIANCE;
  return deformPolyline(anchors, masterVar, MASTER_DEPTH, SILHOUETTE_DECAY, seededRng(seed));
}

/** Average anchor segment length of a silhouette built for this width. */
export function silhouetteSegment(width: number): number {
  const overscan = Math.max(24, width * 0.03);
  return (width + overscan * 2) / UNIFORM_ANCHORS;
}

/**
 * Upper envelope of a silhouette sampled at every integer x in
 * [0, width]: the topmost y the edge reaches in each pixel column.
 */
export function topProfile(silhouette: Vector2[], width: number): Float32Array {
  const cols = Math.max(1, Math.ceil(width) + 1);
  const top = new Float32Array(cols).fill(Infinity);
  for (let i = 0; i < silhouette.length - 1; i++) {
    const a = silhouette[i];
    const b = silhouette[i + 1];
    const xa = Math.min(a.x, b.x);
    const xb = Math.max(a.x, b.x);
    const from = Math.max(0, Math.ceil(xa));
    const to = Math.min(cols - 1, Math.floor(xb));
    const dx = b.x - a.x;
    for (let x = from; x <= to; x++) {
      const t = dx === 0 ? 0 : (x - a.x) / dx;
      const y = a.y + (b.y - a.y) * t;
      if (y < top[x]) top[x] = y;
    }
  }
  // Fill any column the edge skipped (only possible with degenerate input).
  let last = Infinity;
  for (let x = 0; x < cols; x++) {
    if (top[x] === Infinity) top[x] = last;
    else last = top[x];
  }
  for (let x = cols - 1, next = Infinity; x >= 0; x--) {
    if (top[x] === Infinity) top[x] = next;
    else next = top[x];
  }
  return top;
}

/**
 * Box-smoothed copy of a top profile (±radius px). Thin Hobbs spikes
 * would otherwise restart the body gradient for a few columns and show
 * up as vertical streaks in the wash.
 */
export function smoothProfile(top: Float32Array, radius: number): Float32Array {
  const n = top.length;
  const out = new Float32Array(n);
  const r = Math.max(1, Math.round(radius));
  let sum = 0;
  let count = 0;
  for (let x = 0; x <= Math.min(n - 1, r); x++) {
    sum += top[x];
    count++;
  }
  for (let x = 0; x < n; x++) {
    out[x] = sum / count;
    const add = x + r + 1;
    const drop = x - r;
    if (add < n) {
      sum += top[add];
      count++;
    }
    if (drop >= 0) {
      sum -= top[drop];
      count--;
    }
  }
  return out;
}
