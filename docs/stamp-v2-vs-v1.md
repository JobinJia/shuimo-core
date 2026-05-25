# Stamp V1 vs V2 对照

Stamp v2 (`@jobinjia/shuimo-core/stamp-v2`) 与现有 stamp v1 (`@jobinjia/shuimo-core` 默认导出的 `generateStamp`) 共存。本文列出两者的功能差异,帮助你决定哪一版适合当前场景。

**Icon 图例**:✅ 支持 / ❌ 不支持 / ⚠️ 类型里有但 pipeline 未实现 / ⭐ 这一版更好 / 🆕 V2 新增

## 文字 & 字体

| 能力 | V1 | V2 |
|---|---|---|
| 文字输入 | ✅ 仅 `string[]` | ✅⭐ `string \| string[]` |
| 字体 buffer / URL 加载 | ✅ | ✅ |
| 字体 fallback(主字体缺字自动换备字) | ✅ `fontFallbackUrl` | ✅⭐ `fontFallbackUrl`(composite 模式优于 V1 swap,保留主字体风格) |
| harfbuzz 运行时子集化 | ✅ `harfbuzzSubsetWasmUrl` | ✅ `harfbuzzSubsetWasmUrl`(共用 V1 `internal/fontSubset.ts`) |
| `fontWorker`(off-thread woff2 解码) | ✅ | ✅(共用 V1 worker 通道) |
| `script` 篆体风格(小篆/大篆/金文/九叠篆) | ❌ | ✅🆕⭐ 5 档:`jinwen` / `dazhuan` / `xiaozhuan` / `jiudiezhuan` / `custom`,几何级 angularize 参数差异;`carving.intensity` 可 override |

## 布局

| 能力 | V1 | V2 |
|---|---|---|
| 字间距(行内) | ✅ `characterSpacing` | ✅ `layout.gap` / `layout.rowGap` |
| 列间距 | ✅ `columnSpacing` | ✅🆕⭐ `layout.columnGap`(**支持负值**,字可重叠) |
| 像素绝对值覆盖(`*Px`) | ✅⭐ 每个布局值都有 `*Px` 版本 | ❌ 全相对值 |
| 内边距 | ✅ `paddingX(+Px)` / `paddingY(+Px)` | ✅ `layout.padding` |
| 文字偏移 X / Y | ✅ | ✅ |
| 排版方向(垂直 / 圆环) | ❌ 仅 ttb-rtl | ✅🆕 `layout.direction: "ttb-rtl" \| "circular"` |
| **撑满 cell(九叠篆 stretch)** | ❌ | ✅🆕⭐ `layout.stretch` toggle |

## 形状

| 能力 | V1 | V2 |
|---|---|---|
| 方形 / 长方形 / 圆形 / 椭圆 / 自动 | ✅ | ✅ |
| **rect / ellipse 自定义 aspect**(横 / 竖比例) | ❌ | ✅🆕⭐ `shape.aspect` |
| polygon 多边形(3-12 边,flat-top/point-top 朝向) | ❌ | ✅🆕⭐ |
| irregular 异形(自动重磨损,roughness 默认 0.7) | ❌ | ✅🆕⭐ |
| 圆角风格 corner | ✅ 仅 round | ✅⭐ `none` / `round` / `stone` |
| 圆角半径 cornerRadius | ✅ | ✅ |

## 边框 & 磨损

| 能力 | V1 | V2 |
|---|---|---|
| 边框粗细 | ✅ `borderWidth(+Px)` | ✅ `border.thickness` |
| 边框噪声振幅 + 频率独立控制(`noiseAmount` + `noiseDensity`) | ✅⭐ 两个独立旋钮 | ❌ 合并成 `border.roughness` 单值 |
| 边框顶点数 `borderPoints` | ✅⭐ | ❌ |
| **界格(列间红色分隔条)** | ✅⭐ `gridLines` + `gridLineWidth` —— 阴章经典视觉 | ❌ |
| `borderBandWidth`(阴章内边带) | ✅⭐ | ❌ |

## 刀刻 & 纹理

