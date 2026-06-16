# 本梅花 — WinterPlum 重写 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `WinterPlum` 重写为模块文件夹，复刻参考图的单色梅花水墨——浓墨湿笔+飞白老干、细劲上挑新枝、圈花白梅（淡墨轮廓+放射点蕊）、深墨圆苞；保留现有 API 与 SVG 字符串返回。

**Architecture:** 新建 `packages/core/src/elements/natural/winter-plum/`，仿 lotus 的单一职责拆分（`constants / trunk / branch / flower / bud / index`），但保持返回 SVG 字符串。`index` 用单一 `prng.seed(seed)` 驱动：选构图 → 画老干（收集出枝点/锚点）→ 递归新枝（补锚点）→ 按密度在锚点撒花/苞。

**Tech Stack:** TypeScript (strict, ES2020), 现有 `drawing/Brush`(flyingWhite)/`Blob`/`Stroke` + `foundation/noise`/`random`，字符串拼接 SVG。

**Spec:** `docs/superpowers/specs/2026-05-31-winter-plum-redesign-design.md`

---

## ⚠️ 提交策略（覆盖 skill 默认）

用户的长期规则：**视觉改动在用户看到并认可渲染结果前，不要提交**（`feedback_never_commit_first` / `feedback_no_proactive_commit_offer`）。因此本计划：

- 每个实现任务用 `pnpm build`（tsc --noEmit + bundle）和 `pnpm lint` 验证，**不在任务内提交**。
- Task 8 是 **playground 视觉验收门**——必须让用户在浏览器看到渲染结果。
- Task 9 是**唯一的提交任务**，且仅在用户明确认可后执行（用户会说「提交」）。

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `packages/core/src/elements/natural/winter-plum/constants.ts` | 类型、默认值、飞白预设→数值映射 |
| `packages/core/src/elements/natural/winter-plum/trunk.ts` | 老干路径生成 + 浓墨湿笔/飞白渲染，返回 `{svg, anchors, branchOrigins}` |
| `packages/core/src/elements/natural/winter-plum/branch.ts` | 递归新枝 + 锚点收集 |
| `packages/core/src/elements/natural/winter-plum/flower.ts` | 圈花 / 点厾 花朵 |
| `packages/core/src/elements/natural/winter-plum/bud.ts` | 深墨圆苞 |
| `packages/core/src/elements/natural/winter-plum/index.ts` | `WinterPlum` 编排类 + `winterPlum`/`plumBlossoms` + `WinterPlumOptions` |
| `packages/core/src/elements/natural/index.ts` | 改导出路径 `./WinterPlum` → `./winter-plum`（修改） |
| `packages/core/src/elements/natural/WinterPlum.ts` | 删除 |
| `playground/src/demos/FourGentlemenDemo.vue` | 更新 winterPlum case 用新默认/选项（修改） |

---

## Task 1: constants.ts — 类型与默认值

**Files:**
- Create: `packages/core/src/elements/natural/winter-plum/constants.ts`

- [ ] **Step 1: 写文件**

```ts
/** 出枝/落花锚点，沿用旧 WinterPlum 的结构 */
export interface BranchPoint {
  x: number;
  y: number;
  angle: number;
  depth: number;
}

export type PetalStyle = "quanhua" | "diancuo";
export type Composition = "upright-s" | "diagonal";
export type FlyingWhitePreset = "strong" | "medium" | "none";

/** 默认纯水墨调色板与尺寸 */
export const DEFAULTS = {
  hei: 200,
  wid: 10,
  branches: 2,
  flowerDensity: 0.4,
  withBuds: true,
  /** 枝干浓墨 */
  col: "rgba(28,24,19,0.92)",
  /** 花瓣淡墨轮廓 */
  flowerColor: "rgba(125,117,107,1)",
  petalStyle: "quanhua" as PetalStyle,
  composition: "upright-s" as Composition,
  flyingWhite: "strong" as FlyingWhitePreset,
};

/** 飞白预设 → Brush.stroke 数值强度 (0-1)，数值实现时按目测微调 */
export const FLYING_WHITE_INTENSITY: Record<FlyingWhitePreset, number> = {
  strong: 0.7,
  medium: 0.4,
  none: 0,
};
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: 通过（新文件被 tsc 收录，无 error）。

---

## Task 2: trunk.ts — 老干

**Files:**
- Create: `packages/core/src/elements/natural/winter-plum/trunk.ts`

- [ ] **Step 1: 写文件**

```ts
import type { Polygon } from "../../../foundation/geometry";
import { noise } from "../../../foundation/noise";
import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";
import type { BranchPoint, Composition } from "./constants";

