# 荷花线条重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `species/lotus.ts` 的视觉/算法从"灰调渐变 blob 花 + 蓝调脉叶 + 飞白带刺茎"重写为参考图的小写意线条画法（花瓣 染+勾+脉、泼墨墨叶、细线茎、墨点），并把单文件拆成 `species/lotus/` 模块目录。

**Architecture:** 所有"线"都建立在 `FlowerCanvas.ts` 现有的 `stroke({pts,wid,col})`（中心折线 + 宽度函数 → `tubify` 填充带）之上。花瓣 = 内染渐变 fill + 左右两条 `contourWid` 锥形勾边 + 若干 `taperBoth` 脉线；叶 = `polygon` 填充的泼墨色块（无线）；茎 = 一条 `taperTail` 线 + 稀疏 `taperBoth` 小刺；墨点 = canvas arc。双图层（ink=multiply / color=normal）+ 现有 bound 裁框出口。

**Tech Stack:** TypeScript (strict, ES2020), Canvas 2D, `@shuimo/core` 的 `FlowerCanvas` 原语（`stroke`/`polygon`/`Layer`/`hsv`/`pnoise`/`BBS`/`normRand`/`mapval`）。无新增测试文件（遵守 CLAUDE.md「不要构建额外的用于测试的文件」）；每步验证 = `pnpm build` 通过；最终验证 = playground 人眼审。

**Spec:** `docs/superpowers/specs/2026-05-30-lotus-line-redesign-design.md`

---

## File Structure

```
packages/core/src/drawing/species/
├── index.ts                 # 不改：import { drawLotus } from "./lotus" → 解析到 lotus/index.ts
└── lotus/                   # 新建目录（旧 lotus.ts 删除）
    ├── index.ts             # drawLotus 构图入口 + 图层 + 出口
    ├── constants.ts         # 全部数值/颜色常量
    ├── strokes.ts           # 宽度函数库 + inkLine 封装 + jitterPath
    ├── leaf.ts              # 泼墨墨叶（polygon 填充）
    ├── stem.ts              # 细茎 + 小刺（inkLine）
    ├── splatter.ts          # 墨点（arc）
    ├── petal.ts             # 单瓣 染+勾+脉
    └── flower.ts            # 三层层叠花朵
```

依赖单向：`constants`（无依赖）← `strokes`（仅依赖 FlowerCanvas）← `leaf/stem/splatter/petal` ← `flower` ← `index`。

**Build command（每个 Task 末尾验证）：** 在仓库根目录 `/Users/jiabinbin/myself/github/shuimo-core` 运行 `pnpm build`，期望无 tsc 报错、tsdown 打包成功。

---

## Task 1: 常量模块 constants.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/constants.ts`

- [ ] **Step 1: 写 constants.ts（全部内容）**

