/**
 * ChunkRenderer coordinates viewport-based rendering using chunks
 */

import type { IRenderer, RenderContext, DrawStyle, Transform } from '../../foundation/types';
import { ChunkManager } from './ChunkManager';
import type { ChunkGeneratorFn, ChunkRendererOptions, Viewport } from './types';

/**
 * ChunkRenderer provides an infinite scrolling canvas by dividing the scene into chunks.
 * It only renders chunks visible in the current viewport, enabling efficient rendering
 * of very large or infinite scenes.
 */
export class ChunkRenderer {
  private manager: ChunkManager;
  private renderer: IRenderer;
  private viewport: Viewport;
  private enableCaching: boolean;
  private preloadDistance: number;
  private scrollX: number;
  private defaultStyle: DrawStyle;
  private defaultTransform: Transform;

  /**
   * Creates a new ChunkRenderer
   * @param renderer - The base renderer (Canvas or SVG)
   * @param generator - Function to generate elements for each chunk
   * @param options - Configuration options
   */
  constructor(
    renderer: IRenderer,
    generator: ChunkGeneratorFn,
    options: ChunkRendererOptions
  ) {
    this.renderer = renderer;
    this.enableCaching = options.enableCaching ?? false;
    this.preloadDistance = options.preloadDistance ?? 1;
    this.scrollX = 0;

    // Initialize viewport
    this.viewport = {
      x: 0,
      y: 0,
      width: renderer.width,
      height: options.viewportHeight,
    };

    // Initialize ChunkManager
    this.manager = new ChunkManager(
      generator,
      options.chunkWidth ?? 512,
      options.viewportHeight,
      options.maxCachedChunks ?? 10,
      options.seed ?? Date.now()
    );

    // Default style and transform
    this.defaultStyle = {
      strokeColor: { r: 0, g: 0, b: 0 },
      strokeWidth: 1,
      opacity: 1,
    };

    this.defaultTransform = {
      translate: { x: 0, y: 0 },
      rotate: 0,
      scale: { x: 1, y: 1 },
    };
  }

  /**
   * Set the horizontal scroll position
   * This determines which chunks are visible
   * @param x - New X position (can be positive or negative for infinite scrolling)
   */
  public setScrollPosition(x: number): void {
    this.scrollX = x;
    this.viewport.x = x;
  }

  /**
   * Get the current scroll position
   */
  public getScrollPosition(): number {
    return this.scrollX;
  }

  /**
   * Render the current viewport
   * This renders all visible chunks and optionally preloads nearby chunks
   */
  public renderViewport(): void {
    // Clear the renderer
    this.renderer.clear();

    // Get visible chunks
    const visibleChunks = this.manager.getVisibleChunks(this.viewport);

    // Preload nearby chunks (doesn't render them, just generates)
    if (this.preloadDistance > 0) {
      this.manager.preloadChunks(this.viewport, this.preloadDistance);
    }

    // Save renderer state
    this.renderer.save();

    // Apply viewport translation (scroll offset)
    this.renderer.translate(-this.viewport.x, 0);

    // Render each visible chunk
    for (const chunk of visibleChunks) {
      this.renderChunk(chunk);
    }

    // Restore renderer state
    this.renderer.restore();
  }

  /**
   * Render a single chunk
   * @param chunk - The chunk to render
   */
  private renderChunk(chunk: any): void {
    // Create render context for this chunk
    const context: RenderContext = {
      renderer: this.renderer,
      style: { ...this.defaultStyle },
      transform: { ...this.defaultTransform },
    };

    // Render the chunk
    chunk.render(context, this.enableCaching);
  }

  /**
   * Update viewport dimensions (e.g., on window resize)
   * @param width - New viewport width
   * @param height - New viewport height
   */
  public updateViewport(width: number, height: number): void {
    this.viewport.width = width;
    this.viewport.height = height;
  }

  /**
   * Scroll by a relative amount
   * @param deltaX - Amount to scroll horizontally
   */
  public scroll(deltaX: number): void {
    this.setScrollPosition(this.scrollX + deltaX);
  }

  /**
   * Get a chunk at a specific index
   * Useful for debugging or direct manipulation
   */
  public getChunk(index: number): any {
    return this.manager.getChunk(index);
  }

  /**
   * Check if a chunk exists at the given index
   */
  public hasChunk(index: number): boolean {
    return this.manager.hasChunk(index);
  }

  /**
   * Clear all chunks and reset
   */
  public clear(): void {
    this.manager.clear();
    this.renderer.clear();
    this.scrollX = 0;
    this.viewport.x = 0;
  }

  /**
   * Update the chunk generator function
   * This will clear all existing chunks
   */
  public setGenerator(generator: ChunkGeneratorFn): void {
    this.manager.setGenerator(generator);
  }

  /**
   * Get current viewport
   */
  public getViewport(): Viewport {
    return { ...this.viewport };
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats() {
    return this.manager.getMemoryStats();
  }

  /**
   * Get the chunk width
   */
  public getChunkWidth(): number {
    return this.manager.getChunkWidth();
  }

  /**
   * Convert screen coordinates to world coordinates
   * @param screenX - Screen X coordinate
   * @param screenY - Screen Y coordinate
   */
  public screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.viewport.x,
      y: screenY + this.viewport.y,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   * @param worldX - World X coordinate
   * @param worldY - World Y coordinate
   */
  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.viewport.x,
      y: worldY - this.viewport.y,
    };
  }

  /**
   * Get the underlying renderer
   */
  public getRenderer(): IRenderer {
    return this.renderer;
  }

  /**
   * Export the current viewport to a specific format
   */
  public async export(format: 'png' | 'jpeg' | 'svg' | 'data-url'): Promise<string | Blob> {
    return this.renderer.export(format);
  }
}
