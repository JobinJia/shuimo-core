# Stamp 印章生成流程图 — 以 fontSize 为核心

> 所有距离计算均以 `fontSize` (简写 `F`) 为基本单位。默认 `F = 70px`。

---

## 零、fontSize 驱动的距离总览

以 `F = 70, text = ["水墨", "丹青", "画"]` (3列, 各2/2/1字) 为例：

```text
fontSize (F) = 70px ─── 一切计算的基准
│
├─ 列宽 (columnWidth)
│   估算: F × 0.55 = 38.5px
│   (或浏览器实测 / 用户指定)
│
├─ 列高 (columnHeight) ── 每列独立计算
│   = 字数 × F × 1.1 + (字数-1) × F × charSpacing
│   "水墨" (2字): 2×F×1.1 + 1×F×0.05 = 2.25F = 157.5px
│   "画"   (1字): 1×F×1.1 + 0         = 1.1F  = 77px
│
├─ 列间距 (columnGap)
│   = F × columnSpacing = F × 0.05 = 3.5px
│
├─ 字间距 (letterSpacing)
│   = characterSpacing em = 0.05em (CSS 相对于 F)
│
├─ 水平内边距 (paddingX)
│   = F × paddingX = F × 0.05 = 3.5px
│
├─ 垂直内边距 (paddingY)
│   = F × paddingY = F × 0.05 = 3.5px
│
└─ 文本区域总尺寸
    totalWidth  = Σ列宽 + (列数-1) × F × colSpacing
                = 3×0.55F + 2×0.05F = 1.75F = 122.5px
    totalHeight = max(各列高) = 2.25F = 157.5px
```

---

## 一、完整流程图

```text
generateStamp(options)
│
│  F = fontSize (默认 70)
│
├─ 1. 参数归一化 (全部转为 F 的倍数)
│     ┌──────────────────────────────────────────────┐
│     │ columnSpacingPx 有值?                         │
│     │   Y → colSpacing = columnSpacingPx / F       │
│     │   N → colSpacing = columnSpacing (默认 0.05) │
│     │                                              │
│     │ characterSpacingPx 有值?                      │
│     │   Y → charSpacing = characterSpacingPx / F   │
│     │   N → charSpacing = characterSpacing (0.05)  │
│     │                                              │
│     │ paddingXPx 有值?                              │
│     │   Y → padX = paddingXPx                      │
│     │   N → padX = F × paddingX  (= 0.05F)        │
│     │                                              │
│     │ paddingYPx 有值?                              │
│     │   Y → padY = paddingYPx                      │
│     │   N → padY = F × paddingY  (= 0.05F)        │
│     └──────────────────────────────────────────────┘
│
├─ 2. generateStampPath(options) → { path, bounds }
│     │
│     ├─ 2a. calculateTextBounds()  ← 详见第二节
│     │       所有距离均由 F 推导
│     │
│     ├─ 2b. 边框基础尺寸  ← 详见第三节
│     │       基于 textDims + padding (F的倍数)
│     │
│     ├─ 2c. 噪声初始化 + 路径绘制  ← 详见第四、五节
│     │
│     └─ return { path, bounds }
│
├─ 3. calculateTextBounds() 第二次 (含实测高度)
│     → 精确的 columnWidths, columnGap = F × colSpacing
│
├─ 4. 文本偏移与定位  ← 详见第六节
│     所有偏移基于 bounds 和 textDims 的差值
│
├─ 5. 生成 <text> SVG 元素
│     font-size: F px
│     letter-spacing: charSpacing em (相对 F)
│
├─ 6. 组装滤镜 + SVG
│
└─ return SVG string
```

---

## 二、文本度量 — calculateTextBounds 详解

### 2.1 列宽 (columnWidth)

