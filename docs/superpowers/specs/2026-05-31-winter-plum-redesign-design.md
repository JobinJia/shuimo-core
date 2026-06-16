# 本梅花 — WinterPlum 重写设计

- **日期**: 2026-05-31
- **代号**: 本梅花
- **目标**: 重写 `WinterPlum` 元素，完整复刻一幅传统单色梅花水墨画的味道——浓墨湿笔的苍劲老干（带枯笔飞白）、细劲上挑的新枝、留白圈花的白梅花瓣（淡墨轮廓 + 放射深点蕊）、枝头深墨圆苞。
- **参考图**: 用户提供的剪贴板梅花水墨画（圈花白梅，老干飞白，主干 S 形上扬）。

## 背景

现有 `packages/core/src/elements/natural/WinterPlum.ts` 已有正确骨架（递归枝、五瓣花、花苞、花蕊），但与参考图差距明显：

- 花瓣是 `blob()` 实心填充，非圈花留白；
- 老干用均匀锥形 `stroke()`，无飞白、无湿墨质感；
- 默认调色是棕褐色（`col: rgba(60,50,40)`、`flowerColor: rgba(180,150,100)`），非纯水墨；
- 多根等权重 branch，构图偏散，无主干主导。

`WinterPlum` 为独立元素（仅 FourGentlemen demo 使用），**未**被 `PaintingGenerator` / `SceneManager` 引用。渲染方式为返回 SVG 字符串，由 demo 注入 DOM（宣纸底 `#f8f6f0`）。

## 可用底层能力（已勘察）

- `Brush.stroke(points, opts)` → SVG 字符串，支持 `flyingWhite`(0–1, 飞白)、`pressure`、`inkStart/inkEnd`、`noise`、`texture`。飞白机制：stroke 末端按 noise 门控减宽产生白丝缝隙。
- `Brush.dot(x, y, opts)` → SVG，16 边形墨点 + 纹理，继承 flyingWhite。
- `Stroke.generate(ptlist, opts)` → 简单变宽描边（轮廓/细茎用）。
- `Blob.generate(x, y, opts)` → 有机墨块（实心点厾瓣用）。
- `noise` / `prng`（foundation）→ 路径扰动与可复现随机。

## 决策记录（brainstorm 结论）

| 议题 | 决定 |
|------|------|
| 目标档位 | 完整复刻参考图 |
| 花瓣画法 | 默认**圈花**；**圈花/点厾两种模式做成参数** |
| 构图 | 默认**主干 S 上扬 (`upright-s`)**；**`upright-s` / `diagonal` 两种做成参数** |
| 老干飞白 | 做成参数，默认**强飞白**；预设字符串 `'strong' \| 'medium' \| 'none'` |
| 调色板 | 默认改为**纯水墨黑白**（保留 `col`/`flowerColor` 参数可调） |
| 代码组织 | **拆成模块文件夹**（仿 lotus 单一职责拆分） |
| API | **保留现有签名**，只新增选项，返回仍为 SVG 字符串 |

## 模块结构

新建目录 `packages/core/src/elements/natural/winter-plum/`，替换单文件 `WinterPlum.ts`。仿 lotus 的「每文件单一职责」拆分（注意：lotus 为 canvas 绘制，本梅花保持**返回 SVG 字符串**不变）：

| 文件 | 职责 | 关键依赖 |
|------|------|----------|
| `constants.ts` | 默认值与可调参：墨色调色板、尺寸/密度区间、飞白预设→数值映射、构图默认 | — |
| `trunk.ts` | 老干：按构图模式生成 noise 扰动主干路径，用 `Brush.stroke`（大 width、低 `inkEnd`、强 `flyingWhite`）画浓墨湿笔 + 飞白；返回 `{ svg, anchors }` | `Brush`, `noise`, `prng` |
| `branch.ts` | 新枝：自老干递归生出、细劲上挑、渐细、弱飞白；沿途追加花/苞锚点 | `Brush`, `noise`, `prng` |
| `flower.ts` | `drawFlower({ petalStyle, ... })`：**圈花**(留白瓣 + 淡墨轮廓弧 + 放射深点蕊 + 中心点) / **点厾**(实心墨瓣 + 简化蕊)；`blossoms()` 复用 | `Brush`, `Blob`, `Stroke` |
| `bud.ts` | 枝头深墨圆苞（`Brush.dot` 或小 `Blob`） | `Brush` / `Blob` |
| `index.ts` | `WinterPlum` 编排类 + `winterPlum` / `plumBlossoms` 导出；保留原 API | 上述全部 |

