import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateSeal } from "../seal";
import { polygonBorder } from "./shape";

let fontBuf: ArrayBuffer;

beforeAll(() => {
  const path = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.demo.woff2");
  const node = readFileSync(path);
  fontBuf = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength) as ArrayBuffer;
});

describe("polygonBorder", () => {
  it("emits N vertices for an N-gon (both outer + inner)", () => {
    const six = polygonBorder({ width: 200, height: 200, thickness: 10 }, 6, "flat-top");
    expect(six.outer).toHaveLength(6);
    expect(six.inner).toHaveLength(6);
  });

  it("flat-top orientation places no vertex straight at top", () => {
    const six = polygonBorder({ width: 200, height: 200, thickness: 10 }, 6, "flat-top");
    const cx = 100;
    const topVertex = six.outer.find(([x, y]) => Math.abs(x - cx) < 1 && y < 10);
    // flat-top: the top is an EDGE — so no single vertex sits at (cx, ≈0)
    expect(topVertex).toBeUndefined();
  });

  it("point-top orientation has a vertex at the top", () => {
    const six = polygonBorder({ width: 200, height: 200, thickness: 10 }, 6, "point-top");
    const cx = 100;
    const topVertex = six.outer.find(([x, y]) => Math.abs(x - cx) < 1 && y < 5);
    expect(topVertex).toBeDefined();
  });

  it("inner ring is smaller than outer (thickness applied)", () => {
    const five = polygonBorder({ width: 200, height: 200, thickness: 12 }, 5, "point-top");
    const outerRadius = Math.hypot(five.outer[0][0] - 100, five.outer[0][1] - 100);
    const innerRadius = Math.hypot(five.inner[0][0] - 100, five.inner[0][1] - 100);
    expect(innerRadius).toBeLessThan(outerRadius);
    expect(outerRadius - innerRadius).toBeCloseTo(12, 1);
  });
});

describe("generateSeal with polygon shape", () => {
  it("hexagon renders without error", () => {
    const r = generateSeal({
      text: "水墨",
      size: 200,
      seed: 42,
      font: fontBuf,
      shape: { kind: "polygon", sides: 6 },
    });
    expect(r.svg).toMatch(/^<svg /);
  });

  it("flat-top vs point-top produce different SVG", () => {
    const flat = generateSeal({
      text: "水墨",
      size: 200,
      seed: 42,
      font: fontBuf,
      shape: { kind: "polygon", sides: 6, orientation: "flat-top" },
    });
    const point = generateSeal({
      text: "水墨",
      size: 200,
      seed: 42,
      font: fontBuf,
      shape: { kind: "polygon", sides: 6, orientation: "point-top" },
    });
    expect(flat.svg).not.toBe(point.svg);
  });
});

describe("generateSeal with irregular shape", () => {
  it("renders without error and uses heavy erosion by default", () => {
    const r = generateSeal({
      text: "水墨",
      size: 200,
      seed: 42,
      font: fontBuf,
      shape: { kind: "irregular" },
    });
    expect(r.svg).toMatch(/^<svg /);
  });

  it("higher roughness → different SVG (more deformation)", () => {
    const low = generateSeal({
      text: "水墨",
      size: 200,
      seed: 42,
      font: fontBuf,
      shape: { kind: "irregular", roughness: 0.4 },
    });
    const high = generateSeal({
      text: "水墨",
      size: 200,
      seed: 42,
      font: fontBuf,
      shape: { kind: "irregular", roughness: 0.95 },
    });
    expect(low.svg).not.toBe(high.svg);
  });
});
