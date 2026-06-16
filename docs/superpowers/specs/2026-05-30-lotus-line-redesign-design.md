# 荷花线条重构设计（小写意 染+勾+脉）

**日期**：2026-05-30
**目标**：重写 `packages/core/src/drawing/species/lotus.ts` 的视觉/算法，把当前"纯水墨灰调 + 3D 渐变 blob 花瓣 + 蓝调带脉叶 + 飞白带刺茎"换成参考图的**小写意线条画法**。
**参考图**：`/Users/jiabinbin/.vimo/eterm/tmp/clipboard/clipboard_1780078359569.png` —— 两朵粉红荷花（勾线填色）+ 泼墨墨叶 + 细线茎 + 底部墨点，竖构图留白。
**前序 spec**：`2026-05-10-canvas-lotus-design.md`（已严重偏离；本 spec 取代其视觉部分，保留其 species 分发架构）。

## 背景与现状差距

当前 `lotus.ts`（1053 行单文件）的画法与参考图在每一层都不一致：

| 元素 | 当前实现 | 参考图 / 目标 |
|------|----------|----------------|
| 花瓣 | 纯灰 `hsv(0,0,·)` 渐变 bezier blob，**无轮廓线**，3D yaw/pitch 投影 | 粉红**勾线填色**：淡粉内染 + 玫红描边 + 脉线，侧视层叠 |
| 叶 | 蓝调 `hue=215` 缺口 + 放射脉 + blur halo | **泼墨/没骨**深墨绿黑色块，**无轮廓无脉** |
| 茎 | 飞白雕刻 + 密集 prickle 毛刺，宽 14 | 细单线，锥形渐变，长而微弯，稀疏小刺 |
| 墨点 | 无 | 底部泼墨黑点/飞溅 |
| 整体 | 灰调湿雾 | 线（花）与块（叶）的对比 + 大留白 |

**核心**：参考图的花是"画"出来的（线条），不是"晕"出来的（blob）。重构的中心是**线条算法**。

## 范围

### In scope
- 重写 `lotus.ts` 的全部 primitive 与构图
- 花瓣：染（淡粉内填）+ 勾（左右两条锥形描边）+ 脉（2–4 条细脉线）
- 叶：泼墨/没骨深墨色块（无线）
- 茎：细锥形单线 + 稀疏小刺
- 底部泼墨墨点
- 色彩规约：花=玫红粉，叶/茎/点=墨
- 把 `lotus.ts` 从单文件拆为 `species/lotus/` 模块目录（详见架构）
- 更新 `LotusCanvasDemo.vue` 仍可正常渲染（接口不变）

### Out of scope（沿用既有约束）
- 莲蓬（莲房）—— 仍不画（见既有 memory `project_lotus_reference`）
- 莲花花心几何细节（雄蕊/花托细节）—— 不画
- 第二个 species
- `colorScheme` 参数（白荷等变体）；颜色保持硬编码 `const`
- 接入 `PaintingGenerator` 上层组合
- Golden image 测试
- 改 `FlowerCanvas.ts` 的 species 分发逻辑（保持不变）

## 线条算法（重构中心）

### 唯一原语：锥形 tubify 描边

所有"线"——花瓣勾边、脉线、茎、刺——都建立在仓库现有的
`FlowerCanvas.ts` 的 `stroke({ pts, wid, col, ... })` 之上：

```
stroke = 中心折线 pts + 宽度函数 wid(t∈[0,1]) → tubify → 单个填充多边形
```

- `tubify()`（FlowerCanvas.ts:473）在每个中心点用前后段角平分线求法向，向两侧偏移 ±wid(t)，拼成左右顶点列 → 闭合填充多边形。
- 这是**变宽填充带**，不是 `ctx.stroke()` 等宽描边——所以能表达毛笔的 起笔/行笔/收笔 粗细变化。
- **不用** `ctx.lineWidth`/`ctx.stroke()` 画任何"主体线条"（仅墨点、极细辅助可例外）。

**宽度函数库**（放 `lotus/strokes.ts`，本次新增的语义封装）：

| 名称 | wid(t) 形态 | 用途 |
|------|-------------|------|
| `taperBoth(w)` | `w·sin(πt)` | 两端尖、中间粗——脉线、刺 |
| `taperTail(w)` | `w·(1 - t^k)` 起粗收尖 | 茎（根粗梢细） |
| `contourWid(w)` | `w·(0.5 + 0.5·sin(πt))` + 轻 pnoise 抖 | 花瓣勾边（端部不为 0，保留收锋） |

