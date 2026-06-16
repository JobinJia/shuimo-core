import { BBS, hsv } from "../../FlowerCanvas";
import { REFLECT_SQUASH, REFLECT_ALPHA, REFLECT_BLUR } from "./constants";

/**
 * Draw a water reflection of the plants: the plant image flipped about the
 * waterline, vertically squashed, faded and blurred — a soft mirror on the pond.
 */
export function drawReflection(
  dstCtx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  waterY: number,
): void {
  dstCtx.save();
  dstCtx.globalAlpha = REFLECT_ALPHA;
  dstCtx.filter = `blur(${REFLECT_BLUR}px)`;
  // Mirror about waterY, then squash vertically.
  dstCtx.translate(0, waterY);
  dstCtx.scale(1, -REFLECT_SQUASH);
  dstCtx.translate(0, -waterY);
  dstCtx.drawImage(srcCanvas, 0, 0);
  dstCtx.restore();
}

/**
 * A few faint horizontal ripple lines at the waterline to seat the reflection.
 */
export function drawWaterline(ctx: CanvasRenderingContext2D, waterY: number, cwid: number): void {
  ctx.save();
  ctx.lineCap = "round";
  const lines = 5;
  for (let i = 0; i < lines; i++) {
    const y = waterY + (BBS.next() - 0.3) * 28;
    const x0 = cwid * (0.04 + 0.25 * BBS.next());
    const x1 = cwid * (0.6 + 0.36 * BBS.next());
    const midY = y + (BBS.next() - 0.5) * 6;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo((x0 + x1) / 2, midY, x1, y);
    ctx.lineWidth = 0.8 + BBS.next() * 0.8;
    ctx.strokeStyle = hsv(0, 0, 0.45, 0.1 + BBS.next() * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}
