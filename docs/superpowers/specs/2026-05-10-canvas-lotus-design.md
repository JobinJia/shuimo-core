# Canvas 荷花生成器设计

**日期**：2026-05-10
**目标**：在 `FlowerCanvas` 上新增可指定生成荷花的能力，弃用之前已删除的 SVG `Lotus` 实现。
**参考图**：单朵粉红荷花 + 多片墨叶 + 留白构图（写意风）。

## 背景

- 之前的 `packages/core/src/elements/natural/Lotus.ts`（SVG 实现）已于 commit `c6eb705` 删除，原因是视觉效果不满意。
- `FlowerCanvas` 现有 `woody` / `herbal` 两条骨架，源自 LingDong 的 *Nonflowers*，本质是"随机出一种不存在的花"，没有 species 概念，无法表达荷花的三个核心结构：
  1. 圆形浮叶（放射叶脉，与现有沿脊线展宽度的 `leaf()` 模型不兼容）
  2. 侧视层叠花瓣（现有花是顶视绕中心 stamp）
  3. 墨叶 + 单点彩花的双图层色彩规约

## 范围

### In scope
- `FlowerCanvasOptions.species: "lotus"` 新增选项
- 单花 + 多叶 + 0–1 花苞构图
- 粉红色硬编码 + 鹅黄雄蕊 + 墨色叶/茎
- 莲叶（圆形浮叶）primitive
- 莲花（侧视三层花瓣）primitive
- 复用现有 `stem()` 画茎
- Playground demo 重新挂 `/lotus` 路由

### Out of scope
- 第二个 species（牡丹/梅等）
- 多花构图
- `colorScheme` 参数（白荷花等变体）
- 莲蓬（莲房）
- 莲花花心几何细节
- 把荷花接入 `PaintingGenerator` 上层组合
- Golden image 测试

## 架构

### 目录结构

```
packages/core/src/drawing/
├── FlowerCanvas.ts          # 主入口，新增 species 分发
└── species/
    ├── index.ts             # registry: { lotus: drawLotus }
    └── lotus.ts             # 荷花 pipeline + primitives
```

### API

```typescript
export interface FlowerCanvasOptions {
  seed?: string | number;
  /** Random Nonflowers 骨架。互斥于 species，species 优先。 */
  type?: "woody" | "herbal" | "random";
  /** 物种预设。设了就走该物种 pipeline，忽略 type。 */
  species?: "lotus";
  width?: number;
  height?: number;
  background?: "none" | "paper" | string;
  fast?: boolean;
}
```

### 分发逻辑（`FlowerCanvas.ts` 的 `generateFlowerCanvas`）

```typescript
if (options.species) {
  const draw = SPECIES[options.species];
  draw(ctx, { xof, yof, fast });
} else {
  // 现有 woody/herbal 分支保持不变
}
```

### Registry（`species/index.ts`）

```typescript
import { drawLotus } from "./lotus";

export type SpeciesDrawOpts = {
  xof: number;
  yof: number;
  fast: boolean;
};
export type SpeciesDraw = (
  ctx: CanvasRenderingContext2D,
  opts: SpeciesDrawOpts,
) => void;

export const SPECIES: Record<string, SpeciesDraw> = {
  lotus: drawLotus,
};
```

### 关键决策
- `species` 与 `type` 是**两个独立参数**，不合并。`type` 语义为骨架（woody/herbal），`species` 语义为物种；正交概念。
- 不引入 `SpeciesParams` 跨物种 schema（n=1 时设计抽象会错）。
- 向后兼容：现有不带 `species` 的调用完全不变。

## Lotus Pipeline

### 画布 / 图层（沿用 herbal）

- `cwid = 1200`，地面线 `y0 ≈ cwid * 0.85`
- 双图层：
  - `lay0`：墨叶 + 茎（`multiply` 混合）
  - `lay1`：花 + 雄蕊（`normal` 混合）
- 出口走现有 `Layer.bound` 自动裁框 + 缩放（与 woody/herbal 一致）。`fast` 跳过 bound。

### 构图配方（seed 决定具体值）

| 元素     | 数量            | 位置                          | 备注 |
|----------|-----------------|-------------------------------|------|
| 直立茎   | 4–7 根          | x ∈ [0.2, 0.8]·cwid 内随机    | 顶端必接花/叶/苞之一 |
| 浮叶     | 3–6 片          | 茎顶 + 1–2 片低位前景大叶     | 大小 + 墨色随 z-depth 渐变 |
| 盛开花   | 1（默认）       | 茎顶最高位                    | 单花构图 |
| 花苞     | 0–1（30% 概率） | 另一根茎顶                    | 增加层次 |
| 莲蓬     | —               | —                             | v1 跳过 |