每条线再叠一层沿程 `pnoise` 微扰（幅度 ≤ wid 的 ~15%）做手绘抖动，noise 种子取自 `BBS.next()` 保证确定性。

### 颜色 / 湿边

- 线色用 `hsv(h,s,v,a)`（FlowerCanvas 导出）。勾边玫红、脉线更淡、茎/刺墨色。
- 湿边只靠极轻 `ctx.filter = blur(0.3–0.6px)`，**不再用大 shadowBlur halo**（当前实现的雾感来源，删除）。

## 花瓣模型（方案 B：染 + 勾 + 脉）

单瓣由一条**脊线**（base→tip 的二次贝塞尔）+ 一个**最大半宽 `halfW(t)`** 剖面定义。基于脊线派生三层，从下到上画：

1. **染（wash）**：左右边缘 = `脊线 ± 法向·halfW(t)`，闭合成水滴形，填**线性渐变**：
   - base 端 `hsv(ROSE_H, 低饱和, 高明度)`（近白）
   - tip 端 `hsv(ROSE_H, 高饱和, 中明度)`（玫红）
   - 注意梯度方向：**tip 深、base 浅**（与墨色 taper 相反，符合参考图）。
2. **勾（contour）**：沿**左、右两条边缘折线**各画一条 `stroke()`，`wid = contourWid(CONTOUR_W)`，色 `hsv(ROSE_H, 高饱和, 低明度)`（玫红描边，比染色深）。两条独立 stroke，在 base/tip 自然收锋，不强行闭合。
3. **脉（veins）**：从 base 附近向 tip 画 2–4 条 `stroke()`，`wid = taperBoth(VEIN_W)`（极细），色为勾线色再调淡，沿脊线方向轻微扇形发散。

**单瓣参数**（per-petal，seed 决定）：脊线长 `PETAL_LEN·rand`、最大半宽 `PETAL_HALFW·rand`、脊线弯曲 `bend`、左右不对称 `curl`、tip 偏移 `tipLean`、最宽点位置 `widePos`。

### 花朵构图（侧视层叠，非 3D 投影）

放弃当前 yaw/pitch 3D 投影模型，改回参考图的**侧视扇形层叠**（更可控、更像写意）：

- 三层 aperture（张开角）由外到内递减：
  | 层 | 瓣数 | 张开半角 | 脊线长系数 | 明度偏移 |
  |----|------|----------|------------|----------|
  | 外 | 5–6 | ~75° | 1.0 | 偏浅 |
  | 中 | 3–4 | ~45° | 0.85 | 中 |
  | 内 | 2–3 | ~22° | 0.7 | 偏深（玫红更浓）|
- 每层花瓣绕花心按角度均布 + 抖动；后层先画、前层后画（外层在底、内层在面）。
- 花心**不画几何细节**（OOS）；内层花瓣自然收拢遮住即可。
- 单朵花心位置在茎顶；构图 2–3 朵（参考图为 2 朵盛开），花心 y 在画布上 1/3，x 错开 `FLOWER_X_SPREAD`。

## 叶模型（泼墨/没骨，无线）

- 深墨色块：极坐标半径函数采样的不规则圆形/肾形浮叶轮廓 → `polygon({fil:true})` 填充。
- 色 `hsv(LEAF_H≈140, 低饱和 0.15–0.3, 低明度 0.12–0.25, alpha)`，墨绿黑。
- 多片重叠用 `multiply` 累积浓度（保留当前的 multiply 思路）。
- **不画轮廓线、不画放射脉**（与当前实现相反）；可保留一条很淡的折面线暗示翻叶（≤30% 概率，可选）。
- 前景大叶低位、后景小叶高位，墨色随 z-depth 渐变。

## 茎模型（细单线 + 稀疏刺）

- 一条 `stroke()`：中心 = 锚点到画布底的贝塞尔（保留当前 S 曲生成思路），`wid = taperTail(STEM_W≈3–4)` 根粗梢细。
- 色墨 `hsv(0,0,0.18,·)`，沿程 pnoise 明度轻抖。
- **删除飞白雕刻（destination-out hair bundle）与密集 prickle**。
- 小刺：沿茎稀疏（每茎 0–6 个）短 `taperBoth` 线，长 2–4px，不再是 14–28 个。

## 墨点（泼墨）

