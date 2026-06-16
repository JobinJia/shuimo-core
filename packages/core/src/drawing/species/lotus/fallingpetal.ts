import { BBS, normRand } from "../../FlowerCanvas";
import {
  FALL_PETAL_COUNT_MIN,
  FALL_PETAL_COUNT_MAX,
  FALL_PETAL_LEN_MIN,
  FALL_PETAL_LEN_MAX,
} from "./constants";
import { drawPetal } from "./petal";

const PI = Math.PI;

/**
 * Drifting fallen petals — small single pink dabs scattered in the air across
 * the upper scene. Each is one petal shape at a random position and rotation.
 */
export function drawFallingPetals(
  ctx: CanvasRenderingContext2D,
  cwid: number,
  topY: number,
  bottomY: number,
): void {
  const count = Math.floor(normRand(FALL_PETAL_COUNT_MIN, FALL_PETAL_COUNT_MAX + 1));
  for (let i = 0; i < count; i++) {
    const x = cwid * (0.1 + 0.8 * BBS.next());
    const y = topY + (bottomY - topY) * BBS.next();
    const len = normRand(FALL_PETAL_LEN_MIN, FALL_PETAL_LEN_MAX);
    const angle = BBS.next() * 2 * PI;
    drawPetal(ctx, {
      baseX: x,
      baseY: y,
      angle,
      length: len,
      halfW: len * normRand(0.42, 0.6),
      bend: (BBS.next() - 0.5) * len * 0.25,
      widePos: normRand(0.45, 0.58),
      curl: (BBS.next() - 0.5) * 0.7,
      vShift: 0.02,
      alpha: 0.85,
      veins: false,
    });
  }
}
