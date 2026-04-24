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

  it('replaces every fill:white / fill="white" with a transparent fill', () => {
    const result = PaintingGenerator.landscape({
      width: 1200,
      height: 800,
      onXuanPaper: false,
      transparent: true,
      seed: 42,
      minCounts: { mount: 3, distmount: 1 },
    });

    expect(result.svg).not.toContain("fill:white");
    expect(result.svg).not.toContain('fill="white"');
    expect(result.svg).not.toContain("fill='white'");
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
    expect(result.svg).not.toContain("fill:white");
  });
});
