import { describe, expect, it } from "vite-plus/test";
import { generateRidge } from "./RidgeGenerator";
import { generateInkFill } from "./InkWashLayer";

const layer = generateRidge({
  width: 800,
  height: 400,
  seed: 42,
  depth: 0.7,
  resolution: 100,
  peakCount: 1,
  sharpness: 3,
  subRidgeCount: 0,
  noiseOctaves: 6,
});

describe("InkWashLayer", () => {
  it("generates a gradient with increasing opacity from top to bottom", () => {
    const fill = generateInkFill({ layer, seed: 42, splashCount: 3 });

    expect(fill.gradient.length).toBeGreaterThanOrEqual(2);
    const first = fill.gradient[0];
    const last = fill.gradient[fill.gradient.length - 1];
    expect(last.opacity).toBeGreaterThan(first.opacity);
  });

  it("returns no splash regions (edge-bleed moved to silhouette mask)", () => {
    const fill = generateInkFill({ layer, seed: 99, splashCount: 5 });
    // Splash blobs were retired in favour of a Hobbs edge mask drawn by
    // the renderer over the mountain silhouette.
    expect(fill.splashes.length).toBe(0);
  });

  it("is deterministic for the same seed", () => {
    const input = { layer, seed: 123, splashCount: 4 };
    const fill1 = generateInkFill(input);
    const fill2 = generateInkFill(input);

    expect(fill1.gradient.length).toBe(fill2.gradient.length);
    for (let i = 0; i < fill1.gradient.length; i++) {
      expect(fill1.gradient[i].stop).toBe(fill2.gradient[i].stop);
      expect(fill1.gradient[i].opacity).toBe(fill2.gradient[i].opacity);
    }

    expect(fill1.splashes.length).toBe(fill2.splashes.length);
    for (let i = 0; i < fill1.splashes.length; i++) {
      expect(fill1.splashes[i].length).toBe(fill2.splashes[i].length);
      for (let j = 0; j < fill1.splashes[i].length; j++) {
        expect(fill1.splashes[i][j].x).toBe(fill2.splashes[i][j].x);
        expect(fill1.splashes[i][j].y).toBe(fill2.splashes[i][j].y);
      }
    }

    expect(fill1.noiseSeed).toBe(fill2.noiseSeed);
  });
});
