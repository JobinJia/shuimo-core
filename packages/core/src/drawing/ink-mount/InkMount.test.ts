import { describe, expect, it } from "vite-plus/test";
import { InkMount } from "./InkMount";

describe("InkMount", () => {
  it("generates a complete scene with default options", () => {
    const scene = InkMount.generateScene({
      width: 800,
      height: 600,
      seed: 42,
    });

    expect(scene.layers.length).toBeGreaterThan(0);
    expect(scene.strokes.length).toBe(scene.layers.length);
    expect(scene.fills.length).toBe(scene.layers.length);
    expect(scene.mists.length).toBeGreaterThan(0);
    expect(scene.width).toBe(800);
    expect(scene.height).toBe(600);
  });

  it("respects explicit layer count", () => {
    const scene = InkMount.generateScene({
      width: 800,
      height: 600,
      seed: 42,
      layers: 3,
    });

    expect(scene.layers.length).toBe(3);
  });

  it("auto-calculates layer count based on height", () => {
    const sceneTall = InkMount.generateScene({
      width: 800,
      height: 1000,
      seed: 42,
    });
    const sceneShort = InkMount.generateScene({
      width: 800,
      height: 200,
      seed: 42,
    });

    expect(sceneTall.layers.length).toBeGreaterThan(sceneShort.layers.length);
  });

  it("generates a single layer for composability", () => {
    const scene = InkMount.generateLayerScene({
      width: 800,
      height: 600,
      seed: 42,
      depth: 0.7,
    });

    expect(scene.layers.length).toBe(1);
    expect(scene.layers[0].depth).toBe(0.7);
  });
});