```text
三种来源, 优先级递减, 最终都是像素值:

  ① measuredColumnWidths (浏览器 getBBox 实测)
     → 每列独立宽度, 最精确

  ② columnWidthPx (用户手动指定)
     → 所有列统一宽度

  ③ 估算 (兜底)
     columnWidth = F × 0.55
     ┌─────────────────────────────────────┐
     │  为什么是 0.55?                      │
     │  衬线字体竖排时, 实际渲染宽度         │
     │  约为 fontSize 的 55%                │
     │  (历史值: 0.85 → 0.7 → 0.55)        │
     └─────────────────────────────────────┘

  F=70 时: 列宽 ≈ 38.5px
```

### 2.2 列高 (columnHeight)

```text
两种来源:

  ① measuredColumnHeights (浏览器实测) → 直接用

  ② 估算公式 (逐列计算):
     columnHeight = chars × F × 1.1 + (chars - 1) × F × charSpacing
                    ├──────────────┘   ├──────────────────────────┘
                    每字基础高度         字间间隔
                    (含上下 padding)

     拆解:
     ┌──────────────────────────────────────────────┐
     │  单字高度   = F × 1.1                         │
     │  字间间隔   = F × charSpacing                  │
     │                                               │
     │  n 个字:                                       │
     │  总高 = n × (F × 1.1) + (n-1) × (F × charSp) │
     │       = F × [n × 1.1 + (n-1) × charSp]       │
     │                                               │
     │  全部是 F 的倍数!                               │
     └──────────────────────────────────────────────┘

  数值示例 (F=70, charSpacing=0.05):

  字数 │  公式展开                   │ = F × 系数  │ 像素值
  ─────┼─────────────────────────────┼─────────────┼────────
    1  │ 1×F×1.1 + 0                │ 1.10F       │ 77.0
    2  │ 2×F×1.1 + 1×F×0.05        │ 2.25F       │ 157.5
    3  │ 3×F×1.1 + 2×F×0.05        │ 3.40F       │ 238.0
    4  │ 4×F×1.1 + 3×F×0.05        │ 4.55F       │ 318.5
    n  │ n×F×1.1 + (n-1)×F×0.05    │ (1.15n-0.05)F│
```

### 2.3 文本区域总尺寸

```text
  totalWidth = Σ(各列宽) + (列数 - 1) × F × colSpacing
               ├────────┘   ├───────────────────────┘
               各列宽度之和    列间间隔总和

  totalHeight = max(各列高度)

  ┌──────────────────────────────────────────────┐
  │  示例: 3列 (各列宽=0.55F), colSpacing=0.05   │
  │                                              │
  │  totalWidth = 3 × 0.55F + 2 × 0.05F         │
  │             = 1.65F + 0.1F                   │
  │             = 1.75F                          │
  │             = 122.5px  (F=70)                │
  │                                              │
  │  也可以写成:                                   │
  │  totalWidth = F × [n×0.55 + (n-1)×0.05]     │
  │             = F × [0.6n - 0.05]              │
  │                                              │
  │  ← 完全由 F 和 列数 决定 →                     │
  └──────────────────────────────────────────────┘
```

---

## 三、边框尺寸 — 全部由 F 推导

### 3.1 基础尺寸 (公共步骤)

```text
  padX = F × paddingX  (默认 = 0.05F = 3.5px)
  padY = F × paddingY  (默认 = 0.05F = 3.5px)

  baseWidth   = textDims.width + padX × 2
              = F×[n×0.55 + (n-1)×0.05] + F×0.05×2
              = F×[n×0.55 + (n-1)×0.05 + 0.1]
              = F×[0.6n + 0.05]

  baseRightH  = col[0].height + padY × 2
              = F×[(1.15×chars₀ - 0.05) + 0.1]
              = F×[1.15×chars₀ + 0.05]

  baseLeftH   = col[末].height + padY × 2
              = F×[1.15×chars_last + 0.05]

  ┌────── 应用 borderScale ──────────────────┐
  │  scaleX = borderScaleX ?? borderScale    │
  │  scaleY = borderScaleY ?? borderScale    │
  │                                          │
  │  maxWidth    = baseWidth  × scaleX       │
  │  rightHeight = baseRightH × scaleY       │
  │  leftHeight  = baseLeftH  × scaleY       │
  │                                          │
  │  scale=1 时, 所有尺寸仍是 F 的倍数        │
  └──────────────────────────────────────────┘
```

