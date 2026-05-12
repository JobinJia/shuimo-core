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
    const mx = (A.x + C.x) / 2;
    const my = (A.y + C.y) / 2;
    out.push(A, new Vector2(mx + gaussian(rand) * variance, my + gaussian(rand) * variance));
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
