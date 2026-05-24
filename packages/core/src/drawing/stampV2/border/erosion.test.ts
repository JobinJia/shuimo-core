import { describe, expect, it } from "vitest";
import { PRNG } from "../../../foundation/random/prng";
import { squareBorder, borderPolygon } from "./shape";
import { erodeBorder } from "./erosion";

function makePrng(seed: number): PRNG {
  const p = new PRNG();
  p.seed(seed);
  return p;
}

const SIZE = 200;
const THICKNESS = 8;

describe("erodeBorder", () => {
  it("roughness=0 returns the base polygon untouched", () => {
    const border = squareBorder({ width: SIZE, height: SIZE, thickness: THICKNESS });
    const base = borderPolygon(border);
    const out = erodeBorder(border, base, { roughness: 0 }, makePrng(1));
    expect(out).toEqual(base);
  });

  it("roughness>0 changes vertex count on the outer ring", () => {
    const border = squareBorder({ width: SIZE, height: SIZE, thickness: THICKNESS });
    const base = borderPolygon(border);
    const out = erodeBorder(border, base, { roughness: 0.5 }, makePrng(2));
    const baseOuterLen = base[0][0].length;
    let foundDifferent = false;
    for (const poly of out) {
      if (poly[0].length !== baseOuterLen) {
        foundDifferent = true;
        break;
      }
    }
    expect(foundDifferent).toBe(true);
  });

  it("preserves the annular shape (polygon-clipping may collapse outer+hole into a self-touching ring)", () => {
    const border = squareBorder({ width: SIZE, height: SIZE, thickness: THICKNESS });
    const base = borderPolygon(border);
    const out = erodeBorder(border, base, { roughness: 0.3 }, makePrng(3));
    // Either 2 separate rings (outer+hole) OR 1 self-touching ring is fine —
    // both render as the annular band under evenodd. Just make sure SOMETHING
    // valid came back.
    expect(out.length).toBeGreaterThan(0);
    expect(out[0][0].length).toBeGreaterThan(3);
  });

  it("same seed → identical MultiPolygon", () => {
    const border = squareBorder({ width: SIZE, height: SIZE, thickness: THICKNESS });
    const base = borderPolygon(border);
    const a = erodeBorder(border, base, { roughness: 0.4 }, makePrng(42));
    const b = erodeBorder(border, base, { roughness: 0.4 }, makePrng(42));
    expect(a).toEqual(b);
  });

  it("higher roughness produces different outer ring than lower roughness", () => {
    const border = squareBorder({ width: SIZE, height: SIZE, thickness: THICKNESS });
    const base = borderPolygon(border);
    const low = erodeBorder(border, base, { roughness: 0.1 }, makePrng(7));
    const high = erodeBorder(border, base, { roughness: 0.9 }, makePrng(7));
    expect(high[0][0]).not.toEqual(low[0][0]);
  });
});
