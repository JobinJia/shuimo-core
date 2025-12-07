/**
 * WebGPU 渲染模块
 *
 * 提供基于 WebGPU 的高性能水墨画渲染能力
 */

// 统一渲染引擎
export { ShuimoEngine, TreeType } from './ShuimoEngine';
export type {
  ShuimoEngineOptions,
  PathPoint,
  StrokeOptions as EngineStrokeOptions,
  MountOptions as EngineMountOptions,
  WaterOptions as EngineWaterOptions,
  TreeOptions as EngineTreeOptions,
  BlobOptions as EngineBlobOptions,
  TextureOptions as EngineTextureOptions,
} from './ShuimoEngine';

// GPU 场景管理器
export { GPUSceneManager } from './GPUSceneManager';
export type { GPUChunk, GPUSceneState } from './GPUSceneManager';

// 新版渲染器（多边形填充）
export { ShuimoRenderer } from './ShuimoRenderer';
export type { RendererOptions } from './ShuimoRenderer';

// 墨水扩散引擎
export { InkDiffusionEngine } from './InkDiffusion';
export type { InkDiffusionParams } from './InkDiffusion';

// 笔触渲染器
export { StrokeRenderer, WidthFuncType } from './StrokeRenderer';
export type { StrokeOptions as GPUStrokeOptions } from './StrokeRenderer';

// 山峰渲染器
export { MountRenderer } from './MountRenderer';
export type { MountOptions } from './MountRenderer';

// 水面渲染器
export { WaterRenderer } from './WaterRenderer';
export type { WaterOptions as GPUWaterOptions } from './WaterRenderer';

// 树木渲染器
export { TreeRenderer } from './TreeRenderer';
export type { TreeOptions as GPUTreeOptions } from './TreeRenderer';

// 墨点渲染器
export { BlobRenderer } from './BlobRenderer';
export type { BlobOptions as GPUBlobOptions } from './BlobRenderer';

// 纹理渲染器（皴法）
export { TextureRenderer } from './TextureRenderer';
export type { TextureOptions as GPUTextureOptions, TextureRegion } from './TextureRenderer';
