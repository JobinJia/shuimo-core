/**
 * ChunkManager handles the lifecycle of chunks: generation, caching, and eviction
 */

import { Chunk } from './Chunk';
import type { ChunkGeneratorFn, ChunkManagerState, Viewport } from './types';

/**
 * ChunkManager generates chunks on-demand and manages their lifecycle.
 * It implements an LRU (Least Recently Used) cache to limit memory usage.
 */
export class ChunkManager {
  private chunks: Map<number, Chunk>;
  private chunkWidth: number;
  private viewportHeight: number;
  private maxCachedChunks: number;
  private baseSeed: number;
  private generatedRange: { min: number; max: number };
  private lruQueue: number[]; // Chunk indices in LRU order
  private generator: ChunkGeneratorFn;

  /**
   * Creates a new ChunkManager
   * @param generator - Function to generate elements for a chunk
   * @param chunkWidth - Width of each chunk (default: 512)
   * @param viewportHeight - Height of the viewport
   * @param maxCachedChunks - Maximum number of chunks to keep in memory (default: 10)
   * @param baseSeed - Base random seed for deterministic generation
   */
  constructor(
    generator: ChunkGeneratorFn,
    chunkWidth: number = 512,
    viewportHeight: number = 800,
    maxCachedChunks: number = 10,
    baseSeed: number = Date.now()
  ) {
    this.chunks = new Map();
    this.chunkWidth = chunkWidth;
    this.viewportHeight = viewportHeight;
    this.maxCachedChunks = maxCachedChunks;
    this.baseSeed = baseSeed;
    this.generator = generator;
    this.generatedRange = { min: 0, max: 0 };
    this.lruQueue = [];
  }

  /**
   * Get or generate a chunk at the given index
   * @param index - Chunk index
   * @returns The chunk at the given index
   */
  public getChunk(index: number): Chunk {
    // Check if chunk already exists
    let chunk = this.chunks.get(index);

    if (chunk) {
      // Update LRU: move to end (most recently used)
      this.updateLRU(index);
      return chunk;
    }

    // Generate new chunk
    chunk = this.generateChunk(index);
    this.chunks.set(index, chunk);
    this.lruQueue.push(index);

    // Update generated range
    const chunkX = index * this.chunkWidth;
    this.generatedRange.min = Math.min(this.generatedRange.min, chunkX);
    this.generatedRange.max = Math.max(this.generatedRange.max, chunkX + this.chunkWidth);

    // Enforce cache limit
    this.enforceCacheLimit();

    return chunk;
  }

  /**
   * Generate a new chunk at the given index
   */
  private generateChunk(index: number): Chunk {
    const x = index * this.chunkWidth;
    const seed = this.baseSeed + index;

    // Generate elements using the provided generator function
    const elements = this.generator(x, seed);

    return new Chunk(index, x, this.chunkWidth, this.viewportHeight, seed, elements);
  }

  /**
   * Get all chunks that intersect with the viewport
   * @param viewport - Current viewport
   * @returns Array of visible chunks
   */
  public getVisibleChunks(viewport: Viewport): Chunk[] {
    const startIndex = Math.floor(viewport.x / this.chunkWidth);
    const endIndex = Math.ceil((viewport.x + viewport.width) / this.chunkWidth);

    const visibleChunks: Chunk[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      const chunk = this.getChunk(i);
      if (chunk.intersects(viewport)) {
        visibleChunks.push(chunk);
      }
    }

    return visibleChunks;
  }

  /**
   * Preload chunks near the viewport
   * @param viewport - Current viewport
   * @param distance - Number of chunks to preload in each direction
   */
  public preloadChunks(viewport: Viewport, distance: number = 1): void {
    const startIndex = Math.floor(viewport.x / this.chunkWidth) - distance;
    const endIndex = Math.ceil((viewport.x + viewport.width) / this.chunkWidth) + distance;

    for (let i = startIndex; i <= endIndex; i++) {
      // This will generate chunks if they don't exist
      this.getChunk(i);
    }
  }

  /**
   * Update LRU queue: move index to end (most recently used)
   */
  private updateLRU(index: number): void {
    const pos = this.lruQueue.indexOf(index);
    if (pos !== -1) {
      this.lruQueue.splice(pos, 1);
    }
    this.lruQueue.push(index);
  }

  /**
   * Enforce cache size limit by evicting least recently used chunks
   */
  private enforceCacheLimit(): void {
    while (this.chunks.size > this.maxCachedChunks && this.lruQueue.length > 0) {
      const oldestIndex = this.lruQueue.shift();
      if (oldestIndex !== undefined) {
        const chunk = this.chunks.get(oldestIndex);
        if (chunk) {
          chunk.clearCache();
          this.chunks.delete(oldestIndex);
        }
      }
    }
  }

  /**
   * Check if a chunk at the given index exists
   */
  public hasChunk(index: number): boolean {
    return this.chunks.has(index);
  }

  /**
   * Clear all chunks
   */
  public clear(): void {
    for (const chunk of this.chunks.values()) {
      chunk.clearCache();
    }
    this.chunks.clear();
    this.lruQueue = [];
    this.generatedRange = { min: 0, max: 0 };
  }

  /**
   * Get current state (for debugging)
   */
  public getState(): ChunkManagerState {
    return {
      chunks: new Map(this.chunks),
      generatedRange: { ...this.generatedRange },
      viewport: { x: 0, y: 0, width: 0, height: 0 }, // Will be set by ChunkRenderer
    };
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): {
    chunkCount: number;
    totalMemory: number;
    averageMemoryPerChunk: number;
  } {
    let totalMemory = 0;
    for (const chunk of this.chunks.values()) {
      totalMemory += chunk.getMemoryUsage();
    }

    return {
      chunkCount: this.chunks.size,
      totalMemory,
      averageMemoryPerChunk: this.chunks.size > 0 ? totalMemory / this.chunks.size : 0,
    };
  }

  /**
   * Update the chunk generator function
   */
  public setGenerator(generator: ChunkGeneratorFn): void {
    this.generator = generator;
    // Clear existing chunks as they were generated with the old function
    this.clear();
  }

  /**
   * Get the chunk width
   */
  public getChunkWidth(): number {
    return this.chunkWidth;
  }

  /**
   * Get the base seed
   */
  public getBaseSeed(): number {
    return this.baseSeed;
  }
}
