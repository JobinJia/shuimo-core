/**
 * 笔画轨迹估算模块
 * 基于论文第3节的方法实现
 */

import { Vector2 } from '../../foundation/geometry/Vector2'
import type { StrokeContour, StrokeShape, DrawingTrajectory, StrokeEndType } from './types'

/**
 * 笔画轨迹估算器
 */
export class StrokeTrajectoryEstimator {
  /**
   * 从笔画形状估算绘画轨迹
   */
  estimateTrajectory(shape: StrokeShape): DrawingTrajectory {
    const { contour } = shape

    // 1. 将轮廓分割为两侧
    const { side1, side2, startPoint, endPoint } = this.splitContour(contour)

    // 2. 使用Bézier曲线拟合两侧轮廓
    const curve1 = this.fitBezierCurve(side1)
    const curve2 = this.fitBezierCurve(side2)

    // 3. 提取中轴线
    const medialAxis = this.extractMedialAxis(curve1, curve2)

    // 4. 检测端点类型并调整轨迹
    const startType = this.detectEndpointType(contour, startPoint)
    const endType = this.detectEndpointType(contour, endPoint)

    const trajectoryPoints = this.adjustTrajectory(
      medialAxis,
      startType,
      endType,
      side1,
      side2
    )

    // 5. 使用三次Bézier曲线平滑轨迹
    const smoothedPoints = this.smoothTrajectory(trajectoryPoints)

    return {
      points: smoothedPoints,
      footprints: [], // 将在BrushFootprint模块中生成
      startPoint: smoothedPoints[0],
      endPoint: smoothedPoints[smoothedPoints.length - 1]
    }
  }

  /**
   * 分割轮廓为两侧
   * 论文 3.2.1 节
   */
  private splitContour(contour: StrokeContour): {
    side1: Vector2[]
    side2: Vector2[]
    startPoint: Vector2
    endPoint: Vector2
  } {
    const { points, startIndex, endIndex } = contour
    const n = points.length

    // 将轮廓分为两侧
    const side1: Vector2[] = []
    const side2: Vector2[] = []

    // 从起点到终点的一侧
    for (let i = startIndex; i !== endIndex; i = (i + 1) % n) {
      side1.push(points[i])
    }
    side1.push(points[endIndex])

    // 从终点到起点的另一侧
    for (let i = endIndex; i !== startIndex; i = (i + 1) % n) {
      side2.push(points[i])
    }
    side2.push(points[startIndex])

    return {
      side1,
      side2,
      startPoint: points[startIndex],
      endPoint: points[endIndex]
    }
  }

  /**
   * 使用Bézier曲线拟合点序列
   * 使用最小二乘法优化
   */
  private fitBezierCurve(points: Vector2[]): Vector2[] {
    if (points.length < 4) return points

    const result: Vector2[] = []
    const segmentSize = 10 // 每段包含的采样点数

    for (let i = 0; i < points.length - 1; i += segmentSize) {
      const endIdx = Math.min(i + segmentSize, points.length - 1)
      const segment = points.slice(i, endIdx + 1)

      if (segment.length >= 4) {
        const bezierPoints = this.fitCubicBezier(segment)
        result.push(...bezierPoints)
      } else {
        result.push(...segment)
      }
    }

    return result
  }

  /**
   * 拟合三次Bézier曲线
   */
  private fitCubicBezier(points: Vector2[], samples: number = 10): Vector2[] {
    if (points.length < 2) return points

    const p0 = points[0]
    const p3 = points[points.length - 1]

    // 简化实现：使用线性插值估计控制点
    const p1 = Vector2.lerp(p0, points[Math.floor(points.length / 3)], 1.5)
    const p2 = Vector2.lerp(p3, points[Math.floor(points.length * 2 / 3)], 1.5)

    const result: Vector2[] = []
    for (let i = 0; i <= samples; i++) {
      const t = i / samples
      result.push(this.cubicBezier(p0, p1, p2, p3, t))
    }

    return result
  }

  /**
   * 计算三次Bézier曲线上的点
   */
  private cubicBezier(
    p0: Vector2,
    p1: Vector2,
    p2: Vector2,
    p3: Vector2,
    t: number
  ): Vector2 {
    const t2 = t * t
    const t3 = t2 * t
    const mt = 1 - t
    const mt2 = mt * mt
    const mt3 = mt2 * mt

    const x = mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x
    const y = mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y

    return new Vector2(x, y)
  }

