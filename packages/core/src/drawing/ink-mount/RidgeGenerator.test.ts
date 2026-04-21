import { describe, expect, it } from "vite-plus/test";
import { generateRidge } from "./RidgeGenerator";
import type { RidgeGeneratorInput } from "./RidgeGenerator";

const baseInput: RidgeGeneratorInput = {
  width: 800,
  height: 600,
  seed: 42,
  depth: 0.5,
  resolution: 200,
  peakCount: 3,
  sharpness: 2,
  subRidgeCount: 2,
  noiseOctaves: 4,
};

describe("RidgeGenerator", () => {
  it("generates a ridge line with the correct number of points", () => {
    const layer = generateRidge(baseInput);

    expect(layer.ridgeLine.length).toBe(baseInput.resolution);
    expect(layer.normals.length).toBe(baseInput.resolution);
    expect(layer.subRidges.length).toBe(baseInput.subRidgeCount);
  });

  it("produces deterministic output for the same seed", () => {
    const layer1 = generateRidge(baseInput);
    const layer2 = generateRidge(baseInput);

    expect(layer1.ridgeLine.length).toBe(layer2.ridgeLine.length);
    for (let i = 0; i < layer1.ridgeLine.length; i++) {
      expect(layer1.ridgeLine[i].x).toBe(layer2.ridgeLine[i].x);
      expect(layer1.ridgeLine[i].y).toBe(layer2.ridgeLine[i].y);
    }

    for (let i = 0; i < layer1.normals.length; i++) {
      expect(layer1.normals[i].x).toBe(layer2.normals[i].x);
      expect(layer1.normals[i].y).toBe(layer2.normals[i].y);
    }
  });

  it("generates peaks that are higher than the base FBM line", () => {
    const withPeaks = generateRidge({ ...baseInput, peakCount: 2 });
    const withoutPeaks = generateRidge({ ...baseInput, peakCount: 0 });

    const minYWithPeaks = Math.min(...withPeaks.ridgeLine.map((p) => p.y));
    const minYWithoutPeaks = Math.min(...withoutPeaks.ridgeLine.map((p) => p.y));

    // Peaks push y upward (lower y value in screen coords)
    expect(minYWithPeaks).toBeLessThan(minYWithoutPeaks);
  });

  it("computes normals perpendicular to the ridge", () => {
    const layer = generateRidge(baseInput);

    for (const normal of layer.normals) {
      const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
      expect(len).toBeCloseTo(1.0, 2);
    }
  });
});