### 3.2 各形状最终尺寸 (均为 F 的倍数)

```text
auto (梯形):
  width  = maxWidth
  height = max(rightHeight, leftHeight)
  → 两边高度可不同, 形成梯形

square (正方形):
  baseSize = max(textWidth + 2×padX, textHeight + 2×padY)
  size = baseSize × avgScale    (avgScale = (scaleX+scaleY)/2)

rectangle (长方形):
  width  = (textWidth  + 2×padX) × scaleX
  height = (textHeight + 2×padY) × scaleY

circle (圆形):
  baseDiameter = max(textWidth + 2×padX, textHeight + 2×padY)
  diameter = baseDiameter × avgScale
  radius = diameter / 2

ellipse (胶囊):
  横向 (textWidth > textHeight):
    width  = (textWidth + 2×padX + (textHeight+2×padY)×0.15) × scaleX
    height = (textHeight + 2×padY) × scaleY
             ↑ 额外 15% 补偿

  纵向:
    shortSide = min(textWidth+2×padX, textHeight+2×padY)
    width  = (textWidth + 2×padX) × scaleX
    height = (textHeight + 2×padY + shortSide×0.15) × scaleY
```

### 3.3 以 F=70, 3列各2字 为数值示例

```text
  F = 70, n = 3, chars = 2 (每列), padX = padY = 0.05F, scale = 1

  列宽    = 0.55F = 38.5px
  列高    = 2.25F = 157.5px
  列间距  = 0.05F = 3.5px
  padX    = 0.05F = 3.5px
  padY    = 0.05F = 3.5px

  textWidth  = 3×38.5 + 2×3.5 = 122.5px  (= 1.75F)
  textHeight = 157.5px                     (= 2.25F)

  ┌── auto 梯形 ──────────────────────────────┐
  │ baseWidth = 1.75F + 2×0.05F = 1.85F      │
  │           = 129.5px                       │
  │ baseH     = 2.25F + 2×0.05F = 2.35F      │
  │           = 164.5px                       │
  │ width  = 1.85F = 129.5px                  │
  │ height = 2.35F = 164.5px                  │
  └───────────────────────────────────────────┘

  ┌── square ─────────────────────────────────┐
  │ size = max(1.85F, 2.35F) = 2.35F         │
  │      = 164.5px                            │
  └───────────────────────────────────────────┘

  ┌── rectangle ──────────────────────────────┐
  │ width  = 1.85F = 129.5px                  │
  │ height = 2.35F = 164.5px                  │
  └───────────────────────────────────────────┘

  ┌── circle ─────────────────────────────────┐
  │ diameter = max(1.85F, 2.35F) = 2.35F     │
  │          = 164.5px                        │
  └───────────────────────────────────────────┘
```

---

## 四、噪声系统

```text
  噪声现已跟随 F 等比缩放:

  noiseAmount = DEFAULT_NOISE_AMOUNT × F  (默认 12/70 × F, F=70 时 = 12px)
  noiseScale  = 0.015 (采样频率, 固定)

  applyNoise(x, y, edgeProgress):
  ┌────────────────────────────────────────────────┐
  │  noiseX = noise3D(x×0.015, y×0.015, z=0)      │
  │  noiseY = noise3D(x×0.015, y×0.015, z=100)    │
  │           ↑ z=100 使 X/Y 去相关                 │
  │                                                │
  │  cornerFactor = edgeProgress                   │
  │    (0 = 角落无噪声, 1 = 边中点最大噪声)          │
  │                                                │
  │  偏移X = noiseX × actualNoiseAmount × cornerFactor │
  │  偏移Y = noiseY × actualNoiseAmount × cornerFactor │
  │                                                    │
  │  actualNoiseAmount = noiseAmountPx ?? F × noiseAmount│
  │  默认 noiseAmount = 12/70, 所以:                     │
  │    F=70  → 12px    F=140 → 24px    F=35 → 6px       │
  │                                                    │
  │  噪声范围: [-actualNoiseAmount, +actualNoiseAmount]   │
  │  噪声始终约为 F 的 ±17%, 不随 F 变化                   │
  └────────────────────────────────────────────────────┘
```

