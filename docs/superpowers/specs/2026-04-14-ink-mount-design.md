# InkMount — 写意水墨山体渲染引擎

## 概述

新增独立的水墨山体渲染模块，目标是逼近传统中国写意山水画的视觉效果：尖锐山脊、沿等高线的皴法笔触、浓淡墨色渐变、层间云雾。

不修改现有 `Mount` 类，作为全新实现。

## 需求

- **双模式**：独立生成完整山水场景 + 可作为可组合元素嵌入场景
- **渲染后端**：Canvas 2D + WebGPU，自动检测降级
- **层数**：自动计算（基于画布高度），支持用户覆盖（2-10 层）
- **云雾内置**，暴露接口允许外部注入元素
- **输出**：接受外部 context 直接绘制，或返回离屏 Canvas/ImageBitmap
- **质量档位**：draft / normal / high

## 架构

```
packages/core/src/drawing/ink-mount/
├── InkMount.ts           — 主入口，编排管线
├── RidgeGenerator.ts     — 山脊轮廓生成（FBM + 角峰注入）
├── CunFaEngine.ts        — 皴法笔触引擎（沿法线方向）
├── InkWashLayer.ts       — 墨色渲染（渐变 + 泼墨 + 噪声）
├── MistLayer.ts          — 云雾生成
├── types.ts              — 所有类型定义
├── renderer/
│   ├── Canvas2DBackend.ts
│   ├── WebGPUBackend.ts
│   └── types.ts          — RenderBackend 接口
└── index.ts
```

放在 `drawing/` 层（渲染原语），而非 `elements/`（场景元素）。后续可在 `elements/` 层包装为 `InkMountain` 组合元素。

## 数据流

```
InkMount.generate(options)
  → RidgeGenerator    输出 MountainLayer[]（轮廓点 + 法线）
  → CunFaEngine       输出 CunFaStroke[]（位置、方向、粗细、墨色）
  → InkWashLayer      输出 InkFill（渐变 + 泼墨块 + 噪声）
  → MistLayer         输出 MistRegion[]（雾区轮廓 + 透明度）
  → Renderer          按深度从远到近绘制：山体填充 → 皴法 → 轮廓 → 云雾
```

核心原则：算法层输出纯数据，渲染后端只负责绘制。

## 核心算法

### RidgeGenerator

- 基础轮廓：6 阶 FBM（persistence=0.5, lacunarity=2.0）
- 角峰注入：1-3 个主峰，`y += peakHeight * (1 - |x - peakX| / falloff)^sharpness`
- 副脊线：主峰两侧 2-4 条，主轮廓 \* 衰减 + 高频噪声
- 输出：每层 200 个点的轮廓 + 每个点的法线向量

### CunFaEngine

- 沿法线方向向山体内部投射笔触
- 长度 15-60px，近景长远景短
- 角度：法线方向 ± 15° 偏转
- 宽度：起笔细 → 中粗 → 收笔细（毛笔压力曲线）
- 密度：山脊高曲率处密集，平坦处稀疏

### InkWashLayer

- 基础渐变：山顶 opacity 0.1 → 山脚 0.85
- 泼墨块：山脚/凹处 2-5 个贝塞尔曲线不规则区域
- 墨色噪声：Perlin 调制透明度

### MistLayer

- 层间区域用低频 Perlin 生成水平拉长的雾区
- 中心不透明(0.7-0.9) → 边缘渐隐(0)
- 暴露 addElement() 接口

## API

```typescript
// 完整场景
const result = InkMount.generate({
  width: 1200,
  height: 800,
  seed: 42,
  layers: 5,
  quality: "high",
  backend: "auto",
});

// 单层元素（可组合）
const layer = InkMount.generateLayer({
  width: 1200,
  height: 300,
  seed: 42,
  depth: 0.8,
});
```

### 主要类型

- `InkMountOptions` — 完整选项（width, height, seed, layers?, quality?, backend?, ridge?, cunfa?, mist?, onLayer?)
- `RidgeOptions` — 山脊参数（peakCount, sharpness, subRidgeCount, noiseOctaves）
- `CunFaOptions` — 皴法参数（density, lengthRange, pressureCurve）
- `MistOptions` — 云雾参数（opacity, frequency, coverage）
- `MountainLayer` — 中间数据（depth, ridgeLine, subRidges, normals, bounds）
- `CunFaStroke` — 笔触数据（path, width[], opacity）
- `InkFill` — 墨色数据（gradient, splashes, noiseSeed）
- `MistRegion` — 雾区数据（contour, opacity, fadeRadius）

### 渲染后端接口

```typescript
interface RenderBackend {
  drawMountainFill(layer: MountainLayer, ink: InkFill): void;
  drawCunFaStrokes(strokes: CunFaStroke[]): void;
  drawMist(regions: MistRegion[]): void;
  drawRidgeLine(points: Vector2[], opacity: number): void;
  toOutput(): RenderOutput;
}
```

输出支持 HTMLCanvasElement、OffscreenCanvas、ImageBitmap。

## 质量档位

| 档位   | 皴法密度 | 噪声精度 | 泼墨块 | 适用场景 |
| ------ | -------- | -------- | ------ | -------- |
| draft  | 0.2      | 4 阶 FBM | 0      | 实时预览 |
| normal | 0.5      | 6 阶 FBM | 2-3    | 一般使用 |
| high   | 0.8-1.0  | 8 阶 FBM | 4-5    | 最终出图 |

## 依赖

复用现有模块：

- `foundation/noise/SimplexNoise` — FBM 噪声
- `foundation/noise/PerlinNoise` — 墨色/云雾噪声
- `foundation/geometry/Vector2` — 向量运算
- `foundation/random/prng` — 种子随机数
- `webgpu/` — WebGPU 后端复用现有引擎基础设施