- 底部左侧一簇黑墨点/飞溅：`BLOB`/小圆 + 少量随机卫星点，`hsv(0,0,0.08, 0.7–0.95)`。
- 数量、位置 seed 驱动；集中在叶丛根部。

## 色彩规约

| 元素 | 颜色 |
|------|------|
| 花瓣染 | base `hsv(345, 0.15, 0.97)` → tip `hsv(345, 0.55, 0.80)`（玫红粉，常量微调）|
| 花瓣勾线 | `hsv(345, 0.6, 0.60)` |
| 花瓣脉 | 勾线色调淡（alpha↓、明度↑）|
| 叶 | `hsv(140, 0.2, 0.18)` 附近，墨绿黑 |
| 茎 / 刺 | `hsv(0, 0, 0.18)` 墨 |
| 墨点 | `hsv(0, 0, 0.08)` 浓墨 |

颜色不暴露为参数，集中放各模块顶部 `const`（玫红色相 `ROSE_H` 等）便于微调。

## 图层 / 混合

沿用当前双层 + 出口裁框思路：

- `inkLayer`（multiply blit）：叶、茎、刺、墨点
- `colorLayer`（normal blit）：花瓣（染/勾/脉）
- 出口：`fast` 跳过 bound 直接 blit；否则 `Layer.bound` 求并集 + 缩放居中（保留当前 margin 逻辑，防止顶部花被裁）。

## 架构 / 文件拆分

当前 1053 行单文件过大且混合了 primitive 与构图。因本次为整体重写，顺带拆为模块目录（每文件单一职责，便于独立理解/测试/调参）：

```
packages/core/src/drawing/species/
├── index.ts                 # registry 不变：{ lotus: drawLotus }
└── lotus/
    ├── index.ts             # drawLotus 构图入口（编排叶→茎→点→花，图层与出口）
    ├── constants.ts         # 全部数值/颜色 const（画布、构图配方、色彩规约）
    ├── strokes.ts           # 宽度函数库 + 基于 FlowerCanvas.stroke 的 line 封装
    ├── petal.ts             # 单瓣 染+勾+脉
    ├── flower.ts            # 三层层叠花朵
    ├── leaf.ts              # 泼墨墨叶
    ├── stem.ts              # 细茎 + 小刺
    └── splatter.ts          # 墨点
```

- 对外契约不变：`SPECIES.lotus = drawLotus`，签名 `(ctx, { xof, yof, fast })`。
- `FlowerCanvas.ts` 不改。
- `LotusCanvasDemo.vue` 不改（仅消费 `generateFlowerCanvas({ species:"lotus" })`）。

## 验证

### 自动测试（沿用既有，不新增 golden）
- `species:"lotus"` 不抛异常，返回 canvas，宽高匹配。
- 同 seed 两次像素哈希一致（确定性）——所有随机走 `BBS`/`pnoise`，禁用 `Date.now`/`Math.random`。

### 人眼审美
- `pnpm build` 通过（tsc 严格 + tsdown）。
- 起 playground 审 `/lotus`（**用户手动**起，不自动起 dev server）；按 memory 流程：出图截图对照参考图，再迭代调参。
- 调参对照点：花瓣勾线粗细/玫红浓度、三层张开角、叶墨浓度、茎粗细、墨点量、留白。

## 风险

1. **三层 aperture/瓣数为估值**，首版需 ≥1 轮调参 —— 数值集中在 `constants.ts`。
2. **闭合花瓣的勾线在 base/tip 收锋**：两条独立边缘 stroke 若在端点错位会露缝；首版先不强制闭合，靠染色 fill 兜底，观感不行再加端封。
3. **tubify 在锐角脊线处自交**：花瓣脊线保持平滑低曲率；脉线短不易自交。
4. **拆模块引入循环依赖**：`constants` 不依赖任何模块；`strokes` 仅依赖 FlowerCanvas；其余依赖 `strokes`+`constants`，单向。

## 实现顺序

1. 建 `species/lotus/` 目录，`constants.ts` + `strokes.ts`（宽度函数 + line 封装），先单测确定性。
2. `leaf.ts`（泼墨块）+ `stem.ts`（细线+刺）+ `splatter.ts`（墨点）。
3. `petal.ts`（染+勾+脉单瓣）。
4. `flower.ts`（三层层叠）。
5. `index.ts` 构图编排 + 图层出口；删除旧 `lotus.ts`，`species/index.ts` 指向新目录。
6. `pnpm build`；人眼审；调参。