```typescript
// All tunable numeric + colour constants for the lotus species.
// Kept in one place so visual tuning never touches algorithm modules.

const PI = Math.PI;
const deg = (d: number): number => (d * PI) / 180;

export const CWID = 1200;

// ── Composition ──
export const FLOWER_COUNT_MIN = 2;
export const FLOWER_COUNT_MAX = 3;
export const FLOWER_Y_MIN = CWID * 0.1;
export const FLOWER_Y_MAX = CWID * 0.3;
export const FLOWER_X_MIN_FRAC = 0.2;
export const FLOWER_X_MAX_FRAC = 0.8;
export const FLOWER_X_SPREAD_FRAC = 0.18;

export const LEAF_COUNT_MIN = 4;
export const LEAF_COUNT_MAX = 7;
export const LEAF_CLUSTER_Y_MIN = CWID * 0.55;
export const LEAF_CLUSTER_Y_MAX = CWID * 0.9;
export const LEAF_X_MIN_FRAC = 0.1;
export const LEAF_X_MAX_FRAC = 0.92;
export const LEAF_R_MIN = 90;
export const LEAF_R_MAX = 230;

// ── Colours ──
// Petal: rose hue, wash goes near-white at base → saturated rose at tip.
export const ROSE_H = 345;
export const PETAL_WASH_BASE_S = 0.12;
export const PETAL_WASH_BASE_V = 0.98;
export const PETAL_WASH_TIP_S = 0.55;
export const PETAL_WASH_TIP_V = 0.82;
export const PETAL_CONTOUR_S = 0.6;
export const PETAL_CONTOUR_V = 0.6;

// Leaf: dark ink-green boneless mass.
export const LEAF_H = 140;
export const LEAF_S_MIN = 0.15;
export const LEAF_S_MAX = 0.3;
export const LEAF_V_MIN = 0.12;
export const LEAF_V_MAX = 0.26;

// Ink: stems, spurs, splatter.
export const INK_V = 0.18;
export const SPLATTER_V = 0.08;

// ── Petal geometry ──
export const PETAL_LEN = 175;
export const PETAL_HALFW = 42;
export const PETAL_CONTOUR_W = 3.2;
export const PETAL_VEIN_W = 1.2;
export const PETAL_VEIN_COUNT_MIN = 2;
export const PETAL_VEIN_COUNT_MAX = 4;

// Three layers, outer → inner: petal count range, half-aperture (rad),
// length scale, per-layer value shift (inner slightly deeper rose).
export interface PetalLayer {
  countMin: number;
  countMax: number;
  aperture: number;
  lenScale: number;
  vShift: number;
}
export const PETAL_LAYERS: PetalLayer[] = [
  { countMin: 5, countMax: 6, aperture: deg(75), lenScale: 1.0, vShift: 0.06 },
  { countMin: 3, countMax: 4, aperture: deg(45), lenScale: 0.85, vShift: 0.0 },
  { countMin: 2, countMax: 3, aperture: deg(22), lenScale: 0.7, vShift: -0.08 },
];

// ── Stem ──
export const STEM_W = 3.6;
export const STEM_BOTTOM_OVERSHOOT = 30;
export const STEM_DRIFT_PX = 90;
export const STEM_BEND_PX = 90;
export const STEM_SPUR_MAX = 7; // 0..6 spurs per stem

// ── Splatter ──
export const SPLATTER_COUNT_MIN = 6;
export const SPLATTER_COUNT_MAX = 16;
export const SPLATTER_SPREAD_X = 220;
export const SPLATTER_SPREAD_Y = 160;
```

- [ ] **Step 2: 验证类型 / 编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过（此文件仅常量，旧 `lotus.ts` 仍在，registry 仍指向它，互不影响）。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/constants.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add constants module for line-based redesign

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 线条原语 strokes.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/strokes.ts`

- [ ] **Step 1: 写 strokes.ts（全部内容）**

```typescript
import { pnoise, stroke } from "../../FlowerCanvas";

/** Point in the flower-canvas Vec3 convention (z unused, kept 0). */
export type Pt = [number, number, number];

const PI = Math.PI;

/** Two-ended taper: thin at both ends, fattest mid. Veins, spurs. */
export function taperBoth(w: number): (t: number) => number {
  return (t) => w * Math.sin(t * PI);
}

/** Root-thick, tip-thin taper with a small floor so the梢 never vanishes. Stems. */
export function taperTail(w: number, k = 1.6): (t: number) => number {
  return (t) => w * (1 - Math.pow(t, k)) + w * 0.15;
}

/** Contour line: keeps width at both ends (does not vanish), gentle belly. */
export function contourWid(w: number): (t: number) => number {
  return (t) => w * (0.45 + 0.55 * Math.sin(t * PI));
}

/** Perlin micro-jitter on a path to give a hand-drawn wobble (deterministic via seed). */
export function jitterPath(pts: Pt[], amp: number, seed: number): Pt[] {
  return pts.map((p, i) => {
    const t = i / Math.max(1, pts.length - 1);
    const jy = (pnoise(t * 4 + seed, 0) - 0.5) * 2 * amp;
    const jx = (pnoise(t * 4 + seed + 100, 0) - 0.5) * 2 * amp;
    return [p[0] + jx, p[1] + jy, 0] as Pt;
  });
}

