/**
 * Chunk-based rendering types for infinite scrolling
 *
 * This module provides types for managing and rendering large scenes in chunks,
 * enabling efficient infinite scrolling for panoramic views like Shanshui landscapes.
 */

import type { BoundingBox, IElement } from '../../foundation/types';

/**
 * A chunk represents a horizontal slice of a scene
 * Chunks are generated on-demand and cached for performance
 */
export interface Chunk {
  /** Unique identifier for the chunk */
  id: string;

  /** Horizontal index (0, 1, 2, ...) */
  index: number;

  /** X-position of the chunk's left edge */
  x: number;

  /** Width of the chunk (typically fixed, e.g., 512px) */
  width: number;

  /** Bounding box for the chunk */
  bounds: BoundingBox;

  /** Elements contained in this chunk, sorted by depth (y-coordinate) */
  elements: IElement[];

  /** Whether the chunk has been rendered at least once */
  rendered: boolean;

  /** Cached SVG string for quick re-rendering (optional) */
  cachedSVG?: string;

  /** Random seed used to generate this chunk (for reproducibility) */
  seed: number;
}

/**
 * Chunk generation function signature
 * Takes x-offset and seed, returns array of elements for that chunk
 */
export type ChunkGeneratorFn = (xOffset: number, seed: number) => IElement[];

/**
 * Options for configuring chunk rendering
 */
export interface ChunkRendererOptions {
  /** Width of each chunk in pixels (default: 512) */
  chunkWidth?: number;

  /** Maximum number of chunks to keep in memory (default: 10) */
  maxCachedChunks?: number;

  /** Viewport height in pixels */
  viewportHeight: number;

  /** Base random seed for chunk generation */
  seed?: number;

  /** Whether to enable SVG caching for chunks */
  enableCaching?: boolean;

  /** Preload chunks outside viewport (number of chunks, default: 1) */
  preloadDistance?: number;
}

/**
 * Viewport represents the visible area of the scene
 */
export interface Viewport {
  /** X-position of the left edge */
  x: number;

  /** Y-position of the top edge (usually 0) */
  y: number;

  /** Width of the viewport */
  width: number;

  /** Height of the viewport */
  height: number;
}

/**
 * Chunk manager state
 */
export interface ChunkManagerState {
  /** Currently loaded chunks (keyed by index) */
  chunks: Map<number, Chunk>;

  /** Range of x-coordinates that have been generated [xMin, xMax] */
  generatedRange: { min: number; max: number };

  /** Current viewport position */
  viewport: Viewport;
}