### 4.1 edgeProgress 分布

```text
  顶边: edgeProgress = 1.0 (全程满噪声)

  其他三边: edgeProgress = sin(t × π)

  t:    0.0   0.25   0.5   0.75   1.0
  sin:  0.0   0.71   1.0   0.71   0.0
        ↑                          ↑
       角落                       角落
       (无噪声)                  (无噪声)

  → 角落处平滑过渡, 边中间最不规则
```

### 4.2 noise3D 流程 (Perlin 改进版)

```text
  noise3D(x, y, z) → [-1, 1]

  1. 定位单位立方体: X,Y,Z = floor & 255
  2. 立方体内相对坐标: x,y,z ∈ [0,1)
  3. fade 曲线: u,v,w = 6t⁵ - 15t⁴ + 10t³
  4. 哈希 8 个角点 → 排列表查找
  5. 每角点: grad(hash, dx, dy, dz) = 12 方向之一的点积
  6. 三线性插值 → 最终值 ∈ [-1, 1]
```

---

## 五、边框路径生成

### 5.1 auto 梯形

```text
  cornerRadii = cornerRadius × (1 ± 20%)  各角独立随机
  pointsPerEdge = floor(borderPoints / 4)

  绘制顺序 (顺时针):
  ┌──────────────────────────────────────────────────┐
  │                                                  │
  │   (cr.tl, 0)          (maxWidth-cr.tr, 0)        │
  │       ●─── 顶边 fullNoise=1.0 ───●               │
  │      ╱                              ╲             │
  │ Q(0,0→cr.tl)                   Q(maxW,0→cr.tr)   │
  │     │                                │            │
  │     │  左边 sin(t×π)       右边 sin(t×π)          │
  │     │                                │            │
  │ Q(0,leftH→cr.bl)         Q(maxW,rightH→cr.br)    │
  │      ╲                              ╱             │
  │       ●── 底边 高度插值 sin(t×π) ──●              │
  │                                                  │
  │   Q = quadTo 二次贝塞尔曲线圆角                    │
  │                                                  │
  │   底边特殊:                                       │
  │   xPos = (maxW-cr.br) → cr.bl  线性               │
  │   yPos = rightH → leftH        线性插值            │
  │   → 形成左右不等高的梯形底边                        │
  └──────────────────────────────────────────────────┘
```

### 5.2 square / rectangle

```text
  regularShape = true → 无噪声纯圆角矩形 (quadTo)
  regularShape = false → 四边带噪声 + 四角 quadTo

  cornerRadii 随机化:
  每角 = cornerRadius × (1 + (random()-0.5) × 0.4)
       = cornerRadius × [0.8, 1.2]
```

### 5.3 circle

```text
  regularShape = true → 4段三次贝塞尔, k=0.5522847498
  regularShape = false → borderPoints 个点在圆上:
    angle = (i / borderPoints) × 2π
    x = cx + cos(angle) × radius
    y = cy + sin(angle) × radius
    → applyNoise(x, y, edgeProgress=1.0)
```

### 5.4 ellipse (胶囊形)

```text
  横向 (width > height):
    radius = height / 2
    curveRadius = radius × 0.5
    straightLength = width - radius × 2

    ╭── top straight ───╮
    │                    │  左右: 半椭圆弧
    ╰── bottom straight ╯  curvR 控制弧度

  纵向 (width ≤ height):
    radius = width / 2
    curveRadius = radius × 0.5
    straightLength = height - curveRadius × 2

    ╭─╮
    │ │ 上下: 半椭圆弧
    │ │ 左右: 直线段
    ╰─╯
```

