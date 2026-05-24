import { describe, expect, it } from "vitest";
import { union, difference, intersection, asMultiPolygon, ringsToPolygon } from "./boolean";

const square = (x: number, y: number, s: number): [number, number][] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];

describe("boolean ops", () => {
  it("A ∪ A simplifies to A (single polygon)", () => {
    const a = asMultiPolygon(square(0, 0, 10));
    const u = union(a, a);
    expect(u).toHaveLength(1);
    expect(u[0]).toHaveLength(1);
    // polygon-clipping emits self-closing rings (first vertex repeated as last).
    expect(u[0][0].length).toBeGreaterThanOrEqual(4);
    expect(u[0][0].length).toBeLessThanOrEqual(5);
  });

  it("A \\ A is empty", () => {
    const a = asMultiPolygon(square(0, 0, 10));
    const d = difference(a, a);
    expect(d).toEqual([]);
  });

  it("union of two overlapping squares yields one polygon", () => {
    const a = asMultiPolygon(square(0, 0, 10));
    const b = asMultiPolygon(square(5, 5, 10));
    const u = union(a, b);
    expect(u).toHaveLength(1);
    expect(u[0]).toHaveLength(1);
  });

  it("intersection of two overlapping squares is the overlap rectangle", () => {
    const a = asMultiPolygon(square(0, 0, 10));
    const b = asMultiPolygon(square(5, 5, 10));
    const i = intersection(a, b);
    expect(i).toHaveLength(1);
    const outer = i[0][0];
    const xs = outer.map((p) => p[0]).sort((a, b) => a - b);
    const ys = outer.map((p) => p[1]).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(5, 6);
    expect(xs[xs.length - 1]).toBeCloseTo(10, 6);
    expect(ys[0]).toBeCloseTo(5, 6);
    expect(ys[ys.length - 1]).toBeCloseTo(10, 6);
  });

  it("polygon with hole survives difference round-trip", () => {
    const ring = ringsToPolygon(square(0, 0, 20), [
      square(5, 5, 10).slice().reverse() as [number, number][],
    ]);
    const back = union(ring, ring);
    expect(back).toHaveLength(1);
    expect(back[0].length).toBe(2); // outer + hole
  });
});
