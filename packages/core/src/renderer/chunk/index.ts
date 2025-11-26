/**
 * Chunk-based rendering for infinite scrolling
 *
 * This module provides efficient rendering of large or infinite scenes by dividing
 * them into fixed-width chunks that are generated and rendered on-demand.
 *
 * @example
 * ```typescript
 * import { ChunkRenderer } from '@shuimo/core';
 * import { CanvasRenderer } from '@shuimo/core';
 *
 * // Create a base renderer
 * const canvas = document.getElementById('canvas') as HTMLCanvasElement;
 * const renderer = new CanvasRenderer(canvas);
 *
 * // Define a chunk generator function
 * const generator = (xOffset: number, seed: number) => {
 *   const elements = [];
 *   // Generate elements for this chunk...
 *   return elements;
 * };
 *
 * // Create chunk renderer
 * const chunkRenderer = new ChunkRenderer(renderer, generator, {
 *   chunkWidth: 512,
 *   viewportHeight: 800,
 *   maxCachedChunks: 10,
 *   seed: 12345,
 *   enableCaching: true,
 *   preloadDistance: 1,
 * });
 *
 * // Render the viewport
 * chunkRenderer.renderViewport();
 *
 * // Handle scrolling
 * window.addEventListener('scroll', (e) => {
 *   chunkRenderer.setScrollPosition(window.scrollX);
 *   chunkRenderer.renderViewport();
 * });
 * ```
 */

export { Chunk } from './Chunk';
export { ChunkManager } from './ChunkManager';
export { ChunkRenderer } from './ChunkRenderer';
export type {
  Chunk as IChunk,
  ChunkGeneratorFn,
  ChunkRendererOptions,
  Viewport,
  ChunkManagerState,
} from './types';