export interface TrunkOptions {
  x: number;
  y: number;
  hei: number;
  wid: number;
  col: string;
  composition: Composition;
  /** 0-1 飞白强度 */
  flyingWhite: number;
}

export interface TrunkResult {
  svg: string;
  anchors: BranchPoint[];
  /** 新枝起点 */
  branchOrigins: { x: number; y: number; angle: number }[];
}

export function drawTrunk(opts: TrunkOptions): TrunkResult {
  const { x, y, hei, wid, col, composition, flyingWhite } = opts;
  const points: Polygon = [];
  const anchors: BranchPoint[] = [];
  const branchOrigins: { x: number; y: number; angle: number }[] = [];

  const steps = Math.max(24, Math.floor(hei / 8));
  const n0 = prng.next() * 100;

  // 主生长方向（数学角，-PI/2 向上；SVG y 向下，sin 取负即向上）
  const baseAngle = composition === "diagonal" ? -Math.PI / 4 : -Math.PI / 2;
  // S 形摆幅（占高比例）
  const sway = (composition === "diagonal" ? 0.1 : 0.16) * hei;
  const swayDir = prng.next() < 0.5 ? 1 : -1;
  const perp = baseAngle + Math.PI / 2;
  const stepBucket = Math.max(1, Math.floor(steps / 4));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const along = hei * t;
    const sCurve = Math.sin(t * Math.PI * 1.2) * sway * swayDir;
    const gnarl = (noise.noise(t * 3, n0) - 0.5) * wid * 2.2;
    const px = x + Math.cos(baseAngle) * along + Math.cos(perp) * (sCurve + gnarl);
    const py = y + Math.sin(baseAngle) * along + Math.sin(perp) * (sCurve + gnarl);
    points.push([px, py]);

    // 上 2/3 段生新枝起点
    if (i > steps * 0.3 && i % stepBucket === 0) {
      const dir =
        baseAngle + (prng.next() < 0.5 ? 1 : -1) * (Math.PI / 4 + (prng.next() * Math.PI) / 6);
      branchOrigins.push({ x: px, y: py, angle: dir });
    }
    if (i > 0 && i % 4 === 0) {
      anchors.push({ x: px, y: py, angle: baseAngle, depth: 3 });
    }
  }

  // 湿墨核（不飞白，略窄，托底）
  const core = Brush.stroke(points, {
    width: wid * 0.92,
    color: col,
    pressure: (t: number) => 1 - t * 0.55,
    inkStart: 1,
    inkEnd: 0.7,
    noise: 0.35,
    flyingWhite: 0,
  });
  // 表层（飞白枯笔）
  const surface = Brush.stroke(points, {
    width: wid,
    color: col,
    pressure: (t: number) => 1 - t * 0.55,
    inkStart: 0.9,
    inkEnd: 0.45,
    noise: 0.55,
    flyingWhite,
    texture: 6,
  });

  return { svg: core + surface, anchors, branchOrigins };
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: 通过。

---

## Task 3: branch.ts — 新枝

**Files:**
- Create: `packages/core/src/elements/natural/winter-plum/branch.ts`

- [ ] **Step 1: 写文件**

