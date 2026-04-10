# 笔画动画功能使用指南

## 🎉 新功能概述

基于论文 **"Animating Strokes in Drawing Process of Chinese Ink Painting"** (Yang Lijie, Xu Tianchen, Wu Enhua, 2016) 实现的笔画动画功能已成功添加到项目中！

## 📁 项目结构

```
packages/core/src/
├── experimental/              # 新增实验性功能目录
│   ├── stroke-animation/
│   │   ├── types.ts          # 类型定义
│   │   ├── StrokeTrajectory.ts    # 笔画轨迹估算
│   │   ├── BrushFootprint.ts      # 毛笔足迹模型
│   │   ├── StrokeAnimator.ts      # 动画渲染器
│   │   ├── index.ts               # 模块入口
│   │   └── README.md              # 详细文档
│   └── index.ts
└── foundation/geometry/
    └── Vector2.ts            # 新增2D向量类

playground/src/
├── demos/
│   └── StrokeAnimation.vue   # 演示页面
└── router/router.ts          # 已添加路由
```

## 🚀 快速开始

### 1. 启动 Playground

```bash
pnpm playground
```

### 2. 访问演示页面

在浏览器中打开：`http://localhost:5173/stroke-animation`

### 3. 使用演示

1. **绘制笔画** - 在画布上按住鼠标拖动绘制
2. **生成动画** - 点击"生成动画"按钮
3. **播放控制** - 使用播放/暂停/重置按钮控制动画
4. **参数调整** - 调整速度、足迹数量、渲染效果等参数

## 💻 代码使用示例

### 基础使用

```typescript
import { Vector2, Experimental } from '@shuimo/core'

// 1. 准备笔画数据
const strokeShape: Experimental.StrokeShape = {
  imageData: /* 笔画图像数据 */,
  contour: {
    points: [/* Vector2 点序列 */],
    startIndex: 0,
    endIndex: points.length - 1
  }
}

// 2. 创建估算器和生成器
const estimator = new Experimental.StrokeTrajectoryEstimator()
const generator = new Experimental.BrushFootprintGenerator()

// 3. 估算轨迹
const trajectory = estimator.estimateTrajectory(strokeShape)

// 4. 生成足迹
const footprints = generator.generateFootprints(
  trajectory,
  strokeShape.contour,
  50 // 足迹数量
)
trajectory.footprints = footprints

// 5. 创建动画器并播放
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const animator = new Experimental.StrokeAnimator(canvas)
animator.setTrajectory(trajectory)
animator.setSpeed(30)
animator.play()
```

### 使用快捷工具类

```typescript
import { Experimental } from "@shuimo/core";

const animation = new Experimental.StrokeAnimation(canvas);
await animation.createAnimation(strokeShape, 50);

const animator = animation.getAnimator();
animator?.play();
```

## 🎨 核心功能

### 1. 笔画轨迹估算

- ✅ 自动从笔画轮廓提取绘画轨迹
- ✅ Bézier曲线拟合确保流畅性
- ✅ 智能端点检测（锋利/平滑）
- ✅ 中轴线提取

### 2. 毛笔足迹模型

- ✅ 支持中锋和侧锋两种笔法
- ✅ 动态计算足迹大小和方向
- ✅ 基于方向变化的停留时间模拟
- ✅ 压力值计算

### 3. 实时动画渲染

- ✅ Canvas 2D 高性能渲染
- ✅ 播放/暂停/重置控制
- ✅ 可调节的动画速度
- ✅ 干笔效果模拟
- ✅ 墨色渐变效果
- ✅ 可选的辅助显示（轨迹线、足迹边界）

## 🔧 API 参考

### 类型定义

```typescript
// 笔画形状
interface StrokeShape {
  imageData: ImageData;
  contour: StrokeContour;
  medialAxis?: Vector2[];
}

// 笔画轮廓
interface StrokeContour {
  points: Vector2[];
  startIndex: number;
  endIndex: number;
}

// 毛笔足迹
interface BrushFootprint {
  center: Vector2;
  majorAxis: number;
  minorAxis: number;
  angle: number;
  isSideTip?: boolean;
  pressure?: number;
}

// 绘画轨迹
interface DrawingTrajectory {
  points: Vector2[];
  footprints: BrushFootprint[];
  startPoint: Vector2;
  endPoint: Vector2;
}

// 渲染配置
interface RenderConfig {
  showTrajectory?: boolean;
  showFootprintBounds?: boolean;
  diffusionStrength?: number;
  dryBrushStrength?: number;
}
```

### 主要类

#### StrokeTrajectoryEstimator

```typescript
class StrokeTrajectoryEstimator {
  estimateTrajectory(shape: StrokeShape): DrawingTrajectory;
}
```

#### BrushFootprintGenerator

```typescript
class BrushFootprintGenerator {
  generateFootprints(
    trajectory: DrawingTrajectory,
    contour: StrokeContour,
    numFootprints?: number,
  ): BrushFootprint[];

  setInitialMinorAxis(value: number): void;
}
```

#### StrokeAnimator

```typescript
class StrokeAnimator {
  constructor(canvas: HTMLCanvasElement);

  setTrajectory(trajectory: DrawingTrajectory): void;
  setRenderConfig(config: Partial<RenderConfig>): void;
  setSpeed(speed: number): void;

  play(): void;
  pause(): void;
  reset(): void;
  clear(): void;

  getAnimationState(): AnimationState;
  destroy(): void;
}
```

## ⚠️ 注意事项

### 实验性功能

此模块为实验性质，API可能会在未来版本中发生变化。

### 性能建议

- 建议足迹数量控制在 50-100 个
- 复杂笔画可能需要更多处理时间
- 大画布尺寸会影响渲染性能

### 最佳实践

1. **简单笔画** - 最适合流畅、连续的笔画
2. **清晰轮廓** - 确保笔画轮廓清晰可辨
3. **合理采样** - 根据笔画复杂度调整足迹数量
4. **渐进式调整** - 先用默认参数，再根据效果调整

## 📚 更多信息

- 详细文档：`packages/core/src/experimental/stroke-animation/README.md`
- 论文参考：Yang, L., Xu, T., & Wu, E. (2016). Animating Strokes in Drawing Process of Chinese Ink Painting.

## 🐛 问题反馈

如遇到问题，请检查：

1. ✅ Core 包是否已重新编译
2. ✅ Playground 依赖是否已更新
3. ✅ 浏览器控制台是否有错误信息

## 🎯 下一步计划

未来可能的改进方向：

- [ ] 支持更复杂的笔画形状
- [ ] 物理模拟的墨色扩散效果
- [ ] 更多笔法识别（如飞白、泼墨）
- [ ] 性能优化（WebGL渲染）
- [ ] 批量处理多个笔画
- [ ] 导出为视频功能

---

**Happy Coding! 🎨**
