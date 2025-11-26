/**
 * shuimo-core
 *
 * A TypeScript library for procedural Chinese landscape painting generation
 *
 * @packageDocumentation
 */

// Foundation exports
export * from './foundation';

// Renderer exports (excluding types that conflict with foundation)
export { Renderer, RenderContext } from './renderer/renderer';
export { CanvasRenderer } from './renderer/canvas';
export { SVGRenderer } from './renderer/svg';
export { colorToCSS, colorToHex, hsvToRgb, rgbToHsv, lerpHue } from './renderer/types';

// Chunk renderer exports
export {
  Chunk,
  ChunkManager,
  ChunkRenderer,
  type IChunk,
  type ChunkGeneratorFn,
  type ChunkRendererOptions,
  type Viewport,
  type ChunkManagerState,
} from './renderer/chunk';

// Elements exports
export * from './elements';

// Scene exports
export * from './scene';
