/**
 * Tests for chunk-based rendering system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Chunk } from '../../src/renderer/chunk/Chunk';
import { ChunkManager } from '../../src/renderer/chunk/ChunkManager';
import { ChunkRenderer } from '../../src/renderer/chunk/ChunkRenderer';
import type { IElement, RenderContext, BoundingBox } from '../../src/foundation/types';
import { CanvasRenderer } from '../../src/renderer/canvas';

// Mock element for testing
class MockElement implements IElement {
  public readonly id: string;
  public readonly type = 'mock';
  public readonly bounds: BoundingBox;

  constructor(id: string, x: number, y: number, width: number = 50, height: number = 50) {
    this.id = id;
    this.bounds = { x, y, width, height };
  }

  render(_context: RenderContext): void {
    // Mock render - does nothing
  }

  clone(): IElement {
    return new MockElement(this.id, this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
  }

  getBounds(): BoundingBox {
    return { ...this.bounds };
  }
}

describe('Chunk', () => {
  it('should create a chunk with correct properties', () => {
    const chunk = new Chunk(0, 0, 512, 800, 12345);

    expect(chunk.index).toBe(0);
    expect(chunk.x).toBe(0);
    expect(chunk.width).toBe(512);
    expect(chunk.seed).toBe(12345);
    expect(chunk.rendered).toBe(false);
    expect(chunk.elements).toHaveLength(0);
  });

  it('should generate correct id', () => {
    const chunk = new Chunk(5, 2560, 512, 800, 12345);
    expect(chunk.id).toBe('chunk-5-12345');
  });

  it('should have correct bounds', () => {
    const chunk = new Chunk(2, 1024, 512, 800, 12345);
    expect(chunk.bounds).toEqual({
      x: 1024,
      y: 0,
      width: 512,
      height: 800,
    });
  });

  it('should add elements and sort by y-coordinate', () => {
    const chunk = new Chunk(0, 0, 512, 800, 12345);

    const element1 = new MockElement('e1', 100, 300);
    const element2 = new MockElement('e2', 200, 100);
    const element3 = new MockElement('e3', 150, 200);

    chunk.addElement(element1);
    chunk.addElement(element2);
    chunk.addElement(element3);

    expect(chunk.elements).toHaveLength(3);
    // Should be sorted by y: e2(100), e3(200), e1(300)
    expect(chunk.elements[0].id).toBe('e2');
    expect(chunk.elements[1].id).toBe('e3');
    expect(chunk.elements[2].id).toBe('e1');
  });

  it('should remove elements by id', () => {
    const chunk = new Chunk(0, 0, 512, 800, 12345);

    const element1 = new MockElement('e1', 100, 300);
    const element2 = new MockElement('e2', 200, 100);

    chunk.addElement(element1);
    chunk.addElement(element2);

    expect(chunk.removeElement('e1')).toBe(true);
    expect(chunk.elements).toHaveLength(1);
    expect(chunk.elements[0].id).toBe('e2');
  });

  it('should return false when removing non-existent element', () => {
    const chunk = new Chunk(0, 0, 512, 800, 12345);
    expect(chunk.removeElement('nonexistent')).toBe(false);
  });

  it('should check if point is contained', () => {
    const chunk = new Chunk(0, 1024, 512, 800, 12345);

    expect(chunk.containsPoint(1200, 400)).toBe(true);
    expect(chunk.containsPoint(1024, 0)).toBe(true);
    expect(chunk.containsPoint(1535, 799)).toBe(true);

    expect(chunk.containsPoint(1000, 400)).toBe(false); // Before chunk
    expect(chunk.containsPoint(1600, 400)).toBe(false); // After chunk
    expect(chunk.containsPoint(1200, 900)).toBe(false); // Below chunk
  });

  it('should check intersection with bounding box', () => {
    const chunk = new Chunk(0, 1024, 512, 800, 12345);

    // Viewport fully contains chunk
    expect(chunk.intersects({ x: 0, y: 0, width: 2000, height: 800 })).toBe(true);

    // Viewport partially overlaps chunk
    expect(chunk.intersects({ x: 1200, y: 0, width: 500, height: 800 })).toBe(true);

    // Viewport completely before chunk
    expect(chunk.intersects({ x: 0, y: 0, width: 1000, height: 800 })).toBe(false);

    // Viewport completely after chunk
    expect(chunk.intersects({ x: 2000, y: 0, width: 500, height: 800 })).toBe(false);
  });

  it('should clear cache', () => {
    const chunk = new Chunk(0, 0, 512, 800, 12345);
    chunk.cachedSVG = '<svg>test</svg>';
    chunk.clearCache();
    expect(chunk.cachedSVG).toBeUndefined();
  });
});

describe('ChunkManager', () => {
  let generator: (xOffset: number, seed: number) => IElement[];

  beforeEach(() => {
    generator = (xOffset: number, seed: number) => {
      // Generate 3 mock elements per chunk
      return [
        new MockElement(`e-${xOffset}-1`, xOffset + 100, 200),
        new MockElement(`e-${xOffset}-2`, xOffset + 200, 300),
        new MockElement(`e-${xOffset}-3`, xOffset + 300, 400),
      ];
    };
  });

  it('should create a chunk manager', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);
    expect(manager.getChunkWidth()).toBe(512);
    expect(manager.getBaseSeed()).toBe(12345);
  });

  it('should generate chunks on demand', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);

    const chunk0 = manager.getChunk(0);
    expect(chunk0.index).toBe(0);
    expect(chunk0.x).toBe(0);
    expect(chunk0.elements).toHaveLength(3);

    const chunk1 = manager.getChunk(1);
    expect(chunk1.index).toBe(1);
    expect(chunk1.x).toBe(512);
    expect(chunk1.elements).toHaveLength(3);
  });

  it('should return same chunk instance for same index', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);

    const chunk1 = manager.getChunk(0);
    const chunk2 = manager.getChunk(0);

    expect(chunk1).toBe(chunk2);
  });

  it('should get visible chunks for viewport', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);

    const viewport = { x: 500, y: 0, width: 1000, height: 800 };
    const visibleChunks = manager.getVisibleChunks(viewport);

    // Viewport spans from x=500 to x=1500
    // Should include chunks at indices 0, 1, 2
    expect(visibleChunks.length).toBeGreaterThanOrEqual(2);
    expect(visibleChunks.length).toBeLessThanOrEqual(3);
  });

  it('should preload chunks near viewport', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);

    const viewport = { x: 1024, y: 0, width: 512, height: 800 };
    manager.preloadChunks(viewport, 2);

    // Should have chunks 0, 1, 2, 3, 4 (visible chunk 2 + 2 on each side)
    expect(manager.hasChunk(0)).toBe(true);
    expect(manager.hasChunk(1)).toBe(true);
    expect(manager.hasChunk(2)).toBe(true);
    expect(manager.hasChunk(3)).toBe(true);
    expect(manager.hasChunk(4)).toBe(true);
  });

  it('should enforce cache limit with LRU eviction', () => {
    const manager = new ChunkManager(generator, 512, 800, 3, 12345); // Max 3 chunks

    // Generate 5 chunks
    manager.getChunk(0);
    manager.getChunk(1);
    manager.getChunk(2);
    manager.getChunk(3);
    manager.getChunk(4);

    const stats = manager.getMemoryStats();
    expect(stats.chunkCount).toBeLessThanOrEqual(3);
  });

  it('should clear all chunks', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);

    manager.getChunk(0);
    manager.getChunk(1);
    manager.getChunk(2);

    manager.clear();

    const stats = manager.getMemoryStats();
    expect(stats.chunkCount).toBe(0);
  });

  it('should update generator and clear chunks', () => {
    const manager = new ChunkManager(generator, 512, 800, 10, 12345);

    manager.getChunk(0);
    expect(manager.hasChunk(0)).toBe(true);

    const newGenerator = (xOffset: number, seed: number) => [];
    manager.setGenerator(newGenerator);

    expect(manager.hasChunk(0)).toBe(false);
  });
});

describe.skip('ChunkRenderer', () => {
  // Skip ChunkRenderer tests in Node environment as they require real Canvas
  // These tests should be run in a browser environment with proper Canvas support

  let canvas: HTMLCanvasElement;
  let renderer: CanvasRenderer;
  let generator: (xOffset: number, seed: number) => IElement[];

  beforeEach(() => {
    // Create a canvas for testing
    if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 800;
    } else {
      // Skip canvas tests in non-browser environment
      return;
    }

    renderer = new CanvasRenderer(canvas);

    generator = (xOffset: number, seed: number) => {
      return [
        new MockElement(`e-${xOffset}-1`, xOffset + 100, 200),
        new MockElement(`e-${xOffset}-2`, xOffset + 200, 300),
      ];
    };
  });

  it('should create a chunk renderer', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
      maxCachedChunks: 10,
      seed: 12345,
    });

    expect(chunkRenderer.getChunkWidth()).toBe(512);
    expect(chunkRenderer.getScrollPosition()).toBe(0);
  });

  it('should update scroll position', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
    });

    chunkRenderer.setScrollPosition(1000);
    expect(chunkRenderer.getScrollPosition()).toBe(1000);
  });

  it('should scroll by relative amount', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
    });

    chunkRenderer.scroll(500);
    expect(chunkRenderer.getScrollPosition()).toBe(500);

    chunkRenderer.scroll(300);
    expect(chunkRenderer.getScrollPosition()).toBe(800);
  });

  it('should convert screen to world coordinates', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
    });

    chunkRenderer.setScrollPosition(1000);

    const world = chunkRenderer.screenToWorld(100, 200);
    expect(world.x).toBe(1100); // 100 + 1000 scroll
    expect(world.y).toBe(200);
  });

  it('should convert world to screen coordinates', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
    });

    chunkRenderer.setScrollPosition(1000);

    const screen = chunkRenderer.worldToScreen(1500, 300);
    expect(screen.x).toBe(500); // 1500 - 1000 scroll
    expect(screen.y).toBe(300);
  });

  it('should update viewport dimensions', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
    });

    chunkRenderer.updateViewport(1200, 900);

    const viewport = chunkRenderer.getViewport();
    expect(viewport.width).toBe(1200);
    expect(viewport.height).toBe(900);
  });

  it('should clear all chunks', () => {
    if (typeof document === 'undefined') return;

    const chunkRenderer = new ChunkRenderer(renderer, generator, {
      chunkWidth: 512,
      viewportHeight: 800,
    });

    chunkRenderer.setScrollPosition(1000);
    chunkRenderer.getChunk(0);
    chunkRenderer.getChunk(1);

    chunkRenderer.clear();

    expect(chunkRenderer.getScrollPosition()).toBe(0);
    expect(chunkRenderer.hasChunk(0)).toBe(false);
  });
});
