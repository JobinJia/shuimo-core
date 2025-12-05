/**
 * 笔画轮廓提取器
 * 从笔画图像中提取轮廓
 */

import { Vector2 } from '../../foundation/geometry/Vector2'
import type { StrokeContour } from './types'

/**
 * 轮廓提取器
 */
export class ContourExtractor {
  /**
   * 从ImageData中提取笔画轮廓
   * 使用边界跟踪算法
   */
  extractContour(imageData: ImageData): StrokeContour | null {
    const { width, height, data } = imageData

    // 1. 二值化图像
    const binary = this.binarize(data, width, height)

    // 2. 查找边界起点
    const startPoint = this.findBoundaryStart(binary, width, height)
    if (!startPoint) return null

    // 3. 边界跟踪
    const contourPoints = this.traceBoundary(binary, width, height, startPoint)
    if (contourPoints.length < 3) return null

    // 4. 简化轮廓（减少点数）
    const simplified = this.simplifyContour(contourPoints, 2.0)

    // 5. 找到起点和终点索引
    const { startIndex, endIndex } = this.findEndpoints(simplified)

    return {
      points: simplified,
      startIndex,
      endIndex
    }
  }

  /**
   * 二值化图像
   */
  private binarize(data: Uint8ClampedArray, width: number, height: number): boolean[] {
    const binary = new Array(width * height).fill(false)
    const threshold = 128

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4
        const alpha = data[idx + 3]
        // 有内容的像素（透明度大于阈值）
        if (alpha > threshold) {
          binary[y * width + x] = true
        }
      }
    }

    return binary
  }

  /**
   * 查找边界起点
   */
  private findBoundaryStart(
    binary: boolean[],
    width: number,
    height: number
  ): { x: number; y: number } | null {
    // 从左上角开始扫描，找到第一个边界点
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (binary[y * width + x]) {
          // 检查是否为边界点（至少有一个邻居是背景）
          if (this.isBoundaryPoint(binary, width, height, x, y)) {
            return { x, y }
          }
        }
      }
    }
    return null
  }

  /**
   * 检查是否为边界点
   */
  private isBoundaryPoint(
    binary: boolean[],
    width: number,
    height: number,
    x: number,
    y: number
  ): boolean {
    // 8邻域检查
    const dirs = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1]
    ]

    for (const [dx, dy] of dirs) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return true
      if (!binary[ny * width + nx]) return true
    }

    return false
  }

  /**
   * 边界跟踪算法（Moore邻域跟踪）
   */
  private traceBoundary(
    binary: boolean[],
    width: number,
    height: number,
    start: { x: number; y: number }
  ): Vector2[] {
    const contour: Vector2[] = []
    const visited = new Set<string>()

    // 8邻域方向（顺时针）
    const dirs = [
      [0, -1], [1, -1], [1, 0], [1, 1],
      [0, 1], [-1, 1], [-1, 0], [-1, -1]
    ]

    let current = start
    let direction = 0 // 初始方向
    let firstMove = true

    while (true) {
      const key = `${current.x},${current.y}`
      if (!firstMove && current.x === start.x && current.y === start.y) {
        break // 回到起点，完成追踪
      }

      if (!visited.has(key)) {
        contour.push(new Vector2(current.x, current.y))
        visited.add(key)
      }

      // 查找下一个边界点
      let found = false
      for (let i = 0; i < 8; i++) {
        const checkDir = (direction + i) % 8
        const [dx, dy] = dirs[checkDir]
        const nx = current.x + dx
        const ny = current.y + dy

        if (
          nx >= 0 && nx < width &&
          ny >= 0 && ny < height &&
          binary[ny * width + nx]
        ) {
          current = { x: nx, y: ny }
          direction = (checkDir + 6) % 8 // 调整搜索方向
          found = true
          firstMove = false
          break
        }
      }

      if (!found) break
      if (contour.length > width * height) break // 防止无限循环
    }

    return contour
  }

  /**
   * 简化轮廓（Douglas-Peucker算法）
   */
  private simplifyContour(points: Vector2[], tolerance: number): Vector2[] {
    if (points.length <= 2) return points

    const douglasPeucker = (pts: Vector2[], epsilon: number): Vector2[] => {
      if (pts.length <= 2) return pts

      // 找到距离首尾连线最远的点
      let maxDist = 0
      let maxIndex = 0
      const start = pts[0]
      const end = pts[pts.length - 1]

      for (let i = 1; i < pts.length - 1; i++) {
        const dist = this.pointToLineDistance(pts[i], start, end)
        if (dist > maxDist) {
          maxDist = dist
          maxIndex = i
        }
      }

      // 如果最大距离大于阈值，递归简化
      if (maxDist > epsilon) {
        const left = douglasPeucker(pts.slice(0, maxIndex + 1), epsilon)
        const right = douglasPeucker(pts.slice(maxIndex), epsilon)
        return [...left.slice(0, -1), ...right]
      } else {
        return [start, end]
      }
    }

    return douglasPeucker(points, tolerance)
  }

  /**
   * 点到直线的距离
   */
  private pointToLineDistance(point: Vector2, lineStart: Vector2, lineEnd: Vector2): number {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    const lengthSquared = dx * dx + dy * dy

    if (lengthSquared === 0) {
      return point.distance(lineStart)
    }

    const t = Math.max(
      0,
      Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSquared)
    )

    const projection = new Vector2(lineStart.x + t * dx, lineStart.y + t * dy)
    return point.distance(projection)
  }

  /**
   * 找到笔画的起点和终点索引
   * 基于笔画两端的形状特征
   */
  private findEndpoints(points: Vector2[]): { startIndex: number; endIndex: number } {
    if (points.length < 4) {
      return { startIndex: 0, endIndex: points.length - 1 }
    }

    // 简化：找到距离最远的两个点作为端点
    let maxDist = 0
    let startIndex = 0
    let endIndex = 0

    for (let i = 0; i < points.length; i++) {
      for (let j = i + Math.floor(points.length / 4); j < points.length; j++) {
        const dist = points[i].distance(points[j])
        if (dist > maxDist) {
          maxDist = dist
          startIndex = i
          endIndex = j
        }
      }
    }

    return { startIndex, endIndex }
  }
}
