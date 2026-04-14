import { describe, expect, it } from "vite-plus/test";
import { generateRidge } from "./RidgeGenerator";
import { generateMist } from "./MistLayer";

const layers = [0.2, 0.5, 0.8].map(depth =>
  generateRidge({
    width: 800,
    height: 400,
    seed: 42,
    depth,
    resolution: 100,
    peakCount: 1,
    sharpness: 3,
    subRidgeCount: 0,
    noiseOctaves: 6,
  }),
);

describe("MistLayer", () => {
  it("generates mist regions between mountain layers", () => {
    const mists = generateMist({
      layers,
      width: 800,
      height: 400,
      seed: 42,
      opacity: 0.6,
      frequency: 1.0,
      coverage: 0.5,
    });

    expect(mists.length).toBeGreaterThan(0);
    for (const mist of mists) {
      expect(mist.contour.length).toBeGreaterThanOrEqual(4);
      expect(mist.opacity).toBeGreaterThan(0);
      expect(mist.opacity).toBeLessThanOrEqual(1);
      expect(mist.fadeRadius).toBeGreaterThan(0);
    }
  });

  it("respects coverage parameter", () => {
    const mistLow = generateMist({
      layers,
      width: 800,
      height: 400,
      seed: 42,
      opacity: 0.6,
      frequency: 1.0,
      coverage: 0.2,
    });

    const mistHigh = generateMist({
      layers,
      width: 800,
      height: 400,
      seed: 42,
      opacity: 0.6,
      frequency: 1.0,
      coverage: 0.9,
    });

    const totalPointsLow = mistLow.reduce((sum, m) => sum + m.contour.length, 0);
    const totalPointsHigh = mistHigh.reduce((sum, m) => sum + m.contour.length, 0);

    expect(totalPointsHigh).toBeGreaterThanOrEqual(totalPointsLow);
  });
});