```ts
import type { Polygon } from "../../../foundation/geometry";
import { noise } from "../../../foundation/noise";
import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";
import type { BranchPoint } from "./constants";

export interface BranchOptions {
  x: number;
  y: number;
  angle: number;
  length: number;
  width: number;
  col: string;
  /** 0-1 飞白强度 */
  flyingWhite: number;
  depth: number;
  /** 花/苞锚点，原地追加 */
  anchors: BranchPoint[];
}

export function drawBranch(opts: BranchOptions): string {
  const { x, y, angle, length, width, col, flyingWhite, depth, anchors } = opts;
  if (depth <= 0 || length < 14 || width < 0.8) return "";

  const points: Polygon = [];
  const steps = Math.max(8, Math.floor(length / 6));
  const n0 = prng.next() * 100;
  const bend = (prng.next() - 0.5) * 0.5;
  const perp = angle + Math.PI / 2;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = Math.sin(t * Math.PI) * bend * length * 0.25;
    const gnarl = (noise.noise(t * 4, n0) - 0.5) * width;
    const px = x + Math.cos(angle) * length * t + Math.cos(perp) * (curve + gnarl);
    const py = y + Math.sin(angle) * length * t + Math.sin(perp) * (curve + gnarl);
    points.push([px, py]);
    if (i > 0 && i % 2 === 0) {
      anchors.push({ x: px, y: py, angle, depth });
    }
  }

  let svg = Brush.stroke(points, {
    width,
    color: col,
    pressure: (t: number) => Math.max(0.15, 1 - t * 0.8),
    inkStart: 0.85,
    inkEnd: 0.4,
    noise: 0.5,
    flyingWhite: flyingWhite * 0.6,
  });

  // 子枝向上挑
  const subCount = depth > 1 ? 1 + Math.floor(prng.next() * 2) : 0;
  for (let i = 0; i < subCount; i++) {
    const t = 0.4 + prng.next() * 0.5;
    const idx = Math.floor(t * (points.length - 1));
    const pt = points[idx];
    const tiltUp = -Math.PI / 2;
    const subAngle = angle * 0.4 + tiltUp * 0.6 + (prng.next() - 0.5) * (Math.PI / 3);
    svg += drawBranch({
      x: pt[0],
      y: pt[1],
      angle: subAngle,
      length: length * (0.45 + prng.next() * 0.3),
      width: width * (0.5 + prng.next() * 0.25),
      col,
      flyingWhite,
      depth: depth - 1,
      anchors,
    });
  }
  return svg;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: 通过。

---

## Task 4: flower.ts — 圈花 / 点厾

**Files:**
- Create: `packages/core/src/elements/natural/winter-plum/flower.ts`

- [ ] **Step 1: 写文件**

```ts
import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";
import { blob } from "../../../drawing/Blob";
import type { PetalStyle } from "./constants";

export interface FlowerOptions {
  petalStyle: PetalStyle;
  /** 花瓣墨色 */
  color: string;
  size: number;
}

/** 把 rgba() 颜色按 factor 加深（用于花蕊） */
function darken(color: string, factor: number): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return color;
  const r = Math.floor(Number(m[1]) * factor);
  const g = Math.floor(Number(m[2]) * factor);
  const b = Math.floor(Number(m[3]) * factor);
  const a = m[4] ? Number(m[4]) : 1;
  return `rgba(${r},${g},${b},${a})`;
}

/** 圈花：留白瓣 + 淡墨轮廓 + 放射深点蕊 */
function drawQuanhua(x: number, y: number, col: string, size: number): string {
  const petalCount = 5;
  const rx = size * 0.62;
  const ry = size * 0.74;
  const stamenCol = darken(col, 0.4);
  let svg = "";

  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 - Math.PI / 2 + (prng.next() - 0.5) * 0.18;
    const cx = x + Math.cos(a) * size * 0.5;
    const cy = y + Math.sin(a) * size * 0.5;
    const deg = (a * 180) / Math.PI + 90;
    const dash = (rx + ry) * 1.6; // 留小缺口，像手写的圈
    svg +=
      `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" ` +
      `transform="rotate(${deg.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})" ` +
      `fill="none" stroke="${col}" stroke-width="${(size * 0.13).toFixed(2)}" ` +
      `stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(dash * 0.18).toFixed(1)}"/>`;
  }

  const stamenCount = 6 + Math.floor(prng.next() * 4);
  for (let i = 0; i < stamenCount; i++) {
    const a = prng.next() * Math.PI * 2;
    const len = size * (0.32 + prng.next() * 0.34);
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    svg +=
      `<line x1="${x.toFixed(2)}" y1="${y.toFixed(2)}" x2="${ex.toFixed(2)}" y2="${ey.toFixed(2)}" ` +
      `stroke="${stamenCol}" stroke-width="${(size * 0.05).toFixed(2)}" stroke-linecap="round"/>`;
    svg += Brush.dot(ex, ey, { width: size * 0.13, color: stamenCol, noise: 0.6 });
  }
  svg += Brush.dot(x, y, { width: size * 0.18, color: stamenCol, noise: 0.5 });
  return svg;
}

