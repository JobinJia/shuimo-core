# Flower Canvas to SVG Migration Task

## 项目目标

将 `reference-code/flowers/main.js` 中的 Canvas 实现改造为 SVG 实现，集成到 shuimo-core 项目中。

## 核心要求

- ✅ **完全复制滤镜效果**（不能简化）
- ✅ **Paper 纹理作为可选素材**（需要时添加）
- ✅ **返回 SVGElement**（DOM 元素）
- ✅ **保持原有的随机生成算法**（PRNG + Perlin Noise）

---

## Canvas 到 SVG 映射方案

### 1. 核心 API 映射

| Canvas API | SVG 替代方案 | 实现策略 |
|------------|-------------|---------|
| `ctx.beginPath()` / `ctx.moveTo()` / `ctx.lineTo()` | `<path d="M x y L x y ...">` | 生成 path 字符串 |
| `ctx.fillStyle` / `ctx.fill()` | `<path fill="color">` | 属性设置 |
| `ctx.strokeStyle` / `ctx.stroke()` | `<path stroke="color">` | 属性设置 |
| `ctx.globalCompositeOperation` | `<g style="mix-blend-mode">` | CSS 混合模式 |
| `ctx.getImageData()` / 像素操作 | **在生成时融入 noise** | 关键创新点 |

### 2. 滤镜实现策略（关键）

**原 Canvas 版本流程：**
```
1. 绘制形状到 canvas
2. getImageData() 获取像素数据
3. 遍历每个像素，用 Noise 函数调整颜色/透明度
4. putImageData() 写回
```

**SVG 版本流程（无法逐像素操作）：**
```
1. 生成形状时计算中心点坐标
2. 用 Noise 函数基于坐标计算颜色调整值
3. 直接生成调整后的颜色到 SVG path
```

**示例代码：**
```typescript
// 原 Canvas: Filter.wispy (Lines 1062-1066)
function wispy(x, y, r, g, b, a) {
  let n = Noise.noise(x * 0.2, y * 0.2)
  let m = Noise.noise(x * 0.5, y * 0.5, 2)
  return [r, g * mapval(m, 0, 1, 0.95, 1), b * mapval(m, 0, 1, 0.9, 1), a * mapval(n, 0, 1, 0.5, 1)]
}

// SVG 版本: 在 polygon 函数中
function polygon({ pts, col, applyWispy }) {
  const [cx, cy] = calculateCenter(pts)

  if (applyWispy) {
    const n = Noise.noise(cx * 0.2, cy * 0.2)
    const m = Noise.noise(cx * 0.5, cy * 0.5, 2)
    col = adjustColorWithNoise(col, n, m)
  }

  return createSVGPath(pts, col)
}
```

---

## 项目文件结构

```
packages/core/src/drawing/
├── Flower.ts                      # 主导出: generateFlower()
├── flower/
│   ├── types.ts                   # TypeScript 类型定义
│   ├── FlowerMath.ts              # 数学工具: v3, bezmh, distance, mapval, sigmoid, bean, squircle
│   ├── FlowerPRNG.ts              # 伪随机数生成器 Prng 类
│   ├── FlowerNoise.ts             # Perlin Noise 实现
│   ├── FlowerColor.ts             # 颜色工具: rgba, hsv, lerpHue
│   ├── FlowerShape.ts             # SVG 基础形状: polygon, stroke, tubify
│   ├── FlowerLayer.ts             # Layer 系统: empty, blit, bound, border
│   ├── FlowerFilter.ts            # 滤镜: wispy, fade (融入生成阶段)
│   ├── FlowerPlant.ts             # 植物结构: leaf, stem, branch
│   ├── FlowerParams.ts            # 参数生成: genParams
│   └── FlowerComposer.ts          # 组合器: woody, herbal

packages/playground/src/
└── Flower.vue                     # 演示页面
```

---

## 实施阶段

### 阶段 1: 基础设施 ✅
**目标**: 搭建项目结构，迁移不需要改动的工具函数

**任务列表:**
- [ ] 创建文件结构 (`packages/core/src/drawing/flower/`)
- [ ] 创建 `types.ts` - 定义 TypeScript 接口
- [ ] 迁移 `FlowerMath.ts` - 数学工具函数（Lines 28-37, 168-227, 256-355）
- [ ] 迁移 `FlowerPRNG.ts` - Prng 类（Lines 40-79）
- [ ] 迁移 `FlowerNoise.ts` - Perlin Noise（Lines 102-166）
- [ ] 实现 `FlowerColor.ts` - rgba, hsv, lerpHue（Lines 357-409）

**关键点:**
- 所有数学/几何函数可以直接复制
- 添加 TypeScript 类型标注
- 不依赖 DOM，纯计算

