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
  const { seed, type = "random", width = 600, height = 600, background = "none" } = options;

  // ============================================================================
  // Match Original Canvas Execution Flow
  // ============================================================================
  // Original flow (reference-code/flowers/main.js):
  // 1. Initialize PRNG with seed
  // 2. makeBG() calls paper({ col: PAPER_COL0, tex: 10, spr: 0 })
  // 3. paper({ col: PAPER_COL1 }) for visible background
  // 4. prng.random() <= 0.5 to decide plant type
  // 5. woody() or herbal() → genParams()
  // ============================================================================

  const finalSeed = seed !== undefined ? seed : new Date().getTime().toString();

  // Step 1: Set seed for PRNG
  prng.seed(finalSeed);
  resetNoise();
  seedPRNG(finalSeed);

  // Step 2: Simulate makeBG() - consume same randoms as Canvas version
  const PAPER_COL0: [number, number, number] = [0.98, 0.91, 0.74];
  generatePaperCanvas({
    col: PAPER_COL0,
    tex: 10,
    spr: 0,
    reso: 512,
  });

  // Create SVG container
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", width.toString());
  svg.setAttribute("height", height.toString());
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("xmlns", SVG_NS);

  // Step 3: Paper background (consume randoms to match Canvas flow)
  const PAPER_COL1: [number, number, number] = [1, 0.99, 0.9];

  // Must consume same randoms as original for PRNG consistency
  generatePaperCanvas({
    col: PAPER_COL1,
    tex: 20,
    spr: 1,
    reso: 512,
  });

  if (background === "paper") {
    // Use pure SVG paper (no Canvas/image dependency)
    const paperId = seed
      ? `paper-${seed.toString().replace(/[^a-zA-Z0-9]/g, "-")}`
      : `paper-${Date.now()}`;

    const { defs, rect } = createPureSVGPaper(paperId, width, height, {
      col: PAPER_COL1,
      tex: 20,
    });

    svg.appendChild(defs);
    svg.appendChild(rect);
  } else if (background !== "none") {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("width", width.toString());
    rect.setAttribute("height", height.toString());
    rect.setAttribute("fill", background);
    svg.appendChild(rect);
  }

  // Step 4: Determine plant type
  let plantType: "woody" | "herbal";
  if (type === "random") {
    plantType = prng.random() <= 0.5 ? "woody" : "herbal";
  } else {
    plantType = type;
  }

  // Step 5: Generate plant
  const layer =
    plantType === "woody" ? woody({ xof: 300, yof: 550 }) : herbal({ xof: 300, yof: 600 });

  // Apply border clipping (squircle shape)
  border(layer, squircle(0.98, 3));

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
