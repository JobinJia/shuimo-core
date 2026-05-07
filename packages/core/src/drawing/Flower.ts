/**
 * Flower Generator - Main Export
 * Procedurally generated paintings of non-existent flowers
 *
 * Migrated from Canvas to SVG implementation
 * Original: Nonflowers by Lingdong Huang (c) 2018
 * Reference: reference-code/flowers/main.js
 */

import type { FlowerOptions } from "./flower/types";
import { SVG_NS } from "./flower/types";
import { prng } from "../foundation/random";
import { seed as seedPRNG } from "./flower/FlowerPRNG";
import { resetNoise } from "./flower/FlowerNoise";
import { woody, herbal } from "./flower/FlowerComposer";
import { squircle } from "./flower/FlowerMath";
import { border } from "./flower/FlowerLayer";
import { createPureSVGPaper, generatePaperCanvas } from "./flower/FlowerPaper";

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate a procedural flower painting as SVG
 *
 * @param options - Configuration options
 * @returns SVG element containing the generated flower
 *
 * @example
 * ```typescript
 * // Generate random flower
 * const svg = generateFlower()
 * document.body.appendChild(svg)
 *
 * // Generate with specific seed
 * const svg = generateFlower({ seed: '12345' })
 *
 * // Generate woody plant
 * const svg = generateFlower({ type: 'woody', seed: 'my-seed' })
 * ```
 */
export function generateFlower(options: FlowerOptions = {}): SVGSVGElement {
  const { seed, type = "random", width = 600, height = 600, background = "none", fast = false } = options;

  const finalSeed = seed !== undefined ? seed : new Date().getTime().toString();

  // Step 1: Set seed for PRNG
  prng.seed(finalSeed);
  resetNoise();
  seedPRNG(finalSeed);

  // Create SVG container
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", width.toString());
  svg.setAttribute("height", height.toString());
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("xmlns", SVG_NS);

  // Paper background — skip entirely when background is 'none'.
  // The Canvas reference version (Nonflowers) always generates two paper textures
  // via makeBG() + paper(). Those calls consume PRNG state; skipping them means
  // the same seed produces a different plant than with background !== 'none'.
  // This is fine — mobile 'none' flower is its own seed space.
  if (background !== "none") {
    // makeBG() → paper({col: PAPER_COL0}) — 512×512 canvas, ~66k pixels × 2 noise calls
    const PAPER_COL0: [number, number, number] = [0.98, 0.91, 0.74];
    generatePaperCanvas({
      col: PAPER_COL0,
      tex: 10,
      spr: 0,
      reso: 512,
    });

    // paper({col: PAPER_COL1}) — second 512×512 canvas texture
    const PAPER_COL1: [number, number, number] = [1, 0.99, 0.9];
    generatePaperCanvas({
      col: PAPER_COL1,
      tex: 20,
      spr: 1,
      reso: 512,
    });

    if (background === "paper") {
      const paperId = seed
        ? `paper-${seed.toString().replace(/[^a-zA-Z0-9]/g, "-")}`
        : `paper-${Date.now()}`;

      const { defs, rect } = createPureSVGPaper(paperId, width, height, {
        col: PAPER_COL1,
        tex: 20,
      });

      svg.appendChild(defs);
      svg.appendChild(rect);
    } else {
      // Solid color background
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("width", width.toString());
      rect.setAttribute("height", height.toString());
      rect.setAttribute("fill", background);
      svg.appendChild(rect);
    }
  }

  // Step 4: Determine plant type
  let plantType: "woody" | "herbal";
  if (type === "random") {
    plantType = prng.random() <= 0.5 ? "woody" : "herbal";
  } else {
    plantType = type;
  }

  // Step 5: Generate plant
  const xof = width / 2;
  const yof = height;
  const layer =
    plantType === "woody"
      ? woody({ xof, yof, fast })
      : herbal({ xof, yof, fast });

  // Squircle border: clones layer (50k+ nodes) and calls getBBox(). Skip in fast mode.
  if (!fast) {
    border(layer, squircle(0.98, 3));
  }

  // Add layer to SVG
  svg.appendChild(layer.group);

  return svg;
}

// ============================================================================
// Re-export utilities for advanced usage
// ============================================================================

export { woody, herbal } from "./flower/FlowerComposer";
export { genParams } from "./flower/FlowerParams";
export { leaf, stem, branch } from "./flower/FlowerPlant";
export type { FlowerOptions, FlowerParams } from "./flower/types";
