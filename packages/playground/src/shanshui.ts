/**
 * Shanshui Generator - Uses @shuimo/core to generate traditional Chinese landscape
 */

import { SceneManager, prng, overrideMathRandom } from '@shuimo/core';

// Initialize Math.random override
overrideMathRandom();

// Global scene manager instance
let sceneManager: SceneManager | null = null;
let currentSeed: number = Date.now();
let lastX: number = 0;

/**
 * Initialize or reset the scene manager with a new seed
 */
export function initScene(seed: number, windx: number = 3000, windy: number = 800) {
  // Set PRNG seed
  prng.seed(seed);
  currentSeed = seed;
  lastX = 0;

  // Create new scene manager
  sceneManager = new SceneManager(windx, windy, 512);
  return sceneManager;
}

/**
 * Generate shanshui SVG for a given viewport position
 */
export function generateShanshui(currentX: number, seed: number): string {
  // Re-initialize if seed changed
  if (!sceneManager || seed !== currentSeed) {
    initScene(seed);
  }

  if (!sceneManager) {
    return '';
  }

  // Calculate scroll delta and update position
  const delta = currentX - lastX;
  lastX = currentX;

  // scroll() internally calls update() when needed
  if (delta !== 0) {
    sceneManager.scroll(delta);
  } else {
    // For initial render or when position hasn't changed
    sceneManager.update();
  }

  // Get the rendered SVG
  return sceneManager.getSVG();
}

/**
 * Get current scene statistics
 */
export function getSceneStats() {
  return sceneManager?.getStats() || {
    chunkCount: 0,
    xmin: 0,
    xmax: 0,
    viewport: { x: 0, y: 0, width: 0, height: 0 }
  };
}