/**
 * Draw one line as a tubified variable-width FILLED ribbon (not ctx.stroke()).
 * `wid(t∈[0,1])` is the calligraphic width profile. Soft wet edge via tiny blur.
 */
export function inkLine(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  opts: { col: string; wid: (t: number) => number; blur?: number },
): void {
  if (pts.length < 3) return; // tubify needs interior points
  ctx.save();
  ctx.filter = `blur(${opts.blur ?? 0.4}px)`;
  stroke({ ctx, pts, col: opts.col, wid: opts.wid });
  ctx.restore();
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。确认 `stroke` 从 `../../FlowerCanvas` 正确导入（它是 `export function stroke`）。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/strokes.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add stroke primitives (width funcs + tubified inkLine)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 泼墨墨叶 leaf.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/leaf.ts`

- [ ] **Step 1: 写 leaf.ts（全部内容）**

```typescript
import { BBS, hsv, mapval, normRand, pnoise, polygon } from "../../FlowerCanvas";
import { LEAF_H, LEAF_S_MIN, LEAF_S_MAX, LEAF_V_MIN, LEAF_V_MAX } from "./constants";
import type { Pt } from "./strokes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

export interface LeafArgs {
  cx: number;
  cy: number;
  r: number;
  /** 0 = far/light, 1 = near/dark. */
  depth: number;
}

/**
 * Boneless (没骨) ink lotus pad: an irregular kidney/oval ink mass.
 * NO contour line and NO radial veins — the line-vs-wash contrast with the
 * drawn flowers is intentional. Caller sets multiply blend.
 */
export function drawLotusLeaf(ctx: CanvasRenderingContext2D, a: LeafArgs): void {
  const samples = 80;
  const phi = BBS.next() * 2 * PI;
  const freq = 2 + BBS.next() * 1.5;
  const squash = normRand(0.7, 1.0);
  const rot = BBS.next() * PI;
  const cosR = cos(rot);
  const sinR = sin(rot);
  const notchDepth = 0.12 + BBS.next() * 0.16;
  const notchSigma = 0.25;

  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i++) {
    const th = (i / samples) * 2 * PI;
    let dt = th;
    while (dt > PI) dt -= 2 * PI;
    while (dt < -PI) dt += 2 * PI;
    const notch = 1 - notchDepth * Math.exp(-(dt * dt) / (notchSigma * notchSigma));
    const n = pnoise(cos(th) * freq + phi, sin(th) * freq + phi);
    const rf = notch * (1 + (n - 0.5) * 0.22);
    const lx = a.r * cos(th) * rf;
    const ly = a.r * squash * sin(th) * rf;
    pts.push([a.cx + lx * cosR - ly * sinR, a.cy + lx * sinR + ly * cosR, 0]);
  }

  const v = mapval(a.depth, 0, 1, LEAF_V_MAX, LEAF_V_MIN);
  const s = mapval(a.depth, 0, 1, LEAF_S_MIN, LEAF_S_MAX);
  const alpha = mapval(a.depth, 0, 1, 0.55, 0.92);

  ctx.save();
  ctx.filter = "blur(1.5px)";
  polygon({ ctx, pts, col: hsv(LEAF_H, s, v, alpha), fil: true });
  ctx.restore();
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/leaf.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add boneless ink leaf (no contour, no veins)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 细茎 + 小刺 stem.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/stem.ts`

- [ ] **Step 1: 写 stem.ts（全部内容）**

```typescript
import { BBS, hsv, normRand } from "../../FlowerCanvas";
import { CWID, INK_V, STEM_W, STEM_BOTTOM_OVERSHOOT, STEM_DRIFT_PX, STEM_BEND_PX, STEM_SPUR_MAX } from "./constants";
import { inkLine, jitterPath, taperBoth, taperTail, type Pt } from "./strokes";

/**
 * One thin tapered ink stem from anchor (leaf/flower base) down past the
 * canvas bottom, plus a few sparse spurs. Replaces the old feibai-carved,
 * prickle-heavy stem entirely.
 */
export function drawLotusStem(ctx: CanvasRenderingContext2D, anchorX: number, anchorY: number): void {
  const bottomY = CWID + STEM_BOTTOM_OVERSHOOT;
  const bottomX = anchorX + (BBS.next() - 0.5) * STEM_DRIFT_PX;
  const bend1 = (BBS.next() - 0.5) * STEM_BEND_PX;
  const bend2 = (BBS.next() - 0.5) * STEM_BEND_PX;
  const c1x = anchorX + (bottomX - anchorX) * 0.33 + bend1;
  const c1y = anchorY + (bottomY - anchorY) * 0.33;
  const c2x = anchorX + (bottomX - anchorX) * 0.67 + bend2;
  const c2y = anchorY + (bottomY - anchorY) * 0.67;

  const bez = (t: number): Pt => {
    const u = 1 - t;
    return [
      u * u * u * anchorX + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bottomX,
      u * u * u * anchorY + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * bottomY,
      0,
    ];
  };

  const N = 40;
  let pts: Pt[] = [];
  for (let i = 0; i <= N; i++) pts.push(bez(i / N));
  pts = jitterPath(pts, 2.5, BBS.next() * 20);
  inkLine(ctx, pts, { col: hsv(0, 0, INK_V, 0.9), wid: taperTail(STEM_W), blur: 0.5 });

  // ── sparse spurs ──
  const spurCount = Math.floor(normRand(0, STEM_SPUR_MAX));
  for (let k = 0; k < spurCount; k++) {
    const i = Math.floor((0.15 + BBS.next() * 0.7) * N);
    const p = pts[i];
    const pn = pts[Math.min(i + 1, pts.length - 1)];
    const dx = pn[0] - p[0];
    const dy = pn[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const side = BBS.next() < 0.5 ? 1 : -1;
    const slen = normRand(2, 4) + 3;
    const tip: Pt = [p[0] + nx * side * slen, p[1] + ny * side * slen, 0];
    const mid: Pt = [(p[0] + tip[0]) / 2, (p[1] + tip[1]) / 2, 0];
    inkLine(ctx, [p, mid, tip], { col: hsv(0, 0, INK_V, 0.8), wid: taperBoth(0.9), blur: 0.3 });
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/stem.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add thin tapered stem with sparse spurs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 墨点 splatter.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/splatter.ts`

- [ ] **Step 1: 写 splatter.ts（全部内容）**

```typescript
import { BBS, hsv, normRand } from "../../FlowerCanvas";
import { SPLATTER_V, SPLATTER_COUNT_MIN, SPLATTER_COUNT_MAX, SPLATTER_SPREAD_X, SPLATTER_SPREAD_Y } from "./constants";

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
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/splatter.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add ink splatter dots at cluster base

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 单瓣 染+勾+脉 petal.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/petal.ts`

- [ ] **Step 1: 写 petal.ts（全部内容）**

```typescript
import { hsv, normRand } from "../../FlowerCanvas";
import {
  ROSE_H,
  PETAL_WASH_BASE_S,
  PETAL_WASH_BASE_V,
  PETAL_WASH_TIP_S,
  PETAL_WASH_TIP_V,
  PETAL_CONTOUR_S,
  PETAL_CONTOUR_V,
  PETAL_CONTOUR_W,
  PETAL_VEIN_W,
  PETAL_VEIN_COUNT_MIN,
  PETAL_VEIN_COUNT_MAX,
} from "./constants";
import { contourWid, inkLine, taperBoth, type Pt } from "./strokes";

const PI = Math.PI;
const sin = Math.sin;
const cos = Math.cos;

export interface PetalArgs {
  baseX: number;
  baseY: number;
  /** spine direction, screen radians (-PI/2 = straight up). */
  angle: number;
  length: number;
  halfW: number;
  /** perpendicular bow of the spine (px). */
  bend: number;
  /** widest point along spine, 0..1. */
  widePos: number;
  /** left/right asymmetry, -1..1. */
  curl: number;
  /** per-layer value offset. */
  vShift: number;
  alpha: number;
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * One lotus petal painted as 染 (interior wash, base→tip rose gradient) +
 * 勾 (two tapered contour strokes down each silhouette edge) + 脉 (a few fine
 * vein strokes from the base). Every line is a tubified variable-width ribbon.
 */
export function drawPetal(ctx: CanvasRenderingContext2D, a: PetalArgs): void {
  const ax = cos(a.angle);
  const ay = sin(a.angle);
  const px = -ay; // perpendicular
  const py = ax;
  const N = 24;

  // Spine: straight axis + perpendicular bow peaking mid.
  const spine: Pt[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const sx = a.baseX + ax * a.length * t;
    const sy = a.baseY + ay * a.length * t;
    const bow = sin(t * PI) * a.bend;
    spine.push([sx + px * bow, sy + py * bow, 0]);
  }

  // Half-width profile rising to widePos then falling (teardrop).
  const halfAt = (t: number): number => {
    const wp = Math.max(0.12, a.widePos);
    const rise = Math.pow(sin(Math.min(1, t / wp) * PI * 0.5), 0.85);
    const fall = Math.pow(sin(Math.min(1, (1 - t) / (1 - wp)) * PI * 0.5), 0.85);
    return a.halfW * Math.min(rise, fall);
  };

  const left: Pt[] = [];
  const right: Pt[] = [];
  const lf = 1 - a.curl * 0.35;
  const rf = 1 + a.curl * 0.35;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const hw = halfAt(t);
    const s = spine[i];
    left.push([s[0] + px * hw * lf, s[1] + py * hw * lf, 0]);
    right.push([s[0] - px * hw * rf, s[1] - py * hw * rf, 0]);
  }

  // ── 染 wash ──
  ctx.save();
  ctx.filter = "blur(0.6px)";
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  const tipX = spine[N][0];
  const tipY = spine[N][1];
  const grad = ctx.createLinearGradient(a.baseX, a.baseY, tipX, tipY);
  grad.addColorStop(0, hsv(ROSE_H, PETAL_WASH_BASE_S, clamp01(PETAL_WASH_BASE_V + a.vShift), a.alpha));
  grad.addColorStop(1, hsv(ROSE_H, PETAL_WASH_TIP_S, clamp01(PETAL_WASH_TIP_V + a.vShift), a.alpha));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // ── 勾 contour: two edge strokes ──
  const cc = hsv(ROSE_H, PETAL_CONTOUR_S, clamp01(PETAL_CONTOUR_V + a.vShift), clamp01(a.alpha + 0.1));
  inkLine(ctx, left, { col: cc, wid: contourWid(PETAL_CONTOUR_W), blur: 0.4 });
  inkLine(ctx, right, { col: cc, wid: contourWid(PETAL_CONTOUR_W), blur: 0.4 });

  // ── 脉 veins: fan from base toward tip ──
  const veinCol = hsv(ROSE_H, PETAL_CONTOUR_S * 0.7, clamp01(PETAL_CONTOUR_V + 0.18), a.alpha * 0.6);
  const veinCount = Math.floor(normRand(PETAL_VEIN_COUNT_MIN, PETAL_VEIN_COUNT_MAX + 1));
  for (let v = 0; v < veinCount; v++) {
    const spread = (v / Math.max(1, veinCount - 1) - 0.5) * 0.5;
    const M = 10;
    const vpts: Pt[] = [];
    for (let i = 0; i <= M; i++) {
      const t = 0.08 + (i / M) * 0.82;
      const s = spine[Math.round(t * N)];
      const hw = halfAt(t) * spread;
      vpts.push([s[0] + px * hw, s[1] + py * hw, 0]);
    }
    inkLine(ctx, vpts, { col: veinCol, wid: taperBoth(PETAL_VEIN_W), blur: 0.3 });
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/petal.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add petal as wash + two contour strokes + veins

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 三层层叠花朵 flower.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/flower.ts`

- [ ] **Step 1: 写 flower.ts（全部内容）**

```typescript
import { BBS, normRand } from "../../FlowerCanvas";
import { PETAL_LAYERS, PETAL_LEN, PETAL_HALFW } from "./constants";
import { drawPetal } from "./petal";

const PI = Math.PI;

/**
 * One side-view lotus bloom: three concentric petal layers (outer→inner) with
 * decreasing aperture. Outer layer is painted first so inner petals overlap on
 * top, giving the cupped stacked-petal silhouette.
 */
export function drawFlower(ctx: CanvasRenderingContext2D, fx: number, fy: number): void {
  for (let layer = 0; layer < PETAL_LAYERS.length; layer++) {
    const L = PETAL_LAYERS[layer];
    const count = Math.floor(normRand(L.countMin, L.countMax + 1));
    const baseAngle = -PI / 2; // upward
    for (let i = 0; i < count; i++) {
      const frac = count === 1 ? 0.5 : i / (count - 1);
      const spread = (frac - 0.5) * 2 * L.aperture;
      const angle = baseAngle + spread + (BBS.next() - 0.5) * 0.12;
      drawPetal(ctx, {
        baseX: fx + (BBS.next() - 0.5) * 10,
        baseY: fy + (BBS.next() - 0.5) * 6,
        angle,
        length: PETAL_LEN * L.lenScale * normRand(0.85, 1.1),
        halfW: PETAL_HALFW * normRand(0.85, 1.15),
        bend: (BBS.next() - 0.5) * 20,
        widePos: normRand(0.4, 0.6),
        curl: (BBS.next() - 0.5) * 0.6,
        vShift: L.vShift,
        alpha: 0.95,
      });
    }
  }
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/drawing/species/lotus/flower.ts
git commit -m "$(cat <<'EOF'
feat(lotus): add three-layer side-view bloom

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 构图入口 index.ts + 删除旧 lotus.ts

**Files:**
- Create: `packages/core/src/drawing/species/lotus/index.ts`
- Delete: `packages/core/src/drawing/species/lotus.ts`
- Verify-unchanged: `packages/core/src/drawing/species/index.ts`（`import { drawLotus } from "./lotus"` 会解析到新目录的 `index.ts`，无需改动）

- [ ] **Step 1: 写 lotus/index.ts（全部内容）**

```typescript
import { BBS, Layer, mapval, normRand } from "../../FlowerCanvas";
import type { SpeciesDrawOpts } from "../index";
import {
  CWID,
  FLOWER_COUNT_MIN,
  FLOWER_COUNT_MAX,
  FLOWER_Y_MIN,
  FLOWER_Y_MAX,
  FLOWER_X_MIN_FRAC,
  FLOWER_X_MAX_FRAC,
  FLOWER_X_SPREAD_FRAC,
  LEAF_COUNT_MIN,
  LEAF_COUNT_MAX,
  LEAF_CLUSTER_Y_MIN,
  LEAF_CLUSTER_Y_MAX,
  LEAF_X_MIN_FRAC,
  LEAF_X_MAX_FRAC,
  LEAF_R_MIN,
  LEAF_R_MAX,
} from "./constants";
import { drawLotusLeaf } from "./leaf";
import { drawLotusStem } from "./stem";
import { drawSplatter } from "./splatter";
import { drawFlower } from "./flower";

export function drawLotus(ctx: CanvasRenderingContext2D, opts: SpeciesDrawOpts): void {
  const { xof, yof, fast } = opts;
  const cwid = CWID;
  const inkLayer = Layer.empty(cwid);
  const colorLayer = Layer.empty(cwid);

  // ── Leaves (back-to-front by depth) ──
  type Leaf = { cx: number; cy: number; r: number; depth: number };
  const leafCount = Math.floor(normRand(LEAF_COUNT_MIN, LEAF_COUNT_MAX + 1));
  const leaves: Leaf[] = [];
  for (let i = 0; i < leafCount; i++) {
    leaves.push({
      cx: cwid * (LEAF_X_MIN_FRAC + (LEAF_X_MAX_FRAC - LEAF_X_MIN_FRAC) * BBS.next()),
      cy: mapval(BBS.next(), 0, 1, LEAF_CLUSTER_Y_MIN, LEAF_CLUSTER_Y_MAX),
      r: normRand(LEAF_R_MIN, LEAF_R_MAX),
      depth: BBS.next(),
    });
  }
  leaves.sort((a, b) => a.depth - b.depth);

  // ── Flower positions (min horizontal spread) ──
  const flowerCount = Math.floor(normRand(FLOWER_COUNT_MIN, FLOWER_COUNT_MAX + 1));
  const minSpread = cwid * FLOWER_X_SPREAD_FRAC;
  const flowerXs: number[] = [];
  let attempts = 0;
  while (flowerXs.length < flowerCount && attempts < 30) {
    const c = cwid * (FLOWER_X_MIN_FRAC + (FLOWER_X_MAX_FRAC - FLOWER_X_MIN_FRAC) * BBS.next());
    if (flowerXs.every((x) => Math.abs(x - c) >= minSpread)) flowerXs.push(c);
    attempts++;
  }
  const flowers = flowerXs.map((fx) => ({
    fx,
    fy: mapval(BBS.next(), 0, 1, FLOWER_Y_MIN, FLOWER_Y_MAX),
  }));

  // ── Ink layer: stems → leaves (multiply) ──
  inkLayer.ctx.save();
  inkLayer.ctx.globalCompositeOperation = "multiply";
  for (const lf of leaves) drawLotusStem(inkLayer.ctx, lf.cx, lf.cy);
  for (const f of flowers) drawLotusStem(inkLayer.ctx, f.fx, f.fy);
  for (const lf of leaves) drawLotusLeaf(inkLayer.ctx, lf);
  inkLayer.ctx.restore();

  // Splatter near the leaf-cluster base.
  drawSplatter(inkLayer.ctx, cwid * 0.3, cwid * 0.82);

  // ── Colour layer: flowers ──
  for (const f of flowers) drawFlower(colorLayer.ctx, f.fx, f.fy);

  // ── Output (same framing as the previous implementation) ──
  let xref: number;
  let yref: number;
  if (fast) {
    xref = xof - cwid / 2;
    yref = yof - Math.round(cwid * 0.9);
    ctx.save();
    Layer.blit(ctx, inkLayer.ctx, { ble: "multiply", xof: xref, yof: yref });
    Layer.blit(ctx, colorLayer.ctx, { ble: "normal", xof: xref, yof: yref });
    ctx.restore();
    return;
  }

  const b1 = Layer.bound(inkLayer.ctx);
  const b2 = Layer.bound(colorLayer.ctx);
  const bd = {
    xmin: Math.min(b1.xmin, b2.xmin),
    xmax: Math.max(b1.xmax, b2.xmax),
    ymin: Math.min(b1.ymin, b2.ymin),
    ymax: Math.max(b1.ymax, b2.ymax),
  };
  const targetW = ctx.canvas.width;
  const targetH = ctx.canvas.height;
  const contentW = Math.max(1, bd.xmax - bd.xmin);
  const contentH = Math.max(1, bd.ymax - bd.ymin);
  const horizMargin = targetW * 0.05;
  const topMargin = targetH * 0.04;
  const bottomMargin = targetH * 0.04;
  const scale = Math.min(
    1,
    (targetW - 2 * horizMargin) / contentW,
    (targetH - topMargin - bottomMargin) / contentH,
  );
  xref = (targetW - contentW * scale) / 2 - bd.xmin * scale;
  yref = targetH - bottomMargin - bd.ymax * scale;
  void xof;
  void yof;
  ctx.save();
  ctx.scale(scale, scale);
  Layer.blit(ctx, inkLayer.ctx, { ble: "multiply", xof: xref / scale, yof: yref / scale });
  Layer.blit(ctx, colorLayer.ctx, { ble: "normal", xof: xref / scale, yof: yref / scale });
  ctx.restore();
}
```

- [ ] **Step 2: 删除旧单文件**

Run: `git rm packages/core/src/drawing/species/lotus.ts`
（`species/index.ts` 的 `import { drawLotus } from "./lotus"` 现在解析到 `lotus/index.ts`，无需改。）

- [ ] **Step 3: 验证编译**

Run: `cd /Users/jiabinbin/myself/github/shuimo-core && pnpm build`
Expected: 通过。若报「找不到 ./lotus」说明目录 index.ts 未被解析——确认 `lotus/index.ts` 导出了 `drawLotus`。

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/drawing/species/lotus/index.ts
git rm --cached packages/core/src/drawing/species/lotus.ts 2>/dev/null || true
git add -A packages/core/src/drawing/species/
git commit -m "$(cat <<'EOF'
refactor(lotus): wire line-based composition, drop old monolith

Replace the 1053-line single-file lotus (grey gradient blobs, blue veined
pads, feibai stems) with a modular xieyi line painting: wash+contour+vein
petals, boneless ink leaves, thin tapered stems, ink splatter.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Playground 人眼审 + 调参

**Files:**
- (no code change unless tuning) `packages/core/src/drawing/species/lotus/constants.ts`

- [ ] **Step 1: 确认 demo 仍可用**

确认 `playground/src/demos/LotusCanvasDemo.vue` 调用 `generateFlowerCanvas({ species: "lotus", ... })`（接口未变，应无需改）。

- [ ] **Step 2: 起 playground 出图（用户手动）**

> ⚠️ CLAUDE.md：Never auto-start dev servers。请用户手动 `! pnpm playground`，访问 `/lotus`，截图。

- [ ] **Step 3: 对照参考图审，列出调参项**

对照 `/Users/jiabinbin/.vimo/eterm/tmp/clipboard/clipboard_1780078359569.png`，检查：
- 花瓣勾线粗细（`PETAL_CONTOUR_W`）、玫红浓度（`PETAL_CONTOUR_*` / `PETAL_WASH_*`）
- 三层张开角与瓣数（`PETAL_LAYERS`）
- 叶墨浓度/大小（`LEAF_V_*` / `LEAF_R_*`）
- 茎粗细（`STEM_W`）与刺量（`STEM_SPUR_MAX`）
- 墨点量与位置（`SPLATTER_*`）
- 整体留白/裁框（出口 margin）

仅改 `constants.ts`，每轮 `pnpm build` 后重新出图，直到观感贴合参考图。

- [ ] **Step 4: Commit（调参收敛后）**

```bash
git add packages/core/src/drawing/species/lotus/constants.ts
git commit -m "$(cat <<'EOF'
chore(lotus): tune line/colour constants to match reference

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:** 染+勾+脉花瓣→Task 6；三层层叠→Task 7；泼墨叶→Task 3；细茎+刺→Task 4；墨点→Task 5；唯一 tubify 线条原语+宽度函数→Task 2；色彩规约+常量→Task 1；双图层+裁框出口→Task 8；模块拆分→Task 1–8 目录；OOS（莲蓬/花心/colorScheme/PaintingGenerator/golden）均未触及。✅ 全覆盖。

**Placeholder scan:** 每个 code step 均为完整可写入内容，无 TBD/TODO/「类似 Task N」。✅

**Type consistency:** `Pt = [number,number,number]` 贯穿 strokes/leaf/stem/petal/index；`inkLine(ctx,pts,{col,wid,blur})`、`taperBoth/taperTail/contourWid(w)=>(t)=>number`、`drawPetal(ctx,PetalArgs)`、`drawFlower(ctx,fx,fy)`、`drawLotusLeaf(ctx,LeafArgs)`、`drawLotusStem(ctx,x,y)`、`drawSplatter(ctx,x,y)`、`drawLotus(ctx,SpeciesDrawOpts)` 在定义与调用处签名一致。`PetalLayer` 字段（countMin/countMax/aperture/lenScale/vShift）在 Task 1 定义、Task 7 消费一致。✅

**注意：** 因 CLAUDE.md 禁止新增测试文件，本计划无 test-file TDD；验证靠 `pnpm build` + playground 人眼审（见各 Task Step 与 Task 9）。
