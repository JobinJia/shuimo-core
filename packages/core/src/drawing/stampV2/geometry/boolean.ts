import polygonClipping from "polygon-clipping";
import type { Ring } from "./flatten";

export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

type PCGeom = Polygon | MultiPolygon;

export function union(...geoms: PCGeom[]): MultiPolygon {
  if (geoms.length === 0) return [];
  const [first, ...rest] = geoms;
  return polygonClipping.union(first, ...rest) as MultiPolygon;
}

export function difference(subject: PCGeom, ...clips: PCGeom[]): MultiPolygon {
  return polygonClipping.difference(subject, ...clips) as MultiPolygon;
}

export function intersection(...geoms: PCGeom[]): MultiPolygon {
  if (geoms.length === 0) return [];
  const [first, ...rest] = geoms;
  return polygonClipping.intersection(first, ...rest) as MultiPolygon;
}

export function xor(...geoms: PCGeom[]): MultiPolygon {
  if (geoms.length === 0) return [];
  const [first, ...rest] = geoms;
  return polygonClipping.xor(first, ...rest) as MultiPolygon;
}

/** Wrap a single ring as a MultiPolygon (no holes). */
export function asMultiPolygon(ring: Ring): MultiPolygon {
  return [[ring]];
}

/** Outer ring + zero or more holes → MultiPolygon. */
export function ringsToPolygon(outer: Ring, holes: Ring[] = []): MultiPolygon {
  return [[outer, ...holes]];
}