/** 点厾：实心墨瓣 + 简化蕊 */
function drawDiancuo(x: number, y: number, col: string, size: number): string {
  const petalCount = 5;
  const stamenCol = darken(col, 0.35);
  let svg = "";

  for (let i = 0; i < petalCount; i++) {
    const a = (i / petalCount) * Math.PI * 2 - Math.PI / 2 + (prng.next() - 0.5) * 0.2;
    const cx = x + Math.cos(a) * size * 0.5;
    const cy = y + Math.sin(a) * size * 0.5;
    svg += blob(cx, cy, { len: size * 0.95, wid: size * 0.62, ang: a, col, ret: 0 }) as string;
  }

  const stamenCount = 4 + Math.floor(prng.next() * 3);
  for (let i = 0; i < stamenCount; i++) {
    const a = prng.next() * Math.PI * 2;
    const d = size * (0.15 + prng.next() * 0.25);
    svg += Brush.dot(x + Math.cos(a) * d, y + Math.sin(a) * d, {
      width: size * 0.1,
      color: stamenCol,
      noise: 0.6,
    });
  }
  svg += Brush.dot(x, y, { width: size * 0.16, color: stamenCol, noise: 0.5 });
  return svg;
}

export function drawFlower(x: number, y: number, opts: FlowerOptions): string {
  return opts.petalStyle === "diancuo"
    ? drawDiancuo(x, y, opts.color, opts.size)
    : drawQuanhua(x, y, opts.color, opts.size);
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: 通过。

---

## Task 5: bud.ts — 花苞

**Files:**
- Create: `packages/core/src/elements/natural/winter-plum/bud.ts`

- [ ] **Step 1: 写文件**

```ts
import { prng } from "../../../foundation/random";
import { Brush } from "../../../drawing/Brush";

/** 枝头深墨圆苞 + 小萼点 */
export function drawBud(x: number, y: number, col: string, size = 5): string {
  const r = size * (0.8 + prng.next() * 0.5);
  let svg = Brush.dot(x, y, { width: r, color: col, noise: 0.5 });
  const a = -Math.PI / 2 + (prng.next() - 0.5) * 0.6;
  svg += Brush.dot(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, {
    width: r * 0.5,
    color: col,
    noise: 0.6,
  });
  return svg;
}
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: 通过。

---

## Task 6: index.ts — 编排类与公开 API

**Files:**
- Create: `packages/core/src/elements/natural/winter-plum/index.ts`

- [ ] **Step 1: 写文件**

```ts
import { prng } from "../../../foundation/random";
import {
  DEFAULTS,
  FLYING_WHITE_INTENSITY,
  type BranchPoint,
  type Composition,
  type FlyingWhitePreset,
  type PetalStyle,
} from "./constants";
import { drawTrunk } from "./trunk";
import { drawBranch } from "./branch";
import { drawFlower } from "./flower";
import { drawBud } from "./bud";

export interface WinterPlumOptions {
  /** 主干高度 */
  hei?: number;
  /** 主干宽度 */
  wid?: number;
  /** 主干数量 */
  branches?: number;
  /** 落花密度 (0-1) */
  flowerDensity?: number;
  /** 花瓣墨色 */
  flowerColor?: string;
  /** 是否含花苞 */
  withBuds?: boolean;
  /** 枝干墨色 */
  col?: string;
  /** 花瓣画法，默认圈花 */
  petalStyle?: PetalStyle;
  /** 构图走势，默认主干 S 上扬 */
  composition?: Composition;
  /** 飞白强度预设，默认强 */
  flyingWhite?: FlyingWhitePreset;
}

export interface PlumBlossomOptions {
  count?: number;
  size?: number;
  col?: string;
  petalStyle?: PetalStyle;
}

export class WinterPlum {
  static generate(
    xoff: number,
    yoff: number,
    seed: number,
    options: WinterPlumOptions = {},
  ): string {
    prng.seed(seed);

    const hei = options.hei ?? DEFAULTS.hei;
    const wid = options.wid ?? DEFAULTS.wid;
    const branchCount = Math.max(1, options.branches ?? DEFAULTS.branches);
    const density = options.flowerDensity ?? DEFAULTS.flowerDensity;
    const flowerColor = options.flowerColor ?? DEFAULTS.flowerColor;
    const withBuds = options.withBuds ?? DEFAULTS.withBuds;
    const col = options.col ?? DEFAULTS.col;
    const petalStyle = options.petalStyle ?? DEFAULTS.petalStyle;
    const composition = options.composition ?? DEFAULTS.composition;
    const fw = FLYING_WHITE_INTENSITY[options.flyingWhite ?? DEFAULTS.flyingWhite];

    let svg = "";
    const anchors: BranchPoint[] = [];

    for (let b = 0; b < branchCount; b++) {
      const tx = xoff + (prng.next() - 0.5) * wid * 2;
      const trunk = drawTrunk({
        x: tx,
        y: yoff,
        hei: hei * (0.85 + prng.next() * 0.3),
        wid,
        col,
        composition,
        flyingWhite: fw,
      });
      svg += trunk.svg;
      anchors.push(...trunk.anchors);

      for (const o of trunk.branchOrigins) {
        svg += drawBranch({
          x: o.x,
          y: o.y,
          angle: o.angle,
          length: hei * (0.3 + prng.next() * 0.25),
          width: wid * (0.35 + prng.next() * 0.2),
          col,
          flyingWhite: fw,
          depth: 3,
          anchors,
        });
      }
    }

    for (const pt of anchors) {
      if (prng.next() > density) continue;
      const ox = (prng.next() - 0.5) * 8;
      const oy = (prng.next() - 0.5) * 8;
      const isBud = withBuds && prng.next() < 0.25;
      if (isBud) {
        svg += drawBud(pt.x + ox, pt.y + oy, col, 4 + prng.next() * 3);
      } else {
        svg += drawFlower(pt.x + ox, pt.y + oy, {
          petalStyle,
          color: flowerColor,
          size: 8 + prng.next() * 6,
        });
      }
    }

    return svg;
  }

  static blossoms(
    xoff: number,
    yoff: number,
    seed: number,
    options: PlumBlossomOptions = {},
  ): string {
    prng.seed(seed);
    const count = options.count ?? 5;
    const size = options.size ?? 12;
    const col = options.col ?? DEFAULTS.flowerColor;
    const petalStyle = options.petalStyle ?? DEFAULTS.petalStyle;

    let svg = "";
    for (let i = 0; i < count; i++) {
      svg += drawFlower(xoff + (prng.next() - 0.5) * 50, yoff + (prng.next() - 0.5) * 50, {
        petalStyle,
        color: col,
        size: size * (0.7 + prng.next() * 0.6),
      });
    }
    return svg;
  }
}

export function winterPlum(
  xoff: number,
  yoff: number,
  seed: number,
  options?: WinterPlumOptions,
): string {
  return WinterPlum.generate(xoff, yoff, seed, options);
}

export function plumBlossoms(
  xoff: number,
  yoff: number,
  seed: number,
  options?: PlumBlossomOptions,
): string {
  return WinterPlum.blossoms(xoff, yoff, seed, options);
}

export { type BranchPoint, type Composition, type FlyingWhitePreset, type PetalStyle };
```

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: 通过（此时新旧两套并存，均独立编译）。

---

## Task 7: 切换导出 + 删除旧文件

**Files:**
- Modify: `packages/core/src/elements/natural/index.ts`
- Delete: `packages/core/src/elements/natural/WinterPlum.ts`

- [ ] **Step 1: 改导出路径**

把这一行：

```ts
export { WinterPlum, winterPlum, plumBlossoms, type WinterPlumOptions } from "./WinterPlum";
```

改为：

```ts
export { WinterPlum, winterPlum, plumBlossoms, type WinterPlumOptions } from "./winter-plum";
```

- [ ] **Step 2: 删除旧文件**

Run: `git rm packages/core/src/elements/natural/WinterPlum.ts`

- [ ] **Step 3: 类型检查 + lint**

Run: `pnpm build && pnpm lint`
Expected: 都通过，无重复导出/找不到模块报错。

---

## Task 8: 更新 demo + 视觉验收门（需用户看屏）

**Files:**
- Modify: `playground/src/demos/FourGentlemenDemo.vue`（winterPlum case，约 58-69 行）

- [ ] **Step 1: 更新 winterPlum case**

把现有 case 块（带棕褐 `flowerColor`/`col`）替换为下面（去掉棕褐覆盖，用新默认 + 暴露新选项）：

```ts
    case "winterPlum":
      width = 600;
      height = 550;
      content = WinterPlum.generate(100, 500, seed, {
        hei: 350,
        wid: 14,
        branches: 1,
        flowerDensity: 0.55,
        withBuds: true,
        petalStyle: "quanhua",
        composition: "upright-s",
        flyingWhite: "strong",
      });
      break;
```

- [ ] **Step 2: 类型检查 + lint**

Run: `pnpm build && pnpm lint`
Expected: 通过。

- [ ] **Step 3: playground 目测（用户在场）**

启动 playground（dev 模式 alias `@shuimo/core` 到 src，无需 build）：`pnpm playground`
打开 Four Gentlemen demo → 选「梅」→ 点 Regenerate 并**等待重绘**（首帧可能是旧的 leaves-only，重绘后才对）。在整花缩放下检查花瓣（不要看小图裁切）。

核对清单：
- [ ] 老干浓墨且有飞白白丝
- [ ] 新枝细劲、向上挑、渐淡
- [ ] 花瓣是圈花留白 + 放射点蕊（非实心 blob）
- [ ] 整体纯水墨黑白
- [ ] 换几个 seed，构图随之变化、可复现（同 seed 同图）
- [ ] 切 `petalStyle: "diancuo"` / `composition: "diagonal"` / `flyingWhite: "medium"|"none"` 各能正常出图

- [ ] **Step 4: 把渲染结果展示给用户，等待认可**

按用户规则，**在用户明确认可视觉效果前不要进入 Task 9**。若不满意，回到对应任务按目测调参（飞白数值、花瓣尺寸/墨色、构图摆幅），重复 Step 3。

---

## Task 9: 提交（仅在用户认可后）

**前置：** Task 8 用户已认可渲染结果，并发出提交信号（如「提交」）。

- [ ] **Step 1: 确认仓库提交风格**

Run: `git log -30 --pretty=format:"%s%n%b%n---"`
确认：conventional commits（如 `feat:` / `fix(scope):`）、英文、小写、无句末句号、是否带 `Co-Authored-By` trailer。按观察到的风格生成 message（勿套用其它仓库默认）。

- [ ] **Step 2: 暂存并提交**

```bash
git add packages/core/src/elements/natural/winter-plum/ \
        packages/core/src/elements/natural/index.ts \
        playground/src/demos/FourGentlemenDemo.vue \
        docs/superpowers/specs/2026-05-31-winter-plum-redesign-design.md \
        docs/superpowers/plans/2026-05-31-winter-plum-redesign.md
git rm --cached --ignore-unmatch packages/core/src/elements/natural/WinterPlum.ts 2>/dev/null || true
git commit
```

提交信息按 Step 1 观察到的风格撰写（示例主题：`feat(winter-plum): redesign as ink-painting module with 圈花 petals and 飞白 trunk`）。若仓库使用 `Co-Authored-By` trailer，按 harness 要求追加 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

## 自查（已完成）

- **Spec 覆盖**：圈花/点厾 (Task 4)、A/B 构图 (Task 2)、飞白预设 (Task 1+2)、纯水墨默认 (Task 1)、模块拆分 (Task 1-6)、API 保留 (Task 6)、导出切换+删旧 (Task 7)、demo 验证 (Task 8)、无新增测试文件（用 playground 目测，Task 8）。全部有对应任务。
- **占位符**：无 TBD；每段代码完整可运行。
- **类型一致**：`BranchPoint`/`PetalStyle`/`Composition`/`FlyingWhitePreset` 在 constants.ts 定义，trunk/branch/flower/index 一致引用；`drawTrunk`/`drawBranch`/`drawFlower`/`drawBud` 签名与 index 调用一致；`WinterPlumOptions` 字段与 spec 一致。
```