---

## 六、文本定位 — 基于 F 的偏移计算

```text
  第二次 calculateTextBounds (传入 measuredColumnHeights)
  → 更精确的 textDims (列宽、列高)
  columnGap = F × colSpacing

  offsetX, offsetY ∈ [-1, 1]
    -1 = 贴右/贴上 (vertical-rl, 右边是起始边)
     0 = 居中
    +1 = 贴左/贴下

  ┌────── 水平偏移 (控制列群左右位置) ────────────┐
  │                                                │
  │  horizontalSpace = bounds.width - textDims.width│
  │  horizontalOffset = (offsetX + 1) / 2          │
  │                   × horizontalSpace            │
  │  firstColumnX = bounds.width - horizontalOffset │
  │                 ↑ 从右边开始 (vertical-rl)      │
  │                                                │
  │  示例 (F=70, bounds.width=129.5, text.width=122.5):
  │    space = 7.0px (= 0.1F)                      │
  │    offsetX=0: offset = 3.5px, firstCol = 126   │
  │    offsetX=-1: offset = 0, firstCol = 129.5    │
  │    offsetX=+1: offset = 7.0, firstCol = 122.5  │
  └────────────────────────────────────────────────┘

  ┌────── 垂直偏移 (控制列群上下位置) ────────────┐
  │                                                │
  │  maxTextHeight = max(columnHeights)             │
  │  verticalSpace = bounds.height - maxTextHeight  │
  │  verticalOffset = (offsetY + 1) / 2            │
  │                 × verticalSpace                │
  │  startY = verticalOffset                       │
  └────────────────────────────────────────────────┘
```

### 6.1 各列 X 坐标 (从右向左排列)

```text
  columnGap = F × colSpacing = 0.05F

  列0 (最右): x₀ = firstColumnX
  列1:        x₁ = x₀ - colWidth[0] - columnGap
  列2:        x₂ = x₁ - colWidth[1] - columnGap
  ...
  列i:        xᵢ = firstColumnX - Σ(j=0→i-1)(colWidth[j] + columnGap)

  每列 Y: startY (统一)

  ┌────────────────────────────────────────┐
  │                                        │
  │  ← columnGap →     ← columnGap →      │
  │  │  (0.05F)   │    │  (0.05F)   │     │
  │  ▼            ▼    ▼            ▼     │
  │  ┌──┐        ┌──┐        ┌──┐        │
  │  │列│        │列│        │列│        │
  │  │2 │←0.55F→ │1 │←0.55F→ │0 │←0.55F→│
  │  │  │        │  │        │  │        │
  │  └──┘        └──┘        └──┘        │
  │  ← ──── 阅读方向 ←←← (右到左) ────── │
  │                                        │
  └────────────────────────────────────────┘
```

---

## 七、阴章 vs 阳章

```text
  yin 阴章 (默认)              yang 阳章
  ┌─────────────────┐         ┌─────────────────┐
  │ ███████████████ │         │ ┌─────────────┐ │
  │ ███ 白字 ██████ │         │ │             │ │
  │ ███████████████ │         │ │   红字       │ │
  │ ███████████████ │         │ │             │ │
  └─────────────────┘         │ └─────────────┘ │
                               └─────────────────┘
  背景 fill = 红色             背景 fill = 白色
  文字 fill = 白色             边框 stroke = 红色
  滤镜: stamp-ink-texture      文字 fill = 红色
                               边框 borderWidth 控制粗细
                               边框滤镜: stamp-border-texture
```

---

## 八、SVG 滤镜

