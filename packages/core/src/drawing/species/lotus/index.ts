import { BBS, hsv, mapval, normRand, pnoise } from "../../FlowerCanvas";
import type { SpeciesDrawOpts } from "../index";
import {
  CWID,
  WATER_Y,
  INK_V,
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
  REFLECT_BLUR,
  SPLATTER_Y_ABOVE_WATER,
} from "./constants";
import { buildLeaf, paintLeaf, planLeaf, type LeafGeom } from "./leaf";
import { buildStem, paintStem, planStem, type StemGeom } from "./stem";
import {
  buildFlower,
  paintFlower,
  paintFlowerSilhouettes,
  planFlower,
  type FlowerGeom,
  type FlowerPlan,
} from "./flower";
import { planBud } from "./bud";
import { planFallingPetals } from "./fallingpetal";
import { buildSplatter, paintSplatter } from "./splatter";
import { buildWaterline, paintWaterline } from "./water";
import { setBlur, type Painter } from "./strokes";

const PI = Math.PI;
type StalkType = "leaf" | "flower" | "bud";

function pickType(): StalkType {
  const total = STALK_W_LEAF + STALK_W_FLOWER + STALK_W_BUD;
  const r = BBS.next() * total;
  if (r < STALK_W_LEAF) return "leaf";
  if (r < STALK_W_LEAF + STALK_W_FLOWER) return "flower";
  return "bud";
}

interface Stalk {
  x: number;
  topY: number;
  depth: number;
  type: StalkType;
}

/** Built scene: every shape is final geometry, reused by both paint passes. */
interface Scene {
  /** far → near; each stalk's stem and optional leaf. */
  stalks: { stalk: Stalk; stem: StemGeom; leaf: LeafGeom | null }[];
  /** flowers and buds, far → near. */
  blooms: FlowerGeom[];
  falling: FlowerGeom;
}

/**
 * Plan + build the whole pond. ALL randomness is consumed here, before any
 * paint call, so the real pass and the reflection pass paint the exact same
 * plants (the reflection used to re-roll petal leans, leaf rims and stem
 * bends, so it showed a different pond).
 */
function buildScene(): Scene {
  const cwid = CWID;
  const count = Math.floor(normRand(STALK_COUNT_MIN, STALK_COUNT_MAX + 1));
  const stalks: Stalk[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? (i + (BBS.next() - 0.5) * 0.7) / (count - 1) : 0.5;
    const x =
      cwid *
      (STALK_X_MIN_FRAC + (STALK_X_MAX_FRAC - STALK_X_MIN_FRAC) * Math.min(1, Math.max(0, frac)));
    const depth = BBS.next();
    // Near (high depth) elements sit lower in frame; far ones higher into mist.
    const topY =
      mapval(depth, 0, 1, STALK_TOP_MIN, STALK_TOP_MAX) + (BBS.next() - 0.5) * cwid * 0.1;
    stalks.push({ x, topY, depth, type: pickType() });
  }
  // Far → near so nearer (darker, lower) plants overdraw the misty back ones.
  stalks.sort((a, b) => a.depth - b.depth);

  const alphaOf = (depth: number): number => mapval(depth, 0, 1, DEPTH_ALPHA_FAR, DEPTH_ALPHA_NEAR);
  const tops = stalks.map((s) => {
    const alpha = alphaOf(s.depth);
    if (s.type === "leaf") {
      return {
        s,
        alpha,
        r: normRand(LEAF_R_BIG_MIN, LEAF_R_BIG_MAX) * (0.65 + 0.5 * s.depth),
        squash: BBS.next() < LEAF_TILT_CHANCE ? normRand(LEAF_TILT_MIN, 0.9) : 1,
        rot: (BBS.next() - 0.5) * PI,
        scale: 0,
      };
    }
    const scale =
      s.type === "flower"
        ? normRand(FLOWER_SCENE_SCALE_MIN, FLOWER_SCENE_SCALE_MAX) * (0.85 + 0.3 * s.depth)
        : normRand(0.4, 0.6) * (0.85 + 0.3 * s.depth);
    return { s, alpha, r: 0, squash: 1, rot: 0, scale };
  });

  // The perlin table is lazily filled from BBS on first use. Fill it here —
  // after the layout draws, exactly where the previous renderer first touched
  // it — so a seed keeps its composition (stalk count, positions, types,
  // sizes); only fine per-element detail differs from older versions.
  pnoise(0);

  const built: Scene["stalks"] = tops.map((p) => {
    const stem = buildStem(planStem(p.s.x, p.s.topY, WATER_Y, p.alpha));
    const leaf =
      p.s.type === "leaf"
        ? buildLeaf(
            planLeaf({
              cx: p.s.x,
              cy: p.s.topY,
              r: p.r,
              depth: p.s.depth,
              squash: p.squash,
              rot: p.rot,
              alpha: p.alpha,
            }),
          )
        : null;
    return { stalk: p.s, stem, leaf };
  });

  const blooms: FlowerGeom[] = [];
  for (const p of tops) {
    let plan: FlowerPlan | null = null;
    if (p.s.type === "flower") plan = planFlower(p.s.x, p.s.topY, p.scale, p.alpha);
    else if (p.s.type === "bud") plan = planBud(p.s.x, p.s.topY, p.scale, p.alpha);
    if (plan) blooms.push(buildFlower(plan));
  }
  const falling = buildFlower(planFallingPetals(cwid, STALK_TOP_MIN, WATER_Y));
  return { stalks: built, blooms, falling };
}

