import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateStamp, generateStampAsync, generateStampPath, measureStampText } from "./Stamp";

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

  it("keeps single-character circle stamps centered by cell width instead of ink bbox", () => {
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

    const svgWithRightShiftedInk = generateStamp({
      ...baseOptions,
      measuredColumnBoxes: [
        {
          x: 20,
          y: 0,
          width: 20,
          height: 100,
        },
      ],
    });
    const svgWithLeftShiftedInk = generateStamp({
      ...baseOptions,
      measuredColumnBoxes: [
        {
          x: -20,
          y: 0,
          width: 20,
          height: 100,
        },
      ],
    });

    const rightShiftedX = svgWithRightShiftedInk.match(/<text x="([^"]+)"/)?.[1];
    const leftShiftedX = svgWithLeftShiftedInk.match(/<text x="([^"]+)"/)?.[1];
    expect(rightShiftedX).toBe(leftShiftedX);
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
});