## 新 Primitive

### 1. `lotusPad` —— 莲叶

**形状**：极坐标半径函数（不是沿脊线展宽度）

```
r(θ) = R · (1 + 0.08 · sin(7θ + φ))
```

- 极坐标采样 96 个边缘点 → 闭合多边形
- 中心向边缘画 6–8 条放射叶脉（细线，pnoise 微抖）
- 30% 概率画一条折角线（模仿翻面）
- 墨色：`hsv(120, 0.05–0.15, 0.15–0.4, alpha)`
- alpha 受 z-depth 控制（前景 0.85、后景 0.3）
- 整片过 `Filter.wispy` 让边缘湿润

### 2. `lotusFlower` —— 侧视莲花

**三层花瓣**，从外到内 aperture（张开角度）递减：

| Layer | Petal count | Aperture |
|-------|-------------|----------|
| 0 (外) | 5–6         | 70°      |
| 1 (中) | 3–4         | 45°      |
| 2 (内) | 2–3         | 20°      |

**单瓣画法**：
- 二次贝塞尔脊线 `(0,0) → (bendX, bendY) → (tipX, tipY)`
- 沿脊线宽度 = `sin(πt) ^ p`（teardrop）
- 左右两条边缘 quadratic curve，闭合填充 + 描边
- 颜色：`hsv(330, 0.55–0.75, 0.85–0.95)`（粉红，外层略浅、内层略深）

**雄蕊**：花心 8–12 个小点，`hsv(50, 0.3, 0.95)`（鹅黄）。

### 3. `stem` —— 复用现有 `FlowerCanvas` 的 `stem()`

- 长度 200–340
- 宽度 ~1.8（细茎）
- 弯曲幅度 `pnoise · stemBend · 0.3`（轻微 S 曲）
- 颜色：墨色 `hsv(120, 0.1, 0.2, 0.85)`

> **可能需要修改**：现有 `stem()` 期望 `wid` 是函数。常数宽度 `1.8` 可以表达为 `(_x) => 1.8`，先这么写；如果出图发现细节不对，再考虑在 `stem()` 加常数宽度分支。

### 色彩规约

| 元素   | 颜色                   |
|--------|------------------------|
| 叶 / 茎 | 墨色 grayscale-ish     |
| 花瓣    | 粉红 hsv(330, ~, ~)    |
| 雄蕊    | 鹅黄 hsv(50, 0.3, 0.95)|

颜色不暴露为参数（保持算法的视觉一致性）；保留为 `lotus.ts` 顶部 `const` 块以便微调。

## 验证

### 自动测试

- `species: "lotus"` 不抛异常，返回 `HTMLCanvasElement`，宽高匹配
- 同 seed 跑两次，像素哈希一致（确定性）

不做 golden image 测试。

### 人眼审美

通过 playground demo 审。

## Playground Demo

- 新增 `playground/src/demos/LotusCanvasDemo.vue`
- 路由 `/lotus` 复活，但内容指向 `LotusCanvasDemo`
- 内容：
  - 一个 `<canvas>`
  - seed 切换按钮（`1, 42, 100, random`）
  - `Regenerate` 按钮
- 侧栏 `Layout.vue` 把 `/lotus` 加回 Shanshui 分组

## 风险

1. **三层花瓣 aperture 系数是估算值**——首版渲染出来需要至少一轮调参。所有数字常量集中放在 `lotus.ts` 顶部 `const` 块，便于改。
2. **极坐标圆叶 + `Filter.wispy` 可能太"湿"**——参考图叶子边缘相对干净。`wispy` 力度可能需要降。第一版先用现有 `wispy`，根据观感调。
3. **`stem()` 当前调用习惯都是噪声变宽度**——常数宽度 `(_x) => 1.8` 的视觉效果未知，可能需要进 `stem()` 内部加分支。

## 实现顺序（无 writing-plans 阶段，直接进入实现时按此顺序）

1. 建 `species/index.ts` 与空的 `species/lotus.ts`，给 registry + 类型骨架
2. 在 `FlowerCanvas.ts` 加 `species` 字段、加分发 if 分支
3. 实现 `lotusPad`（极坐标圆叶）
4. 实现 `lotusFlower`（三层花瓣 + 雄蕊）
5. 实现 `drawLotus` 构图（茎 + 叶 + 花 + 苞）
6. 写 vitest（不抛异常 + 确定性）
7. 写 `LotusCanvasDemo.vue` + 加路由 + 侧栏
8. 跑 `pnpm build`、起 `pnpm playground`、人眼审，反馈调参
