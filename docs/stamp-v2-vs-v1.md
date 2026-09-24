# Stamp V1 vs V2 对照

Stamp v2 (`@jobinjia/shuimo-core/stamp-v2`) 与现有 stamp v1 (`@jobinjia/shuimo-core` 默认导出的 `generateStamp`) 共存。本文列出两者的功能差异,帮助你决定哪一版适合当前场景。

**Icon 图例**:✅ 支持 / ❌ 不支持 / ⚠️ 类型里有但 pipeline 未实现 / ⭐ 这一版更好 / 🆕 V2 新增

## 文字 & 字体

| 能力 | V1 | V2 |
|---|---|---|
| 文字输入 | ✅ 仅 `string[]` | ✅⭐ `string \| string[]` |
| 字体 buffer / URL 加载 | ✅ | ✅(3.0.0 起解析结果按 buffer / URL 缓存,同一字体只解析一次;`clearSealFontCache()` 可清) |
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
| **短列排法**(如 3+2 两列不等长) | ❌ 短列顶对齐,下方留空 | ✅🆕⭐ `layout.shortColumn`:默认 `"spread"` 短列拉高撑满(字竖向拉长 ≤1.3×);`"top"` 为旧行为 |
| **按 seed 的字形变化**(偏移 / 微倾 / 笔画弯) | ❌ | ✅🆕 `layout.variation`(0-2,默认 1;0 关闭) |

## 形状

| 能力 | V1 | V2 |
|---|---|---|
| 方形 / 长方形 / 圆形 / 椭圆 / 自动 | ✅ | ✅ |
| **rect / ellipse 自定义 aspect**(横 / 竖比例) | ❌ | ✅🆕⭐ `shape.aspect` |
| polygon 多边形(3-12 边,flat-top/point-top 朝向) | ❌ | ✅🆕⭐ |
| 异形(完全不规则 / 跟着文字走的 base) | ❌ | ❌ 尝试过 `kind: "irregular"`(rect + erosion)和 cell-union 路径,前者噪声幅度不够看不出区别,后者交互上效果不对,均已撤掉 |
| 圆角风格 corner | ✅ 仅 round | ✅⭐ `none` / `round` / `stone` |
| 圆角半径 cornerRadius | ✅ | ✅ |

## 边框 & 磨损

| 能力 | V1 | V2 |
|---|---|---|
| 边框粗细 | ✅ `borderWidth(+Px)` | ✅ `border.thickness` |
| 边框噪声振幅 + 频率独立控制(`noiseAmount` + `noiseDensity`) | ✅⭐ 两个独立旋钮 | ❌ 合并成 `border.roughness` 单值(3.0.0 起默认 0.25;振幅不再跟 `thickness` 绑定;角上磨损最重;按 seed 加缺口) |
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
| 印泥渗透 bleed | ✅ | ✅(3.0.0 起附带低频按压浓淡,印泥不再是一整片纯红) |
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

## 性能(实测)

vitest bench,jsdom 环境,1500ms / bench。完整脚本:`packages/core/src/drawing/stampV2/stamp-v1-vs-v2.bench.ts`,跑法 `pnpm --filter @jobinjia/shuimo-core bench`。字体是 138 KB 的 `yishanbeizhuanti.demo.woff2`,以同一个 ArrayBuffer 传入。

| 场景 | V1 mean | V2 mean(3.0.0 前) | V2 mean(3.0.0) |
|---|---|---|---|
| 单印章(2 字单列) | 13.4 ms | 8.96 ms | **0.22 ms** |
| 50 个不同 seed | 621 ms | 441 ms | **11.9 ms** |
| 50 个相同 options | 676 ms | 445 ms | **11.0 ms** |
| 长文(11 字 3 列) | 15.0 ms | 9.88 ms | **0.69 ms** |

