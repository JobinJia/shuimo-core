import { describe, expect, it } from "vite-plus/test";
import { GoldFleckColors, XuanPaper, XuanPaperColors } from "./XuanPaper";
import { renderXuanPaperToCanvas } from "./xuan-paper/canvas-renderer";
import { buildXuanPaperScene } from "./xuan-paper/model";
import { DEFAULT_BASE_COLOR } from "./xuan-paper/presets";
import type { XuanPaperOptions } from "./xuan-paper/types";

function occupiedGoldBuckets(
  width: number,
  height: number,
  scene = buildXuanPaperScene({ width, height, goldFlecks: true, goldDensity: 0.5, seed: 1 }),
): number {
  const buckets = new Set<string>();

  for (const fleck of scene.goldFlecks) {
    const first = fleck.commands[0];
    if (!first || first.type !== "M") {
      continue;
    }
    const bucketX = Math.min(7, Math.floor((first.x / width) * 8));
    const bucketY = Math.min(7, Math.floor((first.y / height) * 8));
    buckets.add(`${bucketX}:${bucketY}`);
  }

  return buckets.size;
}

describe("XuanPaper", () => {
  it("keeps explicit defaults equivalent to omitted defaults", () => {
    const implicit = buildXuanPaperScene({
      width: 180,
      height: 120,
      seed: 42,
    });

    const explicit = buildXuanPaperScene({
      width: 180,
      height: 120,
      baseColor: XuanPaperColors.processed,
      fiberDensity: 1,
      fiberScale: 1,
      textureIntensity: 0.3,
      grainDensity: 0.5,
      age: 0,
      deckleEdge: false,
      deckleRoughness: 0.5,
      goldFlecks: false,
      goldDensity: 0.5,
      goldSize: [2, 12],
      goldColor: GoldFleckColors.gold,
      goldClustering: 0.3,
      seed: 42,
    });

    expect(implicit).toEqual(explicit);
  });

  it("produces deterministic shared scene data for the same seed", () => {
    const a = buildXuanPaperScene({
      width: 160,
      height: 96,
      seed: 99,
      goldFlecks: true,
      age: 0.3,
    });

    const b = buildXuanPaperScene({
      width: 160,
      height: 96,
      seed: 99,
      goldFlecks: true,
      age: 0.3,
    });

    expect(a).toEqual(b);
  });

  it("keeps cached scene data isolated from caller mutation", () => {
    const options = {
      width: 160,
      height: 96,
      seed: 199,
      goldFlecks: true,
      age: 0.2,
    } as const;

    const baseline = buildXuanPaperScene(options);
    const mutated = buildXuanPaperScene(options);

    mutated.options.baseColor[0] = 0;
    mutated.fibers[0]?.points.splice(0, 1);
    mutated.particles[0]!.x = -1;
    mutated.goldFlecks[0]?.commands.splice(0, 1);
    if (mutated.deckleOutline) {
      mutated.deckleOutline.top[0] = -1;
    }

    expect(buildXuanPaperScene(options)).toEqual(baseline);
  });

  it("maps preset families to distinct paper profiles", () => {
    const rawScene = buildXuanPaperScene({
      width: 120,
      height: 90,
      seed: 11,
      baseColor: XuanPaperColors.raw,
    });
    const teaScene = buildXuanPaperScene({
      width: 120,
      height: 90,
      seed: 11,
      baseColor: XuanPaperColors.teaStained,
      age: 0.4,
    });

    expect(rawScene.profile.kind).toBe("raw");
    expect(teaScene.profile.kind).toBe("sized");
    expect(rawScene.profile.fiberContrast).toBeGreaterThan(teaScene.profile.fiberContrast);
    expect(rawScene.profile.warmth).toBeLessThan(teaScene.profile.warmth);
  });

  it("keeps gold flecks readable at low resolution", () => {
    const scene = buildXuanPaperScene({
      width: 240,
      height: 160,
      seed: 21,
      goldFlecks: true,
      goldDensity: 0.45,
      goldClustering: 0.35,
    });

    expect(scene.goldFlecks.length).toBeGreaterThanOrEqual(8);
    expect(occupiedGoldBuckets(240, 160, scene)).toBeGreaterThanOrEqual(6);
  });

  it("keeps gold flecks broadly distributed at 4K resolution", () => {
    const scene = buildXuanPaperScene({
      width: 3840,
      height: 2160,
      seed: 77,
      goldFlecks: true,
      goldDensity: 0.5,
      goldClustering: 0.3,
    });

    expect(scene.goldFlecks.length).toBeGreaterThan(1000);
    expect(occupiedGoldBuckets(3840, 2160, scene)).toBeGreaterThanOrEqual(36);
  });

  it("defaults goldDistribution to 'poisson' matching legacy behavior", () => {
    const implicit = buildXuanPaperScene({
      width: 200,
      height: 150,
      seed: 7,
      goldFlecks: true,
      goldDensity: 0.5,
    });

    const explicit = buildXuanPaperScene({
      width: 200,
      height: 150,
      seed: 7,
      goldFlecks: true,
      goldDensity: 0.5,
      goldDistribution: "poisson",
    });

    expect(implicit).toEqual(explicit);
  });

  it("packs more gold flecks when goldDistribution is 'random'", () => {
    const shared = {
      width: 200,
      height: 150,
      seed: 13,
      goldFlecks: true,
      goldDensity: 0.7,
      goldClustering: 0.2,
    } as const;

    const poisson = buildXuanPaperScene({ ...shared, goldDistribution: "poisson" });
    const random = buildXuanPaperScene({ ...shared, goldDistribution: "random" });

    // Random mode skips rejection entirely, so every attempted fleck is accepted
    // (count is bounded by the same internal formula as poisson's nominal count).
    expect(random.goldFlecks.length).toBeGreaterThanOrEqual(poisson.goldFlecks.length);

    // Random mode allows overlaps: at least one pair of flecks should sit closer
    // than the poisson mode's typical minimum spacing.
    function firstAnchor(scene: ReturnType<typeof buildXuanPaperScene>): Array<[number, number]> {
      const anchors: Array<[number, number]> = [];
      for (const fleck of scene.goldFlecks) {
        const first = fleck.commands[0];
        if (first && first.type === "M") {
          anchors.push([first.x, first.y]);
        }
      }
      return anchors;
    }

    function minPairDistance(anchors: Array<[number, number]>): number {
      let minD = Number.POSITIVE_INFINITY;
      for (let i = 0; i < anchors.length; i++) {
        for (let j = i + 1; j < anchors.length; j++) {
          const dx = anchors[i]![0] - anchors[j]![0];
          const dy = anchors[i]![1] - anchors[j]![1];
          const d = Math.hypot(dx, dy);
          if (d < minD) minD = d;
        }
      }
      return minD;
    }

    const randomMin = minPairDistance(firstAnchor(random));
    const poissonMin = minPairDistance(firstAnchor(poisson));

    expect(randomMin).toBeLessThanOrEqual(poissonMin);
  });

  it("renders SVG layers for fibers, particles, and gold when enabled", () => {
    const svg = XuanPaper.generateSVG({
      width: 180,
      height: 120,
      seed: 123,
      goldFlecks: true,
      deckleEdge: true,
      age: 0.45,
    });

    expect(svg.getAttribute("viewBox")).toBe("0 0 180 120");
    expect(svg.querySelector('[data-layer="fibers"]')).not.toBeNull();
    expect(svg.querySelector('[data-layer="particles"]')).not.toBeNull();
    expect(svg.querySelector('[data-layer="gold-flecks"]')).not.toBeNull();
    expect(svg.querySelector("clipPath path")).not.toBeNull();
  });

  it("renderXuanPaperToCanvas on OffscreenCanvas matches the legacy HTMLCanvasElement pathway", () => {
    // jsdom default env has no OffscreenCanvas and no Canvas2D; skip there.
    // In browser-capable envs, both pathways call the same renderer against the
    // same scene, so pixel buffers must match within a tiny tolerance. Allow
    // ≤1 channel delta on ≤0.1% of pixels to absorb implementation drift
    // between CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D.
    if (typeof OffscreenCanvas === "undefined") {
      return;
    }

    const opts: XuanPaperOptions = {
      width: 64,
      height: 48,
      seed: 42,
      goldFlecks: true,
    };
    const scene = buildXuanPaperScene({
      ...opts,
      baseColor: opts.baseColor ?? DEFAULT_BASE_COLOR,
      mode: "canvas",
    });

    const offscreen = new OffscreenCanvas(opts.width!, opts.height!);
    renderXuanPaperToCanvas(offscreen, scene);
    const offCtx = offscreen.getContext("2d");
    if (!offCtx) {
      return;
    }
    const offPixels = offCtx.getImageData(0, 0, opts.width!, opts.height!).data;

    const htmlCanvas = XuanPaper.generate(opts);
    const htmlCtx = htmlCanvas.getContext("2d");
    if (!htmlCtx) {
      return;
    }
    const htmlPixels = htmlCtx.getImageData(0, 0, opts.width!, opts.height!).data;

    expect(offPixels.length).toBe(htmlPixels.length);

    let mismatched = 0;
    for (let i = 0; i < offPixels.length; i += 4) {
      const dR = Math.abs((offPixels[i] ?? 0) - (htmlPixels[i] ?? 0));
      const dG = Math.abs((offPixels[i + 1] ?? 0) - (htmlPixels[i + 1] ?? 0));
      const dB = Math.abs((offPixels[i + 2] ?? 0) - (htmlPixels[i + 2] ?? 0));
      const dA = Math.abs((offPixels[i + 3] ?? 0) - (htmlPixels[i + 3] ?? 0));
      if (dR > 1 || dG > 1 || dB > 1 || dA > 1) {
        mismatched++;
      }
    }
    const totalPixels = opts.width! * opts.height!;
    expect(mismatched / totalPixels).toBeLessThanOrEqual(0.001);
  });

  it("creates reusable SVG patterns", () => {
    const generateSpy = vi
      .spyOn(XuanPaper, "generateDataURL")
      .mockReturnValue("data:image/png;base64,stub");

    const pattern = XuanPaper.createPattern("paper-pattern", {
      width: 128,
      height: 96,
      seed: 88,
    });

    expect(pattern.getAttribute("id")).toBe("paper-pattern");
    expect(pattern.getAttribute("width")).toBe("128");
    expect(pattern.querySelector("image")?.getAttribute("href")).toBe("data:image/png;base64,stub");
    expect(generateSpy).toHaveBeenCalledWith({
      width: 128,
      height: 96,
      seed: 88,
    });
    generateSpy.mockRestore();
  });
});
