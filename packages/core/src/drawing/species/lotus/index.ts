import { BBS, mapval, normRand } from "../../FlowerCanvas";
import type { SpeciesDrawOpts } from "../index";
import {
  CWID,
  WATER_Y,
  STALK_COUNT_MIN,
  STALK_COUNT_MAX,
  STALK_X_MIN_FRAC,
  STALK_X_MAX_FRAC,
  STALK_TOP_MIN,
  STALK_TOP_MAX,
  STALK_W_LEAF,
  STALK_W_FLOWER,
  STALK_W_BUD,
  DEPTH_ALPHA_FAR,
  DEPTH_ALPHA_NEAR,
  LEAF_R_BIG_MIN,
  LEAF_R_BIG_MAX,
  LEAF_TILT_CHANCE,
  LEAF_TILT_MIN,
  FLOWER_SCENE_SCALE_MIN,
  FLOWER_SCENE_SCALE_MAX,
  REFLECT_ALPHA,
  REFLECT_SQUASH,
} from "./constants";
import { drawLotusLeaf } from "./leaf";
import { drawLotusStem } from "./stem";
import { drawFlower } from "./flower";
import { drawBud } from "./bud";
import { drawFallingPetals } from "./fallingpetal";
import { drawWaterline } from "./water";

const PI = Math.PI;
type StalkType = "leaf" | "flower" | "bud";

function pickType(): StalkType {
  const total = STALK_W_LEAF + STALK_W_FLOWER + STALK_W_BUD;
  const r = BBS.next() * total;
  if (r < STALK_W_LEAF) return "leaf";
  if (r < STALK_W_LEAF + STALK_W_FLOWER) return "flower";
  return "bud";
}

export function drawLotus(ctx: CanvasRenderingContext2D, opts: SpeciesDrawOpts): void {
  const { fast } = opts;
  const cwid = CWID;

  // ── Build stalks (x, top y, depth, type) ──
  interface Stalk {
    x: number;
    topY: number;
    depth: number;
    type: StalkType;
  }
  const count = Math.floor(normRand(STALK_COUNT_MIN, STALK_COUNT_MAX + 1));
  const stalks: Stalk[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? (i + (BBS.next() - 0.5) * 0.7) / (count - 1) : 0.5;
    const x = cwid * (STALK_X_MIN_FRAC + (STALK_X_MAX_FRAC - STALK_X_MIN_FRAC) * Math.min(1, Math.max(0, frac)));
    const depth = BBS.next();
    // Near (high depth) elements sit lower in frame; far ones higher into mist.
    const topY = mapval(depth, 0, 1, STALK_TOP_MIN, STALK_TOP_MAX) + (BBS.next() - 0.5) * cwid * 0.1;
    stalks.push({ x, topY, depth, type: pickType() });
  }
  // Far → near so nearer (darker, lower) plants overdraw the misty back ones.
  stalks.sort((a, b) => a.depth - b.depth);

  // ── Precompute per-stalk random params (so the same plants can be painted
  // twice: once for the reflection, once for real) ──
  const alphaOf = (depth: number): number => mapval(depth, 0, 1, DEPTH_ALPHA_FAR, DEPTH_ALPHA_NEAR);
  const params = stalks.map((s) => {
    const alpha = alphaOf(s.depth);
    if (s.type === "leaf") {
      return {
        s,
        alpha,
        r: normRand(LEAF_R_BIG_MIN, LEAF_R_BIG_MAX) * (0.65 + 0.5 * s.depth),
        squash: BBS.next() < LEAF_TILT_CHANCE ? normRand(LEAF_TILT_MIN, 0.9) : 1,
        rot: (BBS.next() - 0.5) * PI,
        veins: s.depth > 0.5,
      };
    }
    if (s.type === "flower") {
      return { s, alpha, scale: normRand(FLOWER_SCENE_SCALE_MIN, FLOWER_SCENE_SCALE_MAX) * (0.85 + 0.3 * s.depth) };
    }
    return { s, alpha, scale: normRand(0.4, 0.6) * (0.85 + 0.3 * s.depth) };
  });

  // Paints the whole plant set onto a context already in scene coordinates.
  // Stems + big leaves first (ink mass), then flowers + buds (pink accents) so
  // blooms read clearly among the dark pads.
  const paintPlants = (g: CanvasRenderingContext2D): void => {
    for (const p of params) {
      drawLotusStem(g, p.s.x, p.s.topY, WATER_Y, p.alpha);
      if (p.s.type === "leaf") {
        drawLotusLeaf(g, {
          cx: p.s.x,
          cy: p.s.topY,
          r: p.r!,
          depth: p.s.depth,
          squash: p.squash!,
          rot: p.rot!,
          alpha: p.alpha,
          veins: p.veins!,
        });
      }
    }
    for (const p of params) {
      if (p.s.type === "flower") drawFlower(g, p.s.x, p.s.topY, p.scale!, p.alpha);
      else if (p.s.type === "bud") drawBud(g, p.s.x, p.s.topY, p.scale!, p.alpha);
    }
    drawFallingPetals(g, cwid, STALK_TOP_MIN, WATER_Y);
  };

  // ── Output: draw the scene DIRECTLY on the target ctx under a fit-transform.
  // Drawing onto the live canvas avoids the offscreen-layer realization issues
  // seen with this canvas backend. Reflection = plants painted flipped & faded
  // below the waterline; then the real plants; then ripple lines.
  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  const margin = Math.min(targetW, targetH) * 0.04;
  const scale = Math.min((targetW - 2 * margin) / cwid, (targetH - 2 * margin) / cwid);
  const xref = (targetW - cwid * scale) / 2;
  const yref = (targetH - cwid * scale) / 2;

  ctx.save();
  ctx.translate(xref, yref);
  ctx.scale(scale, scale);

  // Reflection: mirror about the waterline, squash, fade.
  ctx.save();
  ctx.globalAlpha = REFLECT_ALPHA;
  ctx.translate(0, WATER_Y);
  ctx.scale(1, -REFLECT_SQUASH);
  ctx.translate(0, -WATER_Y);
  paintPlants(ctx);
  ctx.restore();

  // Real plants.
  paintPlants(ctx);

  // Ripple lines at the waterline.
  drawWaterline(ctx, WATER_Y, cwid);

  ctx.restore();
  void fast;
}
