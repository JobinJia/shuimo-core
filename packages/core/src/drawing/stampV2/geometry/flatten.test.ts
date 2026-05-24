import { describe, expect, it } from "vitest";
import { flattenCommands, ringBBox, ringLength } from "./flatten";

describe("flattenCommands", () => {
  it("produces a closed ring from M/L/Z", () => {
    const rings = flattenCommands([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 10, y: 0 },
      { type: "L", x: 10, y: 10 },
      { type: "L", x: 0, y: 10 },
      { type: "Z" },
    ]);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    expect(rings[0][0]).toEqual([0, 0]);
    expect(rings[0][3]).toEqual([0, 10]);
  });

  it("splits multiple sub-paths into separate rings", () => {
    const rings = flattenCommands([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 5, y: 0 },
      { type: "L", x: 5, y: 5 },
      { type: "Z" },
      { type: "M", x: 10, y: 10 },
      { type: "L", x: 20, y: 10 },
      { type: "L", x: 20, y: 20 },
      { type: "Z" },
    ]);
    expect(rings).toHaveLength(2);
    expect(rings[0]).toHaveLength(3);
    expect(rings[1]).toHaveLength(3);
  });

  it("subdivides a cubic Bezier into multiple points", () => {
    const rings = flattenCommands(
      [
        { type: "M", x: 0, y: 0 },
        { type: "C", x1: 0, y1: 100, x2: 100, y2: 100, x: 100, y: 0 },
        { type: "Z" },
      ],
      { tolerance: 0.5 },
    );
    expect(rings).toHaveLength(1);
    // A pronounced cubic should require many subdivisions
    expect(rings[0].length).toBeGreaterThan(8);
    // Endpoints preserved
    expect(rings[0][0]).toEqual([0, 0]);
    expect(rings[0][rings[0].length - 1]).toEqual([100, 0]);
  });

  it("flatter tolerance yields fewer points than tighter", () => {
    const cmds = [
      { type: "M" as const, x: 0, y: 0 },
      { type: "C" as const, x1: 0, y1: 100, x2: 100, y2: 100, x: 100, y: 0 },
      { type: "Z" as const },
    ];
    const tight = flattenCommands(cmds, { tolerance: 0.1 });
    const loose = flattenCommands(cmds, { tolerance: 5 });
    expect(tight[0].length).toBeGreaterThan(loose[0].length);
  });

  it("ringBBox returns min/max corners", () => {
    const bb = ringBBox([
      [3, 4],
      [10, 4],
      [10, 8],
      [3, 8],
    ]);
    expect(bb).toEqual({ x1: 3, y1: 4, x2: 10, y2: 8 });
  });

  it("ringLength includes the closing segment", () => {
    const len = ringLength([
      [0, 0],
      [3, 0],
      [3, 4],
    ]);
    // 3 + 4 + 5 (hypot back to origin)
    expect(len).toBeCloseTo(12, 6);
  });
});
