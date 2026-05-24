import { describe, expect, it } from "vitest";
import { offsetRing } from "./offset";
import { ringBBox } from "./flatten";

describe("offsetRing", () => {
  it("expands a square's bbox by ~radius on all sides", () => {
    const ring: [number, number][] = [
      [10, 10],
      [20, 10],
      [20, 20],
      [10, 20],
    ];
    const out = offsetRing(ring, 5, { segments: 16 });
    expect(out.length).toBe(1);
    const outer = out[0][0];
    const bb = ringBBox(outer);
    // Bounds should extend by ~5 on each side, give a small tolerance for the
    // 16-gon disc not being a perfect circle (cos(π/16) ≈ 0.98).
    expect(bb.x1).toBeLessThan(10);
    expect(bb.x1).toBeGreaterThan(10 - 5.5);
    expect(bb.x2).toBeGreaterThan(20);
    expect(bb.x2).toBeLessThan(20 + 5.5);
    expect(bb.y1).toBeLessThan(10);
    expect(bb.y1).toBeGreaterThan(10 - 5.5);
    expect(bb.y2).toBeGreaterThan(20);
    expect(bb.y2).toBeLessThan(20 + 5.5);
  });

  it("zero radius returns original polygon", () => {
    const ring: [number, number][] = [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
    ];
    const out = offsetRing(ring, 0);
    expect(out).toEqual([[ring]]);
  });

  it("offset of a triangle is a single connected polygon", () => {
    const ring: [number, number][] = [
      [0, 0],
      [10, 0],
      [5, 8],
    ];
    const out = offsetRing(ring, 3, { segments: 12 });
    expect(out.length).toBe(1);
    expect(out[0].length).toBe(1);
  });
});