**预计耗时**: 2-3 小时

---

### 阶段 2: SVG 核心绘图 ✅
**目标**: 实现 Canvas → SVG 的基础绘图函数

**任务列表:**
- [ ] 实现 `FlowerShape.ts`:
  - [ ] `polygon()` - Canvas path → SVG path (Lines 374-399)
  - [ ] `tubify()` - 保持不变，纯几何计算 (Lines 416-442)
  - [ ] `stroke()` - 使用 SVG polygon (Lines 444-459)
  - [ ] SVG 辅助函数: `createSVGElement`, `pathFromPoints`

**原 Canvas 代码:**
```javascript
// polygon (Lines 374-399)
ctx.beginPath()
ctx.moveTo(pts[0][0] + xof, pts[0][1] + yof)
for (let i = 1; i < pts.length; i++) {
  ctx.lineTo(pts[i][0] + xof, pts[i][1] + yof)
}
ctx.fillStyle = col
ctx.fill()
```

**SVG 版本:**
```typescript
function polygon(args: PolygonArgs): SVGPathElement {
  const { pts, col, fil = true, str = false, xof = 0, yof = 0 } = args

  let d = `M ${pts[0][0] + xof} ${pts[0][1] + yof}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${pts[i][0] + xof} ${pts[i][1] + yof}`
  }
  d += ' Z'

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  if (fil) path.setAttribute('fill', col)
  if (str) path.setAttribute('stroke', col)

  return path
}
```

**预计耗时**: 2-3 小时

---

### 阶段 3: Layer 系统和滤镜 🔥
**目标**: 实现图层管理和滤镜效果（最关键）

**任务列表:**
- [ ] 实现 `FlowerLayer.ts`:
  - [ ] `Layer.empty()` - 创建 SVG group (Line 1075)
  - [ ] `Layer.blit()` - 合成图层，支持混合模式 (Lines 1084-1091)
  - [ ] `Layer.bound()` - 获取边界框 (Lines 1131-1150)
  - [ ] `Layer.border()` - 边框裁剪 (Lines 1107-1129)

- [ ] 实现 `FlowerFilter.ts`:
  - [ ] `Filter.wispy` - 颜色噪声效果 (Lines 1062-1066)
  - [ ] `Filter.fade` - 透明度噪声效果 (Lines 1067-1070)
  - [ ] 辅助函数: `applyNoiseToColor`, `calculateElementCenter`

**滤镜实现核心逻辑:**
```typescript
class FlowerFilter {
  static applyWispy(element: SVGElement, noise: NoiseFunction) {
    // 1. 获取元素的中心坐标或边界框
    const bbox = element.getBBox()
    const cx = bbox.x + bbox.width / 2
    const cy = bbox.y + bbox.height / 2

    // 2. 计算噪声值（复制原算法）
    const n = noise(cx * 0.2, cy * 0.2)
    const m = noise(cx * 0.5, cy * 0.5, 2)

    // 3. 调整颜色属性
    const fill = element.getAttribute('fill')
    if (fill) {
      const [r, g, b, a] = parseColor(fill)
      const newG = g * mapval(m, 0, 1, 0.95, 1)
      const newB = b * mapval(m, 0, 1, 0.9, 1)
      const newA = a * mapval(n, 0, 1, 0.5, 1)
      element.setAttribute('fill', rgba(r, newG, newB, newA))
    }
  }

  static applyFade(element: SVGElement, noise: NoiseFunction) {
    const bbox = element.getBBox()
    const cx = bbox.x + bbox.width / 2
    const cy = bbox.y + bbox.height / 2

    const n = noise(cx * 0.01, cy * 0.01)
    const opacity = Math.min(Math.max(mapval(n, 0, 1, 0, 1), 0), 1)
    element.setAttribute('opacity', opacity.toString())
  }
}

// Layer.filter 调用
static filter(layer: Layer, filterType: FilterType) {
  const elements = layer.group.querySelectorAll('path, polygon')
  elements.forEach(el => {
    if (filterType === 'wispy') {
      FlowerFilter.applyWispy(el, Noise.noise)
    } else if (filterType === 'fade') {
      FlowerFilter.applyFade(el, Noise.noise)
    }
  })
}
```

**关键难点:**
- 如何准确计算每个形状的"代表性坐标"（中心点 vs 重心 vs 边界框）
- 如何解析和修改 SVG 颜色属性（rgba/hsv 字符串）
- 保证噪声函数调用参数与 Canvas 版本一致

**预计耗时**: 4-5 小时

---

### 阶段 4: 植物结构 🌿
**目标**: 改造 leaf, stem, branch 函数

