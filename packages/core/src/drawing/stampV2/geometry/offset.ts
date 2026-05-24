import type { Point2, Ring } from "./flatten";
import { union, type MultiPolygon } from "./boolean";

export interface OffsetOptions {
  segments?: number;
}

/**
 * Outward offset of a single ring by `radius` ≈ Minkowski sum with an N-gon
 * disc. Built from edge rectangles + N-gon discs at each vertex (so corners
 * are rounded). Pieces are unioned incrementally — bulk unions can trip the
 * Vatti sweep on near-degenerate seams between adjacent stadiums.
 */
export function offsetRing(ring: Ring, radius: number, opts: OffsetOptions = {}): MultiPolygon {
  if (radius <= 0 || ring.length < 2) return [[ring]];
  const segments = Math.max(8, opts.segments ?? 12);
  let acc: MultiPolygon = [[ring]];
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    acc = union(acc, [[edgeRect(ring[i], ring[j], radius)]]);
    acc = union(acc, [[discRing(ring[i], radius, segments)]]);
  }
  return acc;
}

export function offsetPolygon(
  poly: MultiPolygon,
  radius: number,
  opts: OffsetOptions = {},
): MultiPolygon {
  if (radius <= 0) return poly;
  const offsetted: MultiPolygon[] = [];
  for (const polygon of poly) {
    if (polygon.length === 0) continue;
    offsetted.push(offsetRing(polygon[0], radius, opts));
  }
  if (offsetted.length === 0) return [];
  let acc: MultiPolygon = offsetted[0];
  for (let i = 1; i < offsetted.length; i++) acc = union(acc, offsetted[i]);
  return acc;
}

function edgeRect(a: Point2, b: Point2, r: number): Ring {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) {
    // Degenerate edge — represent as a tiny square so subsequent union doesn't choke.
    return [
      [a[0] - r, a[1] - r],
      [a[0] + r, a[1] - r],
      [a[0] + r, a[1] + r],
      [a[0] - r, a[1] + r],
    ];
  }
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  return [
    [a[0] + nx * r, a[1] + ny * r],
    [b[0] + nx * r, b[1] + ny * r],
    [b[0] - nx * r, b[1] - ny * r],
    [a[0] - nx * r, a[1] - ny * r],
  ];
}

function discRing(c: Point2, r: number, segments: number): Ring {
  const ring: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    ring.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return ring;
}
