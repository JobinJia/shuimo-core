# 笔画动画模块 - 实验性功能

基于论文 "Animating Strokes in Drawing Process of Chinese Ink Painting" (Yang Lijie, Xu Tianchen, Wu Enhua, 2016) 实现的中国水墨画笔画绘制动画系统。

## 功能概述

该模块实现了从静态笔画图像重建动态绘画过程的功能，包括：

1. **笔画轨迹估算** - 从笔画形状自动提取绘画轨迹
2. **毛笔足迹建模** - 模拟毛笔在宣纸上的瞬时足迹（支持中锋/侧锋）
3. **动画渲染** - 实时渲染笔画绘制动画，支持水墨效果

## 核心模块

### 1. StrokeTrajectoryEstimator (笔画轨迹估算器)

从笔画轮廓估算绘画轨迹：

```typescript
import { StrokeTrajectoryEstimator } from '@shuimo/core/experimental/stroke-animation'

const estimator = new StrokeTrajectoryEstimator()
const trajectory = estimator.estimateTrajectory(strokeShape)
```

**算法流程：**
- 轮廓分割：将笔画轮廓分为两侧
- 曲线拟合：使用Bézier曲线拟合轮廓
- 中轴提取：计算两侧轮廓的中轴线
- 端点检测：识别锋利/平滑端点并调整轨迹
- 轨迹平滑：使用三次Bézier曲线平滑结果

### 2. BrushFootprintGenerator (毛笔足迹生成器)

根据轨迹生成足迹序列：

```typescript
import { BrushFootprintGenerator } from '@shuimo/core/experimental/stroke-animation'

const generator = new BrushFootprintGenerator()
const footprints = generator.generateFootprints(trajectory, contour, 50)
```

**足迹参数：**
- `center` - 足迹中心位置
- `majorAxis` - 长轴（笔画宽度）
- `minorAxis` - 短轴（停留时间相关）
- `angle` - 旋转角度
- `isSideTip` - 是否为侧锋
- `pressure` - 压力值

### 3. StrokeAnimator (笔画动画渲染器)

实时渲染笔画绘制动画：

```typescript
import { StrokeAnimator } from '@shuimo/core/experimental/stroke-animation'

const animator = new StrokeAnimator(canvas)
animator.setTrajectory(trajectory)
animator.setSpeed(30) // 足迹/秒
animator.play()
```

**渲染特性：**
- 中锋/侧锋效果
- 干笔效果
- 墨色扩散
- 可配置的辅助显示（轨迹线、足迹边界）

## 完整使用示例

```typescript
import { Vector2 } from '@shuimo/core'
import {
  StrokeTrajectoryEstimator,
  BrushFootprintGenerator,
  StrokeAnimator,
  type StrokeShape,
  type StrokeContour
} from '@shuimo/core/experimental/stroke-animation'

// 1. 准备笔画数据
const strokeShape: StrokeShape = {
  imageData: /* 笔画图像数据 */,
  contour: {
    points: [/* Vector2 点序列 */],
    startIndex: 0,
    endIndex: points.length - 1
  }
}

// 2. 估算轨迹
const estimator = new StrokeTrajectoryEstimator()
const trajectory = estimator.estimateTrajectory(strokeShape)

// 3. 生成足迹
const generator = new BrushFootprintGenerator()
const footprints = generator.generateFootprints(
  trajectory,
  strokeShape.contour,
  50 // 足迹数量
)
trajectory.footprints = footprints

// 4. 创建动画
const canvas = document.getElementById('canvas') as HTMLCanvasElement
const animator = new StrokeAnimator(canvas)

// 5. 配置渲染
animator.setRenderConfig({
  showTrajectory: false,
  showFootprintBounds: false,
  dryBrushStrength: 0.5,
  diffusionStrength: 0.3
})

// 6. 播放动画
animator.setTrajectory(trajectory)
animator.setSpeed(30)
animator.play()

// 控制播放
animator.pause()
animator.reset()

// 获取状态
const state = animator.getAnimationState()
console.log(`Progress: ${state.progress * 100}%`)
```

## 快捷工具类

使用 `StrokeAnimation` 类可以简化流程：

```typescript
import { StrokeAnimation } from '@shuimo/core/experimental/stroke-animation'

const animation = new StrokeAnimation(canvas)

// 一键创建动画
await animation.createAnimation(strokeShape, 50)

// 获取动画器控制
const animator = animation.getAnimator()
animator?.play()
```

## Playground 演示

在项目中运行：

```bash
pnpm playground
```

然后访问 `/stroke-animation` 路由查看交互式演示：

- 在画布上绘制笔画
- 点击"生成动画"按钮
- 调整动画速度和渲染效果
- 播放/暂停/重置动画

## 技术细节

### 笔法识别

**中锋 (Center-tip)**
- 笔尖位于笔画中间
- 产生规则椭圆足迹
- 墨色均匀分布

**侧锋 (Side-tip)**
- 笔尖倾斜使用
- 产生不规则椭圆足迹
- 墨色不均匀，靠近一侧轮廓

### 轨迹质量控制

轨迹估算通过以下参数约束质量：

1. **足迹位置** - 沿轨迹均匀分布
2. **足迹大小** - 根据笔画宽度动态调整
3. **足迹方向** - 沿轨迹切线方向
4. **足迹形状** - 根据笔法（中锋/侧锋）调整

### 性能优化

- 使用Canvas 2D API进行实时渲染
- 支持GPU加速（通过Canvas硬件加速）
- 轨迹采样和足迹数量可配置
- 增量渲染，只绘制新增足迹

## 限制与注意事项

⚠️ **实验性功能警告**

此模块为实验性质，可能存在以下限制：

1. **简化实现** - 相比论文原文，部分算法进行了简化
2. **笔画形状** - 最适合简单、流畅的笔画，复杂形状可能效果不佳
3. **纹理采样** - 当前使用简化的墨色渲染，未实现完整的物理模拟
4. **性能** - 大量足迹可能影响性能，建议控制在50-100个

## API 稳定性

⚠️ API 可能会在未来版本中发生变化，请谨慎在生产环境使用。

## 参考文献

Yang, L., Xu, T., & Wu, E. (2016). Animating Strokes in Drawing Process of Chinese Ink Painting. Journal of Computer-Aided Design & Computer Graphics, 28(5), 742-749.

## 许可证

与主项目相同的许可证。
