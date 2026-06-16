/** 出枝/落花锚点，沿用旧 WinterPlum 的结构 */
export interface BranchPoint {
  x: number;
  y: number;
  angle: number;
  depth: number;
}

export type PetalStyle = "quanhua" | "diancuo";
export type Composition = "upright-s" | "diagonal";
export type FlyingWhitePreset = "strong" | "medium" | "none";

/** 默认纯水墨调色板与尺寸 */
export const DEFAULTS = {
  hei: 200,
  wid: 10,
  branches: 2,
  flowerDensity: 0.4,
  withBuds: true,
  /** 枝干浓墨 */
  col: "rgba(28,24,19,0.92)",
  /** 花瓣淡墨轮廓 */
  flowerColor: "rgba(125,117,107,1)",
  petalStyle: "quanhua" as PetalStyle,
  composition: "upright-s" as Composition,
  flyingWhite: "strong" as FlyingWhitePreset,
};

/** 飞白预设 → Brush.stroke 数值强度 (0-1)，数值实现时按目测微调 */
export const FLYING_WHITE_INTENSITY: Record<FlyingWhitePreset, number> = {
  strong: 0.7,
  medium: 0.4,
  none: 0,
};
