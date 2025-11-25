import type { Vec2, Color } from '../foundation/types';

/**
 * 颜色方案类型
 */
export enum ColorSchemeType {
  BLUE_MIST = 'blue-mist',           // 蓝色雾气（默认）
  TRADITIONAL_INK = 'traditional-ink', // 传统墨色
  AUTUMN = 'autumn',                  // 秋山红叶
  WINTER_SNOW = 'winter-snow',        // 冬山白雪
  CUSTOM = 'custom'                   // 自定义
}

/**
 * 颜色方案配置
 */
export interface ColorScheme {
  type: ColorSchemeType;
  farColor: Color;      // 远山色
  midColor: Color;      // 中山色
  nearColor: Color;     // 近山色
  shadowColor?: Color;  // 阴影色（可选）
}

/**
 * 山脉层配置
 */
export interface MountainLayer {
  baseHeight: number;       // 基础高度（相对于画布）
  noiseFrequency: number;   // 噪声频率（控制山峰密度）
  noiseAmplitude: number;   // 噪声振幅（控制高度起伏）
  fillColor: Color;         // 填充颜色
  opacity: number;          // 透明度 (0-1)
  strokeColor?: Color;      // 轮廓颜色（可选）
  strokeWidth?: number;     // 轮廓宽度
}

/**
 * 山脉参数配置
 */
export interface MountainParams {
  position: Vec2;           // 山脉基础位置
  width: number;            // 山脉宽度
  height: number;           // 最大高度
  layerCount: number;       // 层数（3-5 层）
  complexity: number;       // 复杂度 (0-1)
  seed?: number;            // 随机种子（可重现）
  colorScheme: ColorScheme; // 颜色方案
}

/**
 * 预设的颜色方案
 */
export const COLOR_SCHEMES: Record<ColorSchemeType, Omit<ColorScheme, 'type'>> = {
  [ColorSchemeType.BLUE_MIST]: {
    farColor: { r: 80, g: 100, b: 120, a: 0.3 },
    midColor: { r: 60, g: 80, b: 100, a: 0.5 },
    nearColor: { r: 40, g: 60, b: 80, a: 0.8 }
  },
  [ColorSchemeType.TRADITIONAL_INK]: {
    farColor: { r: 150, g: 150, b: 150, a: 0.3 },
    midColor: { r: 100, g: 100, b: 100, a: 0.5 },
    nearColor: { r: 50, g: 50, b: 50, a: 0.8 }
  },
  [ColorSchemeType.AUTUMN]: {
    farColor: { r: 150, g: 120, b: 80, a: 0.3 },
    midColor: { r: 120, g: 80, b: 50, a: 0.5 },
    nearColor: { r: 80, g: 50, b: 30, a: 0.8 }
  },
  [ColorSchemeType.WINTER_SNOW]: {
    farColor: { r: 200, g: 210, b: 220, a: 0.3 },
    midColor: { r: 180, g: 190, b: 200, a: 0.5 },
    nearColor: { r: 150, g: 160, b: 180, a: 0.8 }
  },
  [ColorSchemeType.CUSTOM]: {
    farColor: { r: 128, g: 128, b: 128, a: 0.3 },
    midColor: { r: 96, g: 96, b: 96, a: 0.5 },
    nearColor: { r: 64, g: 64, b: 64, a: 0.8 }
  }
};
