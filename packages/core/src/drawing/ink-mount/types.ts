import type { Vector2 } from "../../foundation/geometry/Vector2";

export interface RidgeOptions {
  peakCount: number;
  sharpness: number;
  subRidgeCount: number;
  noiseOctaves: number;
}

export interface CunFaOptions {
  density: number;
  lengthRange: [number, number];
  pressureCurve: number[];
}

export interface MistOptions {
  opacity: number;
  frequency: number;
  coverage: number;
}

export type QualityPreset = "draft" | "normal" | "high";
export type BackendType = "canvas2d" | "auto";

export interface InkMountOptions {
  width: number;
  height: number;
  seed: number;
  layers?: number;
  quality?: QualityPreset;
  backend?: BackendType;
  ridge?: Partial<RidgeOptions>;
  cunfa?: Partial<CunFaOptions>;
  mist?: Partial<MistOptions>;
  ctx?: CanvasRenderingContext2D;
  onLayer?: (layer: MountainLayer, index: number) => void;
}

export interface InkMountLayerOptions {
  width: number;
  height: number;
  seed: number;
  depth: number;
  quality?: QualityPreset;
  backend?: BackendType;
  ridge?: Partial<RidgeOptions>;
  cunfa?: Partial<CunFaOptions>;
  ctx?: CanvasRenderingContext2D;
}

export interface MountainLayer {
  depth: number;
  ridgeLine: Vector2[];
  subRidges: Vector2[][];
  normals: Vector2[];
  bounds: { x: number; y: number; width: number; height: number };
}

export interface CunFaStroke {
  path: Vector2[];
  widths: number[];
  opacity: number;
}

export interface InkFill {
  gradient: { stop: number; opacity: number }[];
  splashes: Vector2[][];
  noiseSeed: number;
}

export interface MistRegion {
  contour: Vector2[];
  opacity: number;
  fadeRadius: number;
}

export interface InkMountScene {
  layers: MountainLayer[];
  strokes: CunFaStroke[][];
  fills: InkFill[];
  mists: MistRegion[];
  /** Optional foreground mist band over the painting's lower portion;
   *  drawn last so it visibly occludes near mountains. */
  foregroundMists?: MistRegion[];
  width: number;
  height: number;
}
