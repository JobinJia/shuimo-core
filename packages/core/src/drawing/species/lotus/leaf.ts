import { BBS, hsv, mapval, pnoise } from "../../FlowerCanvas";
import {
  LEAF_NEAR_V,
  LEAF_FAR_V,
  LEAF_NEUTRAL_S,
  LEAF_H,
  LEAF_EDGE_BLUR_MIN,
  LEAF_EDGE_BLUR_FRAC,
} from "./constants";
import { polyPath, setBlur, type Painter, type Pt } from "./strokes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

/** Random-free leaf placement chosen by the scene. */
export interface LeafShape {
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
}

/** A fully-determined leaf: placement + its own random outline parameters. */
export interface LeafArgs extends LeafShape {
  /** perlin phase of the rim wobble. */
  phi: number;
  /** perlin frequency of the rim wobble. */
  freq: number;
  /** depth of the petiole cleft (fraction of r). */
  notchDepth: number;
}

export interface LeafGeom {
  args: LeafArgs;
  mass: Path2D;
  massCol: string;
  /** soft-edge blur, scene units. */
  blur: number;
  poolIn: string;
  poolOut: string;
}

/** Draw the leaf's random outline parameters from BBS. */
export function planLeaf(shape: LeafShape): LeafArgs {
  const phi = BBS.next() * 2 * PI;
  const freq = 1.6 + BBS.next() * 1.4;
  const notchDepth = 0.1 + BBS.next() * 0.14;
  return { ...shape, phi, freq, notchDepth };
}

/**
 * Big boneless (没骨/泼墨) ink lotus pad: a large neutral-ink mass, dark in
 * front and grey/faded in the misty back, optionally squashed into an ellipse
 * when seen edge-on. A darker pooled centre suggests splashed ink. Per the
 * line-redesign spec there is no outline and no radial veins.
 */
export function buildLeaf(a: LeafArgs): LeafGeom {
  const samples = 96;
  const cosR = cos(a.rot);
  const sinR = sin(a.rot);
  // A cleft (petiole notch) at local angle 0.
  const notchSigma = 0.22;

  const pts: Pt[] = [];
  for (let i = 0; i < samples; i++) {
    const th = (i / samples) * 2 * PI;
    const dt = th > PI ? th - 2 * PI : th;
    const notch = 1 - a.notchDepth * Math.exp(-(dt * dt) / (notchSigma * notchSigma));
    const n = pnoise(cos(th) * a.freq + a.phi, sin(th) * a.freq + a.phi);
    const rf = notch * (1 + (n - 0.5) * 0.18);
    const lx = a.r * cos(th) * rf;
    const ly = a.r * a.squash * sin(th) * rf;
    pts.push([a.cx + lx * cosR - ly * sinR, a.cy + lx * sinR + ly * cosR]);
  }
  const mass = new Path2D();
  polyPath(mass, pts);

  const v = mapval(a.depth, 0, 1, LEAF_FAR_V, LEAF_NEAR_V);
  return {
    args: a,
    mass,
    massCol: hsv(LEAF_H, LEAF_NEUTRAL_S, v, a.alpha),
    blur: Math.max(LEAF_EDGE_BLUR_MIN, a.r * LEAF_EDGE_BLUR_FRAC),
    poolIn: hsv(LEAF_H, LEAF_NEUTRAL_S, v * 0.7, a.alpha * 0.5),
    poolOut: hsv(LEAF_H, LEAF_NEUTRAL_S, v, 0),
  };
}

/**
 * Paint the pad: one blurred fill for the mass (soft wet edge) plus one
 * UNfiltered radial-gradient fill for the pooled centre (the gradient already
 * fades to zero alpha, so blurring it changed nothing but cost a blur pass).
 * `extraBlur` lets the reflection pass soften the edge further.
 */
export function paintLeaf(p: Painter, g: LeafGeom, extraBlur = 0): void {
  const ctx = p.ctx;
  const a = g.args;
  setBlur(p, Math.max(g.blur, extraBlur));
  ctx.fillStyle = g.massCol;
  ctx.fill(g.mass);
  ctx.filter = "none";

  const pr = a.r * 0.7;
  const grad = ctx.createRadialGradient(a.cx, a.cy, 0, a.cx, a.cy, pr);
  grad.addColorStop(0, g.poolIn);
  grad.addColorStop(1, g.poolOut);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(a.cx, a.cy, pr, 0, 2 * PI);
  ctx.fill();
}
