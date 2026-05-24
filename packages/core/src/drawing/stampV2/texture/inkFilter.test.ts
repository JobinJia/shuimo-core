import { describe, expect, it } from "vitest";
import { inkFilterDefs, borderFilterDefs, textFilterDefs } from "./inkFilter";

describe("inkFilterDefs", () => {
  it("emits a filter element with the given id", () => {
    const out = inkFilterDefs({ id: "ink-1", seed: 42, intensity: 1, size: 280 });
    expect(out).toContain('<filter id="ink-1"');
    expect(out).toContain("</filter>");
  });

  it("uses different seeds for sub-noises (decorrelated turbulence layers)", () => {
    const out = inkFilterDefs({ id: "x", seed: 100, intensity: 1, size: 280 });
    const seeds = Array.from(out.matchAll(/seed="(\d+)"/g)).map((m) => Number(m[1]));
    expect(new Set(seeds).size).toBeGreaterThanOrEqual(2);
  });

  it("intensity=0 emits a filter with no feTurbulence output (passthrough)", () => {
    const out = inkFilterDefs({ id: "x", seed: 1, intensity: 0, size: 280 });
    expect(out).toContain("feTurbulence");
    expect(out).toContain("feComposite");
  });
});

describe("borderFilterDefs", () => {
  it("emits a filter with displacement proportional to thickness * intensity", () => {
    const out = borderFilterDefs({ id: "b", seed: 1, intensity: 1, thickness: 10 });
    expect(out).toContain('<filter id="b"');
    expect(out).toMatch(/scale="7"/); // 10 * 0.7 * 1
  });
});

describe("textFilterDefs", () => {
  it("emits an erode + displace + chip chain", () => {
    const out = textFilterDefs({ id: "t", seed: 1, intensity: 1, size: 280 });
    expect(out).toContain('<filter id="t"');
    expect(out).toContain("feMorphology");
    expect(out).toContain("feDisplacementMap");
    expect(out).toContain("feMerge");
  });
});
