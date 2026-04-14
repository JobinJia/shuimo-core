import { describe, expect, it } from "vite-plus/test";
import { generateRidge } from "./RidgeGenerator";
import { generateCunFaStrokes } from "./CunFaEngine";
import type { CunFaEngineInput } from "./CunFaEngine";

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

describe("CunFaEngine", () => {
  it("generates strokes with paths that have multiple points", () => {
    const input: CunFaEngineInput = {
      layer,
      seed: 42,
      density: 0.5,
      lengthRange: [10, 40],
      pressureCurve: [0.3, 1.0, 0.3],
    };

    const strokes = generateCunFaStrokes(input);

    expect(strokes.length).toBeGreaterThan(0);
    for (const stroke of strokes) {
      expect(stroke.path.length).toBeGreaterThanOrEqual(2);
      expect(stroke.widths.length).toBe(stroke.path.length);
      expect(stroke.opacity).toBeGreaterThan(0);
      expect(stroke.opacity).toBeLessThanOrEqual(1);
    }
  });

  it("produces more strokes at higher density", () => {
    const lowDensity = generateCunFaStrokes({
      layer,
      seed: 42,
      density: 0.2,
      lengthRange: [10, 40],
      pressureCurve: [0.3, 1.0, 0.3],
    });

    const highDensity = generateCunFaStrokes({
      layer,
      seed: 42,
      density: 0.8,
      lengthRange: [10, 40],
      pressureCurve: [0.3, 1.0, 0.3],
    });

    expect(highDensity.length).toBeGreaterThan(lowDensity.length);
  });

  it("is deterministic for the same seed", () => {
    const input: CunFaEngineInput = {
      layer,
      seed: 99,
      density: 0.5,
      lengthRange: [10, 40],
      pressureCurve: [0.3, 1.0, 0.3],
    };

    const strokes1 = generateCunFaStrokes(input);
    const strokes2 = generateCunFaStrokes(input);

    expect(strokes1.length).toBe(strokes2.length);
    for (let i = 0; i < strokes1.length; i++) {
      expect(strokes1[i].path.length).toBe(strokes2[i].path.length);
      expect(strokes1[i].opacity).toBe(strokes2[i].opacity);
      for (let j = 0; j < strokes1[i].path.length; j++) {
        expect(strokes1[i].path[j].x).toBe(strokes2[i].path[j].x);
        expect(strokes1[i].path[j].y).toBe(strokes2[i].path[j].y);
        expect(strokes1[i].widths[j]).toBe(strokes2[i].widths[j]);
      }
    }
  });
});
