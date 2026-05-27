import { describe, expect, it } from "vitest";
import { REF_SIZE, scaleForSize } from "./visualScale";

describe("scaleForSize", () => {
  it("returns (1, 1) at the reference size", () => {
    const s = scaleForSize(REF_SIZE);
    expect(s.lengthScale).toBe(1);
    expect(s.frequencyScale).toBe(1);
  });

  it("halves length and doubles frequency at half the reference size", () => {
    const s = scaleForSize(REF_SIZE / 2);
    expect(s.lengthScale).toBeCloseTo(0.5, 10);
    expect(s.frequencyScale).toBeCloseTo(2, 10);
  });

  it("doubles length and halves frequency at twice the reference size", () => {
    const s = scaleForSize(REF_SIZE * 2);
    expect(s.lengthScale).toBeCloseTo(2, 10);
    expect(s.frequencyScale).toBeCloseTo(0.5, 10);
  });

  it("length × frequency ≈ 1 across the supported range", () => {
    for (const size of [100, 160, 200, 280, 360, 480, 600, 800]) {
      const s = scaleForSize(size);
      expect(s.lengthScale * s.frequencyScale).toBeCloseTo(1, 10);
    }
  });

  it("falls back to (1, 1) for non-positive size (defensive no-op)", () => {
    expect(scaleForSize(0)).toEqual({ lengthScale: 1, frequencyScale: 1 });
    expect(scaleForSize(-1)).toEqual({ lengthScale: 1, frequencyScale: 1 });
    expect(scaleForSize(NaN)).toEqual({ lengthScale: 1, frequencyScale: 1 });
  });
});
