/**
 * Shanshui Generator - Uses @shuimo/core to generate traditional Chinese landscape
 */

import { SceneManager, prng, overrideMathRandom } from '@shuimo/core';

// Initialize Math.random override
overrideMathRandom();

// Global scene manager instance
let sceneManager: SceneManager | null = null;
let currentSeed: number = Date.now();

/**
 * Initialize or reset the scene manager with a new seed
 */
export function initScene(seed: number, windx: number = 3000, windy: number = 800) {
  // Set PRNG seed
  prng.seed(seed);
  currentSeed = seed;

  // Create new scene manager
  sceneManager = new SceneManager(windx, windy, 512);

  // Initial render
  sceneManager.update();

  return sceneManager;
}

/**
 * Generate shanshui SVG for a given viewport position
 * This triggers chunk loading and rendering when needed
 * Returns { svg: string, contentChanged: boolean } - contentChanged indicates if new chunks were generated
 */
export function generateShanshui(currentX: number, seed: number): { svg: string; contentChanged: boolean } {
  // Re-initialize if seed changed
  if (!sceneManager || seed !== currentSeed) {
    initScene(seed);
    const svg = sceneManager!.getSVG();
    sceneManager!.markContentClean();
    return { svg, contentChanged: true };
  }

  if (!sceneManager) {
    return { svg: '', contentChanged: false };
  }

  // Set viewport position and update if needed
  const state = sceneManager.getState();
  const delta = currentX - state.cursx;

  if (delta !== 0) {
    sceneManager.setViewportX(currentX);

    // Check if we need to load new chunks
    if (sceneManager.needUpdate()) {
      sceneManager.update();
    }
  }

  // Check if content actually changed (new chunks were generated)
  const contentChanged = sceneManager.isContentDirty();
  const svg = sceneManager.getSVG();

  if (contentChanged) {
    sceneManager.markContentClean();
  }

  return { svg, contentChanged };
}


/**
 * Get current scene statistics
 */
export function getSceneStats() {
  if (!sceneManager) {
    return {
      chunkCount: 0,
      xmin: 0,
      xmax: 0,
      cursx: 0
    };
  }

  const state = sceneManager.getState();
  return {
    chunkCount: state.chunks.length,
    xmin: state.xmin,
    xmax: state.xmax,
    cursx: state.cursx
  };
}