/** Full-detail pass (the plants above the water). */
function paintPlants(p: Painter, scene: Scene): void {
  // Stems + big leaves first (ink mass), then flowers + buds (pink accents) so
  // blooms read clearly among the dark pads.
  for (const s of scene.stalks) {
    paintStem(p, s.stem);
    if (s.leaf) paintLeaf(p, s.leaf);
  }
}

function paintBlooms(p: Painter, scene: Scene): void {
  for (const b of scene.blooms) paintFlower(p, b);
  paintFlower(p, scene.falling);
}

/**
 * Low-detail pass for the reflection: the SAME geometry, blurred. Stems are
 * batched into three depth buckets (one fill each), leaves keep their own
 * fill (their overlaps carry the reflection's tone), blooms are merged into
 * two silhouette fills — about 10–15 filtered draws in total instead of
 * repainting every contour and vein under a blur.
 */
function paintReflection(p: Painter, scene: Scene): void {
  const ctx = p.ctx;
  const buckets = [new Path2D(), new Path2D(), new Path2D()];
  for (const s of scene.stalks) {
    buckets[Math.min(2, Math.floor(s.stalk.depth * 3))].addPath(s.stem.body);
  }
  setBlur(p, REFLECT_BLUR);
  buckets.forEach((path, i) => {
    ctx.fillStyle = hsv(
      0,
      0,
      INK_V,
      0.9 * mapval((i + 0.5) / 3, 0, 1, DEPTH_ALPHA_FAR, DEPTH_ALPHA_NEAR),
    );
    ctx.fill(path);
  });
  for (const s of scene.stalks) if (s.leaf) paintLeaf(p, s.leaf, REFLECT_BLUR);
  // Blooms in two opacity buckets (far / near) → two filtered draws.
  const all = [...scene.blooms, scene.falling];
  const mid = (DEPTH_ALPHA_FAR + DEPTH_ALPHA_NEAR) / 2;
  const far = all.filter((b) => b.plan.alpha < mid);
  const near = all.filter((b) => b.plan.alpha >= mid);
  const meanAlpha = (bs: FlowerGeom[]): number =>
    bs.reduce((sum, b) => sum + b.plan.alpha, 0) / Math.max(1, bs.length);
  setBlur(p, REFLECT_BLUR);
  paintFlowerSilhouettes(p, far, meanAlpha(far));
  paintFlowerSilhouettes(p, near, meanAlpha(near));
  ctx.filter = "none";
}

export function drawLotus(ctx: CanvasRenderingContext2D, opts: SpeciesDrawOpts): void {
  const { fast } = opts;
  const cwid = CWID;

  const scene = buildScene();

  // Ink splatter at the foot of the nearest plant in the left half, leaves
  // preferred (spec: 底部左侧, 集中在叶丛根部).
  let splatX = cwid * 0.3;
  let best = -1;
  for (const s of scene.stalks) {
    const score = s.stalk.depth + (s.leaf ? 1 : 0);
    if (s.stalk.x < cwid * 0.55 && score > best) {
      best = score;
      splatX = s.stem.bottomX;
    }
  }
  const splatter = buildSplatter(splatX, WATER_Y - SPLATTER_Y_ABOVE_WATER);
  const ripples = buildWaterline(WATER_Y, cwid);

  // ── Output: draw the scene DIRECTLY on the target ctx under a fit-transform.
  // Drawing onto the live canvas avoids the offscreen-layer realization issues
  // seen with this canvas backend (an offscreen Layer + blit came out empty).
  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  const margin = Math.min(targetW, targetH) * 0.04;
  const scale = Math.min((targetW - 2 * margin) / cwid, (targetH - 2 * margin) / cwid);
  const xref = (targetW - cwid * scale) / 2;
  const yref = (targetH - cwid * scale) / 2;
  const painter: Painter = { ctx, scale };

  ctx.save();
  ctx.translate(xref, yref);
  ctx.scale(scale, scale);

  // Reflection: mirror about the waterline, squash, fade, blur.
  ctx.save();
  ctx.globalAlpha = REFLECT_ALPHA;
  ctx.translate(0, WATER_Y);
  ctx.scale(1, -REFLECT_SQUASH);
  ctx.translate(0, -WATER_Y);
  paintReflection(painter, scene);
  ctx.restore();

  // Real plants: stems + leaves, then splatter at their foot, then blooms.
  paintPlants(painter, scene);
  paintSplatter(painter, splatter);
  paintBlooms(painter, scene);

  // Ripple lines at the waterline.
  paintWaterline(painter, ripples);

  ctx.restore();
  void fast;
}
