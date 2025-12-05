/**
 * 笔画动画模块 - 实验性功能
 * 基于论文: "Animating Strokes in Drawing Process of Chinese Ink Painting"
 * Yang Lijie, Xu Tianchen, Wu Enhua (2016)
 *
 * 功能：
 * 1. 从笔画形状估算绘画轨迹
 * 2. 生成毛笔足迹序列
 * 3. 动画化展示绘画过程
 */

export * from './types'
export { StrokeTrajectoryEstimator } from './StrokeTrajectory'
export { BrushFootprintGenerator } from './BrushFootprint'
export { StrokeAnimator } from './StrokeAnimator'
export { ContourExtractor } from './ContourExtractor'

// 导入用于类型注解
import { StrokeTrajectoryEstimator } from './StrokeTrajectory'
import { BrushFootprintGenerator } from './BrushFootprint'
import { StrokeAnimator } from './StrokeAnimator'
import { ContourExtractor } from './ContourExtractor'
import type { StrokeShape, DrawingTrajectory } from './types'

/**
 * 快捷工具类 - 集成完整流程
 */
export class StrokeAnimation {
  private trajectoryEstimator: StrokeTrajectoryEstimator
  private footprintGenerator: BrushFootprintGenerator
  private animator: StrokeAnimator | null = null

  constructor(canvas?: HTMLCanvasElement) {
    this.trajectoryEstimator = new StrokeTrajectoryEstimator()
    this.footprintGenerator = new BrushFootprintGenerator()

    if (canvas) {
      this.animator = new StrokeAnimator(canvas)
    }
  }

  /**
   * 从笔画形状创建完整的动画
   */
  async createAnimation(
    shape: StrokeShape,
    numFootprints: number = 50
  ): Promise<DrawingTrajectory> {
    // 1. 估算轨迹
    const trajectory = this.trajectoryEstimator.estimateTrajectory(shape)

    // 2. 生成足迹
    const footprints = this.footprintGenerator.generateFootprints(
      trajectory,
      shape.contour,
      numFootprints
    )

    // 3. 更新轨迹的足迹数据
    trajectory.footprints = footprints

    // 4. 设置到动画器
    if (this.animator) {
      this.animator.setTrajectory(trajectory)
    }

    return trajectory
  }

  /**
   * 设置动画器
   */
  setAnimator(canvas: HTMLCanvasElement): void {
    this.animator = new StrokeAnimator(canvas)
  }

  /**
   * 获取动画器
   */
  getAnimator(): StrokeAnimator | null {
    return this.animator
  }

  /**
   * 获取轨迹估算器
   */
  getTrajectoryEstimator(): StrokeTrajectoryEstimator {
    return this.trajectoryEstimator
  }

  /**
   * 获取足迹生成器
   */
  getFootprintGenerator(): BrushFootprintGenerator {
    return this.footprintGenerator
  }
}
