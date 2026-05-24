import { describe, expect, it } from "vitest";
import { PRNG } from "../../../foundation/random/prng";
import { carveRings } from "./carving";
import type { Ring } from "../geometry/flatten";

function squareRing(x: number, y: number, s: number): Ring {
  // 16-point square so we have enough vertices for noise to move.
  const ring: Ring = [];
  const sides = 4;
  const perSide = 4;
  for (let side = 0; side < sides; side++) {
    for (let k = 0; k < perSide; k++) {
      const t = k / perSide;
      const a = [
        [x, y],
        [x + s, y],
        [x + s, y + s],
        [x, y + s],
      ][side] as [number, number];
      const b = [
        [x + s, y],
        [x + s, y + s],
        [x, y + s],
        [x, y],
      ][side] as [number, number];
      ring.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return ring;
}

function makePrng(seed: number): PRNG {
  const p = new PRNG();
  p.seed(seed);
  return p;
}

describe("carveRings", () => {
  it("intensity=0 returns input rings untouched", () => {
    const rings = [squareRing(0, 0, 10)];
    const out = carveRings(rings, { intensity: 0 }, makePrng(1));
    expect(out).toEqual(rings);
  });

  it("intensity>0 displaces most vertices", () => {
    const rings = [squareRing(0, 0, 50)];
    const out = carveRings(rings, { intensity: 0.5 }, makePrng(7));
    let moved = 0;
    for (let i = 0; i < rings[0].length; i++) {
      const dx = out[0][i][0] - rings[0][i][0];
      const dy = out[0][i][1] - rings[0][i][1];
      if (Math.hypot(dx, dy) > 1e-6) moved++;
    }
    expect(moved).toBeGreaterThan(rings[0].length / 2);
  });

  it("preserves vertex count per ring", () => {
    const rings = [squareRing(0, 0, 20), squareRing(50, 50, 20)];
    const out = carveRings(rings, { intensity: 0.3 }, makePrng(3));
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(rings[0].length);
    expect(out[1]).toHaveLength(rings[1].length);
  });

  it("same seed → identical output", () => {
    const rings = [squareRing(0, 0, 30)];
    const a = carveRings(rings, { intensity: 0.4 }, makePrng(42));
    const b = carveRings(rings, { intensity: 0.4 }, makePrng(42));
    expect(a).toEqual(b);
  });
});
