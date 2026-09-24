import { BBS, normRand } from "../../FlowerCanvas";
import { PETAL_LEN, PETAL_HALFW } from "./constants";
import type { FlowerPlan } from "./flower";
import { planPetal, type PetalArgs } from "./petal";

const PI = Math.PI;

/**
 * A closed lotus bud: a few tightly-wrapped upright petals forming a teardrop,
 * pointing up. Small, used as a stalk top alongside leaves and open flowers.
 * Returns a FlowerPlan so it is built / painted exactly like a bloom.
 */
export function planBud(x: number, y: number, scale = 1, alpha = 1): FlowerPlan {
  const len = PETAL_LEN * 0.72 * scale;
  const hw = PETAL_HALFW * 0.72 * scale;
  // Back petals first (slightly splayed), centre upright last.
  const angles = [-PI / 2 - 0.2, -PI / 2 + 0.2, -PI / 2];
  const petals: PetalArgs[] = [];
  for (let i = 0; i < angles.length; i++) {
    petals.push(
      planPetal({
        baseX: x + (BBS.next() - 0.5) * 3 * scale,
        baseY: y + (BBS.next() - 0.5) * 2 * scale,
        angle: angles[i] + (BBS.next() - 0.5) * 0.08,
        length: len * normRand(0.9, 1.05),
        halfW: hw * normRand(0.92, 1.08),
        bend: (BBS.next() - 0.5) * 6 * scale,
        widePos: 0.5,
        curl: (BBS.next() - 0.5) * 0.3,
        vShift: i === 2 ? 0.04 : -0.04,
        alpha: 0.95 * alpha,
        veins: false,
      }),
    );
  }
  return { petals, alpha: 0.95 * alpha };
}
