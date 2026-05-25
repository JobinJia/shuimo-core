import type { Ring } from "../geometry/flatten";
import type { MultiPolygon } from "../geometry/boolean";
import type { SealShape } from "../types";

export interface BorderRings {
  outer: Ring;
  inner: Ring;
  thickness: number;
}

export interface ShapeBuildOptions {
  /** Outer width of the border bounding box in user units. */
  width: number;
  /** Outer height of the border bounding box in user units. */
  height: number;
  thickness: number;
  /** Corner radius in px. 0 = sharp corners. Default derived from size. */
  cornerRadius?: number;
  /** Segments per rounded corner arc. Default 8. */
  cornerSegments?: number;
  circleSegments?: number;
  /** PRNG for per-corner radius randomization (±20% per v1 spec). */
  prng?: { next(): number };
}

export function buildBorder(shape: SealShape, opts: ShapeBuildOptions): BorderRings {
  switch (shape.kind) {
    case "auto":
      return autoBorder(opts);
    case "square":
      return squareBorder(opts);
    case "circle":
      return circleBorder(opts);
    case "rect":
      return rectBorder(opts);
    case "ellipse":
      return ellipseBorder(opts);
    case "polygon":
      return polygonBorder(opts, shape.sides, shape.orientation ?? "flat-top");
    case "irregular":
      // Irregular geometry is generated downstream (seal.ts applies extra
      // erosion via border/erosion.ts). The base ring here is just a square
      // — erosion does the hand-hewn look.
      return rectBorder(opts);
  }
}

/**
 * 梯形 (auto) — v1's default shape. Left and right heights differ slightly,
 * producing a subtle trapezoid that reads as hand-carved. The asymmetry is
 * seeded so it's reproducible.
 */
export function autoBorder(opts: ShapeBuildOptions): BorderRings {
  // "auto" today degrades to a plain rounded rect (the user's text grid
  // already drives seal dimensions; auto means "let it adapt"). The earlier
  // trapezoid variant is intentionally retired — kept as separate impl
  // below so it can be re-introduced behind an explicit shape kind later.
  return rectBorder(opts);
}

export function autoBorderTrapezoid(opts: ShapeBuildOptions): BorderRings {
  const { width, height, thickness } = opts;
  const prng = opts.prng;
  const r = opts.cornerRadius ?? 0;
  const segs = opts.cornerSegments ?? 8;
  const hRight = height * (prng ? 0.97 + prng.next() * 0.06 : 1);
  const hLeft = height * (prng ? 0.97 + prng.next() * 0.06 : 1);
  const radii = randomizeCornerRadii(r, prng);
  const outer = trapezoidRing(0, 0, width, hRight, hLeft, radii, segs);
  const innerRadii = radii.map((v) => Math.max(0, v - thickness)) as CornerRadii;
  const inner = trapezoidRing(
    thickness,
    thickness,
    width - thickness,
    hRight - thickness,
    hLeft - thickness,
    innerRadii,
    segs,
  );
  return { outer, inner, thickness };
}

function trapezoidRing(
  x1: number,
  y1: number,
  x2: number,
  hRight: number,
  hLeft: number,
  radii: CornerRadii,
  segs: number,
): Ring {
  const w = x2 - x1;
  const half = Math.min(w, Math.min(hRight, hLeft) - y1) / 2;
  const [rtl, rtr, rbr, rbl] = radii.map((v) => Math.max(0, Math.min(v, half)));
  const ring: Ring = [];
  // TL
  arcPoints(ring, x1 + rtl, y1 + rtl, rtl, Math.PI, Math.PI * 1.5, segs);
  // TR
  arcPoints(ring, x2 - rtr, y1 + rtr, rtr, Math.PI * 1.5, Math.PI * 2, segs);
  // BR at hRight
  arcPoints(ring, x2 - rbr, hRight - rbr, rbr, 0, Math.PI * 0.5, segs);
  // BL at hLeft
  arcPoints(ring, x1 + rbl, hLeft - rbl, rbl, Math.PI * 0.5, Math.PI, segs);
  return ring;
}

export function squareBorder(opts: ShapeBuildOptions): BorderRings {
  // Squares share the rounded-rect path; caller is responsible for passing
  // equal width/height when they want a true square outline.
  return rectBorder(opts);
}

export function rectBorder(opts: ShapeBuildOptions): BorderRings {
  const { width: w, height: h, thickness } = opts;
  const r = opts.cornerRadius ?? 0;
  const segs = opts.cornerSegments ?? 8;
  const radii = randomizeCornerRadii(r, opts.prng);
  const outer = roundedRectRing(0, 0, w, h, radii, segs);
  const innerRadii = radii.map((v) => Math.max(0, v - thickness)) as CornerRadii;
  const inner = roundedRectRing(thickness, thickness, w - thickness, h - thickness, innerRadii, segs);
  return { outer, inner, thickness };
}

type CornerRadii = [number, number, number, number];

function randomizeCornerRadii(base: number, prng?: { next(): number }): CornerRadii {
  if (base <= 0 || !prng) return [base, base, base, base];
  return [
    base * (0.8 + prng.next() * 0.4),
    base * (0.8 + prng.next() * 0.4),
    base * (0.8 + prng.next() * 0.4),
    base * (0.8 + prng.next() * 0.4),
  ];
}

