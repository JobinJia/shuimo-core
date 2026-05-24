import type { NormalizedCommand } from "../../internal/glyphPath";

export type Point2 = [number, number];
export type Ring = Point2[];

export interface FlattenOptions {
  /** Max perpendicular distance from a curve segment to its chord, in px. */
  tolerance?: number;
}

/**
 * Flatten normalized glyph commands to closed rings.
 * Each M starts a new ring; Z (or the next M) closes the current one.
 * Cubic / quadratic Bezier curves are subdivided adaptively against `tolerance`.
 */
export function flattenCommands(cmds: NormalizedCommand[], opts: FlattenOptions = {}): Ring[] {
  const tol = opts.tolerance ?? 0.5;
  const rings: Ring[] = [];
  let current: Ring | null = null;
  let startX = 0;
  let startY = 0;
  let prevX = 0;
  let prevY = 0;

  const ensureRing = (): Ring => {
    if (!current) current = [];
    return current;
  };

  for (const c of cmds) {
    switch (c.type) {
      case "M": {
        if (current && current.length > 1) rings.push(current);
        current = [[c.x!, c.y!]];
        startX = prevX = c.x!;
        startY = prevY = c.y!;
        break;
      }
      case "L": {
        const ring = ensureRing();
        ring.push([c.x!, c.y!]);
        prevX = c.x!;
        prevY = c.y!;
        break;
      }
      case "Q": {
        const ring = ensureRing();
        subdivideQuad(prevX, prevY, c.x1!, c.y1!, c.x!, c.y!, tol, ring);
        prevX = c.x!;
        prevY = c.y!;
        break;
      }
      case "C": {
        const ring = ensureRing();
        subdivideCubic(prevX, prevY, c.x1!, c.y1!, c.x2!, c.y2!, c.x!, c.y!, tol, ring);
        prevX = c.x!;
        prevY = c.y!;
        break;
      }
      case "Z": {
        prevX = startX;
        prevY = startY;
        break;
      }
    }
  }
  if (current && current.length > 1) rings.push(current);
  return rings;
}

function subdivideQuad(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tol: number,
  out: Point2[],
): void {
  const dx = x2 - x0;
  const dy = y2 - y0;
  const lineLen2 = dx * dx + dy * dy;
  let flat = false;
  if (lineLen2 === 0) {
    flat = Math.hypot(x1 - x0, y1 - y0) <= tol;
  } else {
    const cross = (x1 - x0) * dy - (y1 - y0) * dx;
    const dist2 = (cross * cross) / lineLen2;
    flat = dist2 <= tol * tol;
  }
  if (flat) {
    out.push([x2, y2]);
    return;
  }
  const x01 = (x0 + x1) / 2;
  const y01 = (y0 + y1) / 2;
  const x12 = (x1 + x2) / 2;
  const y12 = (y1 + y2) / 2;
  const x012 = (x01 + x12) / 2;
  const y012 = (y01 + y12) / 2;
  subdivideQuad(x0, y0, x01, y01, x012, y012, tol, out);
  subdivideQuad(x012, y012, x12, y12, x2, y2, tol, out);
}

function subdivideCubic(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  tol: number,
  out: Point2[],
): void {
  const dx = x3 - x0;
  const dy = y3 - y0;
  const lineLen2 = dx * dx + dy * dy;
  let flat = false;
  if (lineLen2 === 0) {
    const len =
      Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    flat = len <= tol;
  } else {
    const cross1 = (x1 - x0) * dy - (y1 - y0) * dx;
    const cross2 = (x2 - x0) * dy - (y2 - y0) * dx;
    const m = Math.max(Math.abs(cross1), Math.abs(cross2));
    flat = (m * m) / lineLen2 <= tol * tol;
  }
  if (flat) {
    out.push([x3, y3]);
    return;
  }
  const x01 = (x0 + x1) / 2;
  const y01 = (y0 + y1) / 2;
  const x12 = (x1 + x2) / 2;
  const y12 = (y1 + y2) / 2;
  const x23 = (x2 + x3) / 2;
  const y23 = (y2 + y3) / 2;
  const x012 = (x01 + x12) / 2;
  const y012 = (y01 + y12) / 2;
  const x123 = (x12 + x23) / 2;
  const y123 = (y12 + y23) / 2;
  const x0123 = (x012 + x123) / 2;
  const y0123 = (y012 + y123) / 2;
  subdivideCubic(x0, y0, x01, y01, x012, y012, x0123, y0123, tol, out);
  subdivideCubic(x0123, y0123, x123, y123, x23, y23, x3, y3, tol, out);
}

export function ringBBox(ring: Ring): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x1) x1 = x;
    if (x > x2) x2 = x;
    if (y < y1) y1 = y;
    if (y > y2) y2 = y;
  }
  if (x1 === Infinity) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  return { x1, y1, x2, y2 };
}

export function ringLength(ring: Ring): number {
  if (ring.length < 2) return 0;
  let len = 0;
  for (let i = 1; i < ring.length; i++) {
    const dx = ring[i][0] - ring[i - 1][0];
    const dy = ring[i][1] - ring[i - 1][1];
    len += Math.hypot(dx, dy);
  }
  const dxc = ring[0][0] - ring[ring.length - 1][0];
  const dyc = ring[0][1] - ring[ring.length - 1][1];
  len += Math.hypot(dxc, dyc);
  return len;
}
