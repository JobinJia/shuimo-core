import { Vector2 } from "../../../foundation/geometry/Vector2";

/** Box-Muller standard normal sample drawn from the given uniform random. */
export function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-10);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function deformOnce(poly: Vector2[], variance: number, rand: () => number): Vector2[] {
  const out: Vector2[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const A = poly[i];
    const C = poly[(i + 1) % n];
    const mx = (A.x + C.x) / 2;
    const my = (A.y + C.y) / 2;
    out.push(A, new Vector2(mx + gaussian(rand) * variance, my + gaussian(rand) * variance));
  }
  return out;
}

/**
 * Tyler Hobbs–style recursive midpoint deformation of a closed polygon.
 * Each edge is subdivided and the new midpoint is Gaussian-displaced.
 * Variance shrinks by `decay` at every recursion step.
 */
export function deformPolygon(
  poly: Vector2[],
  variance: number,
  depth: number,
  decay: number,
  rand: () => number,
): Vector2[] {
  let cur = poly;
  let v = variance;
  for (let d = 0; d < depth; d++) {
    cur = deformOnce(cur, v, rand);
    v *= decay;
  }
  return cur;
}

function deformPolylineOnce(line: Vector2[], variance: number, rand: () => number): Vector2[] {
  if (line.length < 2) return line.slice();
  const out: Vector2[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const A = line[i];
    const C = line[i + 1];
    // One Box–Muller draw yields both displacement components.
    const r = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-10))) * variance;
    const th = 2 * Math.PI * rand();
    out.push(
      A,
      new Vector2((A.x + C.x) / 2 + r * Math.cos(th), (A.y + C.y) / 2 + r * Math.sin(th)),
    );
  }
  out.push(line[line.length - 1]);
  return out;
}

/**
 * Open-polyline Hobbs deformation. Same midpoint-subdivision idea as
 * `deformPolygon`, but the path is treated as open — no wrap edge between
 * the last and first points. Used for path segments where only some parts
 * of a closed boundary should be deformed (e.g. a mountain ridge while
 * the canvas-bottom edge stays flat).
 */
export function deformPolyline(
  line: Vector2[],
  variance: number,
  depth: number,
  decay: number,
  rand: () => number,
): Vector2[] {
  let cur = line;
  let v = variance;
  for (let d = 0; d < depth; d++) {
    cur = deformPolylineOnce(cur, v, rand);
    v *= decay;
  }
  return cur;
}

/**
 * Allocation-light variant of `deformPolyline` over interleaved
 * `[x0, y0, x1, y1, …]` coordinates. Used for the renderer's many
 * jittered mask copies, where Vector2 churn dominated the cost.
 */
export function deformPolylineFlat(
  coords: Float64Array,
  variance: number,
  depth: number,
  decay: number,
  rand: () => number,
): Float64Array {
  let cur = coords;
  let v = variance;
  for (let d = 0; d < depth; d++) {
    const n = cur.length >> 1;
    if (n < 2) return cur;
    const out = new Float64Array((n * 2 - 1) * 2);
    let o = 0;
    for (let i = 0; i < n - 1; i++) {
      const ax = cur[i * 2];
      const ay = cur[i * 2 + 1];
      const cx = cur[i * 2 + 2];
      const cy = cur[i * 2 + 3];
      const r = Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-10))) * v;
      const th = 2 * Math.PI * rand();
      out[o++] = ax;
      out[o++] = ay;
      out[o++] = (ax + cx) / 2 + r * Math.cos(th);
      out[o++] = (ay + cy) / 2 + r * Math.sin(th);
    }
    out[o++] = cur[(n - 1) * 2];
    out[o++] = cur[(n - 1) * 2 + 1];
    cur = out;
    v *= decay;
  }
  return cur;
}