| 能力 | V1 | V2 |
|---|---|---|
| 刀刻风格 profile | ✅ `normal` / `strong` / `stone-cut` 三档预设 | ❌ 无预设 |
| 刀刻强度 intensity | ✅ 0.3-2.5 缩放 profile | ✅ 0-1 连续值 |
| **几何角化(angularize)**:字形 Bezier 命令量化 + 抖动 + 控制点拉直 | ❌ 仅 SVG filter | ✅🆕⭐ 从 V1 内部函数 port 出来作为独立 pipeline 阶段 |
| SVG filter(chip + grain 减法) | ✅ | ✅⭐ port + 与几何角化叠加 |
| 印泥渗透 bleed | ✅ | ✅ |
| `ink.density` / `grain` / `aging` | ❌ | ⚠️ 类型有,只 `bleed` 接通 pipeline |

## 渲染输出

| 能力 | V1 | V2 |
|---|---|---|
| SVG 输出 | ✅ 返回 `string` | ✅ 返回 `SealResult.svg` |
| **Canvas 输出** | ✅⭐ `StampCanvas.ts` 独立模块 | ⚠️ 类型有 `output.format: "canvas"`,pipeline 未实现 |
| **分层输出**(`layers.background / text / border`) | ❌ | ✅🆕⭐ 便于动画 / 分层导出 |
| WebGPU / WASM | ❌ | ❌ |

## 多印章 / 工程

| 能力 | V1 | V2 |
|---|---|---|
| 同页多印章不冲突 | ❌⚠️ filter ID 写死 `stamp-text-texture` → 同页多印章只第一个生效 | ✅🆕⭐ ID 按 `seed + text + shape + mode + size` 哈希,每印章独立 |
| 圆形 / 椭圆字溢出处理 | ❌ 字直接超出边形 | ✅🆕⭐ 内接矩形(`OVERFLOW=1.08/1.25`)+ shape clip + per-cell clip 三层防护 |
| 印章中心对齐 | ⚠️ 列宽错位 bug(已在 V2 修) | ✅⭐ 字 grid 多次测量验证居中 |
| PRNG 多 salt 分流 | ❌ 单 seed 串到底 | ✅⭐ `SALT_SHAPE` / `SALT_CARVE` / `SALT_EROSION` 独立流 |
| API 架构 | 2400 行 mega-function,SVG 字串拼接 | ⭐ 多阶段 pipeline:layout → glyph fit → angularize → border → erosion → filter → render |

## V2 placeholder(类型里定义了但未实现)

| 字段 | 状态 |
|---|---|
| `notch`(印泥缺口位置) | ⚠️ 不渲染 |
| `pressing`(按压模拟 rotate / pressure / partialLoss / offset) | ⚠️ 不渲染 |
| `output.format: "canvas" \| "both"` | ⚠️ 走 SVG 路径 |
| `ink.density` / `grain` / `aging` | ⚠️ 不影响输出 |

## 实用建议

**V1 还独占的能力**:界格(`gridLines`)、`borderBandWidth`、`noiseDensity` 独立旋钮、Canvas 渲染器。

**V2 已经追平 / 反超 V1 的能力**:字体 fallback(composite 优于 swap)、harfbuzz 子集化、fontWorker、5 档篆体风格、polygon/irregular 异形、aspect 自定义、九叠篆 stretch、分层 SVG 输出、同页多印章 ID 隔离。

**目前怎么选**:
- 需要**界格 / canvas / 像素级 noiseDensity 控制** → V1
- 其他情况 → V2(尤其是 gallery 同页多印章 / 古文字风格 / 异形 shape / 分层输出)

**V2 类型里仍未接通**(别依赖):`notch` / `pressing` / `output.format: "canvas"` / `ink.density-grain-aging`

## 源码位置

- V1:`packages/core/src/drawing/Stamp.ts` 主入口,`StampCanvas.ts` canvas 渲染,`StampWasm.ts` WASM 加速
- V2:`packages/core/src/drawing/stampV2/` 整个目录
  - `seal.ts` — pipeline 编排
  - `types.ts` — 完整选项类型
  - `layout/grid.ts` — 列布局
  - `text/glyphs.ts` + `text/angularize.ts` — 字形提取与角化
  - `border/shape.ts` + `border/erosion.ts` — 边框 / 磨损
  - `texture/inkFilter.ts` — SVG filter 定义
  - `render/svg.ts` — SVG 串组装

## Playground

- `/stamp` — V1 基础 demo
- `/stamp-playground` — V1 完整控制面板
- `/stamp-canvas` — V1 canvas 渲染
- `/stamp-v2` — V2 主 playground(全控制面板 + 同 seed v1 对比)
- `/stamp-v2-gallery` — V2 全量测试矩阵(11 字数布局 × 5 形状 × 2 模式)
