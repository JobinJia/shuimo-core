import { BBS, hsv, normRand } from "../../FlowerCanvas";
import {
  SPLATTER_V,
  SPLATTER_COUNT_MIN,
  SPLATTER_COUNT_MAX,
  SPLATTER_SPREAD_X,
  SPLATTER_SPREAD_Y,
} from "./constants";

/**
 * A cluster of expressive ink dots / splatter near the leaf-cluster base
 * (泼墨点). A few large dots, many small ones.
 */
export function drawSplatter(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const count = Math.floor(normRand(SPLATTER_COUNT_MIN, SPLATTER_COUNT_MAX + 1));
  ctx.save();
  ctx.filter = "blur(0.6px)";
  for (let i = 0; i < count; i++) {
    const dx = (BBS.next() - 0.5) * SPLATTER_SPREAD_X;
    const dy = (BBS.next() - 0.5) * SPLATTER_SPREAD_Y;
    const big = BBS.next() < 0.25;
    const r = normRand(1.5, 9) * (big ? 2.2 : 1);
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0, 2 * Math.PI);
    ctx.fillStyle = hsv(0, 0, SPLATTER_V, normRand(0.6, 0.95));
    ctx.fill();
  }
  ctx.restore();
}
