/**
 * 毛笔足迹模型
 * 基于论文第4节的方法实现
 */

import { Vector2 } from '../../foundation/geometry/Vector2'
import type { BrushFootprint, DrawingTrajectory, StrokeContour } from './types'

/**
 * 毛笔足迹生成器
 */
export class BrushFootprintGenerator {
  private initialMinorAxis: number = 5 // 初始短轴长度

  /**
   * 从轨迹生成足迹序列
   * 论文 4.1 节
   */
  generateFootprints(
    trajectory: DrawingTrajectory,
    contour: StrokeContour,
    numFootprints: number = 50
  ): BrushFootprint[] {
    const footprints: BrushFootprint[] = []
    const { points } = trajectory

    if (points.length < 2) return footprints

    // 在轨迹上均匀采样点
    for (let i = 0; i < numFootprints; i++) {
      const t = i / (numFootprints - 1)
      const samplePoint = this.sampleTrajectory(points, t)

      // 计算足迹参数
      const center = samplePoint
      const angle = this.calculateOrientation(points, t)
      const majorAxis = this.calculateMajorAxis(center, contour, angle)
      const minorAxis = this.calculateMinorAxis(points, i, numFootprints)
      const isSideTip = this.detectSideTip(center, contour, angle, majorAxis)

      footprints.push({
        center,
        majorAxis,
        minorAxis,
        angle,
        isSideTip,
        pressure: 1.0 - Math.abs(t - 0.5) * 0.3 // 中间压力大
      })
    }

    return footprints
  }

  /**
   * 在轨迹上采样点
   */
  private sampleTrajectory(points: Vector2[], t: number): Vector2 {
    if (t <= 0) return points[0]
    if (t >= 1) return points[points.length - 1]

    // 计算累积弧长
    const lengths = [0]
    let totalLength = 0
    for (let i = 0; i < points.length - 1; i++) {
      totalLength += points[i].distance(points[i + 1])
      lengths.push(totalLength)
    }

    // 找到目标弧长位置
    const targetLength = totalLength * t
    for (let i = 0; i < lengths.length - 1; i++) {
      if (targetLength >= lengths[i] && targetLength <= lengths[i + 1]) {
        const segmentT = (targetLength - lengths[i]) / (lengths[i + 1] - lengths[i])
        return Vector2.lerp(points[i], points[i + 1], segmentT)
      }
    }

    return points[points.length - 1]
  }

  /**
   * 计算足迹方向
   * 论文 4.1 节第2点
   */
  private calculateOrientation(points: Vector2[], t: number): number {
    const idx = Math.floor(t * (points.length - 1))
    const nextIdx = Math.min(idx + 1, points.length - 1)

    if (idx === nextIdx) {
      if (idx > 0) {
        const dir = points[idx].sub(points[idx - 1])
        return Math.atan2(dir.y, dir.x) + Math.PI / 2
      }
      return 0
    }

    // 计算切线方向
    const tangent = points[nextIdx].sub(points[idx]).normalize()
    // 法线方向（逆时针旋转90度）
    return Math.atan2(tangent.y, tangent.x) + Math.PI / 2
  }

  /**
   * 计算长轴长度
   * 论文 4.1 节第3点
   */
  private calculateMajorAxis(
    center: Vector2,
    contour: StrokeContour,
    angle: number
  ): number {
    // 沿法线方向查找到轮廓两侧的距离
    const normal = new Vector2(Math.cos(angle), Math.sin(angle))

    let dist1 = 0
    let dist2 = 0

    // 向一侧查找
    for (let d = 1; d < 100; d++) {
      const testPoint = center.add(normal.multiply(d))
      if (this.isPointInContour(testPoint, contour)) {
        dist1 = d
      } else {
        break
      }
    }

    // 向另一侧查找
    for (let d = 1; d < 100; d++) {
      const testPoint = center.add(normal.multiply(-d))
      if (this.isPointInContour(testPoint, contour)) {
        dist2 = d
      } else {
        break
      }
    }

    return dist1 + dist2
  }

  /**
   * 计算短轴长度
   * 论文 4.1 节第4点
   */
  private calculateMinorAxis(
    points: Vector2[],
    currentIndex: number,
    totalFootprints: number
  ): number {
    // 根据相邻足迹的方向变化调整短轴长度
    let b = this.initialMinorAxis

    if (currentIndex > 0 && currentIndex < totalFootprints - 1) {
      const prevIdx = Math.floor(((currentIndex - 1) / (totalFootprints - 1)) * (points.length - 1))
      const currIdx = Math.floor((currentIndex / (totalFootprints - 1)) * (points.length - 1))
      const nextIdx = Math.floor(((currentIndex + 1) / (totalFootprints - 1)) * (points.length - 1))

      if (prevIdx < points.length && currIdx < points.length && nextIdx < points.length) {
        const v1 = points[currIdx].sub(points[prevIdx])
        const v2 = points[nextIdx].sub(points[currIdx])

        const angle1 = Math.atan2(v1.y, v1.x)
        const angle2 = Math.atan2(v2.y, v2.x)

        // 方向变化越大，短轴越长（表示停留时间长）
        let angleDiff = Math.abs(angle2 - angle1)
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff

        b = this.initialMinorAxis * (1 + angleDiff / Math.PI)
      }
    }

    return Math.max(b, this.initialMinorAxis)
  }

  /**
   * 检测是否为侧锋
   * 论文 4.1 节第3点
   */
  private detectSideTip(
    center: Vector2,
    contour: StrokeContour,
    angle: number,
    majorAxis: number
  ): boolean {
    // 检查中心点到两侧轮廓的距离是否不对称
    const normal = new Vector2(Math.cos(angle), Math.sin(angle))

    let dist1 = 0
    let dist2 = 0

    for (let d = 1; d < majorAxis / 2; d++) {
      const testPoint1 = center.add(normal.multiply(d))
      const testPoint2 = center.add(normal.multiply(-d))

      if (this.isPointInContour(testPoint1, contour)) dist1 = d
      if (this.isPointInContour(testPoint2, contour)) dist2 = d
    }

    // 如果距离差异大于阈值，认为是侧锋
    const asymmetry = Math.abs(dist1 - dist2) / Math.max(dist1, dist2, 1)
    return asymmetry > 0.3
  }

  /**
   * 检查点是否在轮廓内
   */
  private isPointInContour(point: Vector2, contour: StrokeContour): boolean {
    // 使用射线法判断点是否在多边形内
    const { points } = contour
    let inside = false

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x
      const yi = points[i].y
      const xj = points[j].x
      const yj = points[j].y

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

      if (intersect) inside = !inside
    }

    return inside
  }

  /**
   * 设置初始短轴长度
   */
  setInitialMinorAxis(value: number): void {
    this.initialMinorAxis = value
  }
}