**任务列表:**
- [ ] 改造 `leaf()` 函数 (Lines 495-583)
  - 输入: 位置、旋转、长度、宽度、颜色等参数
  - 输出: SVGGElement（包含多个 polygon path）
  - 关键: 保持 3D 旋转计算 (v3.roteuler)

- [ ] 改造 `stem()` 函数 (Lines 586-642)
  - 输入: 茎的参数
  - 输出: SVGGElement
  - 关键: tubify 生成的管状结构

- [ ] 改造 `branch()` 函数 (Lines 645-713)
  - 输入: 分支参数（递归）
  - 输出: SVGGElement（嵌套的 group）
  - 关键: 递归结构的正确组装

**改造示例 - leaf():**
```typescript
function leaf(args: LeafArgs): SVGGElement {
  const group = document.createElementNS(SVG_NS, 'g')

  // ... 原有的几何计算逻辑（不变）

  // 原: polygon({ ctx, pts: [...], col: ... })
  // 改为:
  const pathElement = polygon({ pts: [...], col: ... })
  group.appendChild(pathElement)

  return group
}
```

**关键点:**
- 几何计算逻辑完全保持不变
- 只改变最终的绘制方式（ctx → SVG element）
- 返回 group 而不是修改全局 context

**预计耗时**: 4-6 小时

---

### 阶段 5: 组合和演示 🎨
**目标**: 实现主函数和演示页面

**任务列表:**
- [ ] 实现 `FlowerParams.ts`:
  - [ ] `genParams()` - 生成随机参数 (Lines 788-888)
  - [ ] 可选: `vizParams()` - 参数可视化 (Lines 716-785)

- [ ] 实现 `FlowerComposer.ts`:
  - [ ] `woody()` - 木本植物 (Lines 891-969)
  - [ ] `herbal()` - 草本植物 (Lines 972-1059)

- [ ] 实现 `Flower.ts` 主导出:
  ```typescript
  export interface FlowerOptions {
    seed?: number
    type?: 'woody' | 'herbal' | 'random'
    width?: number
    height?: number
    background?: 'none' | 'paper'
  }

  export function generateFlower(options?: FlowerOptions): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', options?.width?.toString() || '600')
    svg.setAttribute('height', options?.height?.toString() || '600')

    // 设置随机种子
    if (options?.seed) {
      Math.seed(options.seed)
    }

    // 生成参数
    const PAR = genParams()

    // 生成植物
    const layer = options?.type === 'woody'
      ? woody({ PAR })
      : herbal({ PAR })

    svg.appendChild(layer.group)

    return svg
  }
  ```

- [ ] 创建 `Flower.vue` 演示页面:
  ```vue
  <template>
    <div class="flower-demo">
      <h2>Flower Generator</h2>
      <div class="controls">
        <button @click="regenerate">Regenerate</button>
        <input v-model="seed" placeholder="Seed" />
      </div>
      <div ref="container"></div>
    </div>
  </template>

  <script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { generateFlower } from '@shuimo/core'

  const container = ref<HTMLDivElement>()
  const seed = ref('')

  function regenerate() {
    if (container.value) {
      container.value.innerHTML = ''
      const svg = generateFlower({
        seed: seed.value || undefined
      })
      container.value.appendChild(svg)
    }
  }

  onMounted(() => regenerate())
  </script>
  ```

**预计耗时**: 3-4 小时

---

## 类型定义参考

```typescript
// types.ts
export const SVG_NS = 'http://www.w3.org/2000/svg'

export type Vec3 = [number, number, number]
export type Vec2 = [number, number]

export interface PolygonArgs {
  pts: Vec2[]
  col?: string
  fil?: boolean
  str?: boolean
  xof?: number
  yof?: number
}

export interface StrokeArgs {
  pts: Vec3[]
  col?: string
  wid?: (x: number) => number
  xof?: number
  yof?: number
}

export interface LeafArgs {
  xof?: number
  yof?: number
  rot?: Vec3
  len?: number
  seg?: number
  wid?: (x: number) => number
  vei?: number[]
  flo?: boolean
  col?: ColorRange
  cof?: (x: number) => number
  ben?: (x: number) => Vec3
}

export interface ColorRange {
  min: [number, number, number, number] // [h, s, v, a]
  max: [number, number, number, number]
}

export interface Layer {
  group: SVGGElement
  width: number
  height: number
}

export interface BlitOptions {
  ble?: 'normal' | 'multiply'
  xof?: number
  yof?: number
}

export type FilterType = 'wispy' | 'fade'

export type NoiseFunction = (x: number, y?: number, z?: number) => number
```

---

## 关键技术挑战

