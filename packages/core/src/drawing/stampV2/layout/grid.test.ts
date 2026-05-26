import { describe, expect, it } from "vitest";
import { layoutGrid } from "./grid";

const area = { x: 0, y: 0, w: 100, h: 100 };

describe("layoutGrid ttb-rtl", () => {
  it("single char fills the area", () => {
    const cells = layoutGrid({ text: "山", area, direction: "ttb-rtl" });
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ index: 0, char: "山", x: 0, y: 0, w: 100, h: 100 });
  });

  it("two chars sit side-by-side, first char on the right (ttb-rtl)", () => {
    const cells = layoutGrid({ text: "水墨", area, direction: "ttb-rtl" });
    expect(cells).toHaveLength(2);
    expect(cells[0].char).toBe("水");
    // i=0 → top-right cell
    expect(cells[0].x).toBeGreaterThan(area.w / 2 - 1);
    expect(cells[0].y).toBe(0);
    expect(cells[1].char).toBe("墨");
    // i=1 → top-left cell, same row
    expect(cells[1].y).toBe(cells[0].y);
    expect(cells[1].x).toBeLessThan(cells[0].x);
  });

  it("four chars form a 2×2 grid, top-right first", () => {
    const cells = layoutGrid({ text: "山水画家", area, direction: "ttb-rtl" });
    expect(cells).toHaveLength(4);
    // i=0 → top-right: cell starts at x=50 (right half), y=0 (top half)
    expect(cells[0].x).toBeGreaterThanOrEqual(50);
    expect(cells[0].y).toBeLessThan(50);
    // i=1 → bottom-right (same column as i=0)
    expect(cells[1].x).toBeCloseTo(cells[0].x, 6);
    expect(cells[1].y).toBeGreaterThanOrEqual(50);
    // i=2 → top-left
    expect(cells[2].x).toBeLessThan(50);
    expect(cells[2].y).toBeLessThan(50);
  });

  it("explicit columns overrides default layout", () => {
    const cells = layoutGrid({ text: "abcd", area, direction: "ttb-rtl", columns: 4 });
    expect(cells).toHaveLength(4);
    // 4 columns → row count 1, all cells at y=0
    expect(cells.every((c) => c.y === 0)).toBe(true);
  });
});

describe("layoutGrid column-major rowHeights", () => {
  it("uses per-row heights when supplied (cellHeightMode='fit' upstream)", () => {
    // 2 columns × 2 rows; row 0 should be twice as tall as row 1.
    const rowHeights = [60, 30];
    const columnWidths = [40, 40];
    const cells = layoutGrid({
      text: ["AB", "CD"],
      area: { x: 0, y: 0, w: 100, h: 100 },
      direction: "ttb-rtl",
      columnWidths,
      rowHeights,
      rowGap: 0,
      columnGap: 0,
    });
    expect(cells).toHaveLength(4);
    // Row 0 cells (chars at index [0] of each column) → "A" + "C"
    const row0 = cells.filter((c) => c.char === "A" || c.char === "C");
    const row1 = cells.filter((c) => c.char === "B" || c.char === "D");
    expect(row0.every((c) => c.h === 60)).toBe(true);
    expect(row1.every((c) => c.h === 30)).toBe(true);
    // Row 1 y starts where row 0 ends.
    const r0Y = row0[0].y;
    const r1Y = row1[0].y;
    expect(r1Y - r0Y).toBeCloseTo(60, 6);
  });

  it("ignores rowHeights of mismatched length and falls back to uniform", () => {
    const cells = layoutGrid({
      text: ["AB", "CD"],
      area: { x: 0, y: 0, w: 100, h: 100 },
      direction: "ttb-rtl",
      columnWidths: [40, 40],
      rowHeights: [10, 20, 30], // wrong length for maxRows=2
      rowGap: 0,
    });
    // Every cell same height → uniform fallback.
    const heights = new Set(cells.map((c) => c.h));
    expect(heights.size).toBe(1);
  });
});

describe("layoutGrid circular", () => {
  it("places n chars at distinct angles around center", () => {
    const cells = layoutGrid({ text: "甲乙丙丁", area, direction: "circular" });
    expect(cells).toHaveLength(4);
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h / 2;
    const angles = cells.map((c) => Math.atan2(c.y + c.h / 2 - cy, c.x + c.w / 2 - cx));
    const uniq = new Set(angles.map((a) => a.toFixed(4)));
    expect(uniq.size).toBe(4);
    // All cells have rotation defined (face outward)
    expect(cells.every((c) => typeof c.rotation === "number")).toBe(true);
  });
});
