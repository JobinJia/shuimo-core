/**
 * 笔画动画渲染器
 * 基于论文第4.2节的渲染方法
 */

import type { BrushFootprint, DrawingTrajectory, AnimationState, RenderConfig } from './types'

/**
 * 笔画动画渲染器
 */
export class StrokeAnimator {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private trajectory: DrawingTrajectory | null = null
  private animationState: AnimationState
  private renderConfig: RenderConfig
  private animationFrameId: number | null = null
  private lastTimestamp: number = 0
  private strokeScale: number = 14 // 笔画粗细缩放因子

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2D context')
    }
    this.ctx = ctx

    this.animationState = {
      progress: 0,
      currentFootprintIndex: 0,
      isPlaying: false,
      speed: 30 // 足迹/秒
    }

    this.renderConfig = {
      showTrajectory: false,
      showFootprintBounds: false,
      diffusionStrength: 0.3,
      dryBrushStrength: 0.5
    }
  }

  /**
   * 设置轨迹数据
   */
  setTrajectory(trajectory: DrawingTrajectory): void {
    this.trajectory = trajectory
    this.reset()
  }

  /**
   * 设置渲染配置
   */
  setRenderConfig(config: Partial<RenderConfig>): void {
    this.renderConfig = { ...this.renderConfig, ...config }
  }

  /**
   * 设置动画速度
   */
  setSpeed(speed: number): void {
    this.animationState.speed = speed
  }

  /**
   * 设置笔画粗细缩放因子
   */
  setStrokeScale(scale: number): void {
    this.strokeScale = scale
  }

  /**
   * 开始播放动画
   */
  play(): void {
    if (!this.trajectory || this.animationState.isPlaying) return

    this.animationState.isPlaying = true
    this.lastTimestamp = performance.now()
    this.animate()
  }

  /**
   * 暂停动画
   */
  pause(): void {
    this.animationState.isPlaying = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  /**
   * 重置动画
   */
  reset(): void {
    this.pause()
    this.animationState.progress = 0
    this.animationState.currentFootprintIndex = 0
    this.clear()
  }

  /**
   * 清空画布
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * 动画循环
   */
  private animate = (): void => {
    if (!this.animationState.isPlaying || !this.trajectory) return

    const currentTime = performance.now()
    const deltaTime = (currentTime - this.lastTimestamp) / 1000 // 转换为秒
    this.lastTimestamp = currentTime

    // 更新进度
    const footprintsPerFrame = this.animationState.speed * deltaTime
    this.animationState.currentFootprintIndex += footprintsPerFrame

    const totalFootprints = this.trajectory.footprints.length

    if (this.animationState.currentFootprintIndex >= totalFootprints) {
      this.animationState.currentFootprintIndex = totalFootprints - 1
      this.animationState.progress = 1
      this.pause()
    } else {
      this.animationState.progress =
        this.animationState.currentFootprintIndex / Math.max(1, totalFootprints - 1)
    }

    // 渲染当前帧
    this.render()

    if (this.animationState.isPlaying) {
      this.animationFrameId = requestAnimationFrame(this.animate)
    }
  }

  /**
   * 渲染当前帧
   */
  private render(): void {
    if (!this.trajectory) return

    this.clear()

    // 渲染辅助线（如果启用）
    if (this.renderConfig.showTrajectory) {
      this.renderTrajectoryGuide()
    }

    // 渲染已经绘制的足迹
    const currentIndex = Math.floor(this.animationState.currentFootprintIndex)
    for (let i = 0; i <= currentIndex && i < this.trajectory.footprints.length; i++) {
      const footprint = this.trajectory.footprints[i]
      const alpha = this.calculateFootprintAlpha(i, currentIndex)
      this.renderFootprint(footprint, alpha)
    }
  }

  /**
   * 计算足迹透明度
   */
  private calculateFootprintAlpha(footprintIndex: number, currentIndex: number): number {
    // 最近的足迹可能还在扩散中
    const diff = currentIndex - footprintIndex
    if (diff < 3) {
      return 0.6 + 0.4 * (1 - diff / 3)
    }
    return 1.0
  }

  /**
   * 渲染单个足迹
   * 论文 4.2 节
   */
  private renderFootprint(footprint: BrushFootprint, alpha: number): void {
    const { center, majorAxis, minorAxis, angle, isSideTip, pressure = 1.0 } = footprint

    // 应用缩放因子
    const scaledMajorAxis = majorAxis * this.strokeScale
    const scaledMinorAxis = minorAxis * this.strokeScale

    this.ctx.save()

    // 移动到足迹中心
    this.ctx.translate(center.x, center.y)
    this.ctx.rotate(angle)

    // 绘制椭圆
    this.ctx.beginPath()
    this.ctx.ellipse(0, 0, scaledMajorAxis / 2, scaledMinorAxis / 2, 0, 0, Math.PI * 2)

    // 设置渲染样式
    if (isSideTip) {
      // 侧锋：不规则椭圆，墨色不均匀
      const gradient = this.ctx.createRadialGradient(
        -scaledMajorAxis / 4,
        0,
        0,
        0,
        0,
        scaledMajorAxis / 2
      )
      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha * pressure})`)
      gradient.addColorStop(0.7, `rgba(40, 40, 40, ${alpha * pressure * 0.6})`)
      gradient.addColorStop(1, `rgba(80, 80, 80, ${alpha * pressure * 0.2})`)
      this.ctx.fillStyle = gradient
    } else {
      // 中锋：规则椭圆，墨色均匀
      const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, scaledMajorAxis / 2)
      gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha * pressure})`)
      gradient.addColorStop(0.6, `rgba(20, 20, 20, ${alpha * pressure * 0.7})`)
      gradient.addColorStop(1, `rgba(100, 100, 100, ${alpha * pressure * 0.1})`)
      this.ctx.fillStyle = gradient
    }

    this.ctx.fill()

    // 添加干笔效果
    if (this.renderConfig.dryBrushStrength && this.renderConfig.dryBrushStrength > 0) {
      this.renderDryBrushEffect(scaledMajorAxis, scaledMinorAxis, alpha, pressure)
    }

    // 绘制边界（如果启用）
    if (this.renderConfig.showFootprintBounds) {
      this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'
      this.ctx.lineWidth = 1
      this.ctx.stroke()
    }

    this.ctx.restore()
  }

  /**
   * 渲染干笔效果
   */
  private renderDryBrushEffect(
    majorAxis: number,
    minorAxis: number,
    alpha: number,
    pressure: number
  ): void {
    const strength = this.renderConfig.dryBrushStrength || 0
    const numDots = Math.floor(20 * strength)

    for (let i = 0; i < numDots; i++) {
      const angle = Math.random() * Math.PI * 2
      const distance = Math.random() * majorAxis / 2
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance * (minorAxis / majorAxis)

      this.ctx.fillStyle = `rgba(60, 60, 60, ${alpha * pressure * 0.3 * Math.random()})`
      this.ctx.beginPath()
      this.ctx.arc(x, y, Math.random() * 2 + 0.5, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  /**
   * 渲染轨迹辅助线
   */
  private renderTrajectoryGuide(): void {
    if (!this.trajectory) return

    const { points } = this.trajectory

    this.ctx.save()
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 5])

    this.ctx.beginPath()
    this.ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y)
    }
    this.ctx.stroke()

    this.ctx.restore()
  }

  /**
   * 获取当前动画状态
   */
  getAnimationState(): AnimationState {
    return { ...this.animationState }
  }

  /**
   * 销毁动画器
   */
  destroy(): void {
    this.pause()
    this.clear()
  }
}
