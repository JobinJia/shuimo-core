import { describe, expect, it } from "vite-plus/test";
import { PaintingGenerator } from "./PaintingGenerator";
import { noise } from "../foundation/noise";

// Warm up the noise table so tests see deterministic seed → output mapping.
noise.noise(0, 0);

describe("PaintingGenerator default (opaque) mode", () => {
  it("emits root <svg> with mix-blend-mode:multiply style", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      seed: 42,
      minCounts: { mount: 2 },
    });

    expect(result.svg).toMatch(/<svg\b[^>]*style="[^"]*mix-blend-mode:multiply;[^"]*"/);
  });

  it("emits fill:white occlusions in landscape content", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      seed: 42,
      minCounts: { mount: 2 },
    });

    expect(result.svg).toContain("fill:white");
  });

  it("renders mountain vegetation after terrain occlusion masks", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      seed: 42,
      minCounts: { mount: 3, flatmount: 2 },
    });

    const baseLayer = result.svg.indexOf('data-shuimo-layer="terrain-base"');
    const overlayLayer = result.svg.indexOf('data-shuimo-layer="terrain-overlay"');
    expect(baseLayer).toBeGreaterThan(-1);
    expect(overlayLayer).toBeGreaterThan(baseLayer);
    expect(result.svg.slice(baseLayer, overlayLayer)).toContain("fill:white");
  });

  it("can omit selected landscape elements at render time", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      seed: 42,
      minCounts: { distmount: 2, boat: 1, water: 1 },
      renderElements: {
        distmount: false,
        boat: false,
      },
    });

    expect(result.svg).not.toContain('data-shuimo-element="distmount"');
    expect(result.svg).not.toContain('data-shuimo-element="boat"');
    expect(result.svg).toContain('data-shuimo-element="water"');
  });

  it("renders an explicit boat shortfall reliably across hero-like seeds", () => {
    for (const seed of [1, 2, 3, 4, 5, 8, 13, 21]) {
      const result = PaintingGenerator.landscape({
        width: 2560,
        height: 1000,
        onXuanPaper: false,
        seed,
        minCounts: { mount: 6, flatmount: 3, arch01: 2, arch03: 1, water: 1, boat: 1 },
        renderElements: {
          distmount: false,
          water: true,
          boat: true,
        },
      });

      expect(result.svg.includes('data-shuimo-element="boat"'), `seed ${seed}`).toBe(true);
    }
  });

  it("threads placement.explicitWaterBand.yRange through landscape generation", () => {
    const result = PaintingGenerator.landscape({
      width: 2560,
      height: 800,
      onXuanPaper: false,
      seed: 42,
      minCounts: { water: 1, boat: 1 },
      renderElements: {
        water: true,
        boat: true,
      },
      placement: {
        explicitWaterBand: {
          yRange: [700, 760],
        },
      },
    });

    const boatPoints = result.svg.match(/data-shuimo-element="boat"[\s\S]*?points=' ([^']+)/)?.[1] ?? "";
    const yValues = [...boatPoints.matchAll(/,(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    expect(yValues.length).toBeGreaterThan(0);
    expect(Math.min(...yValues)).toBeGreaterThanOrEqual(695);
    expect(Math.max(...yValues)).toBeLessThanOrEqual(770);
  });

  it("defaults every landscape element to visible", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      seed: 42,
      minCounts: { distmount: 2 },
    });

    expect(result.svg).toContain('data-shuimo-element="distmount"');
  });
});

describe("PaintingGenerator transparent mode", () => {
  it("omits mix-blend-mode:multiply on the root <svg> element", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      transparent: true,
      seed: 42,
      minCounts: { mount: 2 },
    });

    const rootTag = result.svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
    expect(rootTag).not.toMatch(/mix-blend-mode/);
  });

  it("preserves fill:white occlusions so mountain layering stays intact", () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      transparent: true,
      seed: 42,
      minCounts: { mount: 3, distmount: 1 },
    });

    expect(result.svg).toMatch(/fill:white|fill="white"|fill='white'/);
  });

  it("is opt-in: default generate() still produces opaque multiply output", () => {
    const result = PaintingGenerator.generate({
      type: "landscape",
      width: 800,
      height: 600,
      onXuanPaper: false,
      seed: 7,
      minCounts: { mount: 1 },
    });

    expect(result.svg).toMatch(/<svg\b[^>]*style="[^"]*mix-blend-mode:multiply;[^"]*"/);
  });

  it("threads transparent through the landscape() convenience method", () => {
    const result = PaintingGenerator.landscape({
      width: 800,
      height: 600,
      onXuanPaper: false,
      transparent: true,
      seed: 7,
      minCounts: { mount: 1 },
    });

    const rootTag = result.svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
    expect(rootTag).not.toMatch(/mix-blend-mode/);
    expect(result.svg).toMatch(/fill:white|fill="white"|fill='white'/);
  });
});
