import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateSeal, generateSealAsync, Seal } from "./seal";

let fontBuf: ArrayBuffer;

beforeAll(() => {
  // process.cwd() is packages/core when `pnpm test` runs from there.
  const path = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.demo.woff2");
  const node = readFileSync(path);
  fontBuf = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength) as ArrayBuffer;
});

describe("generateSeal", () => {
  it("returns SealResult with the expected shape", () => {
    const r = generateSeal({ text: "水墨", size: 200, seed: 42, font: fontBuf });
    expect(typeof r.svg).toBe("string");
    expect(r.svg).toMatch(/^<svg /);
    // Width adapts to text columns; height = size. "水墨" = 1 col → narrow.
    expect(r.width).toBeLessThanOrEqual(200);
    expect(r.height).toBe(200);
    expect(r.seed).toBe(42);
    expect(r.layers).toHaveProperty("background");
    expect(r.layers).toHaveProperty("text");
    expect(r.layers).toHaveProperty("border");
  });

  it("same seed produces identical SVG", () => {
    const a = generateSeal({ text: "水墨", size: 200, seed: 7, font: fontBuf });
    const b = generateSeal({ text: "水墨", size: 200, seed: 7, font: fontBuf });
    expect(a.svg).toBe(b.svg);
  });

  it("different seeds produce different SVG (per-corner radius varies)", () => {
    const a = generateSeal({ text: "水墨", size: 200, seed: 1, font: fontBuf });
    const b = generateSeal({ text: "水墨", size: 200, seed: 99, font: fontBuf });
    expect(a.svg).not.toBe(b.svg);
  });

  it("circle shape renders without throwing", () => {
    const r = generateSeal({
      text: "水墨",
      size: 200,
      seed: 5,
      font: fontBuf,
      shape: { kind: "circle" },
    });
    expect(r.svg).toMatch(/^<svg /);
  });

  it("yin mode produces a background path, no separate border path", () => {
    const r = generateSeal({
      text: "水",
      size: 200,
      seed: 3,
      font: fontBuf,
      mode: "yin",
    });
    expect(r.layers.background).not.toBe("");
    expect(r.layers.border).toBe("");
  });

  it("yang mode produces a border path, no background fill", () => {
    const r = generateSeal({
      text: "水",
      size: 200,
      seed: 3,
      font: fontBuf,
      mode: "yang",
    });
    expect(r.layers.border).not.toBe("");
    expect(r.layers.background).toBe("");
  });

  it("throws when font is missing", () => {
    expect(() => generateSeal({ text: "水", size: 100 } as never)).toThrow(/font/);
  });

  it("throws when font is a URL (use generateSealAsync)", () => {
    expect(() => generateSeal({ text: "水", size: 100, font: "/fonts/x.woff2" } as never)).toThrow(
      /generateSealAsync/,
    );
  });

  it("Seal class facade renders and updates", () => {
    const s = new Seal({ text: "水", size: 200, seed: 42, font: fontBuf });
    const a = s.render();
    const b = s.update({ seed: 100 });
    expect(a.seed).toBe(42);
    expect(b.seed).toBe(100);
  });
});

describe("generateSeal yin with full texture", () => {
  const baseOpts = {
    text: "水墨",
    size: 280,
    font: undefined as unknown as ArrayBuffer,
    mode: "yin" as const,
    border: { thickness: 7, roughness: 0.5 },
    carving: { intensity: 0.3, breakage: 0.4 },
    ink: { bleed: 0.3, grain: 0.5 },
  };

  it("same seed → identical SVG with full texture stack", () => {
    const a = generateSeal({ ...baseOpts, font: fontBuf, seed: 33 });
    const b = generateSeal({ ...baseOpts, font: fontBuf, seed: 33 });
    expect(a.svg).toBe(b.svg);
  });

  it("different seed → different SVG", () => {
    const a = generateSeal({ ...baseOpts, font: fontBuf, seed: 33 });
    const b = generateSeal({ ...baseOpts, font: fontBuf, seed: 34 });
    expect(a.svg).not.toBe(b.svg);
  });

  it("renders a non-trivial background (texture present)", () => {
    const r = generateSeal({ ...baseOpts, font: fontBuf, seed: 1 });
    expect(r.layers.background.length).toBeGreaterThan(200);
  });

  it("disabling all textures matches the clean baseline", () => {
    const clean = generateSeal({
      text: "水墨",
      size: 280,
      seed: 9,
      font: fontBuf,
      mode: "yin",
      border: { thickness: 7 },
    });
    const cleanAgain = generateSeal({
      text: "水墨",
      size: 280,
      seed: 9,
      font: fontBuf,
      mode: "yin",
      border: { thickness: 7, roughness: 0 },
      carving: { intensity: 0, breakage: 0 },
      ink: { bleed: 0, grain: 0 },
    });
    expect(clean.svg).toBe(cleanAgain.svg);
  });
});

describe("generateSealAsync", () => {
  it("accepts ArrayBuffer same as sync version", async () => {
    const r = await generateSealAsync({ text: "水", size: 200, seed: 11, font: fontBuf });
    expect(r.svg).toMatch(/^<svg /);
  });
});
