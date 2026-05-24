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