`elements/natural/index.ts` 的导出语句路径由 `./WinterPlum` 改为 `./winter-plum`；导出符号（`WinterPlum, winterPlum, plumBlossoms, WinterPlumOptions`）保持不变。

## API

签名保持不变：

```ts
WinterPlum.generate(xoff: number, yoff: number, seed: number, options?: WinterPlumOptions): string
winterPlum(xoff, yoff, seed, options?): string
WinterPlum.blossoms(xoff, yoff, seed, options?): string
plumBlossoms(xoff, yoff, seed, options?): string
```

`WinterPlumOptions` 保留现有字段（`hei`, `wid`, `branches`, `flowerDensity`, `flowerColor`, `withBuds`, `col`），新增：

```ts
interface WinterPlumOptions {
  // ...现有字段...
  /** 花瓣画法，默认 'quanhua'(圈花) */
  petalStyle?: 'quanhua' | 'diancuo';
  /** 构图走势，默认 'upright-s' */
  composition?: 'upright-s' | 'diagonal';
  /** 老干飞白强度预设，默认 'strong' */
  flyingWhite?: 'strong' | 'medium' | 'none';
}
```

`flyingWhite` 字符串在 `constants.ts` 内映射到 `Brush.stroke` 的数值，例如：`strong → 0.7`、`medium → 0.4`、`none → 0`（具体数值实现时按目测微调）。

## 默认调色板（纯水墨）

- `col`（枝干）默认 → `rgba(28,24,19,0.92)`（浓墨）。
- `flowerColor`（花瓣墨线/轮廓）默认 → `rgba(125,117,107,1)`（淡墨）；花蕊取其加深色（放射线 + 花药点）。
- 移除旧棕褐默认。此改动会改变 FourGentlemen demo 现有观感（变黑白），已确认接受。

## 数据流与可复现性

1. `index.generate` 开头 `prng.seed(seed)`。
2. 依 `composition` 选定主干走势。
3. `trunk.drawTrunk(...)` 返回 `{ svg, anchors: BranchPoint[] }`（出枝锚点）。
4. `branch.drawBranch(...)` 递归生成新枝，向 `anchors` 追加花/苞锚点。
5. 按 `flowerDensity` 在锚点上分布 `flower`（圈花/点厾）与 `bud`。
6. 拼接所有 SVG 片段返回字符串。

单一 `seed` 驱动全部随机，相同 seed → 相同输出（沿用现有可复现模式）。`BranchPoint` 结构 `{ x, y, angle, depth }` 沿用现有定义。

## 渲染与范围

- **仅返回 SVG 字符串**（不变）；在 playground FourGentlemen demo（`#f8f6f0` 宣纸底）预览。
- **不在范围内**：WebGPU / canvas 渲染器、`PaintingGenerator` / `SceneManager` 场景集成、描边动画。

## 验证 & 测试

遵守 CLAUDE.md「不要构建额外的用于测试的文件」：

- **不新增测试文件**。
- 验证方式：playground FourGentlemen demo 目测（dev 模式 alias `@shuimo/core` 到 src，改完点 Regenerate 并等待重绘；在整花缩放下检查花瓣，而非小图裁切）。
- seed 复现性手动核对：同 seed 两次生成应得到相同 SVG。

## 风险与注意

- `Brush.stroke` 的飞白是末端 noise 门控减宽，并非真正的劈锋分叉；强飞白可能需配合低 `inkEnd` + 叠加多笔触增强苍劲感，实现时按目测调。
- 圈花留白依赖宣纸底色透出（描边 `fill="none"` 或近纸色），需确保不被实心填充盖住。
- 默认黑白会即时改变 demo 外观——属预期。
