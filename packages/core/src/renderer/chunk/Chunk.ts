/**
 * Chunk class for managing a horizontal slice of the scene
 */

import type { BoundingBox, IElement, RenderContext } from '../../foundation/types';
import type { Chunk as IChunk } from './types';

/**
 * A Chunk represents a fixed-width horizontal slice of an infinite scene.
 * Chunks are generated on-demand and can cache their rendered output.
 */
export class Chunk implements IChunk {
  public readonly id: string;
  public readonly index: number;
  public readonly x: number;
  public readonly width: number;
  public readonly bounds: BoundingBox;
  public readonly elements: IElement[];
  public rendered: boolean;
  public cachedSVG?: string;
  public readonly seed: number;

  /**
   * Creates a new Chunk
   * @param index - Horizontal chunk index (0, 1, 2, ...)
   * @param x - X-position of the chunk's left edge
   * @param width - Width of the chunk
   * @param height - Height of the chunk (typically viewport height)
   * @param seed - Random seed for this chunk
   * @param elements - Elements contained in this chunk
   */
  constructor(
    index: number,
    x: number,
    width: number,
    height: number,
    seed: number,
    elements: IElement[] = []
  ) {
    this.index = index;
    this.x = x;
    this.width = width;
    this.seed = seed;
    this.elements = elements;
    this.rendered = false;
    this.cachedSVG = undefined;

    // Generate unique ID
    this.id = `chunk-${index}-${seed}`;

    // Define bounding box
    this.bounds = {
      x,
      y: 0,
      width,
      height,
    };
  }

  /**
   * Add an element to this chunk
   * Elements are automatically sorted by y-coordinate (depth order)
   */
  public addElement(element: IElement): void {
    this.elements.push(element);
    this.sortElements();
    // Invalidate cache when elements change
    this.cachedSVG = undefined;
  }

  /**
   * Remove an element from this chunk by ID
   */
  public removeElement(elementId: string): boolean {
    const index = this.elements.findIndex((el) => el.id === elementId);
    if (index !== -1) {
      this.elements.splice(index, 1);
      // Invalidate cache when elements change
      this.cachedSVG = undefined;
      return true;
    }
    return false;
  }

  /**
   * Sort elements by y-coordinate (depth order)
   * Elements with lower y-coordinates are rendered first (background)
   */
  private sortElements(): void {
    this.elements.sort((a, b) => {
      const boundsA = a.getBounds();
      const boundsB = b.getBounds();
      return boundsA.y - boundsB.y;
    });
  }

  /**
   * Render all elements in this chunk
   * @param context - Render context
   * @param _enableCaching - Whether to cache the SVG output (reserved for future use)
   */
  public render(context: RenderContext, _enableCaching: boolean = false): void {
    // If we have cached SVG and caching is enabled, we could use it
    // For now, we'll just render all elements
    for (const element of this.elements) {
      element.render(context);
    }

    this.rendered = true;

    // Note: SVG caching would require access to the renderer's output
    // This would be handled at the ChunkRenderer level
  }

  /**
   * Check if a point is within this chunk
   */
  public containsPoint(x: number, y: number): boolean {
    return (
      x >= this.bounds.x &&
      x < this.bounds.x + this.bounds.width &&
      y >= this.bounds.y &&
      y < this.bounds.y + this.bounds.height
    );
  }

  /**
   * Check if this chunk intersects with a bounding box (e.g., viewport)
   */
  public intersects(box: BoundingBox): boolean {
    return !(
      this.bounds.x + this.bounds.width < box.x ||
      this.bounds.x > box.x + box.width ||
      this.bounds.y + this.bounds.height < box.y ||
      this.bounds.y > box.y + box.height
    );
  }

  /**
   * Clear cached data
   */
  public clearCache(): void {
    this.cachedSVG = undefined;
  }

  /**
   * Get memory usage estimate (for debugging)
   */
  public getMemoryUsage(): number {
    let size = 0;
    // Size of elements array
    size += this.elements.length * 100; // Rough estimate per element
    // Size of cached SVG
    if (this.cachedSVG) {
      size += this.cachedSVG.length * 2; // UTF-16 characters
    }
    return size;
  }
}
