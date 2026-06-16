import { BBS, hsv, mapval, normRand, pnoise, polygon } from "../../FlowerCanvas";
import {
  LEAF_NEAR_V,
  LEAF_FAR_V,
  LEAF_NEUTRAL_S,
  LEAF_H,
  LEAF_VEIN_COUNT_MIN,
  LEAF_VEIN_COUNT_MAX,
} from "./constants";
import type { Pt } from "./strokes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

export interface LeafArgs {
  cx: number;
  cy: number;
  r: number;
  /** 0 = far/light/misty, 1 = near/dark. */
  depth: number;
  /** 1 = round top-down pad, <1 = squashed (seen edge-on). */
  squash: number;
  /** ellipse rotation (rad). */
  rot: number;
  /** whole-element opacity from atmospheric depth. */
  alpha: number;
  /** draw radial veins (near/large pads only). */
  veins: boolean;
}

/**
 * Big boneless (没骨/泼墨) ink lotus pad: a large neutral-ink mass, dark in
 * front and grey/faded in the misty back, optionally squashed into an ellipse
 * when seen edge-on, with radial veins fanning from the petiole point. A darker
 * pooled centre suggests splashed ink. Caller composites onto the plant layer.
 */
export function drawLotusLeaf(ctx: CanvasRenderingContext2D, a: LeafArgs): void {
  const samples = 96;
  const phi = BBS.next() * 2 * PI;
  const freq = 1.6 + BBS.next() * 1.4;
  const cosR = cos(a.rot);
  const sinR = sin(a.rot);
  // A cleft (petiole notch) at local angle 0.
  const notchDepth = 0.1 + BBS.next() * 0.14;
  const notchSigma = 0.22;

  const pts: Pt[] = [];
  const localR: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const th = (i / samples) * 2 * PI;
    let dt = th;
    while (dt > PI) dt -= 2 * PI;
    while (dt < -PI) dt += 2 * PI;
    const notch = 1 - notchDepth * Math.exp(-(dt * dt) / (notchSigma * notchSigma));
    const n = pnoise(cos(th) * freq + phi, sin(th) * freq + phi);
    const rf = notch * (1 + (n - 0.5) * 0.18);
    localR.push(rf);
    const lx = a.r * cos(th) * rf;
    const ly = a.r * a.squash * sin(th) * rf;
    pts.push([a.cx + lx * cosR - ly * sinR, a.cy + lx * sinR + ly * cosR, 0]);
  }

  const v = mapval(a.depth, 0, 1, LEAF_FAR_V, LEAF_NEAR_V);

  // ── Pad mass ──
  ctx.save();
  ctx.filter = `blur(${Math.max(1.5, a.r * 0.02)}px)`;
  polygon({ ctx, pts, col: hsv(LEAF_H, LEAF_NEUTRAL_S, v, a.alpha), fil: true });
  ctx.restore();

  // ── Pooled darker centre (splashed ink) ──
  ctx.save();
  ctx.filter = `blur(${Math.max(2, a.r * 0.05)}px)`;
  const grad = ctx.createRadialGradient(a.cx, a.cy, 0, a.cx, a.cy, a.r * 0.7);
  grad.addColorStop(0, hsv(LEAF_H, LEAF_NEUTRAL_S, v * 0.7, a.alpha * 0.5));
  grad.addColorStop(1, hsv(LEAF_H, LEAF_NEUTRAL_S, v, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(a.cx, a.cy, a.r * 0.7, 0, 2 * PI);
  ctx.fill();
  ctx.restore();

  // ── Radial veins from the centre ──
  if (a.veins) {
    ctx.save();
    ctx.filter = "blur(0.5px)";
    ctx.lineCap = "round";
    const veinCount = Math.floor(normRand(LEAF_VEIN_COUNT_MIN, LEAF_VEIN_COUNT_MAX + 1));
    for (let k = 0; k < veinCount; k++) {
      // Spread around, leaving a wedge near the notch (local angle 0).
      const wedge = 0.35 * PI;
      const ang = wedge + (k / Math.max(1, veinCount - 1)) * (2 * PI - 2 * wedge);
      const idx = Math.floor((ang / (2 * PI)) * samples) % samples;
      const tip = localR[idx] * 0.84;
      const segs = 9;
      ctx.beginPath();
      for (let s = 0; s <= segs; s++) {
        const u = s / segs;
        const lx = a.r * cos(ang) * tip * u + (BBS.next() - 0.5) * a.r * 0.02;
        const ly = a.r * a.squash * sin(ang) * tip * u + (BBS.next() - 0.5) * a.r * 0.02;
        const x = a.cx + lx * cosR - ly * sinR;
        const y = a.cy + lx * sinR + ly * cosR;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 0.8 + BBS.next() * 0.8;
      ctx.strokeStyle = hsv(LEAF_H, LEAF_NEUTRAL_S, v * 0.5, a.alpha * (0.4 + BBS.next() * 0.3));
      ctx.stroke();
    }
    ctx.restore();
  }
}
