import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateStamp, generateStampAsync, generateStampPath, measureStampText } from "./Stamp";
import { configureFontSubsetWasm } from "./internal/fontSubset";

describe("Stamp layout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses measured column heights with a small safety buffer for rectangle bounds", () => {
    const result = generateStampPath({
      text: ["月落", "乌啼"],
      shape: "rectangle",
      fontSize: 70,
      paddingYPx: 10,
      measuredColumnWidths: [38, 38],
      measuredColumnHeights: [130, 130],
      seed: 1,
      regularShape: true,
      borderBandWidth: 0,
    });

    expect(result.bounds.height).toBeCloseTo(155.6, 0);
  });

  it("keeps auto shape tall enough for the tallest middle column", () => {
    const result = generateStampPath({
      text: ["甲", "中中中", "乙"],
      shape: "auto",
      fontSize: 70,
      paddingYPx: 10,
      measuredColumnWidths: [38, 38, 38],
      measuredColumnHeights: [70, 210, 70],
      seed: 1,
      borderBandWidth: 0,
    });

    expect(result.bounds.height).toBeCloseTo(235.6, 0);
  });

  it("uses characterSpacingPx when measuring text", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(SVGElement.prototype, "getBBox");

    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value(this: SVGElement) {
        const letterSpacing = Number.parseFloat(this.style.letterSpacing || "0");
        return {
          x: 0,
          y: 0,
          width: 10,
          height: letterSpacing * 1000,
        };
      },
    });

    const result = measureStampText({
      text: ["印"],
      fontSize: 100,
      characterSpacingPx: 10,
    });

    if (originalDescriptor) {
      Object.defineProperty(SVGElement.prototype, "getBBox", originalDescriptor);
    } else {
      delete (SVGElement.prototype as SVGElement & { getBBox?: unknown }).getBBox;
    }

    expect(result?.columnHeights[0]).toBeCloseTo(100, 3);
  });

  it("centers single-character circle stamps by ink bbox so the visible ink lands at the same spot regardless of cell offset", () => {
    const baseOptions = {
      text: ["梅"],
      shape: "circle",
      fontSize: 100,
      paddingXPx: 0,
      paddingYPx: 0,
      borderScale: 1,
      regularShape: true,
      measuredColumnWidths: [40],
      measuredColumnHeights: [100],
      seed: 1,
    } as const;

    const rightBox = { x: 20, y: 0, width: 20, height: 100 };
    const leftBox = { x: -20, y: 0, width: 20, height: 100 };

    const svgWithRightShiftedInk = generateStamp({
      ...baseOptions,
      measuredColumnBoxes: [rightBox],
    });
    const svgWithLeftShiftedInk = generateStamp({
      ...baseOptions,
      measuredColumnBoxes: [leftBox],
    });

    const rightShiftedX = Number.parseFloat(
      svgWithRightShiftedInk.match(/<text x="([^"]+)"/)?.[1] ?? "",
    );
    const leftShiftedX = Number.parseFloat(
      svgWithLeftShiftedInk.match(/<text x="([^"]+)"/)?.[1] ?? "",
    );

    // Centering uses the ink bbox: text x compensates for box.x so the visible
    // ink center (text x + box.x + box.width / 2) lands at the same position
    // regardless of where the ink sits inside the cell.
    const rightInkCenter = rightShiftedX + rightBox.x + rightBox.width / 2;
    const leftInkCenter = leftShiftedX + leftBox.x + leftBox.width / 2;
    expect(rightInkCenter).toBeCloseTo(leftInkCenter, 5);
  });

  it("uses a carved text filter instead of blur-smoothed text edges", () => {
    const svg = generateStamp({
      text: ["印"],
      type: "yin",
      fontSize: 70,
      seed: 1,
    });

    expect(svg).toContain("feMorphology");
    expect(svg).toContain("textChipMask");
    expect(svg).not.toContain('result="smoothedText"');
  });

  it("supports a stronger carved text profile without changing the filter structure", () => {
    const normalSvg = generateStamp({
      text: ["印"],
      type: "yin",
      fontSize: 70,
      textCarving: "normal",
      seed: 1,
    });
    const strongSvg = generateStamp({
      text: ["印"],
      type: "yin",
      fontSize: 70,
      textCarving: "strong",
      seed: 1,
    });

    expect(normalSvg).toContain("stamp-text-texture");
    expect(strongSvg).toContain("stamp-text-texture");
    expect(normalSvg).not.toBe(strongSvg);
  });

  it("supports a stone-cut text profile for sharper carved edges", () => {
    const strongSvg = generateStamp({
      text: ["印"],
      type: "yin",
      fontSize: 70,
      textCarving: "strong",
      seed: 1,
    });
    const stoneCutSvg = generateStamp({
      text: ["印"],
      type: "yin",
      fontSize: 70,
      textCarving: "stone-cut",
      seed: 1,
    });

    expect(stoneCutSvg).toContain('type="turbulence"');
    expect(stoneCutSvg).toContain("textEdgeNoiseStepped");
    expect(stoneCutSvg).toContain("stamp-text-texture");
    expect(stoneCutSvg).not.toBe(strongSvg);
  });

  it("supports stone-cut glyph paths in the core async api", async () => {
    const fontPath = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.ttf");
    const fontBuffer = readFileSync(fontPath);
    const svg = await generateStampAsync({
      text: ["印"],
      type: "yin",
      fontFamily: "峄山碑篆体",
      fontSize: 70,
      textCarving: "stone-cut",
      fontData: fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength,
      ),
      measuredColumnWidths: [38],
      measuredColumnHeights: [72],
      measuredColumnBoxes: [
        {
          x: -35,
          y: 0,
          width: 38,
          height: 72,
        },
      ],
      seed: 1,
    });

    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
  });

  it("renders glyph paths from a woff2 font (fontkit auto-detects format)", async () => {
    const fontPath = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.woff2");
    const fontBuffer = readFileSync(fontPath);
    const svg = await generateStampAsync({
      text: ["墨"],
      type: "yin",
      fontFamily: "峄山碑篆体",
      fontSize: 70,
      fontData: fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength,
      ),
      seed: 1,
    });

    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
  });

  it("uses font glyph metrics for async layout even without browser text measurement", async () => {
    const fontPath = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.ttf");
    const fontBuffer = readFileSync(fontPath);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const svg = await generateStampAsync({
      text: ["水墨", "江南"],
      type: "yang",
      shape: "rectangle",
      fontFamily: "峄山碑篆体",
      fontSize: 70,
      fontData: fontBuffer.buffer.slice(
        fontBuffer.byteOffset,
        fontBuffer.byteOffset + fontBuffer.byteLength,
      ),
      seed: 1,
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(svg).toContain("<path");
    expect(svg).not.toContain("<text");
  });

  it("does not clamp path noise by padding, so explicit noiseAmountPx still changes the border", () => {
    const baseOptions = {
      text: ["印"],
      shape: "rectangle",
      fontSize: 70,
      paddingXPx: 1,
      paddingYPx: 1,
      borderGap: false,
      seed: 1,
    } as const;

    const lowNoise = generateStampPath({
      ...baseOptions,
      noiseAmountPx: 1,
    });
    const highNoise = generateStampPath({
      ...baseOptions,
      noiseAmountPx: 20,
    });

    expect(lowNoise.path).not.toBe(highNoise.path);
  });

  it("keeps filter displacement independent from padding so default texture strength stays stable", () => {
    const compactSvg = generateStamp({
      text: ["印"],
      fontSize: 70,
      paddingXPx: 1,
      paddingYPx: 1,
      seed: 1,
    });
    const roomySvg = generateStamp({
      text: ["印"],
      fontSize: 70,
      paddingXPx: 20,
      paddingYPx: 20,
      seed: 1,
    });

    const extractScales = (svg: string) =>
      [...svg.matchAll(/<feDisplacementMap[^>]*scale="([^"]+)"/g)].map((match) => match[1]);

    expect(extractScales(compactSvg)).toEqual(extractScales(roomySvg));
  });

  it("reserves ellipse end-cap space based on the final scaled long axis", () => {
    const result = generateStampPath({
      text: ["甲", "乙"],
      shape: "ellipse",
      fontSize: 70,
      measuredColumnWidths: [38, 38],
      measuredColumnHeights: [70, 70],
      paddingXPx: 4,
      paddingYPx: 4,
      borderScaleX: 0.7,
      borderScaleY: 1.4,
      regularShape: true,
      seed: 1,
      borderBandWidth: 0,
    });

    const scaledInnerWidth = (38 + 38 + 70 * 0.02 + 8) * 0.7;
    const scaledInnerHeight = (70 + 70 * 0.05 + 70 * 0.03 + 8) * 1.4;
    const expectedWidth = scaledInnerWidth - 2;
    const expectedHeight = scaledInnerHeight + scaledInnerWidth * 0.08;

    expect(result.bounds.width).toBeCloseTo(expectedWidth, 3);
    expect(result.bounds.height).toBeCloseTo(expectedHeight, 3);
    expect(result.bounds.height).toBeGreaterThan(result.bounds.width);
  });

  it("renders text via fallback URL when primary subset is missing the glyph", async () => {
    // Pre-load the harfbuzz wasm so the test doesn't depend on fetch resolving
    // a node_modules path. Configure once; subsequent calls are no-ops.
    const wasmPath = resolve(process.cwd(), "node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm");
    const wasmBuffer = readFileSync(wasmPath);
    configureFontSubsetWasm(
      wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength),
    );

    const primaryPath = resolve(
      process.cwd(),
      "../../playground/public/fonts/yishanbeizhuanti.demo.woff2",
    );
    const fallbackPath = resolve(
      process.cwd(),
      "../../playground/public/fonts/yishanbeizhuanti.ttf",
    );
    const primaryBuffer = readFileSync(primaryPath);
    const fallbackBuffer = readFileSync(fallbackPath);
    const primaryData = primaryBuffer.buffer.slice(
      primaryBuffer.byteOffset,
      primaryBuffer.byteOffset + primaryBuffer.byteLength,
    );

    // jsdom doesn't auto-handle fetch for the fallback URL, so mock it to
    // return the on-disk full TTF directly.
    // Use mockImplementation so each call gets a fresh Response with an
    // unconsumed body (mockResolvedValue would reuse the same Response).
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(fallbackBuffer, {
          status: 200,
          headers: { "content-type": "font/ttf" },
        }),
    );

    const svg = await generateStampAsync({
      text: ["筹"],
      type: "yang",
      shape: "auto",
      fontFamily: "峄山碑篆体",
      fontSize: 100,
      fontData: primaryData,
      fontFallbackUrl: "http://test/yishanbeizhuanti.ttf",
      seed: 1,
    });

    // Fallback fetch happened exactly once and produced a non-empty glyph path.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("http://test/yishanbeizhuanti.ttf");
    expect(svg).toContain("<path");
    // The glyph for "筹" should produce a non-trivial path. Look for a path
    // element whose `d` attribute has at least one curve/line command beyond
    // the stamp border path.
    const glyphPaths = [...svg.matchAll(/<path[^>]*d="([^"]+)"/g)].map((m) => m[1]);
    // First path is the border; any additional path is glyph ink.
    expect(glyphPaths.length).toBeGreaterThanOrEqual(2);
    expect(glyphPaths[1].length).toBeGreaterThan(10);
  });

  it("does not refetch the fallback font when a second stamp uses the same chars", async () => {
    const wasmPath = resolve(process.cwd(), "node_modules/harfbuzzjs/dist/harfbuzz-subset.wasm");
    configureFontSubsetWasm(readFileSync(wasmPath).buffer.slice(0));

    const primaryPath = resolve(
      process.cwd(),
      "../../playground/public/fonts/yishanbeizhuanti.demo.woff2",
    );
    const fallbackPath = resolve(
      process.cwd(),
      "../../playground/public/fonts/yishanbeizhuanti.ttf",
    );
    const primaryBuffer = readFileSync(primaryPath);
    const fallbackBuffer = readFileSync(fallbackPath);
    const primaryData = primaryBuffer.buffer.slice(
      primaryBuffer.byteOffset,
      primaryBuffer.byteOffset + primaryBuffer.byteLength,
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(fallbackBuffer, { status: 200, headers: { "content-type": "font/ttf" } }),
      );

    // Use a URL that the previous test didn't prime, so the cache starts empty
    // and the first generateStampAsync call must actually hit fetch.
    const stampOptions = {
      text: ["筹"],
      type: "yang" as const,
      shape: "auto" as const,
      fontFamily: "峄山碑篆体",
      fontSize: 100,
      fontFallbackUrl: "http://test/yishanbeizhuanti-cache-test.ttf",
      seed: 1,
    };

    await generateStampAsync({
      ...stampOptions,
      fontData: primaryData.slice(0),
    });
    await generateStampAsync({
      ...stampOptions,
      fontData: primaryData.slice(0),
    });

    // Raw fallback fetch should be cached process-wide, so a second stamp with
    // identical chars must not re-download.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the auto-shape border roughly square when the glyph is missing from the font subset", async () => {
    // The demo woff2 is a subset that does not contain U+7B79 「筹」. fontkit
    // returns .notdef with zero path commands, which used to collapse the
    // column ink height to 0 and squash the auto-shape stamp into a horizontal
    // sliver. Column metrics must fall back to em-square cell sizing.
    const fontPath = resolve(
      process.cwd(),
      "../../playground/public/fonts/yishanbeizhuanti.demo.woff2",
    );
    const fontBuffer = readFileSync(fontPath);
    const fontData = fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength,
    );

    const svg = await generateStampAsync({
      text: ["筹"],
      type: "yang",
      shape: "auto",
      fontFamily: "峄山碑篆体",
      fontSize: 100,
      fontData,
      seed: 1,
    });

    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
    expect(viewBox, "stamp svg should expose a viewBox").toBeDefined();
    const [, , w, h] = viewBox!.split(/\s+/).map(Number);
    // Pre-fix: h ≈ 5-10 (ink bbox collapsed to zero) and w ≈ 100, ratio > 8.
    // Post-fix: both dimensions track the em-square, so ratio stays near 1.
    expect(w / h).toBeLessThan(1.4);
    expect(h / w).toBeLessThan(1.4);
  });
});