  /**
   * 提取中轴线
   * 论文 3.2.1 节中点检测
   */
  private extractMedialAxis(curve1: Vector2[], curve2: Vector2[]): Vector2[] {
    const minLen = Math.min(curve1.length, curve2.length)
    const medialAxis: Vector2[] = []

    for (let i = 0; i < minLen; i++) {
      const p1 = curve1[i]
      const p2 = curve2[Math.floor((i / curve1.length) * curve2.length)]
      // 计算中点
      medialAxis.push(new Vector2((p1.x + p2.x) / 2, (p1.y + p2.y) / 2))
    }

    return medialAxis
  }

  /**
   * 检测端点类型
   * 论文 3.2.2 节
   */
  private detectEndpointType(contour: StrokeContour, point: Vector2): StrokeEndType {
    // 简化实现：通过局部曲率判断
    // 高曲率 -> 锋利端点，低曲率 -> 平滑端点
    const { points } = contour
    const idx = points.findIndex(p => p.distance(point) < 1)

    if (idx < 0 || idx >= points.length) return 'sharp' as StrokeEndType

    const range = 5
    const startIdx = Math.max(0, idx - range)
    const endIdx = Math.min(points.length - 1, idx + range)

    // 计算局部方向变化
    let totalAngleChange = 0
    for (let i = startIdx; i < endIdx - 1; i++) {
      const v1 = points[i + 1].sub(points[i])
      const v2 = points[i + 2].sub(points[i + 1])
      const angle = Math.abs(Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x))
      totalAngleChange += angle
    }

    const avgAngleChange = totalAngleChange / (endIdx - startIdx)

    // 阈值判断
    return avgAngleChange > 0.3 ? ('sharp' as StrokeEndType) : ('smooth' as StrokeEndType)
  }

  /**
   * 调整轨迹端点
   * 论文 3.2.2 节
   */
  private adjustTrajectory(
    medialAxis: Vector2[],
    startType: StrokeEndType,
    endType: StrokeEndType,
    side1: Vector2[],
    side2: Vector2[]
  ): Vector2[] {
    const result = [...medialAxis]

    // 对于平滑端点，需要截取部分中轴
    if (startType === ('smooth' as StrokeEndType)) {
      // 找到最长椭圆内轮廓片段的中心作为起点
      const adjustedStart = this.findOptimalStartPoint(medialAxis, side1, side2)
      const startIdx = medialAxis.findIndex(p => p.distance(adjustedStart) < 5)
      if (startIdx > 0) {
        result.splice(0, startIdx)
      }
    }

    if (endType === ('smooth' as StrokeEndType)) {
      // 找到最长椭圆内轮廓片段的中心作为终点
      const adjustedEnd = this.findOptimalEndPoint(medialAxis, side1, side2)
      const endIdx = medialAxis.findIndex(p => p.distance(adjustedEnd) < 5)
      if (endIdx > 0 && endIdx < medialAxis.length) {
        result.splice(endIdx + 1)
      }
    }

    return result
  }

  /**
   * 找到最优起点（平滑端点情况）
   */
  private findOptimalStartPoint(
    medialAxis: Vector2[],
    side1: Vector2[],
    side2: Vector2[]
  ): Vector2 {
    let maxLength = 0
    let bestPoint = medialAxis[0]

    // 检查前几个点
    for (let i = 0; i < Math.min(10, medialAxis.length); i++) {
      const center = medialAxis[i]
      const length = this.calculateContourLengthInEllipse(center, side1, side2)
      if (length > maxLength) {
        maxLength = length
        bestPoint = center
      }
    }

    return bestPoint
  }

  /**
   * 找到最优终点（平滑端点情况）
   */
  private findOptimalEndPoint(
    medialAxis: Vector2[],
    side1: Vector2[],
    side2: Vector2[]
  ): Vector2 {
    let maxLength = 0
    let bestPoint = medialAxis[medialAxis.length - 1]

    // 检查后几个点
    for (let i = Math.max(0, medialAxis.length - 10); i < medialAxis.length; i++) {
      const center = medialAxis[i]
      const length = this.calculateContourLengthInEllipse(center, side1, side2)
      if (length > maxLength) {
        maxLength = length
        bestPoint = center
      }
    }

    return bestPoint
  }

  /**
   * 计算椭圆内轮廓片段的长度
   */
  private calculateContourLengthInEllipse(
    center: Vector2,
    side1: Vector2[],
    side2: Vector2[]
  ): number {
    // 简化：计算附近点的总长度
    const radius = 20
    let length = 0

    for (let i = 0; i < side1.length - 1; i++) {
      if (side1[i].distance(center) < radius) {
        length += side1[i].distance(side1[i + 1])
      }
    }

    return length
  }

  /**
   * 平滑轨迹
   * 使用三次Bézier曲线
   */
  private smoothTrajectory(points: Vector2[]): Vector2[] {
    if (points.length < 4) return points

    return this.fitCubicBezier(points, points.length * 2)
  }
}