```text
  stamp-ink-texture (印泥材质, 9步):
    1. feTurbulence(fractalNoise, 0.04, 4) → 边缘噪声
    2. feDisplacementMap(scale=18) → 不规则边缘
    3. feTurbulence(fractalNoise, 0.4, 4) → 颗粒
    4. feTurbulence(turbulence, 0.08, 2) → 斑块
    5. feBlend(multiply) → 合并颗粒+斑块
    6. feColorMatrix → alpha 蒙版
    7. feComponentTransfer(discrete) → 对比度
    8. feComposite(in) → 蒙版叠加
    9. feGaussianBlur(0.5) + opacity=0.98

  stamp-border-texture (阳章边框):
    feTurbulence(0.04, 3) → DisplacementMap(8) → Blur(0.3)

  stamp-text-texture (雕刻效果):
    Layer1: Turbulence(0.15) → Displacement(1.2) 精细
    Layer2: Turbulence(0.05) → Displacement(0.8) 粗糙
    → Blur(0.3) → contrast(1.2)
```

---

## 九、measureStampText (浏览器端)

```text
  仅浏览器环境可用, 创建临时 SVG 精确测量:

  1. 创建隐藏 SVG (1000×1000)
  2. 每列创建 <text> 元素:
     - writing-mode: vertical-rl
     - font-size: F px
     - letter-spacing: charSpacing em
  3. getBBox() → { width, height } 精确像素值
  4. 返回 { columnWidths[], columnHeights[] }

  注意: generateStampPath 不用 measuredColumnHeights
       (避免边框紧贴文本), 只在文本定位时使用
```

---

## 十、距离公式速查表 (全部基于 F)

| 距离名称 | 以 F 表示的公式 | F=70 时的值 |
| --- | --- | --- |
| 列宽 (估算) | `F × 0.55` | 38.5px |
| 单字高度 | `F × 1.1` | 77px |
| n 字列高 | `F × (1.15n - 0.05)` | 2字=157.5px |
| 列间距 | `F × colSpacing` | F×0.05 = 3.5px |
| 字间距 | `charSpacing em` (CSS) | 0.05em |
| 水平内边距 | `F × paddingX` | F×0.05 = 3.5px |
| 垂直内边距 | `F × paddingY` | F×0.05 = 3.5px |
| 文本总宽 (n列等宽) | `F × (0.6n - 0.05)` | 3列=122.5px |
| auto 边框宽 | `F × (0.6n + 0.05) × scaleX` | 129.5px |
| auto 边框高 | `F × (1.15×chars + 0.05) × scaleY` | 2字=164.5px |
| 水平偏移 | `(offsetX+1)/2 × (boundsW - textW)` | 居中=3.5px |
| 垂直偏移 | `(offsetY+1)/2 × (boundsH - textH)` | 居中=3.5px |
| 噪声偏移 | `noise × F×(12/70) × edgeProgress` | F=70: 最大±12px |
| 圆角 | `F×(15/70) × [0.8, 1.2]` | F=70: 15×[0.8,1.2] |
| 边框点数 | `round(F × 24/70)` | F=70: 24 |
| 边框宽度 | `F × (1/70)` | F=70: 1px |
| 椭圆补偿 | `shortSide × 0.15` | 视情况 |

---

## 十一、F 变化对整体的影响

```text
  当 F 翻倍 (70 → 140):

  ┌──────────────────────────────────────────────┐
  │ 全部线性放大 (F 的倍数):                        │
  │   列宽         38.5 → 77px    (×2)           │
  │   列高         157.5 → 315px  (×2)           │
  │   列间距       3.5 → 7px      (×2)           │
  │   padding      3.5 → 7px      (×2)           │
  │   边框宽(整体) 129.5 → 259px  (×2)           │
  │   边框高(整体) 164.5 → 329px  (×2)           │
  │   noiseAmount  12 → 24px      (×2)           │
  │   cornerRadius 15 → 30px      (×2)           │
  │   borderWidth  1 → 2px        (×2)           │
  │   borderPoints 24 → 48        (×2)           │
  │                                              │
  │ → 印章整体等比缩放, 视觉效果一致               │
  │ → 如需固定像素值, 使用 *Px 后缀字段覆盖        │
  └──────────────────────────────────────────────┘
```