### 1. 滤镜效果的精确复制
**挑战**: Canvas 可以逐像素操作，SVG 不能

**解决方案**:
- 在形状生成时融入 noise 计算
- 为每个形状计算代表性坐标
- 使用相同的 Noise 函数和参数

**验证方法**:
- 对比相同 seed 下 Canvas 版本和 SVG 版本的视觉效果
- 检查颜色值的数值差异

### 2. 图层混合模式
**挑战**: Canvas 的 `globalCompositeOperation` 在 SVG 中对应 `mix-blend-mode`

**解决方案**:
```typescript
// Canvas: ctx.globalCompositeOperation = 'multiply'
// SVG: group.style.mixBlendMode = 'multiply'
```

**浏览器兼容性**:
- mix-blend-mode 支持良好（IE 除外）
- 需要测试实际效果

### 3. 坐标变换
**挑战**: Canvas 使用全局 context + offset，SVG 使用 transform

**解决方案**:
- 保持原有的 xof/yof 参数（向后兼容）
- 内部可以选择用 transform 优化

### 4. 性能优化
**挑战**: 大量 path 元素可能影响性能

**解决方案**:
- 使用 `<use>` 复用相似形状
- 合并相邻的相同颜色 path
- 延迟渲染（如果需要）

---

## 测试计划

### 单元测试
- [ ] 数学函数: v3, bezmh, mapval 等
- [ ] PRNG: 相同 seed 产生相同序列
- [ ] Noise: Perlin noise 输出范围和分布
- [ ] Color: rgba/hsv 转换正确性

### 集成测试
- [ ] polygon 生成正确的 SVG path
- [ ] stroke 宽度变化正确
- [ ] leaf/stem/branch 结构正确
- [ ] Layer.blit 混合模式正确

### 视觉回归测试
- [ ] 对比相同 seed 下的 Canvas 和 SVG 输出
- [ ] 检查滤镜效果是否一致
- [ ] 多个随机样本的质量检查

---

## 风险和缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 滤镜效果无法完美复制 | 高 | 详细分析原算法，逐像素对比测试 |
| 性能问题（path 数量多） | 中 | 优化 path 生成，合并重复元素 |
| 混合模式浏览器兼容性 | 低 | Polyfill 或降级方案 |
| TypeScript 类型复杂 | 低 | 渐进式添加类型，先 any 后细化 |

---

## 成功标准

### 功能完整性
- ✅ 生成的花朵视觉效果与原 Canvas 版本一致
- ✅ 支持相同的参数配置
- ✅ 随机种子可复现
- ✅ 滤镜效果完全复制（wispy, fade）

### 代码质量
- ✅ TypeScript 类型覆盖 > 90%
- ✅ 模块化，职责分离清晰
- ✅ 函数签名清晰，有注释

### 性能
- ✅ 单个花朵生成时间 < 500ms
- ✅ SVG 文件大小合理（< 500KB）

### 可维护性
- ✅ 代码结构清晰，易于扩展
- ✅ 与 shuimo-core 其他模块风格一致

---

## 时间估算

| 阶段 | 预计时间 | 依赖 |
|------|---------|------|
| 阶段 1: 基础设施 | 2-3 小时 | 无 |
| 阶段 2: SVG 核心绘图 | 2-3 小时 | 阶段 1 |
| 阶段 3: Layer 和滤镜 | 4-5 小时 | 阶段 2 |
| 阶段 4: 植物结构 | 4-6 小时 | 阶段 3 |
| 阶段 5: 组合和演示 | 3-4 小时 | 阶段 4 |
| **总计** | **15-21 小时** | |

建议分 5 天完成，每天 3-4 小时。

---

## 参考资料

### 原始代码位置
- 主文件: `reference-code/flowers/main.js` (1245 lines)
- HTML: `reference-code/flowers/index.html`

### 关键函数行号
- PRNG: Lines 40-79
- Perlin Noise: Lines 102-166
- Math utilities: Lines 168-227, 256-355
- Color: Lines 357-409
- polygon: Lines 374-399
- stroke: Lines 444-459
- tubify: Lines 416-442
- leaf: Lines 495-583
- stem: Lines 586-642
- branch: Lines 645-713
- Filter: Lines 1062-1071
- Layer: Lines 1074-1151
- woody: Lines 891-969
- herbal: Lines 972-1059
- genParams: Lines 788-888

### SVG 参考
- MDN SVG Tutorial: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial
- SVG Path: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
- SVG Filters: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/filter

---

## 下一步行动

1. ✅ 保存此任务文件 `flower-task.md`
2. [ ] 创建基础文件结构
3. [ ] 开始阶段 1: 迁移数学工具和 PRNG

**准备好开始了吗？**
