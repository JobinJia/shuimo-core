export { InkMount } from "./InkMount";
export { generateRidge } from "./RidgeGenerator";
export { generateCunFaStrokes } from "./CunFaEngine";
export { generateInkFill } from "./InkWashLayer";
export { generateMist } from "./MistLayer";
export { Canvas2DBackend } from "./renderer/Canvas2DBackend";
export type {
  InkMountOptions,
  InkMountLayerOptions,
  InkMountScene,
  MountainLayer,
  CunFaStroke,
  InkFill,
  MistRegion,
  QualityPreset,
  BackendType,
  RidgeOptions,
  CunFaOptions,
  MistOptions,
} from "./types";
export type { RenderBackend, RenderOutput } from "./renderer/types";
