/**
 * 笔画动画相关类型定义
 * 基于论文: "Animating Strokes in Drawing Process of Chinese Ink Painting"
 */

import { Vector2 } from '../../foundation/geometry/Vector2'

/**
 * 笔画轮廓数据
 */
export interface StrokeContour {
  /** 轮廓点序列 */
  points: Vector2[]
  /** 起点索引 */
  startIndex: number
  /** 终点索引 */
  endIndex: number
}

/**
 * 笔画形状描述
 */
export interface StrokeShape {
  /** 笔画图像数据 */
  imageData: ImageData
  /** 笔画轮廓 */
  contour: StrokeContour
  /** 笔画中轴线 */
  medialAxis?: Vector2[]
}

/**
 * 毛笔足迹参数
 */
export interface BrushFootprint {
  /** 中心位置 */
  center: Vector2
  /** 长轴长度 */
  majorAxis: number
  /** 短轴长度 */
  minorAxis: number
  /** 旋转角度(弧度) */
  angle: number
  /** 是否为侧锋 */
  isSideTip?: boolean
  /** 压力值 (0-1) */
  pressure?: number
}

/**
 * 绘画轨迹
 */
export interface DrawingTrajectory {
  /** 轨迹点序列 */
  points: Vector2[]
  /** 每个点对应的足迹 */
  footprints: BrushFootprint[]
  /** 轨迹起点 */
  startPoint: Vector2
  /** 轨迹终点 */
  endPoint: Vector2
}

/**
 * 笔画端点类型
 */
export enum StrokeEndType {
  /** 锋利的端点 */
  SHARP = 'sharp',
  /** 平滑的端点 */
  SMOOTH = 'smooth'
}

/**
 * 动画状态
 */
export interface AnimationState {
  /** 当前进度 (0-1) */
  progress: number
  /** 当前渲染的足迹索引 */
  currentFootprintIndex: number
  /** 是否正在播放 */
  isPlaying: boolean
  /** 动画速度 (足迹/秒) */
  speed: number
}

/**
 * 渲染配置
 */
export interface RenderConfig {
  /** 是否显示轨迹辅助线 */
  showTrajectory?: boolean
  /** 是否显示足迹边界 */
  showFootprintBounds?: boolean
  /** 扩散效果强度 (0-1) */
  diffusionStrength?: number
  /** 干笔效果强度 (0-1) */
  dryBrushStrength?: number
}