/**
 * Generate a CW (screen y-down) rounded-rectangle ring. When `r=0`, falls
 * back to a plain 4-vertex rectangle — this keeps the sharp-corner case
 * identical to Phase 1 output (no regression).
 */
function roundedRectRing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  radii: CornerRadii,
  segs: number,
): Ring {
  const w = x2 - x1;
  const h = y2 - y1;
  const half = Math.min(w, h) / 2;
  const [rtl, rtr, rbr, rbl] = radii.map((v) => Math.max(0, Math.min(v, half)));
  if (rtl + rtr + rbr + rbl <= 0) {
    return [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
    ];
  }
  const ring: Ring = [];
  arcPoints(ring, x1 + rtl, y1 + rtl, rtl, Math.PI, Math.PI * 1.5, segs);
  arcPoints(ring, x2 - rtr, y1 + rtr, rtr, Math.PI * 1.5, Math.PI * 2, segs);
  arcPoints(ring, x2 - rbr, y2 - rbr, rbr, 0, Math.PI * 0.5, segs);
  arcPoints(ring, x1 + rbl, y2 - rbl, rbl, Math.PI * 0.5, Math.PI, segs);
  return ring;
}

function arcPoints(
  ring: Ring,
  cx: number,
  cy: number,
  r: number,
  startA: number,
  endA: number,
  segs: number,
): void {
  for (let i = 0; i <= segs; i++) {
    const a = startA + ((endA - startA) * i) / segs;
    ring.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
}

export function circleBorder(opts: ShapeBuildOptions): BorderRings {
  // Circles share the ellipse path; caller is responsible for passing equal
  // width/height to get a true circle.
  return ellipseBorder(opts);
}

export function ellipseBorder(opts: ShapeBuildOptions): BorderRings {
  const { width: w, height: h, thickness } = opts;
  const segments = opts.circleSegments ?? 96;
  const cx = w / 2;
  const cy = h / 2;
  const rxOuter = w / 2;
  const ryOuter = h / 2;
  const rxInner = Math.max(0, rxOuter - thickness);
  const ryInner = Math.max(0, ryOuter - thickness);
  const outer: Ring = [];
  const inner: Ring = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2 - Math.PI / 2;
    outer.push([cx + Math.cos(a) * rxOuter, cy + Math.sin(a) * ryOuter]);
    inner.push([cx + Math.cos(a) * rxInner, cy + Math.sin(a) * ryInner]);
  }
  return { outer, inner, thickness };
}

/**
 * Regular N-gon border centered in the (width, height) box. Vertices ride on
 * the inscribed ellipse so width/height stretching produces an oval-ish
 * polygon (useful when shape.aspect ≠ 1). Inner ring is the same polygon
 * shrunk by `thickness` along each radius.
 */
export function polygonBorder(
  opts: ShapeBuildOptions,
  sides: number,
  orientation: "flat-top" | "point-top",
): BorderRings {
  const { width: w, height: h, thickness } = opts;
  const n = Math.max(3, Math.floor(sides));
  const cx = w / 2;
  const cy = h / 2;
  // Rotation: point-top puts vertex 0 at top (-π/2). flat-top rotates by half
  // an angle so the FIRST EDGE is centered at top (a horizontal segment).
  const baseRotation = -Math.PI / 2;
  const rotation = orientation === "flat-top" ? baseRotation + Math.PI / n : baseRotation;
  const outer: Ring = [];
  const inner: Ring = [];
  // Inner ring: pull every radius in by `thickness`. Approximation; for
  // moderately thick borders this is visually indistinguishable from an
  // exact inset polygon (which would require offsetting along edge normals,
  // not vertex normals — overkill at our thickness range).
  const rxOuter = w / 2;
  const ryOuter = h / 2;
  const rxInner = Math.max(0, rxOuter - thickness);
  const ryInner = Math.max(0, ryOuter - thickness);
  for (let i = 0; i < n; i++) {
    const a = rotation + (i / n) * Math.PI * 2;
    outer.push([cx + Math.cos(a) * rxOuter, cy + Math.sin(a) * ryOuter]);
    inner.push([cx + Math.cos(a) * rxInner, cy + Math.sin(a) * ryInner]);
  }
  return { outer, inner, thickness };
}

/** Border as polygon-with-hole MultiPolygon (outer ring + inner ring as hole). */
export function borderPolygon(rings: BorderRings): MultiPolygon {
  return [[rings.outer, rings.inner.slice().reverse()]];
}

/** Stamp dimensions implied by a shape, used by the renderer for viewBox. */
export function shapeBox(shape: SealShape, size: number, border?: BorderRings): { width: number; height: number } {
  switch (shape.kind) {
    case "auto": {
      if (border) {
        const bb = ringBBoxFromRing(border.outer);
        return { width: bb.x2 - bb.x1, height: bb.y2 - bb.y1 };
      }
      return { width: size, height: size };
    }
    case "rect":
      return { width: size, height: size / Math.max(0.1, shape.aspect ?? 1.4) };
    case "ellipse":
      return { width: size, height: size / Math.max(0.1, shape.aspect ?? 1.4) };
    default:
      return { width: size, height: size };
  }
}

function ringBBoxFromRing(ring: Ring): { x1: number; y1: number; x2: number; y2: number } {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of ring) {
    if (x < x1) x1 = x;
    if (x > x2) x2 = x;
    if (y < y1) y1 = y;
    if (y > y2) y2 = y;
  }
  return { x1, y1, x2, y2 };
}