**旧版这一节有个错误说法要更正**:原文说"字体 cache 在两边 warm 状态都命中"。对 V2 这不成立 —— 3.0.0 之前 V2 的非 worker 路径(`generateSeal` / 不带 `fontWorker` 的 `generateSealAsync`)根本没有字体缓存,每刻一枚章都把字体重新解析一遍。所以"不同 seed"和"相同 options"两组跑出来一样快(441 对 445 ms),恰好说明缓存不存在。旧表里 V2 的时间几乎全花在反复解析字体上。

3.0.0 的改动:

- 解析后的字体按 ArrayBuffer(WeakMap,随 buffer 回收)和 URL(同一 URL 只 fetch 一次,并发请求共用)缓存。woff2 全量字体(1.28 MB)下每枚章从 ~98 ms 降到 ~2.5 ms;浏览器 gallery 182 块图从 182 次下载 + 解析 2.3 MB TTF 降到 1 次。
- 每个字形只解码一次(量字宽的那次结果直接缩放复用);删掉了算完就扔的展平步骤;路径数字格式化换成快速实现(输出逐字节不变,V1 共用)。
- SVG 滤镜作用区域收紧到"元素包围盒 + 3 个单位"(原来最大 136% × 136%),去掉低于像素的噪声倍频。按 2 倍屏估算,480 px 印章的滤镜中间画面从 21.2 降到 14.6 百万像素,gallery 182 块合计从 1177 降到 799 百万像素(其中 Perlin 噪声计算 599 → 292)。

V1 的数字本身没变(差异只是机器噪声)。

## V2 placeholder(类型里定义了但未实现)

| 字段 | 状态 |
|---|---|
| `notch`(印泥缺口位置) | ⚠️ 不渲染 |
| `pressing`(按压模拟 rotate / pressure / partialLoss / offset) | ⚠️ 不渲染 |
| `output.format: "canvas" \| "both"` | ⚠️ 走 SVG 路径 |
| `ink.density` / `grain` / `aging` | ⚠️ 不影响输出 |

## 实用建议

**V1 还独占的能力**:界格(`gridLines`)、`borderBandWidth`、`noiseDensity` 独立旋钮、Canvas 渲染器。

**V2 已经追平 / 反超 V1 的能力**:字体 fallback(composite 优于 swap)、harfbuzz 子集化、fontWorker、5 档篆体风格、polygon 多边形、aspect 自定义、九叠篆 stretch、短列撑满、按 seed 的字形变化、分层 SVG 输出、同页多印章 ID 隔离、字体缓存后数十倍的生成速度。

**目前怎么选**:
- 需要**界格 / canvas / 像素级 noiseDensity 控制** → V1
- 其他情况 → V2(尤其是 gallery 同页多印章 / 古文字风格 / 多边形 / 分层输出)

**V2 类型里仍未接通**(别依赖):`notch` / `pressing` / `output.format: "canvas"` / `ink.density-grain-aging`

## 源码位置

- V1:`packages/core/src/drawing/Stamp.ts` 主入口,`StampCanvas.ts` canvas 渲染,`StampWasm.ts` WASM 加速
- V2:`packages/core/src/drawing/stampV2/` 整个目录
  - `seal.ts` — pipeline 编排
  - `types.ts` — 完整选项类型
  - `layout/grid.ts` — 列布局
  - `text/glyphs.ts` + `text/angularize.ts` + `text/variation.ts` — 字形提取(含字体缓存)、角化、按 seed 的字形变化
  - `border/shape.ts` + `border/erosion.ts` — 边框 / 磨损
  - `texture/inkFilter.ts` — SVG filter 定义
  - `render/svg.ts` — SVG 串组装

## Playground

- `/stamp` — V1 基础 demo
- `/stamp-playground` — V1 完整控制面板
- `/stamp-canvas` — V1 canvas 渲染
- `/stamp-v2` — V2 主 playground(全控制面板 + 同 seed v1 对比)
- `/stamp-v2-gallery` — V2 全量测试矩阵(13 字数布局 × 7 形状 × 2 模式)
