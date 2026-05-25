import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  resolveFontSync,
  collectStampChars,
  findMissingChars,
  compositeFont,
} from "./glyphs";
import type { GlyphFont, NormalizedCommand } from "../../internal/glyphPath";

let fontBuf: ArrayBuffer;

beforeAll(() => {
  const path = resolve(process.cwd(), "../../playground/public/fonts/yishanbeizhuanti.demo.woff2");
  const node = readFileSync(path);
  fontBuf = node.buffer.slice(node.byteOffset, node.byteOffset + node.byteLength) as ArrayBuffer;
});

describe("collectStampChars", () => {
  it("dedupes and preserves first-seen order across columns", () => {
    expect(collectStampChars(["水墨", "丹青墨"])).toEqual(["水", "墨", "丹", "青"]);
  });

  it("flattens a plain string", () => {
    expect(collectStampChars("落梅听")).toEqual(["落", "梅", "听"]);
  });

  it("returns empty for empty / missing input", () => {
    expect(collectStampChars(undefined)).toEqual([]);
    expect(collectStampChars([])).toEqual([]);
    expect(collectStampChars("")).toEqual([]);
  });
});

describe("findMissingChars", () => {
  it("returns chars whose getPath comes back empty", () => {
    const font = resolveFontSync(fontBuf);
    // The demo subset only ships a handful of chars (it's built for the playground
    // sample text). Pick a char unlikely to be in any minimal seal subset.
    const exotic = "𰻞"; // biáng — almost no fonts include this codepoint
    expect(findMissingChars(font, [exotic])).toContain(exotic);
  });

  it("returns [] when every char is present", () => {
    const font = resolveFontSync(fontBuf);
    // These are in the demo subset (used by the playground default text).
    expect(findMissingChars(font, ["落"])).toEqual([]);
  });
});

describe("compositeFont", () => {
  it("routes missing-in-primary chars to fallback", () => {
    // Build a fake primary that has no glyphs at all.
    const emptyPrimary: GlyphFont = {
      unitsPerEm: 1000,
      getAdvanceWidth: () => 0,
      getPath: () => [],
    };
    // Build a fake fallback that returns one M command for any char.
    const stubCommand: NormalizedCommand = { type: "M", x: 1, y: 2 };
    const fallback: GlyphFont = {
      unitsPerEm: 2048,
      getAdvanceWidth: () => 100,
      getPath: () => [stubCommand],
    };
    const composed = compositeFont(emptyPrimary, fallback);
    expect(composed.getPath("X", 0, 0, 10)).toEqual([stubCommand]);
    // Fallback's advance (100 at em=2048) rescales into primary's em (1000):
    // 100 * 1000 / 2048 ≈ 48.83
    expect(composed.getAdvanceWidth("X")).toBeCloseTo(48.83, 1);
    // unitsPerEm follows primary so layout math anchors to it.
    expect(composed.unitsPerEm).toBe(1000);
  });

  it("uses primary when present (fallback ignored)", () => {
    const primary: GlyphFont = {
      unitsPerEm: 1000,
      getAdvanceWidth: () => 500,
      getPath: () => [{ type: "M", x: 99, y: 99 }],
    };
    const fallback: GlyphFont = {
      unitsPerEm: 2048,
      getAdvanceWidth: () => 9999,
      getPath: () => [{ type: "M", x: 0, y: 0 }],
    };
    const composed = compositeFont(primary, fallback);
    expect(composed.getPath("X", 0, 0, 10)[0].x).toBe(99);
    expect(composed.getAdvanceWidth("X")).toBe(500);
  });
});
